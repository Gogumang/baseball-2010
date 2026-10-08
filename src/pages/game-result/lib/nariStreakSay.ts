import type { StreakNotice } from '@/entities/career/model/gameEvaluation'

/** 0x8a6fc 모드 4 나쁜 칸 — 무안타 글 102 */
const HITLESS_LABEL = 102
/** 0xcc298 — 좋은 칸 사이 */
const GOOD_SEPARATOR = ' / '
/** 0xd4dac */
const LINE_BREAK = '!N'

/**
 * **타자편 116 평가 이벤트의 명령 3 say 글** — 0x8a6fc 모드 4 갈래(0x8a8d4~0x8abd4, 직접 떴다):
 * ```
 * [0] 2안타 이상 칸 == 표 0xd4dfc 이면  n + 글 100                         ; 0xbc73d 숫자 · 0xbc965 덧붙이기
 * [1] 홈런 칸 == 0xd4dfc 이면           ([0] 이 있었으면 " / ") + n + 글 101
 * [2] 무안타 칸 == 0xd4e24 이면         n + 글 102                          ; 사이 글 없이 바로 잇는다
 * [0] 또는 [1] 이 있으면                "!N" + 글 108
 * [2] 가 있으면                         "!N" + 글 110 · 111(4경기) · 112(5경기)
 * ```
 * 이 글이 전역 버퍼 0x1552af4 로 가고 명령 3(say, 글 10000)이 찍는다. 알림이 없으면 명령도 없다(빈 글).
 */
export function nariStreakSayOf(notices: readonly StreakNotice[], texts: readonly string[]): string {
  const good = notices.filter((notice) => notice.labelIndex !== HITLESS_LABEL)
  const bad = notices.find((notice) => notice.labelIndex === HITLESS_LABEL)
  const item = (notice: StreakNotice) => `${notice.count}${texts[notice.labelIndex] ?? ''}`
  let text = good.map(item).join(GOOD_SEPARATOR)
  if (bad !== undefined) text += item(bad)
  if (good.length > 0) text += `${LINE_BREAK}${texts[good[0].commentIndex] ?? ''}`
  if (bad !== undefined) text += `${LINE_BREAK}${texts[bad.commentIndex] ?? ''}`
  return text
}

/** 나쁜 칸(무안타)이 있는가 — say 표정 3 */
export function hasHitlessStreak(notices: readonly StreakNotice[]): boolean {
  return notices.some((notice) => notice.labelIndex === HITLESS_LABEL)
}
