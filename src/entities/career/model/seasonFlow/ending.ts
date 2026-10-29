import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { hasSkill } from '@/entities/career/model/playerCareer'
import { ROMANCE_EVENT_IDS } from '@/entities/career/model/titles'
import { isBugFixed } from '@/shared/config/bugfixes'

export const FINAL_YEAR = 13
const LEGEND_SKILL = 7
export const FIRST_ENDING_YEAR = 7
/** 소지금 판정 단위(100만원) — 웹판 소지금은 만원 단위다 */
const MONEY_UNIT = 100

/**
 * 판정 0xa3a84 의 −1(판정 없음 — 7~13년차 인기도가 정확히 1000 이거나 7년차 전) 을 141 이 그대로 받은 값.
 * 141 진입 0x12300 은 `e = 0xa3a85(S)` 를 고치지 않고 엔딩 판 0x87c7c 에 넘긴다 — 그 화면은 `EndingScreen` 머리말(141 의 e = −1).
 */
export const NO_ENDING_JUDGEMENT = -1

/**
 * **저장에 드는 커리어** — 엔딩 141 은 보너스 팝업을 닫기 전까지 커리어를 저장하지 않는다.
 * - 141 진입 0x12300 은 S+0x50 = 6 을 메모리에만 쓰고(1230e — 0x22755 를 부르지 않는다), 엔딩 판 0x87c7c 는 전역기록만
 *   저장한다(0x1f1b9).
 * - 141 틀 0x1bbc4 에서 커리어를 저장하는 자리는 보너스 팝업 0x2b 를 닫는 1bc64~1bc70(그 앞 1bc5e 가 S+0x7b = 1) 하나다.
 *   판정 없음(e = −1)은 팝업이 안 뜨고(키 0x1220c `ble`), 부상 · 방출(e = 0 · 1)은 이어하기 팝업 0x32 라 "예"(1bd52~)가 G 를 빼고
 *   전역기록만 저장한 뒤 105(진입이 S+0x50 = 3 · 저장) · 새 시즌 0x1b768(저장)로 가고 "아니오"(1be46)는 메인 메뉴다.
 *   은퇴(e ≥ 2)도 보너스가 0 이거나 S+0x7b 가 서 있으면 0x2b 없이 0x2d 다.
 * 곧 보너스를 받기(`endingBonusReceived`) 전 엔딩은 저장이 114 끝 0x8b0e4(1c02e)가 쓴 것 그대로라 다시 켜면 그때의 S+0x50 으로
 * 돌아간다(132 의 503 이면 9 → 502 다시). 받은 뒤 저장은 S+0x50 = 6 이라 이어하기가 141 로 간다(0x1c154 1c24e — `resumePointOf`).
 * 웹은 엔딩 번호를 커리어 칸에 두므로 보너스 전에는 그 칸만 비워 저장한다 — 메모리의 커리어(화면 · 기록연감 +0xa7)는 그대로다.
 */
export function savedCareerOf<C extends { readonly endingIndex: number | null; readonly endingBonusReceived?: boolean }>(career: C): C {
  return career.endingIndex !== null && career.endingBonusReceived !== true ? { ...career, endingIndex: null } : career
}

/** 부상 중 이만큼 경기를 치르면 부상 엔딩 (0xa3a84 의 `+0x1b6 > 19`) */
const INJURED_GAMES_FOR_ENDING = 20

/** 7년차 인기도가 이 값 이하면 방출(1) — 0xa3a84 */
const RELEASE_POPULARITY_MAXIMUM = 499

/** StrENDING 번호. 7년차 전에는 null */
export function judgeEnding(career: PlayerCareer): number | null {
  const year = career.season
  const money = Math.trunc(career.money / MONEY_UNIT)
  // 원본 0xa3a84 의 **첫 줄** — 연차보다 먼저 본다 (G-2·B-6). 웹에 빠져 있던 판정이다
  if (career.injuredGamesPlayed >= INJURED_GAMES_FOR_ENDING) return 0
  if (year < FIRST_ENDING_YEAR) return null
  if (year === FIRST_ENDING_YEAR && career.popularity <= RELEASE_POPULARITY_MAXIMUM) return 1
  const finalYearEnding = year >= FINAL_YEAR ? finalYearEndingOf(career, money) : null
  if (finalYearEnding !== null) return finalYearEnding
  return popularityEndingOf(career.popularity, money)
}

