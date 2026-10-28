import { PLAYER_SIDE_LAST_BAT, type PlayerSide } from '@/entities/game/model/gameState'
import { PITCHERS_PER_TEAM } from '@/entities/team/model/teamRoster'

/** 자동 진행이 끝나지 않는 상황을 막는 안전장치 (원본에는 없다) */
export const MAXIMUM_AUTO_STEPS = 2_000

export const MAXIMUM_LOG_LENGTH = 40

export const OUTS_PER_INNING = 3

export const BATTING_ORDER_SIZE = 9

/** 타자 스킬 22 압도 — 0xa5e14 소모 ×2 · 실투 0x33cbc +5 (`0xb62b4(타자, 22)`) */
export const INTIMIDATE_SKILL_ID = 22

/**
 * 웹판에는 상대·동료 투수의 등번호가 없다. 승·패·세이브 판정은 "누구인지" 만 가리면 되므로
 * **내 투수만 번호를 갖고** 나머지는 이 두 값으로 구분한다 (0xa5d5e 가 읽는 `레코드 +0` 자리).
 */
export const MY_PITCHER_NUMBER = 0

/** 동료 투수 표지 = 이 값 − 로스터 칸 (교체가 생겨 우리 쪽 CPU 투수도 여럿이다) */
export const TEAMMATE_PITCHER_NUMBER_BASE = -100

/** 상대 투수 표지 = 이 값 − 로스터 칸 */
export const OPPONENT_PITCHER_NUMBER_BASE = -200

/**
 * **내 투수 줄의 웹 칸 번호.** 웹 로스터(`teamPitchers`, 팀마다 8명)에는 내 육성 투수가 없어 그 뒤 번호(8)를 붙인다 — 칸 번호일
 * 뿐 배열 자리가 아니다. 원본 배열 자리는 등록 0x10fb4 가 정한다(선발 0번 `[나, 1…7, 0]` · 구원 7번 `[0…6, 나, 7]` — 옛 그 칸
 * 선수는 맨 끝, 팀 투수 9명). 그 배열은 나리 팀 레코드가 들고(`ourPitcherOrder`), 날마다 0x1c46c 가 0↔k 맞바꿈·0~3 돌리기를
 * 영구로 한다 (`entities/pitcher-career/model/myPitcherRecord`). 벤치 차례로 드러난다: 교체 AI 의 "벤치 마지막"(0xac360)·
 * `0xabfcc` 동률·구원 갈래 최소 벤치 `r7`(0xc1c46).
 */
export const MY_PITCHER_SLOT = PITCHERS_PER_TEAM

/**
 * **우리 팀 마투수의 웹 칸 번호** — 원본은 `0xb521c` 가 목록 **8번 칸**에 넣고 옛 8번을 맨 끝으로 옮긴다. 웹은 번호 8 을 내 투수
 * (`MY_PITCHER_SLOT`)가 쓰고 있어 다른 번호(9)를 붙인다 — 목록 차례로는 원본대로 8번 자리에 앉는다(`ourPitcherOrderOf`). 상대 팀 마투수는 `ACE_PITCHER_SLOT`(8) 그대로다.
 */
export const OUR_ACE_PITCHER_SLOT = MY_PITCHER_SLOT + 1

/** 투수 목록에서 마투수가 끼는 자리 — `0xb521c` 의 8번 칸 */
export const ACE_PITCHER_LIST_INDEX = 8

export function teammatePitcherNumberOf(slot: number): number {
  return slot === MY_PITCHER_SLOT ? MY_PITCHER_NUMBER : TEAMMATE_PITCHER_NUMBER_BASE - slot
}

export function opponentPitcherNumberOf(slot: number): number {
  return OPPONENT_PITCHER_NUMBER_BASE - slot
}

/* ── 자동 타석의 교체 · 0xc1ba4 ──────────────────────────────────────────────── */

/** 원본 실점 카운터 A·B 는 99 에서 자른다 (P7 E1) */
export const MAXIMUM_PITCHER_COUNTER = 99

/** 기본 측 — 나만의리그 화면은 지금까지 늘 후공으로 돌려 왔다 (타자편과 같은 기본값) */
export const DEFAULT_PLAYER_SIDE: PlayerSide = PLAYER_SIDE_LAST_BAT
