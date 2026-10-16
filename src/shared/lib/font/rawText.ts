import { measurePixelTextWidth } from '@/shared/lib/font/layout'

/**
 * **날 글 폭 0x9c52c** — 공용 글 0xba269 의 폭이 −1 일 때 글상자 0x6ef4c 가 이 값을 폭으로 쓴다
 * (6efb0~6efd0: `[sp+0x74] + 1 == 0` 이면 `0x9c52c(글꼴, 글, 바이트 길이, &폭, &높이, 0, [글꼴+8], 1)`).
 *
 * 0x9c52c 는 '!' 서식을 거르지 않는다 — 거르개 [글꼴+0x78] 은 글꼴을 짓는 0x9c9d0 → 0x9b650 이 0 으로 두고 다른 곳이 안 쓴다.
 * 그래서 `!C` · `!N` · `!cRRGGBB` 도 영문 글자(5px + 자간 1)로 들어가고, 줄은 0x0a 에서만 끊는다(0x9c660 `cmp r4, #0xa`).
 * 끊을 때마다 그 줄 폭을 [sp+0x18] 최댓값에 모은다(0x9c6b0~0x9c6b6) — 여러 줄이면 가장 넓은 줄이다.
 * `!N` 은 줄을 끊지 않으므로 두 줄 글(`…!N…`)은 한 줄로 이어 잰다.
 */
export function measureRawTextWidth(raw: string): number {
  return Math.max(0, ...raw.split('\n').map((line) => measurePixelTextWidth(line)))
}

/**
 * **0xba269 폭 −1 의 `!C` 줄 가운데 x** — 폭 = 날 글 폭(`measureRawTextWidth`)이고 `!C` 줄은 x + (폭 >> 1) 을 가운데로 둔다
 * (0x6f12c `asrs r3, r2, #1; adds r3, x, r3` → 줄 그리기 0x6ed88 6edc6 `x − (줄 폭 >> 1)`).
 * 날 글에는 서식 글자도 들어 있어 가운데는 보이는 글의 가운데보다 오른쪽으로 밀린다 — 원본 그대로.
 */
export function measuredTitleCenterXOf(x: number, raw: string): number {
  return x + (measureRawTextWidth(raw) >> 1)
}
