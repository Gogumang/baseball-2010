/**
 * 환경설정 화면 문구 — 원본 StrMAINMENU 원문. 대괄호는 원본 인덱스다.
 */
export const SETTINGS_TEXT = {
  sound: '사운드', // [63]
  speed: '속도', // [64]
  vibration: '진동', // [65]
  detail: '상세 설정', // [66]
  dataManagement: '게임 데이터 관리', // [68]
  vibrationOff: 'OFF', // [78]
  vibrationOn: 'ON', // [79]
  /** 🌐 원본 백업·복구는 서버가 필요하다 */
  dataManagementBlocked: '게임 데이터 관리는!N통신이 필요합니다',
  speedDescription: '게임 속도의 빠르기를!N조절할 수 있습니다', // [33]
  pitch: '투구', // [69]
  pitchDescription: '투구 게이지 사용 여부를!N선택할 수 있습니다', // [38]
  modeReset: '모드 초기화', // [67]
  modeResetDescription: '게임 모드를 초기화!N시킬 수 있습니다', // [36]
  careerReset: '나만의리그 초기화', // [82]
  seasonReset: '시즌모드 초기화', // [83]
  editReset: '에디트 초기화', // [84]
  /** 시즌모드 초기화 확인 — 0xcf870 (상태 0x21 하위 0 칸 1, 0x2c7ec) */
  seasonResetConfirm: '!C!cffffff시즌 모드 초기화를!N하시겠습니까?!N(!cff0000G포인트 아이템도!N함께 삭제됩니다!cffffff)',
  /** 에디트 초기화 확인 — 0xcf8d4 (상태 0x21 하위 0 칸 2, 0x2c80e) */
  editResetConfirm: '!C!cffffff선수 이름을 초기화!N하시겠습니까?',
  /** 초기화 뒤 알림 — 0xcf900 (0x2c9d0 · 0x2ca28) */
  resetDone: '!C초기화 되었습니다',
  careerResetConfirm:
    '!C!cFFFFFF나만의 리그 타자편!N초기화를 하시겠습니까?!N(!cFF0000G포인트 아이템도!N함께 삭제됩니다!cFFFFFF)', // [210]
} as const
