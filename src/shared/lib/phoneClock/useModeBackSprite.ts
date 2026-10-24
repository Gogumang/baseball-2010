import { modeBackPaletteOf, timeSlotOfHour } from '@/shared/lib/phoneClock/phoneClock'
import type { TimeSlot } from '@/shared/lib/phoneClock/phoneClock'
import { recolorRequestsOf, useRecoloredSprite, useWarmRecoloredSprites } from '@/shared/lib/sprite/paletteSwap'

/** mode_back 합성 프레임 폴더 — 번호 지도는 `frames/index`, 팔레트는 `palette.json` (`tools/apply_mpl.py`) */
export const MODE_BACK_FRAMES = './sprites/mode_back/frames'

const TIME_SLOTS: readonly TimeSlot[] = [0, 1, 2]

export interface ModeBackSprite {
  /** 시간대 [gfx+0x1c] — 프레임 번호이기도 하다 */
  readonly slot: TimeSlot
  /** 프레임 키 (`000` ~ `002`) */
  readonly key: string
  /** 시간대 팔레트(0x7b934 의 mode_back.mpl 줄 t − 1)를 입힌 그림 — 칠하기 전에는 구운 낮 색 */
  readonly src: string
}

/**
 * 그림 0x7b9ac 가 그리는 mode_back — 프레임과 팔레트가 둘 다 시간대 [gfx+0x1c] 다(`phoneClock.ts` 머리말).
 * 시간대 0 은 mpl 을 안 쓰고(줄 −1) PZX 기본 팔레트 = 구워 둔 PNG 그대로다.
 */
export function useModeBackSprite(hour: number): ModeBackSprite {
  const slot = timeSlotOfHour(hour)
  const key = String(slot).padStart(3, '0')
  const src = useRecoloredSprite(`${MODE_BACK_FRAMES}/${key}.png`, modeBackPaletteOf(slot))
  // 화면에 있는 동안 시간대가 넘어가면 프레임 · 벌이 같이 바뀐다 — 세 시간대 그림을 미리 칠해 넘어가는 그림에 구운 낮 색이 비치지 않게
  useWarmRecoloredSprites(TIME_SLOTS.flatMap((each) => recolorRequestsOf(MODE_BACK_FRAMES, [each], modeBackPaletteOf(each))))
  return { slot, key, src }
}
