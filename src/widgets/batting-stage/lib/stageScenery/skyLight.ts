/** 하늘 조명 `sky_effect_light` 를 싣는가 — 0x7703e `cmp #7 / bgt` (그리기 0x784d8 도 같은 검사를 다시 한다) */
export const SKY_LIGHT_LAST_COLOR_INDEX = 7

/** 하늘 조명을 안 그리는 모드 — 5 투수 미션 · 6 타자 미션 · 7 홈런더비 (0x784a2~0x784b0) */
const SKY_LIGHT_HIDDEN_MODES: readonly number[] = [5, 6, 7]

/**
 * 이 게임 모드(전역 `0x1552d10`)에서 하늘 조명 0x78490 을 그리는가 — 모드 5·6·7 이면 안 그린다.
 * 모드를 모르면(undefined) 그 셋이 아닌 것으로 본다.
 */
export function isSkyLightModeShown(gameMode: number | undefined): boolean {
  return gameMode === undefined || !SKY_LIGHT_HIDDEN_MODES.includes(gameMode)
}

export function skyLightPaletteRowOf(colorIndex: number): number | null {
  return colorIndex <= 1 ? null : colorIndex - 2
}

/**
 * 하늘 조명 애니 칸 — 0x78490 이 그린 뒤 `0x93d90`(한 칸 넘기기) · `0x93cfc(애니, 1)`(되풀이로 켜기)를
 * 부르므로 **끝나면 처음으로 돌아가는** 되풀이다. 칸 길이는 판정 글자와 같은 `max(1, 지연)` 틱(0x93d90).
 */
export function skyLightFrameAt(entries: readonly { frame: number; delay: number }[], tick: number): number | null {
  if (entries.length === 0) return null
  const total = entries.reduce((sum, entry) => sum + Math.max(1, entry.delay), 0)
  let remaining = Math.max(0, tick) % total
  for (const entry of entries) {
    const length = Math.max(1, entry.delay)
    if (remaining < length) return entry.frame
    remaining -= length
  }
  return entries[entries.length - 1].frame
}
