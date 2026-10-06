import { simulateLeagueGame } from '@/entities/league/model/leagueDay'
import { rotationSlotOf } from '@/entities/pitcher-career/model/pitcherRotation'
import type { RandomPort } from '@/shared/api/random/randomPort'
import {
  endNationalCupDay,
  nationalCupMatchupOf,
  otherMatchOf,
  recordNationalCupResult,
} from '@/entities/national-cup/model/nationalCup'
import type { NationalCup } from '@/entities/national-cup/model/nationalCup'

/**
 * 국가대항전 경기 진행 — CPU 끼리의 같은 라운드 둘째 경기(`0xc2dac`)와 하루 넘기기.
 * 근거: `docs/re/_raw/notes/P5-national-match.md` "CPU 끼리 국가대항전 경기" 절 (확정).
 */

/**
 * 국가대항전 CPU 경기의 선발 칸 — **양 팀 모두 상대국 슬롯 레코드의 0번**이고, 그 0번은 대회 첫날이면 마스터 0번,
 * 그 뒤로는 **늘 마스터 1번**이다 (직접 떴다).
 *
 * ```
 * 준비 0xc2c4c (c2c8e~c2ce4) : state[0x2e+1] = state[0x2e+0] = (L+0x32) % 4 = k
 *      c2d18~c2d40          : 0xb8c94(팀객체0, 0, k) · 0xb8c94(팀객체1, 0, k)   ; → 0xb5e98(레코드, 0, k, 1) 맞바꿈
 * 레코드 0xb8680 → 0x1f570 : 대회 중(S+0x12c) 팀 10 이 아니면 **모두 base+0x934** (1f596~1f5a2)
 * ```
 * CPU 경기의 두 나라(11~13)는 늘 10 이 아니어서 두 팀 객체가 **같은 레코드**를 가리킨다 → 같은 k 로 두 번 맞바꿔
 * 제자리로 돌아온다. 그 레코드는 하루 끝 `0xb818c`(b8216)·대회 초기화(b7ca4)가 `0x20648` 로 **그날 사람 경기 상대**를
 * 마스터에서 새로 복사한 것이고, 같은 날 사람 경기 준비 `0x6548`(670e~673e)이 g = L+0x32 ≠ 0 이면 한 번 돌린다
 * (0xb8c80 → 0xb5ca8, 사람 경기의 `opponentDayCounter` 와 같은 셈). CPU 경기(결과 장면 0x4ea0c 4f25c)는 그 뒤다.
 */
export function nationalCupStartingPitcherIndex(cup: NationalCup): number {
  return rotationSlotOf(cup.day === 0 ? 0 : 1)
}

export interface NationalCupGameResult {
  readonly winner: number
  readonly loser: number
  /** 칸 1(= `a`, 말 공격) 의 점수 */
  readonly firstSlotRuns: number
  /** 칸 0(= `b`, 초 공격) 의 점수 */
  readonly secondSlotRuns: number
}

/**
 * CPU 끼리 한 경기 `0xc2dac(sim, 모드, L, a, b)` — 결과 장면 `0x4ea0c` 가 `a = 0xb7614(L,n,2)`, `b = (L,n,3)` 으로 부른다.
 *
 * 준비 `0xc2c4c` 는 `a` 를 **칸 1**(c2cb6), `b` 를 칸 0(c2cee)의 팀 번호로 두고, 팀 객체 둘은 c2d06·c2d14 에서
 * `0xb891c(객체0, 모드, a)`·`(객체1, 모드, b)` 로 세운다(칸·명단 엇갈림 — `cpuGameSidesOf`). 그런데 대회 중 선수 레코드
 * `0x1f570` 은 두 나라 모두 상대국 슬롯 `base+0x934` 이므로 **양 팀이 그날 사람 경기 상대국의 선수로 똑같이 선다**
 * (`rosterTeam`). 스태미나도 그 레코드 하나를 같이 깎는다(`sharedRoster`). 굴림·마선수·구장은 없다(`state+0x30 = 0xff`).
 * ```
 * score(칸1) > score(칸0) ? (a 승, b 패) : (b 승, a 패)      (0xc2f12~0xc2f46)
 * ```
 * 칸 1 은 말 공격이다 — 명단이 같으니 **나중에 공격한 쪽이 더 내면 a 승**, 동점이면 `b` 승.
 *
 * **스태미나도 그 레코드 하나다** (4d09e39): 같은 날 사람 경기가 상대국 레코드(`base+0x934`)의 투수 스태미나 `+0x2c` 를
 * 이미 깎아 두었으므로, CPU 경기는 **사람 경기가 끝났을 때의 상대 투수 칸별 값**에서 선다(`startingStaminas`).
 * 그 레코드는 다음 날 하루 끝 `0xb818c`(b8216)의 `0x20648` 이 마스터에서 새로 복사하므로 CPU 경기의 끝 값은 이어지지 않는다.
 * 안 넘기면 모두 10000 이다(사람 경기 쪽이 아직 끝 값을 넘기지 않는 길).
 */
