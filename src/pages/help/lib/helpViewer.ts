import { HELP_LAST_BROWSABLE_CHAPTER } from '@/shared/config/helpSections'

/**
 * StrHOWTO 뷰어의 키 상태 — 뷰어 객체는 skin(전역 `0x1552cfc`) 그 자체다.
 *
 * | 칸 | 뜻 |
 * |---|---|
 * | `+0xe5` | 1 = **장 고르기**, 0 = **쪽 보기** |
 * | `+0xe6` | 장 (표 `0xd0b18` 의 번호) |
 * | `+0xfc` | 장 안의 쪽 |
 * | `+0x45c` | 장 이동 잠금 (메인 메뉴 상태 10 [게임문의]만 1) |
 */
export interface HelpViewerState {
  readonly isChoosingChapter: boolean
  readonly chapter: number
  readonly page: number
}

/**
 * 여는 값 — `0x63688(skin, 장)` 은 `+0xe5 = 1`(장 고르기) · `+0xe6 = 0` · `+0xfc = 0` · `+0x45c = 0` 으로 연다
 * (0x6374c `strb 1, [+0xe5]` · 0x63798 `+0x45c = 0`). 메인 메뉴 상태 7 과 경기 중 [조작방법](0x3c260) 이 이 값 그대로다.
 * 상태 10 만 그 뒤 `+0xe5 = 0`(쪽 보기) · `+0xe6 = 6` · `+0x45c = 1` 로 고쳐 쓴다 (0x266a6~0x266c6).
 */
export function openHelpViewer(chapter: number, isLocked: boolean): HelpViewerState {
  return isLocked
    ? { isChoosingChapter: false, chapter, page: 0 }
    : { isChoosingChapter: true, chapter, page: 0 }
}

/** 원본 키 — 위 −1 · 아래 −2 · 왼 −3 · 오른 −4 · OK −5 · CLR −16 (I-controls 키 코드) */
export type HelpViewerKey = '위' | '아래' | '왼' | '오른' | 'OK' | 'CLR'

/** 키 하나를 먹은 뒤 — `'닫기'` 면 뷰어를 닫는다 */
export type HelpViewerStep = HelpViewerState | '닫기'

const BROWSABLE_CHAPTER_COUNT = HELP_LAST_BROWSABLE_CHAPTER + 1

/**
 * 뷰어 키 **0x637d0** (점프표 `0xd1dbc` = 키 + 16):
 * ```
 * 637fc  +0xe5 == 0(쪽 보기)이면 0x61ce4(뷰어, 키) — 위·'2' / 아래·'8' 로 글 줄을 올리고 내린다
 * −5 OK · −2 아래 → 63828  잠김이면 끝 · 장 고르기면 +0xe5 = 0(쪽 보기로)
 * −16 CLR        → 63840  잠김 → 닫기 · 장 고르기 → 닫기 · 쪽 보기 → +0xe5 = 1(장 고르기로)
 * −3 왼          → 638a0  장 고르기: +0xfc = 0 · 장 = 장 > 0 ? 장 − 1 : 5 / 쪽 보기: 쪽 = 쪽 > 0 ? 쪽 − 1 : 쪽수 − 1
 * −4 오른        → 638fe  장 고르기: +0xfc = 0 · 장 = 장 ≤ 4 ? 장 + 1 : 0 / 쪽 보기: 쪽 = 쪽 < 쪽수 − 1 ? 쪽 + 1 : 0
 * −1 위 · 그 밖  → 63964  아무것도 안 한다
 * ```
 * 왼·오른은 잠금(+0x45c)을 안 본다 — 상태 10 은 쪽 보기로 열려 쪽만 넘긴다.
 *
 * `pageCount` 는 원본이면 표 `0xd0b18[장]` 이다. 웹은 빈 StrHOWTO 항목([33])을 빼고 세므로(`helpSections.ts`)
 * 부르는 쪽이 보이는 쪽수를 넘긴다 — 장 6 만 4 → 3 으로 다르다(빈 쪽을 원본 0x635d0 이 어떻게 그리는지 안 읽었다).
 *
 * ⚠️ 안 옮긴 것: 쪽 보기의 위·아래 줄 넘기기(0x61ce4 — 글이 칸보다 길 때만, 칸 높이는 뷰어 0x58d10 미해독)와
 *    닫기 연출(`+0x94 = 1` · `+0x98 = 0` · `+0x99 = 0` 뒤 `+0x99 == 0 && +0x98 ≠ 0` 이 될 때 1 을 돌려준다 — 몇 틱 걸리는지 안 읽었다).
 */
export function stepHelpViewer(
  state: HelpViewerState,
  key: HelpViewerKey,
  isLocked: boolean,
  pageCount: number,
): HelpViewerStep {
  switch (key) {
    case 'OK':
    case '아래':
      if (isLocked || !state.isChoosingChapter) return state
      return { ...state, isChoosingChapter: false }
    case 'CLR':
      if (isLocked || state.isChoosingChapter) return '닫기'
      return { ...state, isChoosingChapter: true }
    case '왼':
    case '오른': {
      const step = key === '오른' ? 1 : -1
      if (state.isChoosingChapter) {
        const chapter = (state.chapter + step + BROWSABLE_CHAPTER_COUNT) % BROWSABLE_CHAPTER_COUNT
        return { ...state, chapter, page: 0 }
      }
      return { ...state, page: (state.page + step + pageCount) % pageCount }
    }
    case '위':
      return state
  }
}
