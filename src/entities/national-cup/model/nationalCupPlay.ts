import { simulateLeagueGame } from '@/entities/league/model/leagueDay'
import { STARTING_PITCHER_CANDIDATES } from '@/entities/team/model/teamRoster'
import type { RandomPort } from '@/shared/api/random/randomPort'
import {
  endNationalCupDay,
  otherMatchOf,
  recordNationalCupResult,
} from '@/entities/national-cup/model/nationalCup'
import type { NationalCup } from '@/entities/national-cup/model/nationalCup'

/**
 * 국가대항전 경기 진행 — CPU 끼리의 같은 라운드 둘째 경기(`0xc2dac`)와 하루 넘기기.
 * 근거: `docs/re/_raw/notes/P5-national-match.md` "CPU 끼리 국가대항전 경기" 절 (확정).
 */

/**
 * 국가대항전 선발 투수 칸 — 양 팀 모두 `L+0x32 % 4` 번째 투수다 (`0xb6c2d`).
 * 정규 경기(`0x3107a`)가 `rand(0,4)` 로 뽑는 것과 달리 **날짜로 정해진다** — 로테이션인 셈이다.
 *
 * ⚠️ 지금은 **이 값을 경기에 꽂을 자리가 없다.** 웹판 공용 시뮬 `simulateLeagueGame`
 * (`entities/league`)은 선발을 스스로 `rand(0,4)` 로 뽑고 선발 칸을 인자로 받지 않는데,
 * 그 파일은 이 작업의 담당 폴더 밖이라 손대지 않았다. `simulateLeagueGame` 이 선발 칸을 받게 되면
 * `playCpuNationalCupGame` 에서 이 값을 넘기면 된다 — 규칙 자체는 여기 그대로 남겨 둔다.
 */
export function nationalCupStartingPitcherIndex(cup: NationalCup): number {
  return cup.day % STARTING_PITCHER_CANDIDATES
}

export interface NationalCupGameResult {
  readonly winner: number
  readonly loser: number
  /** 칸 1(= `a`) 의 점수 */
  readonly firstSlotRuns: number
  /** 칸 0(= `b`) 의 점수 */
  readonly secondSlotRuns: number
}

/**
 * CPU 끼리 한 경기 `0xc2dac(sim, 모드, L, a, b)`.
 *
 * 준비 `0xc2c4c` 가 `a` 를 **칸 1**, `b` 를 **칸 0** 에 넣는다. 간이 타석 루프(`0xc262c`)를
 * 경기가 끝날 때까지 돌린 뒤
 * ```
 * score(칸1) > score(칸0) ? (a 승, b 패) : (b 승, a 패)      (0xc2f12~0xc2f46)
 * ```
 * 로 판정한다. **정규시즌 `0xc2a48` 의 뒤집힘 버그가 여기에는 없다** — 판정이 정상이고,
 * 동점이면 `b` 가 이긴다.
 *
 * 웹판은 포스트시즌(`playCpuSeriesGame`)과 같이 칸 1 을 선공(away)으로 두고
 * 정규 경기와 같은 타석 엔진(`simulateLeagueGame`)을 쓴다 — 원본도 같은 간이 타석 루프다.
 */
export function playCpuNationalCupGame(a: number, b: number, random: RandomPort): NationalCupGameResult {
  const score = simulateLeagueGame({ away: a, home: b }, random)
  // 칸 1(a) 이 더 많이 냈을 때만 a 승 — 동점이면 b 승이다 (원본 그대로)
  const winner = score.awayRuns > score.homeRuns ? a : b
  const loser = winner === a ? b : a
  return { winner, loser, firstSlotRuns: score.awayRuns, secondSlotRuns: score.homeRuns }
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
): NationalCup {
  const afterHuman = recordNationalCupResult(cup, humanWinner, humanLoser)

  const other = otherMatchOf(afterHuman)
  const afterCpu =
    other === null
      ? afterHuman
      : (() => {
          const result = playCpuNationalCupGame(other[0], other[1], random)
          return recordNationalCupResult(afterHuman, result.winner, result.loser)
        })()

  return endNationalCupDay(afterCpu)
}
