import { HELP_LAST_BROWSABLE_CHAPTER } from '@/shared/config/helpSections'
import { helpScrollMetricsOf } from '@/pages/help/lib/helpPages'

/**
 * StrHOWTO 뷰어의 키 상태 — 뷰어 객체는 skin(전역 `0x1552cfc`) 그 자체다.
 *
 * | 칸 | 뜻 |
 * |---|---|
 * | `+0xe5` | 1 = **장 고르기**, 0 = **쪽 보기** |
 * | `+0xe6` | 장 (표 `0xd0b18` 의 번호) |
 * | `+0xfc` | 장 안의 쪽 |
 * | `+0x108` | 글의 맨 윗줄 (스크롤 — 쪽을 새로 읽는 `0x635d0` 이 `0x61c54` 로 0 으로 되돌린다) |
 * | `+0x45c` | 장 이동 잠금 (메인 메뉴 상태 10 [게임문의]만 1) |
 */
export interface HelpViewerState {
  readonly isChoosingChapter: boolean
  readonly chapter: number
  readonly page: number
  readonly scrollTop: number
}

/**
 * 여는 값 — `0x63688(skin, 장)` 은 `+0xe5 = 1`(장 고르기) · `+0xe6 = 0` · `+0xfc = 0` · `+0x45c = 0` 으로 연다
 * (0x6374c `strb 1, [+0xe5]` · 0x63798 `+0x45c = 0`). 메인 메뉴 상태 7 과 경기 중 [조작방법](0x3c260) 이 이 값 그대로다.
 * 상태 10 만 그 뒤 `+0xe5 = 0`(쪽 보기) · `+0xe6 = 6` · `+0x45c = 1` 로 고쳐 쓴다 (0x266a6~0x266c6).
 */
export function openHelpViewer(chapter: number, isLocked: boolean): HelpViewerState {
  return isLocked
    ? { isChoosingChapter: false, chapter, page: 0, scrollTop: 0 }
    : { isChoosingChapter: true, chapter, page: 0, scrollTop: 0 }
}

/**
 * 원본 키 — 위 −1 · 아래 −2 · 왼 −3 · 오른 −4 · OK −5 · CLR −16 (I-controls 키 코드).
 * `'2'`·`'8'` 은 줄 넘기기 `0x61ce4` 만 받는다(0x61cf4 `cmp 0x32` · 0x61cf8 `cmp 0x38`) — 점프표 `0xd1dbc` 에는 없다.
 */
export type HelpViewerKey = '위' | '아래' | '왼' | '오른' | 'OK' | 'CLR' | '2' | '8'

/** 키 하나를 먹은 뒤 — `'닫기'` 면 뷰어를 닫는다 */
export type HelpViewerStep = HelpViewerState | '닫기'

const BROWSABLE_CHAPTER_COUNT = HELP_LAST_BROWSABLE_CHAPTER + 1

/**
 * 쪽 보기의 줄 넘기기 **0x61ce4** — 0x637fc 가 `+0xe5 == 0`(쪽 보기)일 때만 점프표보다 먼저 부른다.
 * ```
 * 61cfe  위 −1 · '2':  전체 > 보이는 줄 && 맨 윗줄 > 0 이면  맨 윗줄−− · 손잡이 −= 걸음 (0 에서 멈춤)
 * 61d3e  아래 −2 · '8': 전체 > 보이는 줄 && 맨 윗줄 + 보이는 줄 < 전체 이면  맨 윗줄++ · 손잡이 += 걸음 (막대 − 10 에서 멈춤)
 * ```
 */
function scrollHelpText(state: HelpViewerState, key: HelpViewerKey, lineCount: number): HelpViewerState {
  const { maxTop } = helpScrollMetricsOf(lineCount)
  if (key === '위' || key === '2') {
    return maxTop > 0 && state.scrollTop > 0 ? { ...state, scrollTop: state.scrollTop - 1 } : state
  }
  if (key === '아래' || key === '8') {
    return maxTop > 0 && state.scrollTop < maxTop ? { ...state, scrollTop: state.scrollTop + 1 } : state
  }
  return state
}

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
 * `pageCount` 는 표 `0xd0b18[장]` 그대로다(`helpPageCountOf` — 빈 StrHOWTO[33] 도 한 쪽이라 장 6 은 4쪽).
 * `lineCount` 는 지금 쪽의 줄 수(`wrapHelpText`) — 쪽 보기의 줄 넘기기가 쓴다.
 * 쪽·장이 바뀌면 `0x635d0` 이 쪽을 새로 읽어 맨 윗줄을 0 으로 되돌린다. 쪽 보기 → 장 고르기(CLR)는 쪽을 다시 안 읽어 그대로 둔다.
 *
 * 닫기 연출은 뷰어 그리기 쪽 일이다(`HelpScreen` — `+0x125` 가 서면 곧장 닫는다).
 */
export function stepHelpViewer(
  state: HelpViewerState,
  key: HelpViewerKey,
  isLocked: boolean,
  pageCount: number,
  lineCount = 0,
): HelpViewerStep {
  // 0x637f4 — 쪽 보기면 줄 넘기기를 먼저 (위·아래·'2'·'8' 만 본다)
  const scrolled = state.isChoosingChapter ? state : scrollHelpText(state, key, lineCount)
  switch (key) {
    case 'OK':
    case '아래':
      if (isLocked || !state.isChoosingChapter) return scrolled
      return { ...state, isChoosingChapter: false }
    case 'CLR':
      if (isLocked || state.isChoosingChapter) return '닫기'
      return { ...state, isChoosingChapter: true }
    case '왼':
    case '오른': {
      const step = key === '오른' ? 1 : -1
      if (state.isChoosingChapter) {
        const chapter = (state.chapter + step + BROWSABLE_CHAPTER_COUNT) % BROWSABLE_CHAPTER_COUNT
        return { ...state, chapter, page: 0, scrollTop: 0 }
      }
      return { ...state, page: (state.page + step + pageCount) % pageCount, scrollTop: 0 }
    }
    case '위':
    case '2':
    case '8':
      return scrolled
  }
}
