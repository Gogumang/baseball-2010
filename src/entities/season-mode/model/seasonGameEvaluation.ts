import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'

/**
 * **시즌 경기 뒤 0xe9 (갱신 0xdea0) 가 쌓는 평가 내장 이벤트** — 직접 떴다(0xdea0~0xe14c · 0x8a6fc · 0x8bab8).
 *
 * 0xe9 는 그림도 키도 없다. 들어온 틀에 평가 징글(36/37/38)을 예약하고, 기록 줄을 지어 `0x8a6fc` 로 내장 이벤트를 쌓은 뒤
 * 다음 상태(포스트시즌이면 SR+0xb2 == 0 ? 0xee : 0xef, 아니면 0xf1)와 0xd3 을 걸고 저장한다 — 이벤트는 0xd3 이 튼다.
 * ```
 * def6  글 = ""
 *       "득점: " s8 SR+0x1bd " / " "실점: " s8 SR+0x1be " / " (SR+0x1bd > SR+0x1be ? "경기승리!" : "경기패배!") "!N"
 *       "안타: " (u8 S[7] + S[8] + S[9]) " / " "피안타: " u8 S[2] " / " "에러: " u8 S[3] "!N"
 *       "관중: " SR+0x1b4 "명" " / " "수입: " 0x55cf4(SR+0x66 × 100) (SR+0x55 > 0 이면 "(+200)") "만"
 * e0d4  0x8a6fc(evmgr, 모드, 글 번호 50000, 글, …, S+7 · 팀 사기 · S+0x4a · 인기도 · S+0x64 · 평판, 표정 8)
 * ```
 * S = SR+0x1a0 경기 평판 16칸(`gameRecord`). 원본 그대로의 어긋남 셋:
 * - 동점이면 "경기패배!" 다(`>` 비교). 원본 시즌 경기는 동점으로 끝나지 않지만 식은 그대로 둔다.
 * - 안타 = S[7] + S[8] + S[9] — 홈런 칸이 빠지고 2루타·3루타는 S[7] 과 함께 두 번 센다(`seasonReputation` 주석).
 * - 구내매점 "(+200)" 이 "만" **앞**에 붙는다 → "수입: 520(+200)만". "(+200)" 은 0x8a6fc 가 SR+0x55 를 줄이기 **전** 값으로 본다.
 *
 * 0x8a6fc 시즌(모드 2) 갈래: 명령 1 say(글 번호 50000 — 0x8bab8 이 감독 글을 안 붙여 대사 = 기록 줄만) · 명령 2 system sub 2
 * (변화 창 0x86c90) · 인기도 막대 d = 12(0x8a816) · 연속 기록은 통째로 건너뛴다(0x8a834 → 0x8afaa) · 구내매점 SR+0x55 −1,
 * 0 이 되면 system sub 5 → StrUSER_EVT[113] 창. 굴림은 없다(0x8a6fc · 0x8bab8 · 0x86531 · 0x8587c 에 난수 호출이 없다).
 */
export function seasonGameEvaluationLineOf(record: SeasonRecord): string {
  const s = record.gameRecord
  const result = record.lastGameScore > record.lastGameConceded ? '경기승리!' : '경기패배!'
  const hits = (s[7] ?? 0) + (s[8] ?? 0) + (s[9] ?? 0)
  const store = record.storeGames > 0 ? '(+200)' : ''
  return `득점: ${record.lastGameScore} / 실점: ${record.lastGameConceded} / ${result}!N` +
    `안타: ${hits} / 피안타: ${s[2] ?? 0} / 에러: ${s[3] ?? 0}!N` +
    `관중: ${record.lastAttendance}명 / 수입: ${originalMoneyText(record.lastIncome * 100)}${store}만`
}

/**
 * 명령 1 의 표정 [명령+8] — 0x8a6fc 의 마지막 인자가 8 이면(시즌 0xdea0 만) S+0x4a 로 고른다 (0x8a73a~0x8a756):
 * `< 0 → 3 · 0 ~ 1 → 0 · > 1 → 1`.
 */
export function seasonGameEvaluationExpressionOf(popularityChange: number): number {
  if (popularityChange < 0) return 3
  return popularityChange > 1 ? 1 : 0
}

/** 인기도 변화 막대 0x8587c 의 d — 시즌(0x7b999)이면 12 (0x8a816) */
export const SEASON_EVALUATION_GAUGE_DIVISOR = 12

/** 0x55cf4 — 9999 이하 "%d", 1억 이상 "%d억" · "%d억%03d" (만원 단위, "만" 없음) */
function originalMoneyText(amount: number): string {
  const hundredMillion = 10_000
  if (amount < hundredMillion) return String(amount)
  const head = Math.trunc(amount / hundredMillion)
  const rest = amount % hundredMillion
  return rest === 0 ? `${head}억` : `${head}억${String(rest).padStart(3, '0')}`
}
