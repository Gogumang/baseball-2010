import { ORIGINAL_MAIN_MENU_TEXT } from '@/shared/config/original/mainMenuText'

/**
 * 환경설정 화면 문구 — 원본 StrMAINMENU 원문. 대괄호는 원본 인덱스다.
 */
export const SETTINGS_TEXT = {
  sound: ORIGINAL_MAIN_MENU_TEXT[63] ?? '', // [63]
  speed: ORIGINAL_MAIN_MENU_TEXT[64] ?? '', // [64]
  vibration: ORIGINAL_MAIN_MENU_TEXT[65] ?? '', // [65]
  detail: ORIGINAL_MAIN_MENU_TEXT[66] ?? '', // [66]
  dataManagement: ORIGINAL_MAIN_MENU_TEXT[68] ?? '', // [68]
  vibrationOff: ORIGINAL_MAIN_MENU_TEXT[78] ?? '', // [78]
  vibrationOn: ORIGINAL_MAIN_MENU_TEXT[79] ?? '', // [79]
  /** 🌐 원본 백업·복구는 서버가 필요하다 */
  dataManagementBlocked: '게임 데이터 관리는!N통신이 필요합니다',
  speedDescription: ORIGINAL_MAIN_MENU_TEXT[33] ?? '', // [33]
  pitch: ORIGINAL_MAIN_MENU_TEXT[69] ?? '', // [69]
  pitchDescription: ORIGINAL_MAIN_MENU_TEXT[38] ?? '', // [38]
  modeReset: ORIGINAL_MAIN_MENU_TEXT[67] ?? '', // [67]
  modeResetDescription: ORIGINAL_MAIN_MENU_TEXT[36] ?? '', // [36]
  careerReset: ORIGINAL_MAIN_MENU_TEXT[82] ?? '', // [82]
  seasonReset: ORIGINAL_MAIN_MENU_TEXT[83] ?? '', // [83]
  editReset: ORIGINAL_MAIN_MENU_TEXT[84] ?? '', // [84]
  /** 시즌모드 초기화 확인 — 0xcf870 (상태 0x21 하위 0 칸 1, 0x2c7ec) */
  seasonResetConfirm: '!C!cffffff시즌 모드 초기화를!N하시겠습니까?!N(!cff0000G포인트 아이템도!N함께 삭제됩니다!cffffff)',
  /** 에디트 초기화 확인 — 0xcf8d4 (상태 0x21 하위 0 칸 2, 0x2c80e) */
  editResetConfirm: '!C!cffffff선수 이름을 초기화!N하시겠습니까?',
  /** 초기화 뒤 알림 — 0xcf900 (0x2c9d0 · 0x2ca28) */
  resetDone: '!C초기화 되었습니다',
  careerResetConfirm:
    ORIGINAL_MAIN_MENU_TEXT[210] ?? '', // [210]
} as const
