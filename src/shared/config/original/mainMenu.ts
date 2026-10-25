/**
 * 원작 메인 메뉴 구성.
 *
 * - 글자 그림: ui/main_ui.pzx 합성 프레임 (frames/NNN.png)
 * - 설명 문구: data/StrMAINMENU.zt1 — 대괄호 안 번호가 원본 인덱스다
 * - 순서: StrMAINMENU 의 설명 순서를 그대로 따른다
 *
 * isAvailable 은 원작 여부가 아니라 **이 웹판에서 아직 만들었는지**다.
 *
 * 두 단 = 원본 장면 0x103 의 하위 상태 **4(처음 메뉴 `TOP_MENU`)** 와 **5(게임시작 목록
 * `GAME_START_MENU`)** 다. 4 에서 [게임시작] 을 고르면 5 로 내려가고(진입 0x25b88), 5 에서 CLR 을
 * 누르면 4 로 돌아온다(갱신 0x28cb0 의 `0xbcb49(this+0x18, 4)`).
 * 글자 그림 번호는 상태 5 의 표 0xceb28 (6·7·8·9·10·13·12) 이 `main_ui` 프레임과 그대로 맞고
 * (P6-screens 2d 확정), 처음 메뉴 쪽 0~5 는 프레임 그림을 눈으로 확인해 붙였다
 * (000 게임시작 · 001 스페셜 · 002 도움말 · 003 환경설정 · 004 랭킹 · 005 게임문의).
 */
import { ORIGINAL_MAIN_MENU_TEXT } from '@/shared/config/original/mainMenuText'

export interface MainMenuEntry {
  readonly id: string
  readonly labelFrame: number
  readonly description: string
  readonly isAvailable: boolean
}

export const TOP_MENU: readonly MainMenuEntry[] = [
  { id: '게임시작', labelFrame: 0, isAvailable: true, description: ORIGINAL_MAIN_MENU_TEXT[0] ?? '' }, // [0]
  { id: '스페셜', labelFrame: 1, isAvailable: true, description: ORIGINAL_MAIN_MENU_TEXT[1] ?? '' }, // [1]
  { id: '도움말', labelFrame: 2, isAvailable: true, description: ORIGINAL_MAIN_MENU_TEXT[2] ?? '' }, // [2]
  { id: '환경설정', labelFrame: 3, isAvailable: true, description: ORIGINAL_MAIN_MENU_TEXT[3] ?? '' }, // [3]
  { id: '랭킹', labelFrame: 4, isAvailable: false, description: ORIGINAL_MAIN_MENU_TEXT[4] ?? '' }, // [4]
  { id: '게임문의', labelFrame: 5, isAvailable: false, description: ORIGINAL_MAIN_MENU_TEXT[209] ?? '' }, // [209]
]

export const GAME_START_MENU: readonly MainMenuEntry[] = [
  { id: '최근게임', labelFrame: 6, isAvailable: true, description: ORIGINAL_MAIN_MENU_TEXT[6] ?? '' }, // [6]
  { id: '일반모드', labelFrame: 7, isAvailable: true, description: ORIGINAL_MAIN_MENU_TEXT[7] ?? '' }, // [7]
  { id: '나만의리그', labelFrame: 8, isAvailable: true, description: ORIGINAL_MAIN_MENU_TEXT[8] ?? '' }, // [8]
  { id: '시즌모드', labelFrame: 9, isAvailable: true, description: ORIGINAL_MAIN_MENU_TEXT[9] ?? '' }, // [9]
  { id: '대전모드', labelFrame: 10, isAvailable: false, description: ORIGINAL_MAIN_MENU_TEXT[10] ?? '' }, // [10]
  { id: '홈런더비', labelFrame: 13, isAvailable: true, description: ORIGINAL_MAIN_MENU_TEXT[11] ?? '' }, // [11]
  { id: '미션모드', labelFrame: 12, isAvailable: true, description: ORIGINAL_MAIN_MENU_TEXT[12] ?? '' }, // [12]
]

/** [14] 나만의리그 편 고르기 창 질문 (하위 상태 13 진입 0x25d78, 종류 0x10 — 타자편·투수편 두 칸) */
export const NARI_EDITION_PROMPT = ORIGINAL_MAIN_MENU_TEXT[14] ?? ''

/**
 * [13] 일반모드 진입 창 질문 (하위 상태 12 0x296f0, 종류 0x10 — 이어하기·새로하기·빠른실행 세 칸).
 */
export const GENERAL_MODE_PROMPT = ORIGINAL_MAIN_MENU_TEXT[13] ?? ''

/**
 * [15] 일반모드 새로하기 확인 (0x296f0 단계 1 → 종류 0x82). 원본에서 [15] 를 쓰는 곳은 0x296f0 둘뿐이다
 * (0x2989e · 0x2993c `0x702b5(표, 0xf)`) — 나만의리그 진입은 이 창을 띄우지 않는다. 원문 그대로 (`StrMAINMENU.json`).
 */
export const NEW_GAME_CONFIRM = ORIGINAL_MAIN_MENU_TEXT[15] ?? ''

/**
 * [115] 대전모드를 고를 때 시즌 커리어(전역기록 +0x42)가 없으면 뜨는 확인 팝업 문구.
 * 원본 갱신 0x28cb0 → 0x28dcc 가 StrMAINMENU[0x73 = 115] 로 띄운다 (R11-special-leftovers 4-1 확정).
 */
export const SEASON_FIRST_NOTICE = ORIGINAL_MAIN_MENU_TEXT[115] ?? ''
