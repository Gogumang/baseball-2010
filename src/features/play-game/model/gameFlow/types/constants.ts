import { PITCHERS_PER_TEAM } from '@/entities/team/model/teamRoster'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'

/** `team[+0x29 + 타순]` 의 "아직 안 채움" 값 — `0xaebe4` 가 음수를 보고 채운다 */
export const UNFILLED_SPECIAL_SWING_COUNT = -1

/**
 * 이 화면이 돌리는 경기는 나만의리그 **타자편** = 원본 게임 모드 4 다 (0x327b8 모드표, H-1).
 * 기록달성 판정이 모드를 보므로 상수로 둔다.
 */
export const MY_LEAGUE_BATTER_MODE = 4

/**
 * 자동 진행이 끝나지 않는 상황을 막는 안전장치.
 * 한 경기에 나올 수 있는 이벤트 수를 크게 웃도는 값이면 충분하다.
 */
export const MAXIMUM_AUTO_STEPS = 500

export const MAXIMUM_LOG_LENGTH = 40

/** 타석 기록 링버퍼 용량 (0xa908c) — 스킬 16·17 은 이 버퍼의 **가장 오래된** 두 칸을 본다 */
export const RECENT_AT_BAT_COUNT = 10

/** 타순 칸 수 — 상대 타순 슬롯(team+0x32)은 0~8 로 돈다 */
export const BATTING_ORDER_SIZE = 9

/** 한 타석 앞에서 `0xc1ba4` 를 다시 부르는 상한 — 대타 한 번 · 투수 한 번 · 마지막 빈 부름 */
export const MAXIMUM_SUBSTITUTION_CALLS = 3

/** 원본 실점 카운터 A·B 는 99 에서 자른다 (P7 E1) */
export const MAXIMUM_PITCHER_COUNTER = 99

/** 팀 투수 여덟 칸 (`team+0x0c`) — 벤치는 여기서 마운드와 이미 쓴 투수를 뺀 나머지다 */
export const ALL_PITCHER_SLOTS: readonly number[] = Array.from({ length: PITCHERS_PER_TEAM }, (_unused, slot) => slot)

/** `applyAtBatOutcome` 은 `precomputed` 를 받으면 결과 코드를 안 읽는다 — 주자 판에는 타석 결과가 없어 자리만 채운다 */
export const RUNNER_PLAY_OUTCOME_PLACEHOLDER: AtBatOutcome = { kind: '아웃', detail: '땅볼아웃' }
