import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { matchedBatterTitleNumbers } from '@/entities/career/model/titles/batterRules'
import { matchedCommonTitleNumbers } from '@/entities/career/model/titles/commonRules'
import { TITLE_NAMES, titleDisplayNameOf, titleNumberOf } from '@/entities/career/model/titles/names'
import { titleSubjectOfBatter } from '@/entities/career/model/titles/subject'

/** StrMODE[138] "닉네임이 적용되었습니다" — 장착 팝업이 쓴다 (0x11fe2) */
const EQUIPPED_TITLE_TEXT = 138

/** 번호를 이름으로 바꾸고, 이미 가진 것은 뺀다 (원본은 비트 검사 0xa4088 이 같은 일을 한다) */
export function unownedTitleNamesOf(numbers: readonly number[], owned: readonly string[]): readonly string[] {
  return [...numbers]
    .sort((left, right) => left - right)
    .map((index) => TITLE_NAMES[index])
    .filter((title) => !owned.includes(title))
}

/** 장착 없음 — 원본 선수 +0x1c4 의 −1 (0x11292) */
export const NO_EQUIPPED_TITLE = -1

/**
 * 지금 장착한 칭호 이름 (선수 +0x1c4 → StrNICKNAME[번호]).
 *
 * 원본은 +0x1c4 < 0 이면 기본정보 창에 칭호 줄 자체를 안 그린다 (0x7d5cc, P3 10-1).
 * 웹은 상태판에 늘 한 줄을 쓰고 있어, 장착값이 없거나 이름표 밖이면 **예전처럼 마지막에 얻은 것**을
 * 쓴다 — 옛 저장에는 +0x1c4 칸이 없어서다.
 */
export function currentTitleOf(career: PlayerCareer): string {
  return TITLE_NAMES[career.equippedTitle] ?? career.titleIds[career.titleIds.length - 1] ?? TITLE_NAMES[0]
}

/**
 * 칭호 목록(상태 129)에서 하나를 고른다 — 키 처리 0x11f78 의 확인 갈래:
 * `if 선수+0x1c4 != sel: 선수+0x1c4 = sel` 뒤 팝업 → 저장. 이미 장착한 것이면 **아무 일도 없다**.
 */
export function equipTitle(career: PlayerCareer, title: string): PlayerCareer {
  const index = titleNumberOf(title)
  if (index < 0 || index === career.equippedTitle) return career
  return { ...career, equippedTitle: index }
}

/**
 * 장착 확인 팝업 글 (0x11fd8~0x12040) — **"!C"(0xcc210) + 이름 + StrMODE[138]** 을 그냥 이어 붙인다(strcpy 0xbc75d · strcat 0xbc965).
 * [138] 이 `!N` 으로 시작해서 이름 다음 줄에 "닉네임이 적용되었습니다" 가 온다. 두 줄 다 가운데다.
 * 이름은 원문 StrNICKNAME 그대로(끝 빈칸 포함) — r225 가 앞의 "!C" 와 함께 바로잡았다(예전 웹은 왼쪽 맞춤 · 빈칸 뗀 이름).
 */
export function equipTitleNoticeOf(title: string): string {
  return `!C${titleDisplayNameOf(title)}${ORIGINAL_MODE_TEXT[EQUIPPED_TITLE_TEXT] ?? ''}`
}

/** 조건을 만족했지만 아직 얻지 않은 칭호 (원본 번호 순) */
export function evaluateNewTitles(career: PlayerCareer): readonly string[] {
  const subject = titleSubjectOfBatter(career)
  const numbers = [...matchedCommonTitleNumbers(subject), ...matchedBatterTitleNumbers(career)]
  return unownedTitleNamesOf(numbers, career.titleIds)
}

/**
 * 원본이 실제로 주는 **하나** (0x1a1c0 은 처음 맞는 하나만 this+0x270 에 쓴다).
 * 확인(0x1b1e4)하면 다음 프레임에 다시 판정해서 이어서 준다 — 세션이 관리 화면에서 이 하나를 팝업으로 띄운다
 * (`useCareerSession.pendingTitle`).
 */
export function nextTitleOf(career: PlayerCareer): string | null {
  return evaluateNewTitles(career)[0] ?? null
}

/**
 * 칭호를 준다. 원본은 팝업 확인 때 비트를 켜고 **곧바로 장착**한다 (0x1b214 `선수+0x1c4 = i`).
 * 세션은 관리 화면 팝업에서 하나씩 넘긴다. 여러 개를 한꺼번에 넘기면(중간평가 1·9 처럼 판정 함수 밖에서 번호만 넣는 곳)
 * 번호가 가장 큰 것이 장착으로 남는다 — 원본도 번호 오름차순으로 하나씩 이어 주므로 같다.
 */
export function awardTitles(career: PlayerCareer, titles: readonly string[]): PlayerCareer {
  if (titles.length === 0) return career
  const given = [...titles].map(titleNumberOf).filter((index) => index >= 0)
  const equipped = given.length === 0 ? career.equippedTitle : Math.max(...given)
  return { ...career, titleIds: [...career.titleIds, ...titles], equippedTitle: equipped }
}
