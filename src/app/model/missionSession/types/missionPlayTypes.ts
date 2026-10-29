import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { CpuSwingPose } from '@/entities/pitching/model/simulateBatter'
import type { MissionRun } from '@/entities/mission/model/missionRun'
import type { PitcherRun } from '@/entities/mission/model/pitcherRun'
import type { DefensePlayInput, DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { PitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import type { BenchClearingEntryRoll, HitByPitchHoldPhase } from '@/features/play-game/model/benchClearingScene'

/**
 * **수비 화면(상태 0x17)이 붙들고 있는 타구.**
 *
 * 원본 미션은 모드 5·6 짜리 **보통 경기**(장면 0x104)다 — 상태 표가 모드를 안 가른다.
 * 맞은 공은 0x11 → 메시지 0x6aa → 0x13 → **늘 0x17**(`0xae5f0` 는 `movs r0,#0x17; bx lr` 한 줄,
 * R10 8절 전이표) 이고, 0x17 이 끝나야 `0xae3e8` 이 다음 타석(0xd/0xf)으로 보낸다.
 * 그래서 웹도 인플레이 타구에서 여기 멈춰 서서 화면이 틱을 다 돌리기를 기다린다.
 */
export interface PendingMissionDefense {
  readonly side: '타자' | '투수'
  readonly input: DefensePlayInput
  readonly outcome: AtBatOutcome
  readonly isBunt: boolean
  /** 타구 직전의 주자 수 — 결과 띠("2타점" 따위)가 이 값을 쓴다 */
  readonly runnersOnBase: number
  /**
   * **파울 각 공 판**인가 — 원본은 맞은 공이면 파울 각이라도 판을 돈다. 판이 파울로 닫히면(`foulEnded`) 정산 없이 같은 타석
   * 다음 공(0xae3e8 ae568 → 0xf · 0x35108 → 0xb6b58 스트라이크)이고, 낙구 전에 잡히면 뜬공 아웃(13)으로 타석이 끝난다.
   */
  readonly isFoulPlay?: boolean
}

/** 타자 미션의 붙든 공 도착 판이 끝난 뒤 그 공의 나머지가 쓰는 값 (`handleMissionPitch` 가 공을 받을 때의 것) */
export interface MissionArrivalContext {
  /** 공을 받을 때의 판 — 판에서 3아웃인지 본다 */
  readonly current: MissionRun
  /** 배트를 냈는가 — 스윙 수 */
  readonly hasSwung: boolean
  /** 이 공으로 끝난 타석 결과 (없으면 같은 타석 다음 공) */
  readonly outcome: AtBatOutcome | null
  readonly isBunt: boolean
  /** 공 앞 루상 주자 수 — 결과 띠 */
  readonly runnersOnBase: number
}

/** 투수 미션(모드 5)의 붙든 볼넷 · 사구 · 삼진 — `useMissionSession` 의 `pendingBenchClearing` */
interface PitcherMissionHeldResult {
  readonly side: '투수'
  readonly phase: HitByPitchHoldPhase
  readonly run: PitcherRun
  /** 이 공을 놓은 뒤의 미션 투수 +0x2c — 들어가면 0x3ab7c 가 −1000 */
  readonly pitcherStamina: number
  readonly outcome: AtBatOutcome
  /** 이 공이 연 밀어내기 판(종류 2) — 판정 A(또는 연출 뒤) 0x17 로 재생한다 */
  readonly walkReplay?: DefensePlayResult | null
  /** 진입 0x3a5f0 의 굴림 45 번 — 그리기 0x43228 이 공격 9명을 세운다 (`rollBenchClearingEntry`) */
  readonly entryRolls?: readonly BenchClearingEntryRoll[]
}

/** 타자 미션(모드 6)의 붙든 볼넷 · 사구 (r298) — 판정 A 의 보통 길은 `finishMissionArrivalAtBat` 그대로다 */
interface BatterMissionHeldResult {
  readonly side: '타자'
  readonly phase: HitByPitchHoldPhase
  /** 공을 받을 때의 판 — 벤치 클리어링 그림(0x43228)의 루 · 두 팀 */
  readonly run: MissionRun
  readonly outcome: AtBatOutcome
  /** 이 공의 0x3dfac 이 연 밀어내기 판(종류 2) */
  readonly play: PitchArrivalPlay | null
  readonly hasSwung: boolean
  readonly isBunt: boolean
  /** 공 앞 루상 주자 수 — 결과 띠 */
  readonly runnersOnBase: number
  /** 진입 0x3a5f0 의 굴림 45 번 */
  readonly entryRolls?: readonly BenchClearingEntryRoll[]
}

/** 미션의 붙든 타석 결과 — 투수 미션 · 타자 미션 (`pendingBenchClearing`) */
export type MissionHeldResult = PitcherMissionHeldResult | BatterMissionHeldResult

/** 투수 미션의 붙든 공 도착 판이 끝난 뒤 그 공의 나머지가 쓰는 값 (`handleThrow` 가 공을 던질 때의 것) */
export interface PitcherArrivalContext {
  /** 이 공으로 끝난 타석 결과 (없으면 같은 타석 다음 공) */
  readonly outcome: AtBatOutcome | null
  /** 이 공을 깎은 뒤 미션 투수 체력 — 사구 벤치 클리어링(0x3ab7c)이 본다 */
  readonly pitcherStamina: number
}

/** 투수 미션에서 마지막으로 던진 공 — 타석 장면(`PitcherSideStage`)이 그림으로만 다시 날린다(굴림 없음) */
export interface LastPitcherThrow {
  readonly pitch: Pitch
  readonly resolution: PitchResolution
  /** 0x12 대기 0x4e6d4(15, 볼넷 · 사구 · 삼진이면 31) */
  readonly resultTicks: number
  /** CPU 타자가 휘둘렀으면 스윙 프레임 · 번트 종류 — 장면의 타자 자세 */
  readonly cpuSwing: CpuSwingPose | null
}
