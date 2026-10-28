import type { FielderRecordSeat } from '@/entities/fielding/model/fielderRecords'
import type { TeamEntryBatter } from '@/features/play-team-game/model/teamGameRoster'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import type { PitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'
import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { LiveRunnerPlay } from '@/features/defense-play/model/liveRunnerPlay'

/** 팀 경기의 야수 +0xec 한 칸 — 레코드(명단 줄)를 함께 든다(대타로 명단에서 빠져도 +0xec 는 그 레코드를 가리킨 채다) */
export interface TeamFielderSeat extends FielderRecordSeat {
  readonly player: TeamEntryBatter
}

export interface BatterOutcomeOptions {
  readonly pattern?: BattedBallPattern
  readonly isUncatchable?: boolean
  /**
   * 이 공이 도착하며 연 주자 판(`arriveTeamPitch`). 낫아웃(종류 9 · `'batterRuns'`)이면 그 판의 advance 가 곧
   * 이 삼진 타석의 진루다. 그 밖(볼넷·사구·삼진 + 도루·폭투)은 이미 주자 판으로 먹였으니 재생 칸만 지킨다.
   */
  readonly arrivalPlay?: PitchArrivalPlay | null
  /**
   * 이 공의 **번트 종류** 장면 +0xfdc (0 스윙 · 1~3 번트 — 타석 화면 `onPitchResolved` 넷째 인자). 타구 판 시작 리드
   * (0x3d7b8)가 도루 안 한 주자에게 +3 틱을 더한다(`DefensePlayInput.buntKind`). 안 넘기면 0.
   * 번트는 늘 맞히므로(swingResult `contact = 번트 > 0`) 못 맞힌 공의 도루·폭투 판에는 실릴 일이 없다.
   */
  readonly buntKind?: number
}

/* ── 사람이 던지는 타석 ───────────────────────────────────────────────────────── */

export interface TeamPitchInput {
  /** 원본 구질 번호 1~21, 마구는 22 */
  readonly typeNumber: number
  /**
   * 조준점 x · y · z — 0x10 에서 방향키로 흐른 점(`features/play-pitcher-game/model/pitchAim`). 0x4dc78 이 세 칸 그대로
   * 목표로 쓴다. 안 넘기면 0x10 진입 0x39894 의 존 중심(안 움직인 조준점)
   */
  readonly aim?: WorldPoint
  /** 게이지에서 누른 칸 0~9. 안 눌렀으면 0 */
  readonly gaugeCell: number
}

/** 0x12 진입까지 붙든 우리 공 — `pendingPitchArrival` */
export interface TeamPendingPitchArrival {
  readonly resolution: PitchResolution
  /** 이 공을 먹인 뒤의 타석 결과 (볼넷 · 삼진 · 사구, 아니면 null) */
  readonly outcomeAfter: AtBatOutcome | null
  /** 장면 +0xfdc — CPU 타자의 이 공 번트 종류 */
  readonly buntKind: number
  /** CPU 타자의 손 0xb63c0 — 공의 화면 배치 `Pitch.stageSide`(`simulateBatter` 가 맞은 공의 손으로 쓰는 값). 밀어내기 · 낫아웃 타석 자리 */
  readonly batterHand: number
  /** 0x517e6 — CPU 마타자 필살 성공 타구 (못 맞힌 공이면 늘 거짓이지만 나머지 길이 같은 값을 쓴다) */
  readonly isUncatchable?: boolean
}

/* ── 공 도착 (상태 0x12 진입 0x3dfac → 종류 9 폭투·포일 · 종류 5 도루) ───────────────── */

/**
 * 실시간 주자 판과, 판이 끝난 뒤 이어 갈 투구 흐름의 재료 — 공 도착 판은 `pitchOnce` 의 나머지(타석 결과 · 벤치 클리어링 ·
 * 타구 판)를, 견제 판은 `applyPickoffPlay` 를 이어 돈다.
 */
export type TeamPendingRunnerPlay = LiveRunnerPlay & {
  /** 공 도착 판이면 `pitchOnce` 의 나머지가 쓰는 이 공의 값 */
  readonly resume?: { readonly isUncatchable?: boolean; readonly buntKind: number }
  /**
   * 사람 공격 쪽 판의 공 도착 판이면 `batterPitch` 의 나머지(타석 결과)가 쓰는 값 — 이 공 뒤 타석 결과(없으면 같은 타석 다음 공)와
   * 타석 결과 선택지(`startBatterOutcome`)
   */
  readonly batter?: { readonly outcome: AtBatOutcome | null; readonly options: BatterOutcomeOptions }
}

/** 공 도착 판의 종류 `state[0x26]` — 밀어내기 2 · 도루 5 · 폭투·포일 9 (견제는 4, `PICKOFF_PLAY_KIND`) */
export const ARRIVAL_PLAY_KIND = { 밀어내기: 2, 도루: 5, 폭투포일: 9 } as const

/** 도루 판(종류 5) — 정산 0xa8024 를 `state[0x26] = 5` 로 부르는 판 */
export type StealArrivalPlay = Extract<PitchArrivalPlay, { readonly kind: 5 }>
