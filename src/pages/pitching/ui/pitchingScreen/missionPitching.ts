import type { PitcherRun } from '@/entities/mission/model/pitcherRun'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import type { MissionLimitState } from './otherSlices'

/** 투구 단계 — 0xf 구질 · 0x10 조준 · 0x11 게이지 */
export type PitchPhase = '구질' | '코스' | '게이지'
/** 경기 화면을 덮는 하위 화면 — 경기 중 메뉴가 연다 */
export type MenuOverlay = '조작방법' | '설정'

/**
 * 미션 투수편 = 원본 전역 모드 **5** (XlsPITCHER_MISSION, Q2-mission-rewards 1-0) — 경기 중 메뉴 표 0xcfcfc 의 **행 1**
 * (모드 5~7 → 1: 자동진행 자리에 다시하기). 미션 장면도 경기 장면 0x104 라 '*' 가 같은 메뉴를 연다.
 */
export const MISSION_PITCHER_MODE = 5

/** 투수 미션 HUD 한도 — 0x369f6 타석 · 0x36b04 모드 5 투구(행[9] 아랫 4비트 · P+0x1c) */
export function missionHudLimitsOf(run: PitcherRun): MissionLimitState {
  return {
    plateAppearanceLimit: run.mission.plateAppearanceLimit,
    plateAppearancesUsed: run.mission.plateAppearanceLimit - (run.remainingPlateAppearances ?? run.mission.plateAppearanceLimit),
    swingLimit: 0,
    swingsUsed: 0,
    pitches: {
      limit: run.mission.pitchLimit,
      thrown: run.mission.pitchLimit - Math.max(0, run.remainingPitches ?? run.mission.pitchLimit),
    },
  }
}

/** `team_logo_ini` 작은 로고 — 팀 경기 · 타자편 화면과 같은 경로 */
export const smallLogoUrlOf = (teamId: number) => assetUrl(`./sprites/team_logo_ini/${String(teamId).padStart(3, '0')}.png`)
