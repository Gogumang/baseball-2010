import type { BaseRunners } from '@/entities/game/model/baseRunners'
import { type AtBatOutcome, isFreePass, isHit } from '@/entities/at-bat/model/atBatOutcome'
import { ACE_BATTER_ROSTER_SLOT } from '@/features/play-game/model/gameAces'
import { type AdvanceResult, advanceRunners } from '@/entities/game/model/baseState'
import type { GameState } from '@/entities/game/model/gameState'
import { rosterSlotAt } from '@/entities/game/model/quickLineup'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { survivorsFromBaseOfFates } from '@/features/defense-play/model/runnerFates'
import { applyOpponentAtBat, type OpponentAtBatResult } from '@/features/play-pitcher-game/model/pitcherGameState'
import { OUTS_PER_INNING } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/constants'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'
import { countsMyPitcherRecord } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/recordGates'

/** 간이 엔진 타석(`playQuickPlateAppearance`)이 먹인 주자 — 볼넷 모든 주자 +1(c1918) · 도루(c1982) · 땅볼 진루(0xc15b8)까지 */
export interface QuickAtBatPlay {
  readonly advance: AdvanceResult
  /** 간이 엔진 타석이 민 주자 신원(상대 타순 칸) */
  readonly runners: BaseRunners
}

/** 상대 타석 하나를 먹이는 재료 — 어느 판이 이 타석을 끝냈는가 (`applyDefensivePlay`) */
export interface DefensivePlaySources {
  /**
   * **이미 돌린** 수비 시뮬레이션 결과 (`features/defense-play`). 내가 던진 타석의 인플레이 타구만 갖는다 — 투수편도 원본에서는
   * 사람 경기(0xae24c·0xae3e8)라 간이 엔진이 아니라 수비 AI 가 돈다. 그래서 `baseState` 의 두 근사("희생플라이 보장"·
   * "고정 진루표")가 여기서는 쓰이지 않고, 태그업(0xa9620) → 자동 추가 진루(0xaf918, 송구보다 2틱 넘게 빠를 때만) → 2아웃 득점
   * 보류 순서가 그대로 돈다 (P2 7절 · E-defense-rules). 내가 마운드에 없는 타석(구원 대기·강판 뒤)은 원본도 간이 엔진(0xc262c)이라 null 이다.
   */
  readonly defensePlay: DefensePlayResult | null
  /**
   * 화면에 재생시킬 틱 묶음. 홈런 비행이거나, 미리 다 돌려 버린 갈래의 그 결과다.
   * **실시간으로 이미 다 보여 준 플레이는 null** — 넣으면 같은 장면을 한 번 더 튼다.
   */
  readonly playback: DefensePlayResult | null
  /** 있으면 이 타석은 간이 엔진 타석이다(결과 링 아웃 = 5) */
  readonly quick?: QuickAtBatPlay
  /**
   * **삼진 + 도루 판(종류 5)** 의 정산 — 판정 B 0xae3e8 이 state[0xc] == 5 && 종류 5 면 0xd 로 가며 0xa8024 를 종류 5 로 한 번
   * 부른다(ae586 · ae5a8). 삼진 콜 0xa7c4c(R+0x13c +1 · 16/17 · 0xb8cec R[0]·R[1])는 공 도착 0x3dfac 가 이미 했고, 정산 안에서
   * state[0x26] ∈ {4, 5} 가 막는 칸은 건너뛴다:
   * ```
   * a8856  상대 타자 리그 기록(+0x20 타수 …)          — 건너뜀
   * a8a04  아웃 코드 · 결과 링                      — 건너뜀
   * a8ac8  코드 7 · 타순 칸 타석 +0x14              — 건너뜀
   * a8d38  R+0x134 탈삼진(코드 0x18, R+0x14c 콤보) · 0xa7998(18~23) — 건너뜀
   * a8d98  R+0x138 타자 수(코드 0x19)                — 건너뜀
   * a8fb6  0xb8cec R[1] 끊기 · 결과비트 0x200       — 건너뜀
   * a8cb0  투수 레코드 +0x20(아웃) · a8d00 +0x26(삼진) — 판 종류를 안 본다 (`stealPlayStrikeouts`)
   * ```
   */
  readonly stealPlaySettlement?: boolean
  /**
   * 이 삼진과 한 정산인 주자 판(도루 종류 5 · 삼진 그대로인 폭투·포일 종류 9)의 결과 — 판의 진루는 `applyPitcherArrival` 가 먼저
   * 먹였다. 정산 [sp+0x30] 에 그 판의 아웃 사건이 들고(a8e58 26/27), 필살송구 표시 state[0x8b] 도 그 판의 것이다(a80f8)
   */
  readonly settledRunnerPlay?: DefensePlayResult
}

