import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type { MenuOverlay, PitchPhase } from './pitcherGameSceneProps'

/** 장면 위를 덮는 것 — 판 · 재생 · 중계 · 내 공 · 팝업 · 강판 물음 · 돌발 결과 창 */
export interface PitcherCoverInput {
  readonly progress: PitcherGameProgress
  readonly isSceneShowing: boolean
  readonly isReplaying: boolean
  readonly isRelaying: boolean
  readonly isPitchSceneBusy: boolean
  readonly isPopupOpen: boolean
  readonly overlay: MenuOverlay | null
  readonly asksGiveUp: boolean
}

/** 판(인트로 · 교대 판 · 벤치 클리어링 · 요약 · 수비 판 · 재생 · 중계)이 없다 */
const isBoardFree = (s: PitcherCoverInput) =>
  !s.isSceneShowing && s.progress.pendingDefensePlay === null && s.progress.pendingRunnerPlay == null && !s.isReplaying && !s.isRelaying

/** 내 공(0x11 · 0x12) · 팝업 · 하위 화면 · 강판 물음이 없다 */
const isInputFree = (s: PitcherCoverInput) => !s.isPitchSceneBusy && !s.isPopupOpen && s.overlay === null && !s.asksGiveUp

/**
 * 0xe 대기 · 교체 연출을 셀 수 있는 그림 — 인트로·교대 판·수비 화면·벤치 클리어링·경기 중 메뉴·조작방법·설정·강판 물음·돌발 결과 창이
 * 덮으면 받지 않는다. 타석이 끝나며 난 돌발 결과 창(0x1d)은 다음 0xd 보다 먼저다 (+0x1b6c)
 */
export function isPitcherSceneUncoveredOf(s: PitcherCoverInput): boolean {
  return isBoardFree(s) && isInputFree(s) && s.progress.lastBurstResolution === null
}

/** 견제 키 · 강판 키를 받는 때의 화면 */
export interface PitcherKeyInput {
  readonly canPitch: boolean
  readonly isAwaitingConfirm: boolean
  readonly isReplaying: boolean
  readonly isRelaying: boolean
  readonly isPitchSceneBusy: boolean
  readonly isSceneShowing: boolean
  readonly phase: PitchPhase
  readonly isMenuOpen: boolean
  readonly isPopupOpen: boolean
  readonly asksGiveUp: boolean
  readonly overlay: MenuOverlay | null
  readonly hasBurstLines: boolean
  readonly progress: PitcherGameProgress
}

const isPickoffSceneOpen = (s: PitcherKeyInput) =>
  s.canPitch && !s.isAwaitingConfirm && !s.isReplaying && !s.isRelaying && !s.isPitchSceneBusy && !s.isSceneShowing

/**
 * **견제** — 구질 고르기(상태 0xf)에서만 '3' 1루 · '1' 2루 · '7' 3루 (0x53548, 설명서 <투구 조작>).
 * 코스·게이지 단계는 원본도 다른 상태(0x10·0x11)라 받지 않는다. 그 루에 주자가 없으면 진행기가 키를 먹고 끝낸다.
 */
export function acceptsPickoffOf(s: PitcherKeyInput): boolean {
  const isPickoffInputOpen = s.phase === '구질' && !s.isMenuOpen && !s.asksGiveUp && s.overlay === null
  return isPickoffSceneOpen(s) && isPickoffInputOpen && !s.hasBurstLines && s.progress.managerHookText === null
}

const isGiveUpSceneOpen = (s: PitcherKeyInput) =>
  s.canPitch && !s.isSceneShowing && !s.isPopupOpen && s.overlay === null && !s.asksGiveUp && !s.isReplaying && !s.isRelaying

const isGiveUpPlayFree = (s: PitcherKeyInput) =>
  !s.isPitchSceneBusy && s.progress.pendingDefensePlay === null && s.progress.pendingRunnerPlay == null && s.progress.managerHookText === null

/**
 * '#' — 공용 키 0x498d4 의 '#' 가지(0x4994a): 0x38984 참이고 경기 상태가 **0xe 또는 0xf** 면, 모드 3 은 StrGAME[104]
 * "그만 던지시겠습니까?" 물음(0xbbef8(…, 2, 0x1b, 1))만 띄운다. 0xe 의 OK 뒤 굴림은 OK 를 받을 때 진행기가 돌리므로
 * (`confirmScene`) 0xe 에서 "예" 하면 그 굴림이 아예 안 돈다. 0xd(대기가 보인 뒤 두 그림)·코스(0x10)·게이지(0x11)는 밖이다.
 * `isInConfirmState` 는 0xe 에 들어섰는가, `hasVisibleBurstLines` 는 돌발 창이 서 있는가
 */
export function acceptsGiveUpKeyOf(s: PitcherKeyInput, isInConfirmState: boolean, hasVisibleBurstLines: boolean): boolean {
  const isInHashState = s.isAwaitingConfirm ? isInConfirmState : s.phase === '구질'
  return isGiveUpSceneOpen(s) && isGiveUpPlayFree(s) && !hasVisibleBurstLines && isInHashState
}
