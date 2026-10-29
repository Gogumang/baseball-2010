/**
 * 판정 종류 → game_judge 애니 번호 (0x393b4) — 표 0xcfe90 과 같다 (확정, R2-game-effects.md 7절·9절).
 * 안타·홈런은 원본에서 판정 글자가 아니라 타구 연출로 보여 주므로 글자로 둔다.
 */
const JUDGE_ANIMATIONS: Readonly<Record<string, number>> = {
  스트라이크: 0,
  헛스윙: 0,
  아웃: 1,
  볼: 3,
  파울: 4,
  세이프: 5,
  볼넷: 6,
  '몸에 맞는 공': 7,
  인정2루타: 8,
  삼진: 9,
}

export function judgeAnimationOf(text: string): number | null {
  return JUDGE_ANIMATIONS[text] ?? null
}

/**
 * 판정 글자 애니는 반복하지 않는다 — 끝나면 마지막 칸(빈 그림)에 멈춘다.
 * 칸 길이 = max(1, 지연 + 보정) 틱 (0x93d90, R2-game-effects.md 9절). 보정(correction)은
 * 애니 상태별 s8 값으로 보통 0 이다 — 표에 값이 없으면 0 으로 본다.
 */
export function judgeFrameAt(entries: readonly { frame: number; delay: number; correction?: number }[], tick: number): number | null {
  let remaining = Math.max(0, tick)
  for (const entry of entries) {
    const length = Math.max(1, entry.delay + (entry.correction ?? 0))
    if (remaining < length) return entry.frame
    remaining -= length
  }
  return entries.length === 0 ? null : entries[entries.length - 1].frame
}

/** 팀 아이콘 번호 — 14 는 10, 10 이상은 11 (0x77974) */
const HIDDEN_TEAM_ICON = 10

const OTHER_TEAM_ICON = 11

const HIDDEN_TEAM_ID = 14

const FIRST_SPECIAL_TEAM = 10

export function teamIconOf(teamId: number): number {
  if (teamId === HIDDEN_TEAM_ID) return HIDDEN_TEAM_ICON
  return teamId >= FIRST_SPECIAL_TEAM ? OTHER_TEAM_ICON : teamId
}
