import { ORIGINAL_HOWTO } from '@/shared/config/original/howto'

/**
 * 도움말 묶음 — 본문은 원본 StrHOWTO 그대로다.
 *
 * 묶음 경계는 각 모드 설명이 "<…에 대하여>" 항목으로 시작하는 것을 따라 나눴다
 * (원본 도움말 메뉴의 배치 자체는 코드 안에 있어 아직 모른다). [33] 은 원본이 빈 문자열이다.
 */
export interface HelpSection {
  readonly title: string
  readonly pages: readonly string[]
}

/** [32] 게임문의의 %s 는 버전이다. 타이틀 그림(main_title/006)에 v1.0 이 찍혀 있다. */
export const GAME_VERSION = '1.0'

const pagesOf = (indexes: readonly number[]): string[] =>
  indexes.map((index) => ORIGINAL_HOWTO[index]).filter((page) => page !== undefined && page !== '')

export const HELP_SECTIONS: readonly HelpSection[] = [
  { title: '기본 조작', pages: pagesOf([0, 1, 2, 3, 4]) },
  { title: '일반모드', pages: pagesOf([5, 6, 7, 8, 9]) },
  { title: '나만의리그', pages: pagesOf([10, 11, 12, 13, 14, 15, 16]) },
  { title: '시즌모드', pages: pagesOf([17, 18, 19, 20, 21, 22]) },
  { title: '대전모드', pages: pagesOf([23, 24, 25]) },
  { title: '홈런더비', pages: pagesOf([26]) },
  { title: '미션모드', pages: pagesOf([27]) },
  { title: '스페셜', pages: pagesOf([28, 29]) },
  { title: '환경설정', pages: pagesOf([30, 31]) },
  { title: '게임문의', pages: pagesOf([32, 33, 34, 35]) },
]
