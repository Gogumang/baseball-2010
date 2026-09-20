import { ORIGINAL_HOWTO } from '@/shared/config/original/howto'

/**
 * 도움말 장(章) — 본문은 원본 StrHOWTO 그대로다.
 *
 * 묶음은 **원본 장 표 `0xd0b18` = `[5, 5, 7, 6, 3, 6, 4]`** 그대로다 (S12 2-3 확정).
 * 합이 정확히 **36** 으로 StrHOWTO 항목 수와 같다. 뷰어(0x63688 끝, 0x63776~0x63794)는
 * `시작 = Σ 0xd0b18[0..장−1]` 로 첫 쪽을 잡는다.
 *
 * ```
 * 0 기본 조작 [0]~[4]   · 1 일반모드 [5]~[9]    · 2 나만의리그 [10]~[16] · 3 시즌모드 [17]~[22]
 * 4 대전모드 [23]~[25]  · 5 홈런더비·미션·스페셜·환경설정 [26]~[31]      · 6 게임문의 [32]~[35]
 * ```
 * [33] 은 원본이 빈 문자열이다.
 *
 * 앞서 열 묶음으로 나눴던 것은 원본과 달랐다 — 홈런더비·미션모드·스페셜·환경설정 넷이 **한 장**이다.
 */
export interface HelpSection {
  readonly title: string
  readonly pages: readonly string[]
}

/** 장 표 0xd0b18 (s8) — 장마다 담긴 StrHOWTO 항목 수 */
export const HELP_CHAPTER_LENGTHS: readonly number[] = [5, 5, 7, 6, 3, 6, 4]

/**
 * 메인 메뉴 도움말(상태 7)에서 돌아다닐 수 있는 장은 **0~5 여섯 개**다
 * (0x638be `movs r4, #5` 되감기 · 0x63914 `cmp r0, #4; bgt`).
 * 마지막 장 6 **게임문의**는 제 메뉴 칸(상태 10)에서만 열리고 그때는 장 이동이 잠긴다([뷰어+0x45c] = 1).
 */
export const HELP_LAST_BROWSABLE_CHAPTER = 5
export const GAME_INQUIRY_CHAPTER = 6

/** [32] 게임문의의 %s 는 버전이다. 타이틀 그림(main_title/006)에 v1.0 이 찍혀 있다. */
export const GAME_VERSION = '1.0'

const pagesOf = (indexes: readonly number[]): string[] =>
  indexes.map((index) => ORIGINAL_HOWTO[index]).filter((page) => page !== undefined && page !== '')

/** 장 표를 누적해 그 장의 StrHOWTO 항목 번호를 낸다 (0x63776~0x63794 와 같은 식) */
const chapterIndexes = (chapter: number): number[] => {
  let start = 0
  for (let index = 0; index < chapter; index += 1) start += HELP_CHAPTER_LENGTHS[index]
  return Array.from({ length: HELP_CHAPTER_LENGTHS[chapter] }, (_page, offset) => start + offset)
}

/** 장 이름 — 원본에는 장 제목 문자열이 따로 없어 각 장 첫 쪽의 "<…에 대하여>" 를 따랐다 */
const CHAPTER_TITLES: readonly string[] = [
  '기본 조작',
  '일반모드',
  '나만의리그',
  '시즌모드',
  '대전모드',
  '홈런더비·미션·스페셜·환경설정',
  '게임문의',
]

export const HELP_SECTIONS: readonly HelpSection[] = CHAPTER_TITLES.map((title, chapter) => ({
  title,
  pages: pagesOf(chapterIndexes(chapter)),
}))
