/** S+0x4a · +0x64 · +7 — 지난 평가 경기의 인기도·평판·사기 변화 */
export interface PitcherLastEvaluation {
  readonly popularityChange: number
  readonly reputationChange: number
  readonly moraleChange: number
}

/**
 * **116 경기 뒤 평가 창 재료** — 진입 0x1278c 의 모드 3 갈래(12a3c~12ac0)가 S+0x1d8 바이트로 짓는 기록 줄
 * `[0] 1~3 → "승리 "·"패배 "·"세이브 "(표 0xcc690) · [1]/3 "." [1]%3 "이닝 " · [3] "삼진 " · [2] "실점!N"` 과 감독 글 번호.
 */
export interface PitcherLastGame {
  /** S+0x1d8[0] — 1 승 · 2 패 · 3 세이브 · 0 없음 */
  readonly decisionCode: number
  /** [1] 잡은 아웃 */
  readonly outs: number
  /** [2] 실점 */
  readonly runs: number
  /** [3] 탈삼진 */
  readonly strikeouts: number
  /** [4] 볼넷 + 사구 (R+0x144 + R+0x148, u8) — 0x8a6fc 더티볼. 옛 저장에는 없다(0) */
  readonly walksAndHitByPitch?: number
  /** [5] 피안타 (R+0x12c, u8) — 0x8a6fc 새가슴. 옛 저장에는 없다(0) */
  readonly hitsAllowed?: number
  /** [6] 투구 수 (R+0x140, u8) — 116 감독 글 38 의 셋째 조건(12af2). 옛 저장에는 없다(0) */
  readonly pitches?: number
  /** 116 이 고른 StrUSER_EVT 감독 글 (2~37 · 38 등판 없음) */
  readonly managerCommentIndex: number
}

/** 116 기록 줄 [0] 의 글 — 표 0xcc690 → 0xcc958 · 0xcc960 · 0xcc968 */
const DECISION_LABELS: Readonly<Record<number, string>> = { 1: '승리 ', 2: '패배 ', 3: '세이브 ' }

/** 116 기록 줄 (12a3c~12ac0) — 판단 글 · `이닝 ` · `삼진 ` · `실점` */
export function pitcherLastGameLineOf(game: PitcherLastGame): string {
  const innings = `${Math.trunc(game.outs / 3)}.${game.outs % 3}`
  return `${DECISION_LABELS[game.decisionCode] ?? ''}${innings}이닝 ${game.strikeouts}삼진 ${game.runs}실점`
}

/** 비어 있는 +0x4a · +0x64 · +7 */
export const NO_LAST_EVALUATION: PitcherLastEvaluation = { popularityChange: 0, reputationChange: 0, moraleChange: 0 }
