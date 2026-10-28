import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { strikeoutRecordIdsOf, laserThrowOutRecordOf, multiOutPlayRecordIdsOf, threePitchInningRecordIdsOf } from '@/entities/game/model/gameRecords'
import { withGameRecords } from '@/features/play-team-game/model/teamGameFlow/records/atBatRecords'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'
import type { TeamRecordTally } from '@/features/play-team-game/model/teamGameFlow/types/records'

/**
 * **우리 수비 타석 하나의 기록달성** — 사람 장면·간이 엔진 공통.
 *
 * - 16 삼구 삼진 · 17 풀카운트 삼진 — 삼진 처리 `0xa7c4c` (이 타석 투구 수 `ctx+0x161` == 3 · 볼 3).
 * - 18~20 삼진 콤보 · 21~23 한 투수 10/15/20삼진 — `0xa7998`, 우리 **현재** 투수의 R[1]·R[0].
 *   삼진 아닌 결과로 끝난 타석이면 R[1] = 0 (0xa8fb2~). 플레이 종류 4·5(견제·주자만)는 이 길로 안 온다.
 * - 25 삼구 삼자범퇴 — 아웃 처리 `0xa7d0c`: 반 이닝 투구 수(`ctx+0x16c`) == 3 이고 3아웃.
 * - 26·27 병살·삼중살 — 한 플레이 아웃 2·3 (`0xa8e58`). 낫아웃(state[0x1a])이면 2 의 26 을 막는다 (`droppedThirdStrike`).
 *
 * **삼진 + 도루 판(종류 5)** 은 판정 B 0xae3e8 이 정산을 **종류 5 로 한 번**만 부른다(ae5a8) — `stealPlayOuts` 가 그 판의 아웃이다.
 * 0xa8024 의 종류 4·5 거르기(직접 떴다): a8d38 `0xa57f8(0x18)` · 0xa7998(18~23) 를 건너뛰고 · a8fb6 R[1](연속 삼진) 0 지우기도
 * 건너뛴다 · 범타·삼진 갈래(a8a04 — 결과 링 · ctx+0x162 지우기)도 건너뛴다. 거르지 않는 칸: 0xa7c4c(16·17, R[0]·R[1] +1 —
 * 판 앞 0x3dfac 에서 이미 돌았다) · a8f8c R[3] += 이 정산의 아웃(삼진 이벤트 5 + 아웃 이벤트 0xd) · a8e58 병살·삼중살
 * (state[0x1a] 는 종류 9 낫아웃 칸이라 종류 5 에서는 0 — **삼진 + 도루 저지 둘이면 병살 26** 이다).
 * - 36 필살송구 아웃 — 레이저 연출이 끝난 뒤(+0x1999) 수비 화면 결과 팝업 0x46844 가 **결과 코드 0xd** 를 보이면
 *   state[0x8b] = 1 (46892~46932), 정산이 이 플레이 아웃 이벤트 > 0 이면 36 (0xa80f8~0xa8116).
 *   결과 코드 0xd 는 **타석 결과가 아니다** — 플레이 틱 b4540 에서 그 틱의 아웃 판정 vt90(0xb36d0)이 아웃을 내면
 *   곧바로 vt44(13)·vt54(13) 로 보내는 "아웃이 났다" 코드다(포스·태그·뜬공 포구 모두, `runDefensePlay` 의
 *   `runOutJudgement` 주석). 진행기가 결과 판을 그림마다 돌려 그 표시(`DefensePlayResult.laserOutFlag`)를 낸다 —
 *   레이저 연출 단계 3 이 +0x1998 · +0x1999 를 세운 뒤 +0x1997 이 0 인 채 코드 13 결과 판이 타이머 안에 있어야 서고,
 *   그 사이 다른 코드 판(세이프 9 등 — 보통 갈래)이 오면 지워져 안 선다. 앞 판에서 남은 +0x1999 로도 선다(`defenseScene`).
 * 상대 타석은 공격 팀이 사람이 아니라 백투백 카운터 `ctx+0x162` 를 0 으로 (0xa794c · 5-4).
 */
