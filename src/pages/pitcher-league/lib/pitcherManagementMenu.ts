/**
 * 나만의리그 **투수편** 관리 화면의 메뉴 표 (원본 장면 **0x106** 의 상태 105·106·107 — R9 3절 확정).
 *
 * 원본은 한 장면 안의 상태 번호 하나로 화면을 돌리고 `[장면+0x24]`(뒤 상태) 로 제자리에 돌아온다.
 * 여기 표는 그 상태 번호를 그대로 적어 둔 것이다 — 웹은 화면 이름으로 같은 일을 한다.
 *
 * **커맨드 여섯 칸은 타자편과 같다** (키 0x1261c → 점프표 **0xcc540**, R9 3절 "105 관리 화면").
 * 원본 표에 모드 갈림이 없고, 설명서 StrHOWTO[11] 도 나만의리그 한 덩어리로
 * `[선수정보][트레이닝][휴식][외출][아이템][다음경기]` 여섯을 적는다 (`howto.json:11`).
 *
 * **투수편만 다른 곳은 하위 메뉴 두 군데**다:
 *   - 106 선수정보 칸 3: 타자는 곧장 필살타법 창(123)으로 가지만, **투수는 팝업 0x78**
 *     (StrMODE[59] "원하는 항목을 선택해주세요")을 먼저 띄우고 좌우로 고른 탭(1 또는 2)으로
 *     123(보기) 으로 간다. (지금 상태가 107 이면 108 훈련 창으로 간다 — R9 "106 선수정보 하위 메뉴")
 *   - 107 트레이닝 칸 0~3 은 **제구·구속·변화·체력**이고, 칸 4 는 같은 팝업 0x78 → **108** 이다
 *     (R7 4절 · `pitcherManagement.ts` 모듈 주석).
 *
 * ⚠️ **원본 배치 미해독 — 근사**: 원본 커맨드 줄은 32×32 아이콘 계단형(표 0xd4740 · 하위 0xd4758)이지만
 * 투수편 화면들(`PitcherRegisterScreen`·`PitchTrainingScreen`)은 모두 공용 판(`PixelScreen`) 위에
 * 줄만 세우는 웹판 껍데기라 여기서도 같은 관례를 따른다. 좌표는 쓰지 않는다.
 */

/** 105 커맨드 여섯 칸 — 점프표 0xcc540 차례 그대로 */
export type PitcherManagementCommand = '선수정보' | '트레이닝' | '휴식' | '외출' | '아이템' | '다음경기'

export interface PitcherMenuEntry {
  readonly id: string
  /** 이 칸이 가는 원본 상태 번호(10진). 팝업을 거치는 칸은 그 팝업이 열릴 때의 최종 상태다 */
  readonly state: number
  /** 칸 옆에 붙는 설명 — 없으면 화면이 그때그때 채운다 */
  readonly detail?: string
}

export const PITCHER_COMMAND_SLOTS: readonly (PitcherMenuEntry & { readonly id: PitcherManagementCommand })[] = [
  { id: '선수정보', state: 106 },
  { id: '트레이닝', state: 107 },
  // 칸 2 는 상태를 바로 바꾸지 않는다 — StrMODE[90] 팝업 0x2a 에 "예" 를 해야 127(휴식 실행)로 간다
  { id: '휴식', state: 127 },
  { id: '외출', state: 112 },
  { id: '아이템', state: 110 },
  // 원본은 109(다음 경기 앞 순위표) → 142(경기 준비) → 144 를 거쳐 경기 장면 0x104 로 간다
  { id: '다음경기', state: 109 },
]

/**
 * 106 선수정보 하위 메뉴 다섯 칸 — 점프표 **0xcc69c** (R9 3절).
 * 칸 3 이름은 타자편의 "필살타법" 자리이고 투수는 마구·구질 두 갈래라 "구질" 로 적는다
 * (원본 칸 이름표 그림 번호는 투수편 것이 문서에 없다 — **추정**).
 */
export const PITCHER_PLAYER_INFO_SLOTS: readonly PitcherMenuEntry[] = [
  { id: '기본정보', state: 119 },
  { id: '장비착용', state: 121 },
  { id: '아이템/스킬', state: 122 },
  { id: '구질', state: 123 },
  { id: '기록실', state: 124 },
]

/** 107 트레이닝 칸 4 와 106 칸 3 이 함께 쓰는 팝업 0x78 의 두 갈래 (탭 1·2) */
export const PITCH_WINDOW_CHOICES: readonly [string, string] = ['마구', '구질']

/**
 * ⚠️ **추정**: 팝업 0x78 은 좌우로 `+0x166` 을 토글해 탭 `+0x166 ? 2 : 1` 을 고른다(R9). 탭 1·2 중
 * 어느 쪽이 마구이고 어느 쪽이 구질인지는 문서에 없다 — `pitcherManagement.ts` 가 "그 창에 마구와
 * 구질 훈련이 함께 있다" 고만 적어 **탭 1 = 마구 · 탭 2 = 구질** 로 둔다.
 */
export const PITCH_WINDOW_TABS = { 마구: 1, 구질: 2 } as const

/** 팝업 글 (StrMODE 번호만 확정이고 원문은 표가 웹에 없어 뜻만 옮겼다) */
export const PITCHER_MANAGEMENT_TEXT = {
  /** StrMODE[59] — 팝업 0x78 */
  chooseItem: '원하는 항목을 선택해주세요',
  /** StrMODE[90] — 휴식 확인 (팝업 0x2a) */
  restQuestion: '휴식을 취하시겠습니까?',
  /** StrMODE[91] — 사기가 이미 최고 */
  moraleAlreadyFull: '사기 최고 상태입니다',
  /** StrMODE[192] — 능력치가 한계 */
  abilityAtLimit: '더 이상 능력치를 올릴 수 없습니다',
  /** StrMODE[193] — 사기가 0 이라 훈련 불가 */
  moraleEmpty: '사기가 부족하여 훈련할 수 없습니다',
  /** r_event_txt[176] — 한 주기에 트레이닝·휴식·외출 중 한 가지 */
  alreadyActed: '트레이닝·휴식·외출은 한 번에 한 가지만 할 수 있습니다',
  /** ⚠️ 웹판 문구 — 원본에는 없다. 아직 옮기지 않은 화면을 고른 자리 */
  notPorted: '아직 옮기지 않은 화면입니다',
} as const

/** StrMODE[85] "[%s훈련]을 하시겠습니까?" (0x12e40) */
export function trainingQuestionOf(menuName: string): string {
  return `[${menuName}훈련]을 하시겠습니까?`
}

/** 훈련 결과 글 — StrMODE[40+칸](투수 능력치 이름) + " " + 수치 + " " + StrMODE[83] (G 2절) */
export function trainingResultOf(abilityName: string, gain: number): string {
  return `${abilityName} ${gain} 상승하였습니다`
}
