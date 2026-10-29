/** props 를 기본값을 채운 타자 · 투수 표지와 나머지(`StageLatest` 로 그대로 넘기는 것)로 가른다 */
import type { SwingMode } from '@/entities/batting/model/swingResult'
import { batterEquipmentOf, NO_EQUIPMENT, pitcherEquipmentOfNibbles } from '@/widgets/batting-stage/lib/batterLayers'
import type { StageLatest } from '@/widgets/batting-stage/model/stageRefs'
import type { BattingStageProps } from '@/widgets/batting-stage/model/battingStage/battingStageProps'

/** 부품이 따로 쓰는 props — 나머지는 `rest` 로 그대로 넘긴다 */
type OwnKeys =
  | 'pitcherEquipmentNibbles'
  | 'pitcherSkinIndex'
  | 'pitcherTeamIndex'
  | 'batterHand'
  | 'canBunt'
  | 'swingMode'
  | 'batterForm'
  | 'batterSkinIndex'
  | 'batterTeamIndex'
  | 'batterEquipmentLevels'
  | 'batterSkillIds'
  | 'recentAtBatCodes'
  | 'batterRecordSlot'
  | 'specialSwingNumber'
  | 'aceBatterIndex'
  | 'specialSwingRemaining'
  | 'onSpecialSwingUsed'
  | 'isBatterOwnPlayer'
  | 'careerYearIndex'
  | 'flightProbeRef'
  | 'sceneBuntKind'

/** 기본값을 채운 타자 표지 */
interface BatterDefaults {
  readonly canBunt: boolean
  readonly swingMode: SwingMode
  readonly batterForm: number
  readonly batterSkinIndex: number
  readonly batterSkillIds: readonly number[]
  readonly recentAtBatCodes: readonly number[]
  readonly batterRecordSlot: number
}

/** 기본값을 채운 필살 · 마선수 · 내 선수 표지 */
interface SpecialDefaults {
  readonly pitcherSkinIndex: number
  readonly specialSwingNumber: number
  /** 마타자 순번 — 아니면 −1 */
  readonly aceBatterIndex: number
  readonly isBatterOwnPlayer: boolean
  readonly careerYearIndex: number
}

export type BattingStageInput = BatterDefaults &
  SpecialDefaults &
  Pick<
    BattingStageProps,
    | 'pitcherEquipmentNibbles'
    | 'pitcherTeamIndex'
    | 'batterHand'
    | 'batterTeamIndex'
    | 'batterEquipmentLevels'
    | 'specialSwingRemaining'
    | 'onSpecialSwingUsed'
    | 'flightProbeRef'
    | 'sceneBuntKind'
  > & { readonly rest: Omit<BattingStageProps, OwnKeys> }

export function battingStageInputOf(props: BattingStageProps): BattingStageInput {
  const {
    pitcherEquipmentNibbles,
    pitcherSkinIndex,
    pitcherTeamIndex,
    batterHand,
    canBunt,
    swingMode,
    batterForm,
    batterSkinIndex,
    batterTeamIndex,
    batterEquipmentLevels,
    batterSkillIds,
    recentAtBatCodes,
    batterRecordSlot,
    specialSwingNumber,
    aceBatterIndex,
    specialSwingRemaining,
    onSpecialSwingUsed,
    isBatterOwnPlayer,
    careerYearIndex,
    flightProbeRef,
    sceneBuntKind,
    ...rest
  } = props
  return {
    rest,
    pitcherEquipmentNibbles,
    pitcherTeamIndex,
    batterHand,
    batterTeamIndex,
    batterEquipmentLevels,
    specialSwingRemaining,
    onSpecialSwingUsed,
    flightProbeRef,
    sceneBuntKind,
    ...batterDefaultsOf({ canBunt, swingMode, batterForm, batterSkinIndex, batterSkillIds, recentAtBatCodes, batterRecordSlot }),
    ...specialDefaultsOf({ pitcherSkinIndex, specialSwingNumber, aceBatterIndex, isBatterOwnPlayer, careerYearIndex }),
  }
}

