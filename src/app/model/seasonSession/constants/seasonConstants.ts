import { type MatchProgressSettings, MATCH_SETTING_KIND, INNING_VALUE } from '@/features/play-team-game/model/matchSettings'

/** 시즌모드 = 원본 모드 2 (0x22c7d 의 획득 GP 칸 3) */
export const SEASON_STAT_MODE = 2

/** 엔딩 보너스 표 0xcbc2e 의 단위 — 0x8bd8 8c1a `movs #0xfa ; lsls #2` × 표값 */
export const ENDING_BONUS_UNIT = 1000

/** SR+0xb7 = 0xf 는 "우승팀 미정" 이다 (P4 1a) */
export const NO_CHAMPION = 0xf

/**
 * 경기진행 설정의 원본 기본값 — 전역기록 생성자 0x9f26c 의 0x9f404~0x9f42c(m = 0 · 1 두 번 도는 고리, 직접 떴다):
 * `+0x12c+m = 1`(종류 **이닝**) · `+0x146+m = 0`(값 **전체** — 모든 이닝을 사람이 잡는다) · 상세 비트 +0x120+2m · +0x124+2m ·
 * +0x128+m · +0x12a+m = 0. 그 뒤 0x9f42e~ 가 +0x14d~+0x14f 를 0 으로 둔다.
 * (⚠️ 예전 주석의 "전역 저장이 0 으로 초기화되므로 찬스 · 공격 득점권" 은 틀렸다 — 생성자가 종류 칸에 1 을 넣는다.)
 * 처음 경기정보(0xdd)에 들어오면 설정 창이 저절로 열린다(+0x11e).
 */
export const SEASON_DEFAULT_MATCH_SETTINGS: MatchProgressSettings = {
  kind: MATCH_SETTING_KIND.이닝,
  value: INNING_VALUE.전체,
  battingOrderBits: 0,
  pitchingInningBits: 0,
  offenseRunnerBits: 0,
  defenseRunnerBits: 0,
}

/** 시즌모드 = 원본 게임 모드 2 (능력치 보정 마스크 0x306 에 든다) */
export const SEASON_GAME_MODE = 2

/** 경기 뒤 마무리 0xf1 진입 0x953c 가 트는 배경음 — 관리 화면 4 (`0x6ea6d(소리, 4, −1, 1)`) */
export const SEASON_MANAGEMENT_BGM = 4

/** 이벤트 재생 0xd3 배경음 (0x5110 `0x6ea6d(소리, 0x28, −1, 1)`) */
export const SEASON_EVENT_BGM = 40

/**
 * **시즌 모드 경기 뒤 평가 징글** (36 좋음 · 37 보통 · 38 나쁨).
 *
 * 원본 시즌 상태 **0xe9(경기 뒤 관중·수입 창, 0xdea0)** 안 `0xdeae~0xdede` — 직접 떠서 옮겼다:
 * ```
 * 0000deae: adds r3,#0x4a ; ldrb r3,[r3] ; lsls/asrs #0x18   ; p = (s8)레코드[+0x4a]
 * 0000deb6: cmp r3,#0 ; bge 0xdeca
 * 0000debc: movs r1,#0x26        ; p < 0      → 38   (예약 0xdec4)
 * 0000dece: cmp r3,#3 ; bgt 0xded8                   ; ★ 시즌 문턱은 3 (나만의리그는 1)
 * 0000ded4: movs r1,#0x25        ; 0 ≤ p ≤ 3 → 37   (예약 0xdede)
 * 0000deda: movs r1,#0x24        ; p > 3     → 36
 * ```
 * 나만의리그 쪽(0x12c96, 문턱 1)은 `useCareerSession.evaluationJingleIdOf` 가 따로 들고 있다 —
 * **문턱만 다르고 모양이 같다**. 레코드 `+0x4a` 는 `SeasonRecord.lastPopularityChange` 다.
 *
 * 웹은 `play` 로 낸다. `0x6e498` 은 큐가 아니라 **지금 소리를 끊고 한 칸을 덮어쓴 뒤 다음 틱에 트는**
 * 것이라(`shared/api/audio/soundPort` 머리 주석) 통로가 하나인 웹의 `play` 와 들리는 결과가 같다.
 */
const SEASON_EVALUATION_THRESHOLD = 3

export function seasonEvaluationJingleIdOf(popularityChange: number): number {
  if (popularityChange < 0) return 38
  return popularityChange > SEASON_EVALUATION_THRESHOLD ? 36 : 37
}
