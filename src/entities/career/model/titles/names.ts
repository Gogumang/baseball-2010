import { ORIGINAL_TITLES } from '@/shared/config/original/titles'
import { stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'

/**
 * 칭호(닉네임) — 원본 StrNICKNAME 128개는 **이름 64개(0~63) + 획득 조건 원문 64개(64~127)** 의 짝이다.
 * 예: 35 "안타제조기" ↔ 99 "통산 500안타 달성".
 *
 * 판정은 원본에선 0x1a1c0 한 함수가 한다 (P3 4절). 나만의리그 관리 화면에 들어올 때마다 번호 순서로
 * 검사해서 **처음 맞는 하나만** 팝업으로 주고, 확인하면 비트(+0x178)를 켜고 곧바로 장착(+0x1c4)한 뒤
 * 다음 프레임에 다시 판정한다. 웹은 여러 동작 뒤 한꺼번에 배열로 붙인다 (P3 9절 "부여 방식 차이").
 *
 * **번호 32~47 한 벌을 타자편·투수편이 같이 쓴다** (P3 7·8절). 식 안에서 `this+0xcc == 4`(타자편)로
 * 가르고, 이름·조건 문구만 투수편에서 +16 (48~63) 을 읽는다. 웹은 칭호를 **이름 문자열**로 들고 있어
 * 타자편이 32~47, 투수편이 48~63 이름을 쓰면 원본 비트 한 벌과 같은 뜻이 된다.
 */
const NAME_COUNT = ORIGINAL_TITLES.length / 2

/**
 * 칭호 이름 — 저장(`titleIds` · 수집 `titles`)이 이 글을 **열쇠**로 들고 있어 앞뒤 빈칸을 뗀 꼴로 둔다.
 * 원문 [1] "떠오르는 샛별 " · [2] "최고의 루키 " 는 끝에 빈칸이 있다(생성 표 `ORIGINAL_TITLES` 는 원문 그대로, r223).
 */
export const TITLE_NAMES: readonly string[] = ORIGINAL_TITLES.slice(0, NAME_COUNT).map((name) => name.trim())

/**
 * 화면에 그릴 칭호 이름 — 원문 StrNICKNAME[번호] 그대로(끝 빈칸 포함, r225). 원본은 이름을 늘 표에서 바로 읽어 그린다
 * (칭호 팝업 0x1b102 · 장착 알림 0x12000 · 상태판 0x7d5cc). 가운데 맞춤 폭(0x9c52c)이 끝 빈칸까지 세므로 "떠오르는 샛별 " 은
 * 빈칸 반 칸만큼 왼쪽에 놓인다. 저장 열쇠(`TITLE_NAMES`)는 그대로 뗀 꼴이다. 모르는 이름이면 받은 글 그대로.
 */
export function titleDisplayNameOf(title: string): string {
  const index = TITLE_NAMES.indexOf(title)
  return index < 0 ? title : (ORIGINAL_TITLES[index] ?? title)
}

/** 칭호는 모두 64개 — 기록연감 칸도 공통 32 + 타자 16 + 투수 16 = 64 다 (P3 10-2) */
export const TITLE_COUNT = NAME_COUNT
/** 공통 칭호(어느 편에서 얻어도 한 칸)는 0~31 이다 */
export const COMMON_TITLE_COUNT = 32
/** 투수편 이름은 타자편 번호 + 16 (P3 2절 0x7d5ee) */
export const PITCHER_TITLE_OFFSET = 16
/** 칭호 목록 한 화면에 들어가는 줄 수 — 목록 객체에 `min(개수, 9)` 로 넣는다 (0x104cc) */
export const TITLE_ROWS_PER_PAGE = 9

export function conditionTextOf(title: string): string | null {
  const index = TITLE_NAMES.indexOf(title)
  return index < 0 ? null : stripGameMarkup(ORIGINAL_TITLES[index + NAME_COUNT]).trim()
}

/** 이름 → 원본 번호. 모르는 이름이면 −1 */
export function titleNumberOf(title: string): number {
  return TITLE_NAMES.indexOf(title)
}

/**
 * 얻은 칭호 목록 (0x104cc) — **얻은 순서가 아니라 번호 오름차순**으로 보여 준다.
 * `#` 키 고르기 화면(하위 상태 129)과 기록연감이 이 순서를 쓴다 (P3 10-1).
 */
export function titleListOf(titles: readonly string[]): readonly string[] {
  return [...new Set(titles)].filter((title) => titleNumberOf(title) >= 0).sort((left, right) => titleNumberOf(left) - titleNumberOf(right))
}

/**
 * "닉네임 모두 수집" (0x28e98) — 공통 32 + 타자 16 + 투수 16 을 다 채우면 **60,000 G** 를 준다.
 * 웹은 이름이 64개 모두 다르니 이름 집합이 64개면 곧 완성이다.
 */
export const ALL_TITLES_REWARD_GAME_POINT = 60_000

export function isAllTitlesCollected(titles: readonly string[]): boolean {
  return titleListOf(titles).length >= TITLE_COUNT
}