/** 상대 타석 하나가 경기에 남기는 사실 — 정산 0xa8024 의 칸들이 모두 이 값에서 나온다 */
export interface DefensivePlayFacts {
  readonly before: GameState
  readonly applied: OpponentAtBatResult
  /** 상대 타순 칸 */
  readonly slot: number
  readonly mine: boolean
  /** `countsMyPitcherRecord` — 포스트시즌 · 국가대항전이면 내 투수 R 칸을 안 센다 */
  readonly counts: boolean
  readonly hit: boolean
  readonly walk: boolean
  /** 출루 허용 state[0x88]·투수 +0x2a·삼자범퇴 칸 ctx+0x184 는 볼넷·사구를 함께 본다 (0xa8caa · 0xa8e12/0xa8e36) */
  readonly freePass: boolean
  readonly hitByPitch: boolean
  readonly strikeout: boolean
  readonly inningEnded: boolean
  /** R+0x184 — 안타·볼넷·사구가 나거나 점수가 나면 이 이닝은 더 이상 삼자범퇴가 아니다 (0xa80b4·0xa8e12) */
  readonly perfectInningFlag: boolean
  /**
   * **낫아웃(state[0x1a])** — 공 도착 0x3dfac 의 종류 9 갈래 0x3e09e~0x3e0e0 이 삼진 콜 0xa7c4c(사건 5 · R+0x13c +1 · R[0]·R[1])를
   * 부르고 state[0x1a] = 1 을 세운 뒤 타자주자를 끼운 판(0x46418)을 돈다. 판 운명을 진루로 먹이는 삼진은 이 갈래뿐이다
   */
  readonly droppedThirdStrike: boolean
  /** 정산 홈런 수 [sp+0x24] > 0 (`homeRunCountedOf`) */
  readonly homeRunCounted: boolean
  readonly stealPlaySettlement: boolean
  /**
   * 이 정산의 아웃 [sp+0x30] — 삼진 사건 5 와 함께 선 주자 판의 아웃 사건 0xd 까지. 낫아웃 판은 삼진 콜이 넣은 사건 5 가 판의 아웃
   * 사건 앞에 하나 더 든다(판의 아웃은 아웃 콜 0xa7d0c 의 0xd)
   */
  readonly settledOuts: number
}

export function defensivePlayFactsOf(
  progress: PitcherGameProgress,
  outcome: AtBatOutcome,
  mine: boolean,
  sources: DefensivePlaySources,
): DefensivePlayFacts {
  const before = progress.game
  const { defensePlay } = sources
  const applied = applyOpponentAtBat(before, progress.opponentOrderIndex, outcome, opponentAdvanceOf(before, outcome, sources), runnerHintOf(sources))
  const droppedThirdStrike = outcome.kind === '삼진' && defensePlay !== null
  const hit = isHit(outcome)
  const freePass = isFreePass(outcome)
  return {
    before,
    applied,
    slot: progress.opponentOrderIndex,
    mine,
    counts: countsMyPitcherRecord(progress),
    hit,
    walk: outcome.kind === '볼넷',
    freePass,
    hitByPitch: outcome.kind === '사구',
    strikeout: outcome.kind === '삼진',
    inningEnded: before.outs + applied.outsAdded >= OUTS_PER_INNING,
    perfectInningFlag: progress.perfectInningFlag && !hit && !freePass && applied.runsScored === 0,
    droppedThirdStrike,
    homeRunCounted: homeRunCountedOf(progress, outcome, defensePlay),
    stealPlaySettlement: sources.stealPlaySettlement ?? false,
    settledOuts: applied.outsAdded + (sources.settledRunnerPlay?.advance.outsAdded ?? 0) + (droppedThirdStrike ? 1 : 0),
  }
}

/** 진루 — 판이 있으면 판, 간이 타석이면 그 진루, 아니면 간이 엔진 규칙(**원본 간이 엔진에는 희생플라이가 없다** — E-2 확정) */
function opponentAdvanceOf(before: GameState, outcome: AtBatOutcome, sources: DefensivePlaySources): AdvanceResult {
  if (sources.defensePlay !== null) return sources.defensePlay.advance
  if (sources.quick !== undefined) return sources.quick.advance
  return advanceRunners(before.bases, outcome, before.outs, { quickEngine: true })
}

/** 주자 신원 실마리 — 판이 있으면 살아남은 주자, 간이 타석이면 그 주자 목록 */
function runnerHintOf(sources: DefensivePlaySources) {
  if (sources.defensePlay !== null) return { survivorsFromBase: survivorsFromBaseOfFates(sources.defensePlay.runnerFates) }
  if (sources.quick !== undefined) return { runners: sources.quick.runners }
  return undefined
}

/**
 * 정산 홈런 수 [sp+0x24] > 0 — 장내 홈런 state[0x25] 는 a84d6 이 타자 게이트 [sp+0x34] = 0xa56dc(ctx, 지금 타자, 0)
 * (모드 3 갈래 0xa571c: 포스트시즌 · 국가대항전 아님 && 마선수 아님)가 참일 때만 더한다. 거짓이면 루타 4 안타로만 적혀
 * 홈런 갈래(B0)와 a8728 의 타순 칸 홈런 +0x13 을 건너뛴다. 담장 사건 8 은 게이트 없이 센다
 */
function homeRunCountedOf(progress: PitcherGameProgress, outcome: AtBatOutcome, defensePlay: DefensePlayResult | null): boolean {
  if (outcome.kind !== '홈런') return false
  if (defensePlay?.groundHomeRun !== true) return true
  return countsMyPitcherRecord(progress) && rosterSlotAt(progress.opponentLineup, progress.opponentOrderIndex) !== ACE_BATTER_ROSTER_SLOT
}