/** 13년차 이상 — 전설(인기도 3500 초과 + 스킬 7 "전설" 보유, 0xa3a84 의 +0x1b8 비트7) 뒤 인기도 · 평판 · 소지금 단계. 없으면 null */
function finalYearEndingOf(career: PlayerCareer, money: number): number | null {
  if (career.popularity > 3500 && hasSkill(career, LEGEND_SKILL)) return 9
  return finalYearRankEndingOf(career.popularity, career.reputation, money)
}

function finalYearRankEndingOf(popularity: number, reputation: number, money: number): number | null {
  if (popularity > 3000 && reputation > 699 && money > 399) return 8
  if (popularity > 2500 && reputation > 499) return 7
  if (popularity > 2000 && reputation > 299) return 6
  return null
}

/** 인기도 단계 5 · 4 · 3 · 2(은퇴식) — 원본은 "999 이하" 만 은퇴식이라 정확히 1000 이면 판정이 없다 */
function popularityEndingOf(popularity: number, money: number): number | null {
  if (popularity > 1500) return 5
  if (popularity > 1000 && money > 199) return 4
  if (popularity > 1000) return 3
  // 원본 0xa3b66 `0x3e7 ; bgt` — 3 은 0xa3b5e `> 1000`
  // 고침(bugfixes.json B-76, 기본 켬): 1000 도 은퇴식(2) — 판정 없음 엔딩(키가 안 먹는 141)에 갇히지 않는다
  return popularity <= retirementPopularityLimit() ? 2 : null
}

/**
 * 은퇴식(엔딩 2)의 인기도 상한 — 원본 0xa3b66 은 `≤ 999`, 3 은 `> 1000`(0xa3b5e) 이라 **정확히 1000 이 비어** 판정 −1 이 된다.
 * −1 은 141 키 0x1220c 가 부호 없이(`cmp e,#1 ; bhi`, 12224) 보너스 갈래로 보낸 뒤 단계 > 2 에서 부호 있게(`ble`, 12274) 막아
 * 키가 안 먹는 화면에 갇힌다 (B-76). 고침은 빈 칸 1000 을 은퇴식으로 메운다(굴림 없음) — 타자편 · 투수편 같은 식.
 */
function retirementPopularityLimit(): number {
  return isBugFixed('B-76') ? 1000 : 999
}

/** 연애 엔딩은 StrENDING[9 + c] — c = 1(짝 없음) … 5(넷 모두) 라 10~14 다 */
const ROMANCE_ENDING_BASE = 9
/** 연애 엔딩이 붙는 본 엔딩 — 0 부상 · 1 방출 에는 없다 (0x87fba `cmp [this+0x2e4], #1 ; ble`) */
const LAST_ENDING_WITHOUT_ROMANCE = 1

/**
 * 본 연애 이벤트 — **이벤트 번호 순서**(300 메디카 · 301 레오니 · 302 로제 · 303 발렌타인).
 * 엔딩 적재 0x87c7c 가 이 순서로 `0xb6e81`(본 이벤트인가)을 물어 c 를 세고(0x87f4c~0x87fb0),
 * 제작진 화면의 인물도 같은 순서로 만든다(0x88080~0x88162).
 */
export function romanceEventsSeenOf(seenEventIds: readonly string[]): readonly number[] {
  return Object.values(ROMANCE_EVENT_IDS)
    .filter((eventId) => seenEventIds.includes(String(eventId)))
    .sort((left, right) => left - right)
}

/**
 * 연애 엔딩 번호 (엔딩 적재 0x87c7c — 0x87f4c~0x87fd6, 두 편 공용 장면 0x106):
 * ```
 * c = 1 + 본(300) + 본(301) + 본(302) + 본(303)
 * if [this+0x2e4](본 엔딩) > 1:  전역기록 +0xb1 + c = 1 ; 저장      ; 기록연감 엔딩 칸 9 + c
 * [this+0x340] = 10, c 가 2·3·4·5 면 11·12·13·14                   ; 제작진 앞에 붙는 글 StrENDING[9 + c]
 * ```
 * 본 엔딩 칸은 같은 함수 0x87f30 이 `+0xa8 + e` 에 쓰므로 +0xb1 + c = +0xa8 + (9 + c) — 기록연감 엔딩 10~14 와 맞는다.
 * 부상·방출(0·1)이면 null.
 */
export function romanceEndingIndexOf(endingIndex: number, seenEventIds: readonly string[]): number | null {
  if (endingIndex <= LAST_ENDING_WITHOUT_ROMANCE) return null
  return ROMANCE_ENDING_BASE + 1 + romanceEventsSeenOf(seenEventIds).length
}