export function withOurDefenseRecords(
  progress: TeamGameProgress,
  play: {
    readonly outcome: AtBatOutcome
    readonly outsBefore: number
    readonly outsAdded: number
    /** 이 타석 투구 수 (`ctx+0x161`) */
    readonly atBatPitches: number
    /** 끝났을 때 볼 (`state[5]`) */
    readonly balls: number
    /** 반 이닝 투구 수 (`ctx+0x16c`) — 이 타석의 공까지 든 값 */
    readonly halfInningPitches: number
    /** state[0x8b] — 결과 판 큰 OUT 이 +0x1999 를 보고 세운 필살송구 아웃 표시 (`DefensePlayResult.laserOutFlag`) */
    readonly laserOutFlag: boolean
    /**
     * 이 삼진이 **도루 판(종류 5)과 한 정산**이면 그 판이 낸 아웃(도루 저지) — 판 쪽 진루는 부르는 쪽이 먼저 먹였다.
     * 안 주면 보통 정산이다.
     */
    readonly stealPlayOuts?: number
    /**
     * 이 삼진이 **폭투·포일 판(종류 9, 삼진 그대로)과 한 정산**이면 그 판이 낸 아웃 — 종류 9 는 거르기가 없어 보통 정산에
     * 사건만 더해진다(아웃 콜 0xa7d0c 가 그 판의 아웃마다 0xd 를 넣는다).
     */
    readonly wildPitchPlayOuts?: number
    /**
     * **낫아웃(state[0x1a])** — 0x3e09e 갈래가 삼진 콜 0xa7c4c(사건 5)를 부르고 state[0x1a] = 1 을 세운 뒤 타자주자 판을 돈다.
     * `outsAdded` 는 그 판의 아웃(아웃 콜 0xa7d0c 의 0xd)이다. 정산은 [sp+0x30] = 1 + 판의 아웃으로 세고, a8e5e 가 26 을 막고,
     * a8fa8 이 R[3] 을 −1 하고, a8fb6 이 R[1] 을 지운다
     */
    readonly droppedThirdStrike?: boolean
  },
): TeamGameProgress {
  const facts = defenseSettlementFactsOf(progress.recordTally, play)
  return withGameRecords({ ...progress, recordTally: tallyAfterDefense(progress.recordTally, facts) }, defenseRecordIdsOf(play, facts), false)
}

type DefensePlayRecord = Parameters<typeof withOurDefenseRecords>[1]

/** 정산 한 번이 보는 사실들 — 판정만 모은다 */
interface DefenseSettlementFacts {
  readonly strikeout: boolean
  /** 삼진 + 도루 판(종류 5)과 한 정산 */
  readonly runnerPlay: boolean
  readonly wildPitchOuts: number
  readonly droppedThirdStrike: boolean
  /** 이 정산의 아웃 [sp+0x30] — 삼진 이벤트 5 와 판의 아웃 이벤트 0xd 를 함께 센다 (낫아웃은 삼진 콜의 5 가 하나 더) */
  readonly outsInPlay: number
  /** 낫아웃이면 삼진 콜이 넣은 사건 5 하나 — 아웃 콜(0xa7d0c)이 아니라 state[6] 을 안 올린다 */
  readonly strikeoutCallEvent: number
  readonly moundStrikeouts: number
  /** 0xa7c4c 가 올린 R[1] — 18~23 판정 0xa7998 이 보는 값 */
  readonly comboAtCall: number
  /** 셋째 아웃 판정의 아웃 — 아웃 콜(0xa7d0c)이 센 판의 아웃까지다 */
  readonly outsAfter: number
}

