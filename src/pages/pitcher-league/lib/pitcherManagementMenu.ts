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
 * 이 표는 메뉴 뜻(칸 id · 글)만 담는다 — 좌표는 쓰지 않는다. 커맨드 줄 그림은 `pitcherCommandBar`(0x7e418),
 * 등록(0x66 · 0x67)은 `pitcherRegisterLayout`, 구질 훈련 창(108 탭 2)은 `pitchTrainingWindow` 가 원본 배치를 맡는다.
 */
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'

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

/**
 * 110 아이템 하위 메뉴 세 칸 → 확인하면 **111 상점**(고른 칸이 창 종류) — 키 0x11478 에 모드 갈림이 없다
 * (R9 3절 "110 아이템 하위 메뉴"). 칸 이름은 타자편 관리 화면 표 0xd4758 과 같다.
 * 세 칸 모두 투수편 상점으로 간다 — 장착(창 종류 3, `pitcherEquipment.ts`) · 서브(1)·GP(2) (`pitcherItems.ts`).
 */
export const PITCHER_ITEM_SLOTS: readonly PitcherMenuEntry[] = [
  { id: '장착', state: 111 },
  { id: '서브', state: 111 },
  { id: 'GP', state: 111 },
]

/** 107 트레이닝 칸 4 와 106 칸 3 이 함께 쓰는 팝업 0x78 의 두 갈래 (탭 1·2) */
export const PITCH_WINDOW_CHOICES: readonly [string, string] = ['마구', '구질']

/**
 * 팝업 0x78 은 좌우로 `+0x166` 을 토글해 탭 `+0x166 ? 2 : 1` 을 고른다 — 키 0x19398 이 [[장면+0xe0]+0x188] 에 적는다(193ca~19422).
 * **탭 1 = 마구 · 탭 2 = 구질** 은 확정(2026-10-14): 그리기 0x190f8 이 +0x166 == 0 일 때 고르는 왼쪽 칸 글이 img_text 308 "마구",
 * 오른쪽이 309 "변화구"다(`PitchChoicePopup`).
 */
export const PITCH_WINDOW_TABS = { 마구: 1, 구질: 2 } as const

/** StrMODE 글 — 알림 창(`MessageBox`)이 `!C` 를 붙여 그리므로 앞의 가운데 맞춤 표시는 뗀다 */
const modeText = (index: number): string => (ORIGINAL_MODE_TEXT[index] ?? '').replace(/^!C/, '')

/** 투수 능력치 이름 StrMODE[40+칸] (제구·구속·변화·체력) — 키 0x12d48 의 `adds r1,#0x28` (12ea6 · 12f80) */
const PITCHER_ABILITY_NAME_BASE = 0x28

/**
 * 팝업 글 — 모두 원문 표(`ORIGINAL_MODE_TEXT`)에서 읽는다 (r216 화면 글 감사).
 * 예전에는 59 · 69 · 71 · 72 · 73 · 192 · 193 을 번호만 맞추고 뜻만 옮겨 적었다.
 */
export const PITCHER_MANAGEMENT_TEXT = {
  /** StrMODE[59] — 팝업 0x78 (그리기 0x190f8) */
  chooseItem: modeText(59),
  /**
   * StrMODE[90] — 휴식 확인 (팝업 0x2a). 105 키 0x1261c 휴식 칸(12682~126bc)이 사기 0xa3a25 == 100 이 아니면
   * `0x702b5([장면+0x144], 0x5a)` 로 이 글을 꺼내 팝업 0x2a 를 세운다 — 모드 갈래가 없어 타자편(`useManagementMenu`)과 같은 글이다
   */
  restQuestion: ORIGINAL_MODE_TEXT[90] ?? '',
  /** StrMODE[91] — 사기가 이미 최고 (같은 칸 1269a `movs r1, #0x5b` · 팝업 1) */
  moraleAlreadyFull: ORIGINAL_MODE_TEXT[91] ?? '',
  /** StrMODE[193] — 사기가 0 이라 훈련 불가 (키 0x12d48: 12d90 `0xa3a25 == 0` → 12da2 `movs r1,#0xc1`) */
  moraleEmpty: modeText(193),
  /** StrMODE[69] — 123 창에서 이미 쓰는 마구를 또 고름 (키 0x17cec) */
  magicAlreadyInUse: modeText(69),
  /** StrMODE[71] — 아직 배우지 않은 마구 · 구질 칸 (키 0x17cec · 0x17df8) */
  magicNeedsTraining: modeText(71),
  /** StrMODE[72] — 이미 쓰는 구질 (키 0x17df8) */
  pitchAlreadyInUse: modeText(72),
  /** StrMODE[73] — 구질 고르기 확인 (키 0x17df8) */
  pitchUseQuestion: modeText(73),
  /** StrMODE[63] — 마구를 다 배웠다 (108 창 0x17828 과 같은 글) */
  magicAllTrained: modeText(63),
  /** StrMODE[65] — G포인트가 모자란다 */
  gamePointShortage: modeText(65),
  /** ⚠️ 웹판 문구 — 원본에는 없다. 아직 옮기지 않은 화면을 고른 자리 */
  notPorted: '아직 옮기지 않은 화면입니다',
} as const

/** StrMODE[40+칸] — 투수 능력치 이름 (칸 0 제구 · 1 구속 · 2 변화 · 3 체력) */
export function pitcherAbilityTextOf(slot: number): string {
  return ORIGINAL_MODE_TEXT[PITCHER_ABILITY_NAME_BASE + slot] ?? ''
}

/**
 * StrMODE[192] "[%s] 능력치가 최대입니다" — 키 0x12d48 이 `b6414(선수, 칸, 0)` ≥ 한계면
 * 12ef2 `0x702b5(…, 0xc0)` 에 %s = StrMODE[0x28 + 칸](12f0a~12f10, 타자는 0x23 + 칸) 을 끼워 sprintf 한다 (0x1400468)
 */
export function abilityAtLimitTextOf(slot: number): string {
  return modeText(192).replace('%s', pitcherAbilityTextOf(slot))
}

/** StrMODE[62] "인기도가 부족합니다. 필요한 인기도 : %d" */
export function popularityShortageTextOf(required: number): string {
  return modeText(62).replace('%d', String(required))
}

/** StrMODE[70] "[%s] 을 사용하시겠습니까?" — 123 창의 마구 고르기 확인 (0x17cec), %s = 마구 이름 */
export function useQuestionOf(name: string): string {
  return modeText(70).replace('%s', name)
}

/**
 * StrMODE[85] "[%s훈련]을 하시겠습니까?" — 키 0x12d48 12f28~12f82: %s = StrMODE[0x28 + 칸](투수 · 타자는 0x23 + 칸)
 */
export function trainingQuestionOf(slot: number): string {
  return modeText(85).replace('%s', pitcherAbilityTextOf(slot))
}
