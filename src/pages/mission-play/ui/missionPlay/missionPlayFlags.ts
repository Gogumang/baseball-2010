import type { MissionLimitState } from '@/pages/mission-play/lib/missionHudLayout'
import type { MissionRun } from '@/entities/mission/model/missionRun'
import type { MissionPlayScreenProps } from './missionPlayProps'
import type { MissionMenuOverlay } from './MissionMenuLayer'

/** 미션 HUD 한도 — 0x369f6 타석 · 0x36b04 스윙 (쓴 수 = 한도 − 남은 수) */
export function missionHudLimitsOf(run: MissionRun): MissionLimitState {
  return {
    plateAppearanceLimit: run.mission.plateAppearanceLimit,
    plateAppearancesUsed: run.mission.plateAppearanceLimit - (run.remainingPlateAppearances ?? run.mission.plateAppearanceLimit),
    swingLimit: run.mission.swingLimit,
    swingsUsed: run.mission.swingLimit - (run.remainingSwings ?? run.mission.swingLimit),
  }
}

/** 상태 0xe 의 OK 를 셀 수 있는가 — 결과 연출 · 메뉴 · 조작방법 · 설정 · 교체 연출 0x16 이 덮으면 받지 않는다 */
export const canCountSceneConfirmOf = (
  isOver: boolean,
  isPaused: boolean,
  bannerText: string,
  isMenuOpen: boolean,
  overlay: MissionMenuOverlay | null,
  isSubstituting: boolean,
) => !isOver && !isPaused && bannerText === '' && !isMenuOpen && overlay === null && !isSubstituting

/** 경기 중 메뉴 "설정" 칸 — 설정 값 · 바꾸기를 함께 넘겼을 때만 열린다(안 넘기면 칸이 잠긴다) */
export const canOpenSettingsOf = ({ settings, onSettingsChange }: MissionPlayScreenProps) => settings !== undefined && onSettingsChange !== undefined

/** 교체 연출 0x16 이 서 있는가 — 끝난 미션 밖에서만 */
export const isSubstitutingOf = (isOver: boolean, { substitutionScene }: MissionPlayScreenProps) =>
  !isOver && substitutionScene !== undefined && substitutionScene !== null

/**
 * 타석 갱신이 멈췄는가 — 조작방법 뷰어 동안은 일시정지 팝업이 떠 있어 경기 갱신이 멈춘다 (0x52cc6 0x754f9) · 0xe(OK 대기)에서도
 * 공이 안 나간다 · 교체 연출 0x16 에는 갱신이 없다(R10 표 — 진입 0x3d458 · 그리기 0x4da30 뿐)
 */
export const isStagePausedOf = (
  isPaused: boolean,
  isOver: boolean,
  overlay: MissionMenuOverlay | null,
  isAwaitingConfirm: boolean,
  isSubstituting: boolean,
) => isPaused || isOver || overlay !== null || isAwaitingConfirm || isSubstituting

/** 단말 일시정지 0x463ac 가 메뉴를 여는가 — 끝난 미션(결과 판) 밖이고 하위 창이 없을 때 */
export const isMenuOpenableOf = (isOver: boolean, overlay: MissionMenuOverlay | null) => !isOver && overlay === null