function defenseSettlementFactsOf(tally: TeamRecordTally, play: DefensePlayRecord): DefenseSettlementFacts {
  const strikeout = play.outcome.kind === '삼진'
  const runnerPlay = play.stealPlayOuts !== undefined
  const wildPitchOuts = play.wildPitchPlayOuts ?? 0
  const droppedThirdStrike = play.droppedThirdStrike === true
  const strikeoutCallEvent = droppedThirdStrike ? 1 : 0
  const outsInPlay = play.outsAdded + (play.stealPlayOuts ?? 0) + wildPitchOuts + strikeoutCallEvent
  return {
    strikeout,
    runnerPlay,
    wildPitchOuts,
    droppedThirdStrike,
    outsInPlay,
    strikeoutCallEvent,
    moundStrikeouts: tally.moundStrikeouts + (strikeout ? 1 : 0),
    comboAtCall: strikeoutComboAtCall(tally, strikeout, runnerPlay),
    outsAfter: play.outsBefore + outsInPlay - strikeoutCallEvent,
  }
}

/**
 * 0xa7c4c 가 R[1] 을 올리고(18~23 판정 0xa7998 은 이 값을 본다), 지우기(a8fb6~a8ff8)는 종류 4·5 를 건너뛰고
 * `[sp+0x20] > 0 && !state[0x1a]` 가 아니면 지운다 — 낫아웃 삼진은 판정 뒤 콤보를 끊는다(`tallyAfterDefense`)
 */
function strikeoutComboAtCall(tally: TeamRecordTally, strikeout: boolean, runnerPlay: boolean): number {
  if (strikeout) return tally.moundStrikeoutCombo + 1
  if (runnerPlay) return tally.moundStrikeoutCombo
  return 0
}

function defenseRecordIdsOf(play: DefensePlayRecord, facts: DefenseSettlementFacts): readonly number[] {
  const { outsInPlay } = facts
  return [
    // 종류 5 정산은 0xa7998(18~23)을 안 부르고(a8d38), 16/17(삼진 콜)은 판 정산보다 먼저라 판을 먹일 때(`applyTeamArrival`)
    // 24 앞에 이미 줬다
    ...(facts.strikeout && !facts.runnerPlay
      ? strikeoutRecordIdsOf({
          pitches: play.atBatPitches,
          balls: play.balls,
          comboCount: facts.comboAtCall,
          pitcherStrikeouts: facts.moundStrikeouts,
        })
      : []),
    // 삼진 + 도루 판의 36 은 판을 먹일 때(`applyTeamArrival`) 24 앞에 이미 줬다.
    // state[0x8b] — 결과 판 0x46844 가 레이저 연출 뒤 코드 13(그 판의 아웃 판정) 결과 판에서 세운 표시
    ...(facts.runnerPlay ? [] : laserThrowOutRecordOf({ laserThrowFlag: play.laserOutFlag, outsInPlay }).recordIds),
    ...multiOutPlayRecordIdsOf({ outsInPlay, strikeoutWhileRunning: facts.droppedThirdStrike }),
    ...(isThirdOutByOutCall(play, facts) ? threePitchInningRecordIdsOf(play.halfInningPitches, facts.outsAfter) : []),
  ]
}

/**
 * 25 는 아웃 콜 0xa7d0c 몫이라 삼진(0xa7c4c)이 낸 아웃에는 없다 — 삼진 + 도루 판의 셋째 아웃은 늘 판의 도루 저지 콜이다.
 * 낫아웃은 판의 아웃(타자주자 · 주자)이 아웃 콜이다
 */
function isThirdOutByOutCall(play: DefensePlayRecord, facts: DefenseSettlementFacts): boolean {
  if (!facts.strikeout || facts.runnerPlay || facts.wildPitchOuts !== 0) return true
  return facts.droppedThirdStrike && play.outsAdded > 0
}

function tallyAfterDefense(tally: TeamRecordTally, facts: DefenseSettlementFacts): TeamRecordTally {
  return {
    ...tally,
    // a8ab2 ctx+0x162 = 0 은 범타·삼진 갈래 안이라 종류 5 정산은 안 지운다
    homeRunStreak: facts.runnerPlay ? tally.homeRunStreak : 0,
    moundStrikeouts: facts.moundStrikeouts,
    moundStrikeoutCombo: facts.droppedThirdStrike ? 0 : facts.comboAtCall,
    // a8f8c R[3] += [sp+0x30] · a8fa8 낫아웃이면 −1
    moundOuts: tally.moundOuts + facts.outsInPlay - facts.strikeoutCallEvent,
  }
}