export function playCpuNationalCupGame(
  a: number,
  b: number,
  /** 두 팀이 같이 쓰는 선수 레코드의 팀 — 그날 사람 경기 상대국 (`base+0x934`) */
  rosterTeam: number,
  random: RandomPort,
  /** 양 팀 공통 선발 칸 — `nationalCupStartingPitcherIndex(cup)` */
  startingPitcherSlot: number,
  /** 그날 사람 경기가 끝났을 때 상대국 레코드의 투수 칸별 스태미나 `+0x2c` (두 팀이 같이 쓴다). 안 넘기면 10000 */
  startingStaminas?: readonly number[],
): NationalCupGameResult {
  const score = simulateLeagueGame(
    { away: rosterTeam, home: rosterTeam },
    random,
    startingPitcherSlot,
    // 레코드가 하나라 한 표만 넘기면 된다 — `sharedRoster` 면 away 표를 두 팀이 같이 쓴다
    startingStaminas === undefined ? undefined : { away: startingStaminas },
    { sharedRoster: true },
  )
  // 칸 1(a, 말) 이 더 많이 냈을 때만 a 승 — 동점이면 b 승이다 (원본 그대로)
  const winner = score.homeRuns > score.awayRuns ? a : b
  const loser = winner === a ? b : a
  return { winner, loser, firstSlotRuns: score.homeRuns, secondSlotRuns: score.awayRuns }
}

/**
 * 사람 경기가 끝난 뒤 하루를 넘긴다 — 결과 장면 `0x4ea0c`/`0x4f216~0x4f266`/`0x4f29a` 차례 그대로다.
 *
 * ```
 * ① 사람 경기 승패를 대회 전적에 넣는다 (0xb76dc / 0xb77e0)
 * ② L+0xad > 1 (풀리그 날) 이면 같은 라운드 둘째 경기를 0xc2dad 로 한 판 돌려 기록한다
 * ③ 0xb818d(L) 하루 끝 — 단계를 줄이고, 단계가 1 이 되면 결승 두 팀을 정한다
 * ```
 * 결승 날(단계 1)에는 ② 가 없다.
 */
export function advanceNationalCupDay(
  cup: NationalCup,
  humanWinner: number,
  humanLoser: number,
  random: RandomPort,
  /**
   * 그날 사람 경기가 끝났을 때 **상대국 투수 칸별 스태미나** `+0x2c` — 상대국 슬롯 레코드(`base+0x934`)에 남은 값.
   * 같은 날 CPU 경기의 두 나라가 이 레코드를 그대로 쓴다. 안 넘기면 10000 에서 선다.
   */
  opponentPitcherStaminas?: readonly number[],
): NationalCup {
  const afterHuman = recordNationalCupResult(cup, humanWinner, humanLoser)

  const other = otherMatchOf(afterHuman)
  const afterCpu =
    other === null
      ? afterHuman
      : (() => {
          // 두 나라 모두 그날 사람 경기 상대국 슬롯(+0x934)의 선수로 선다 — 그 레코드의 0번이 양 팀 선발
          const rosterTeam = nationalCupMatchupOf(afterHuman)?.opponent ?? other[0]
          const result = playCpuNationalCupGame(
            other[0],
            other[1],
            rosterTeam,
            random,
            nationalCupStartingPitcherIndex(afterHuman),
            opponentPitcherStaminas,
          )
          return recordNationalCupResult(afterHuman, result.winner, result.loser)
        })()

  return endNationalCupDay(afterCpu)
}
