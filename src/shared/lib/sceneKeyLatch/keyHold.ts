/**
 * **누른 채 되풀이 — 키 객체 틀 머리 0xbca05 의 되풀이 셈** (2026-10-24 직접 떴다, r172).
 *
 * 원본 폰은 누르고 있어도 키 콜백을 한 번만 부른다 — 되풀이는 키 객체(장면+0x18)가 틀마다 스스로 센다:
 * ```
 * bca6a  r5 = [+0x24](이 틀의 뗌)
 * bca6e  뗌이 없고 [+0x48](누르고 있음) 이면  [+0x4c] += 1 · > 3 이면 [+0x50] += 1
 * bca8a  아니면  [+0x50] ≠ 0 이면 길게 누른 뒤 뗌 — [+0x54] = ([+0x54] & ~0xf0) | 0x100 · [+0x38] = [+0x2c] · [+0x50] = 0
 *                 [+0x50] == 0 이면 [+0x4c] = 0
 * bcab0  [+0x50] > 0 && [+0x4c] > 3 이면  [+0x54] |= min([+0x50] << 4, 0xf0) · **되풀이 [+0x38] = [+0x2c]** · [+0x4c] = 0
 * bcad8  이 틀에 누름이 있으면  [+0x1c] = [+0x48] = 1 · [+0x2c] = [+0x30] = 누름
 * bcaec  뗌이 있으면  [+0x54] |= 0x200 · [+0x3c] = 뗌 · [+0x48] = 0
 * ```
 * 곧 누른 틀 F 뒤 F+4 · F+8 · F+12 … 에 되풀이가 나고(단계 [+0x50] = 1, 2, 3 … — 비트 4~7), 뗀 틀에 단계가 있었으면 뗌 되풀이
 * (비트 8)가 한 번 더 난다. 되풀이를 읽는 곳은 경기 장면 키 분배 0x498d4 하나(49a56 — 장면+0x50 = 키 객체+0x38)다.
 * 이 셈은 그 규칙을 틀마다 그대로 돈다 — 쓰는 곳이 틀마다 한 번 `frame` 을 부른다.
 */
export interface KeyHoldFrame {
  /** 이 틀의 되풀이 [+0x38] — 없으면 null */
  readonly repeat: string | null
  /** 되풀이 표시 [+0x54] 비트 — 4~7 단계 · 8 길게 누른 뒤 뗌 · 9 뗌 */
  readonly flags: number
}

export interface KeyHold {
  /** 틀 하나 — 이 틀의 누름(받은 칸에서 옮긴 [+0x28]) · 뗌이 있었는가 */
  readonly frame: (press: string | null, hasRelease: boolean) => KeyHoldFrame
  /** 처음으로 */
  readonly reset: () => void
}

/** 되풀이 단계 비트(4~7)가 서 있는가 — 누르고 있어서 생긴 되풀이 */
export const HOLD_STAGE_MASK = 0xf0
/** 길게 누른 뒤 뗌 (bca9a) */
export const HOLD_LONG_RELEASE_FLAG = 0x100
/** 뗌 (bcaf6) */
export const HOLD_RELEASE_FLAG = 0x200

export function createKeyHold(): KeyHold {
  let isHeld = false
  let heldTicks = 0
  let stage = 0
  let lastPressed: string | null = null
  return {
    frame: (press, hasRelease) => {
      let flags = 0
      let repeat: string | null = null
      if (!hasRelease && isHeld) {
        heldTicks += 1
        if (heldTicks > 3) stage += 1
      } else if (stage !== 0) {
        flags = (flags & ~HOLD_STAGE_MASK) | HOLD_LONG_RELEASE_FLAG
        repeat = lastPressed
        stage = 0
      } else {
        heldTicks = 0
      }
      if (stage > 0 && heldTicks > 3) {
        flags |= Math.min(stage << 4, HOLD_STAGE_MASK)
        repeat = lastPressed
        heldTicks = 0
      }
      if (press !== null) {
        isHeld = true
        lastPressed = press
      }
      if (hasRelease) {
        flags |= HOLD_RELEASE_FLAG
        isHeld = false
      }
      return { repeat, flags }
    },
    reset: () => {
      isHeld = false
      heldTicks = 0
      stage = 0
      lastPressed = null
    },
  }
}