function batterDefaultsOf(given: Partial<BatterDefaults>): BatterDefaults {
  return {
    canBunt: given.canBunt ?? false,
    swingMode: given.swingMode ?? '일반',
    batterForm: given.batterForm ?? 0,
    batterSkinIndex: given.batterSkinIndex ?? 0,
    batterSkillIds: given.batterSkillIds ?? [],
    recentAtBatCodes: given.recentAtBatCodes ?? [],
    batterRecordSlot: given.batterRecordSlot ?? 0,
  }
}

function specialDefaultsOf(given: Partial<SpecialDefaults>): SpecialDefaults {
  return {
    pitcherSkinIndex: given.pitcherSkinIndex ?? 0,
    specialSwingNumber: given.specialSwingNumber ?? 0,
    aceBatterIndex: given.aceBatterIndex ?? -1,
    isBatterOwnPlayer: given.isBatterOwnPlayer ?? false,
    careerYearIndex: given.careerYearIndex ?? 0,
  }
}

/** 타석 칸(`useStageRefs`)에 넘기는 최신 값 — 나머지 props 에 기본값 · 장비 겹 · 팀 번호를 채운다 */
export function stageLatestOf(input: BattingStageInput, isSceneFrozen: boolean): StageLatest {
  const { rest, batterHand, batterEquipmentLevels } = input
  return {
    ...rest,
    canBunt: input.canBunt,
    swingMode: input.swingMode,
    batterForm: input.batterForm,
    ...(batterHand === undefined ? {} : { batterHand }),
    // 마타자 순번 — 타석 교대 0x47dd6 이 몸통 적재 0x78ab0 에, 0x35686 이 스윙 객체 +0x24 에 넣는 0xb63a0
    aceBatterOrder: input.aceBatterIndex,
    batterSkinIndex: input.batterSkinIndex,
    batterEquipment: batterEquipmentLevels === undefined ? NO_EQUIPMENT : batterEquipmentOf(batterEquipmentLevels),
    // 마운드 장비 겹 (48138~4816a → 0x79790) — 마투수 그림이면 0x482fc 의 0x793b0 이 따로 싣는다
    pitcherEquipment: pitcherEquipmentOfNibbles(input.pitcherEquipmentNibbles),
    // 마운드 바탕 벌 = 피부 × 15 + 수비 팀 (482c0~482fc → 0x793b0 의 794c2)
    pitcherSkinIndex: input.pitcherSkinIndex,
    ...stageTeamIndexesOf(input),
    batterSkillIds: input.batterSkillIds,
    recentAtBatCodes: input.recentAtBatCodes,
    batterRecordSlot: input.batterRecordSlot,
    // 필살 남은 횟수 표시 0x38a30 이 그림마다 읽는다
    specialSwingRemaining: input.specialSwingRemaining,
    // 공용 창(히든 오픈 알림 등)이 떠 있으면 경기 장면 갱신이 멈춘다 (0x52cc6)
    isSceneFrozen,
  }
}

/** 마운드 · 타석 팀 번호 — 안 넘기면 HUD 의 상대 팀 · 내 팀 */
function stageTeamIndexesOf({
  rest,
  pitcherTeamIndex,
  batterTeamIndex,
}: BattingStageInput): Pick<StageLatest, 'pitcherTeamIndex' | 'batterTeamIndex'> {
  return {
    pitcherTeamIndex: pitcherTeamIndex ?? rest.hud?.opponentTeamId ?? null,
    // 팀을 안 넘기면 공격 팀(0xb6bf8 — 사람이 치는 타석이라 HUD 의 내 팀 번호)이다 (props 주석 참고)
    batterTeamIndex: batterTeamIndex ?? rest.hud?.ourTeamId ?? 0,
  }
}

/** 이 타석이 키를 받는가 — 공을 안 던지는 동안(결과 연출 `isPaused` · 결과 창 배경 · 공용 창)은 거짓 */
export function takesStageKeysOf(props: BattingStageProps, isCommonWindowOpen: boolean): boolean {
  return !props.isPaused && props.isResultBackdrop !== true && !isCommonWindowOpen
}
