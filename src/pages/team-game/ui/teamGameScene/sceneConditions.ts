import type { ChangeWindowKind, MenuOverlay, PitchPhase } from './teamGameSceneProps'

/** 경기 장면 위를 덮는 것이 없는가 — 0xe 대기를 셀 수 있는 그림 (`isSceneUncoveredOf`) */
export interface SceneUncoverInput {
  readonly isIntroDone: boolean
  readonly hasSummary: boolean
  readonly isHalfInningBoardOpen: boolean
  readonly hasBenchClearing: boolean
  readonly isDefenseInPlay: boolean
  readonly isReplaying: boolean
  readonly isMenuOpen: boolean
  readonly overlay: MenuOverlay | null
  readonly changeWindow: ChangeWindowKind | null
  readonly isPitchSceneBusy: boolean
  readonly hasBurstResolution: boolean
  readonly isBatterPitchEndHolding: boolean
}

/** 판(인트로 · 요약 · 교대 판 · 벤치 클리어링 · 수비 판 · 재생)이 없다 */
const isBoardFree = (s: SceneUncoverInput) =>
  s.isIntroDone && !s.hasSummary && !s.isHalfInningBoardOpen && !s.hasBenchClearing && !s.isDefenseInPlay && !s.isReplaying

/** 팝업(메뉴 · 하위 화면 · 교체 창)이 없다 */
const isPopupFree = (s: SceneUncoverInput) => !s.isMenuOpen && s.overlay === null && s.changeWindow === null

/**
 * 판 · 팝업 · 내 공(0x11 · 0x12)이 없고, 타석이 끝나며 난 돌발 결과 창(0x1d)도 없다 — 0x1d 는 다음 0xd 보다 먼저다(+0x1b6c) —
 * 닫은 뒤에야 0xe 다. 사람 타석 공의 0x12 대기(`isBatterPitchEndHolding`)가 남은 동안도 아니다
 */
export function isSceneUncoveredOf(s: SceneUncoverInput): boolean {
  return isBoardFree(s) && isPopupFree(s) && !s.isPitchSceneBusy && !s.hasBurstResolution && !s.isBatterPitchEndHolding
}

/** 견제 키(0x53548)를 받는 때의 화면 (`acceptsPickoffOf`) */
export interface PickoffInput {
  readonly canPitch: boolean
  readonly isAwaitingConfirm: boolean
  readonly isReplaying: boolean
  readonly isSceneCovering: boolean
  readonly isDefenseInPlay: boolean
  readonly phase: PitchPhase
  readonly isPitchSceneBusy: boolean
  readonly isMenuOpen: boolean
  readonly overlay: MenuOverlay | null
  readonly changeWindow: ChangeWindowKind | null
  readonly hasBurstLines: boolean
}

const isPickoffSceneOpen = (s: PickoffInput) =>
  s.canPitch && !s.isAwaitingConfirm && !s.isReplaying && !s.isSceneCovering && !s.isDefenseInPlay && s.phase === '구질'

/**
 * **견제** — 구질 고르기(상태 0xf)에서 사람이 수비일 때만 '3' 1루 · '1' 2루 · '7' 3루 (0x53548).
 * 코스·게이지 단계는 원본도 다른 상태(0x10·0x11)라 받지 않는다. 그 루에 주자가 없으면 진행기가 키를 먹고 끝낸다.
 * 견제 판(또는 홈런 비행)을 재생하는 동안은 원본도 상태 0x17 이라 0xf 키를 안 받는다.
 * ('3' 은 공격 중이면 도루 키지만 도루는 사람이 칠 차례에만 열려 서로 겹치지 않는다 — `stealableBases`.)
 */
export function acceptsPickoffOf(s: PickoffInput): boolean {
  return isPickoffSceneOpen(s) && !s.isPitchSceneBusy && !s.isMenuOpen && s.overlay === null && s.changeWindow === null && !s.hasBurstLines
}

/** '#' 누름 칸을 그리는 때의 화면 (`acceptsChangeKeyOf`) */
export interface ChangeKeyInput {
  readonly changeWindow: ChangeWindowKind | null
  readonly isSceneCovering: boolean
  readonly isDefenseInPlay: boolean
  readonly isMenuOpen: boolean
  readonly overlay: MenuOverlay | null
  readonly isAwaitingConfirm: boolean
  readonly isInConfirmState: boolean
  readonly isPitchSceneBusy: boolean
  readonly canPitch: boolean
  readonly phase: PitchPhase
  readonly canChangePitcher: boolean
  readonly canPinchHit: boolean
}

const isChangeKeySceneOpen = (s: ChangeKeyInput) =>
  s.changeWindow === null && !s.isSceneCovering && !s.isDefenseInPlay && !s.isMenuOpen && s.overlay === null

/**
 * 원본 화면에서 '#' 가 먹는가 — 0x4994a: 상태 0xe · 0xf, 교대 판 · 수비 판 · 팝업 · 내 공(0x11 · 0x12) 밖 ('#' 키 `hashKeyActionOf`).
 * 조준(0x10) · 게이지(0x11)는 '#' 범위 밖 — 그 자리는 CLR 누름 칸이 쓴다
 */
export function acceptsChangeKeyOf(s: ChangeKeyInput): boolean {
  const isInHashState = !(s.isAwaitingConfirm && !s.isInConfirmState) && !s.isPitchSceneBusy && !(s.canPitch && s.phase !== '구질')
  return isChangeKeySceneOpen(s) && isInHashState && (s.canChangePitcher || s.canPinchHit)
}
