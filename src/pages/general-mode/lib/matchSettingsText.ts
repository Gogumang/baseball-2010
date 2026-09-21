/**
 * **경기진행 설정 창의 문구 표** — R4 4절 확정(문자열 VA·표), 그림 글자는 유력(눈으로 읽음).
 *
 * 창은 경기정보(상태 22)에서 `0` 으로 열고 **일반모드(모드 1)에서만** 열린다
 * (0x31432 `cmp r3,#1`). 시즌모드는 같은 창을 구단관리 쪽에서 연다.
 * 설정 값의 뜻과 경기 루프 판정은 `features/play-team-game/model/matchSettings.ts` 가 이미 가진다 —
 * 여기 있는 것은 **화면에 나갈 글과 그림 번호**뿐이다.
 *
 * ⚠️ 아래 설명 글들은 StrMODE·StrHOWTO 가 아니라 `binary.mod` 안에 박힌 문자열(0xd2180 …)이라
 *    웹판 문자열 표에 들어 있지 않다. 번호로 읽을 수 없어 **원문을 그대로 적고 VA 를 주석에 남긴다**.
 */

/** 종류 `+0x2bc` — 0 찬스 · 1 이닝 · 2 상세 */
export interface SettingKindText {
  /** img_text 프레임 (표 0xd1c70) */
  readonly nameFrame: number
  readonly name: string
  /** 표 0xd1c7c */
  readonly description: string
}

export const SETTING_KIND_TEXTS: readonly SettingKindText[] = [
  // 0xd2180
  { nameFrame: 399, name: '찬스 플레이', description: '미리 정해진 상황에 맞춰 플레이를 진행합니다' },
  // 0xd21b8
  { nameFrame: 400, name: '이닝 플레이', description: '시작 이닝을 선택하여 경기 중간부터 시작 할 수 있습니다' },
  // 0xd21fc
  { nameFrame: 401, name: '상세 플레이', description: '유저가 조작할 선수와 시점을 자유롭게 선택할 수 있습니다' },
]

/** 찬스 값 `+0x2bd` (표 0xd1c88) — 경기 루프 0xc1e04 의 마스크 6(2·3루) / 4(3루) 와 맞다 */
export const CHANCE_VALUE_TEXTS: readonly string[] = [
  // 0xd2240
  '공격 중 2, 3루에 주자가 있을 때 타자로 플레이 합니다',
  // 0xd2280
  '수비 중 3루에 주자가 있을 때 투수로 플레이 합니다',
]

/** 이닝 값 `+0x2bd` (표 0xd1c90 그림 / 0xd1c9c 설명) */
export interface InningValueText {
  readonly nameFrame: number
  readonly name: string
  readonly description: string
}

export const INNING_VALUE_TEXTS: readonly InningValueText[] = [
  // 0xd22c0 — 이닝idx 조건 없음
  { nameFrame: 404, name: '자동진행 없음', description: '모든 이닝을 직접 플레이 합니다' },
  // 0xd22ec — 이닝idx > 2 → 4회부터 직접
  { nameFrame: 405, name: '3이닝 자동진행', description: '설정된 3이닝까지 자동 진행 후 다음 이닝부터 플레이 합니다' },
  // 0xd2334 — 이닝idx > 5 → 7회부터 직접
  { nameFrame: 406, name: '6이닝 자동진행', description: '설정된 6이닝까지 자동 진행 후 다음 이닝부터 플레이 합니다' },
]

/**
 * 상세 줄 `+0xe6` 0..4.
 *
 * ⚠️ 줄 설명 StrMAINMENU[121]~[124] 의 **원문이 웹판 문자열 표에 없다**(mainMenu.ts 는 손으로 적은
 *    메뉴 설명만 들고 있다). 노트가 옮긴 뜻만 적는다 — 원문이 들어오면 번호로 바꿔 읽을 것.
 */
export interface DetailRowText {
  readonly name: string
  /** 칸 수 — 타순·이닝은 9칸, 주자는 3칸(1·2·3루) */
  readonly cells: number
  readonly meaning: string
}

export const DETAIL_ROW_TEXTS: readonly DetailRowText[] = [
  { name: '타자조작', cells: 9, meaning: '지정한 타순의 타석을 직접 친다' },
  { name: '공격주자', cells: 3, meaning: '지정한 베이스에 주자가 있으면 직접 친다' },
  { name: '투수조작', cells: 9, meaning: '지정한 이닝에 직접 던진다 (9번 칸은 9회와 연장 전부)' },
  { name: '수비주자', cells: 3, meaning: '지정한 베이스에 주자가 있으면 직접 던진다' },
]

/** 상세의 마지막 줄 — 확인 */
export const DETAIL_CONFIRM_ROW = 4

/** StrMAINMENU[125] — 확인 창 (원문은 R4 4절에서 옮겼다) */
export const SETTINGS_CONFIRM_TEXT = '현재 설정으로 플레이하시겠습니까?'
/** StrMAINMENU[126] — 상세에서 네 값이 모두 0 일 때 */
export const SETTINGS_EMPTY_TEXT = '최소 한가지 항목은 선택해야 합니다'
