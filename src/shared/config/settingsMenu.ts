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
  careerResetConfirm:
    '!C!cFFFFFF나만의 리그 타자편!N초기화를 하시겠습니까?!N(!cFF0000G포인트 아이템도!N함께 삭제됩니다!cFFFFFF)', // [210]
} as const
