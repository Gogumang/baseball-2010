import { sprite } from '@/widgets/batting-stage/lib/spriteLoader'
import { hudPartUrl } from '@/widgets/batting-stage/lib/renderHud/hudParts'
import { isBugFixed } from '@/shared/config/bugfixes'

export const LAMP_STEP = 9

/**
 * 램프 칸 수 = 개수를 **잘라서** 센다 — 0x376a4~0x376d0 이 [min(st[4], 2), min(st[5], 3), min(st[6], 2)] 를 칸 표로 만든다.
 * (스트라이크 3 · 아웃 3 이 되는 순간에도 칸은 둘만 켜진다)
 */
export const LAMPS = [
  { part: 13, x: 58, y: 24, key: 'strikes', max: 2 },
  { part: 14, x: 58, y: 34, key: 'balls', max: 3 },
  { part: 15, x: 58, y: 44, key: 'outs', max: 2 },
] as const

/** 램프 한 종류의 칸 수 (0x376a4~0x376d0 — 위로만 자른다) */
export function lampCountOf(lamp: { readonly max: number }, count: number): number {
  return count < lamp.max ? count : lamp.max
}

/**
 * 새 램프 확대 연출 (0x37730~0x37892, 직접 떴다). 종류 k 마다 장면에 "지난 칸 수" +0x17d4~6 · 타이머 +0x17d7~9 를 둔다.
 * ```
 * c = 자른 칸 수 (lampCountOf)
 * c ≤ 0 (0x37736)        → 아무것도 안 한다 — 지난 칸 수도 타이머도 그대로(타이머가 줄지도 않는다)
 * c > 0 이고 지난 ≠ c     → 타이머 = 5 · 지난 = c (0x37744)
 * 칸 i = 0..c−1          → 타이머 > 0 이고 i == c−1 이면 효과 0x10 · 배율 z = 타이머로 그리고 타이머 −1 (0x37828~0x37858)
 * ```
 * 그래서 새 램프가 5·4·3·2·1 배로 다섯 그림 동안 줄어든다. 확대 자리는 **상자** w·h 로 `(x − ((z−1)·w >> 1), y − ((z−1)·h >> 1))`.
 * 타석 시작 0xd 진입(0x48f08)은 **타이머만** 0 으로 지운다 — 지난 칸 수는 경기 적재 0x48658(48cc2~48cf2)이 한 번 채울 뿐이다.
 * 원본 버그(B-87): 칸이 0 으로 내려갔다 같은 수로 다시 켜지면(지난 1 → 0 → 1) 확대가 없다 — 고친 길은 0 에서 지난 칸 수를 지운다.
 * 정수 배 확대라는 것은 R6 3b 확정 (프레임 그리기 0x944b5 의 e == 0x10, b > 0 → 좌표·크기 ×b).
 */
const LAMP_ZOOM_TIMER = 5

/** 램프 상자 크기 — game_ui 프레임 0 의 상자 7~13 이 모두 7×7 (boxes.json) */
const LAMP_BOX_SIZE = 7

type LampKey = (typeof LAMPS)[number]['key']

/** 한 종류의 기억 — 지난 칸 수 · 다음 그림의 타이머 · 이번 틱에 쓴 배율(같은 틱에 두 번 그려도 한 그림으로 센다) */
export interface LampZoomMemory {
  readonly last: number
  readonly timer: number
  readonly tick: number
  readonly zoom: number
}

export const INITIAL_LAMP_ZOOM: LampZoomMemory = { last: 0, timer: 0, tick: -1, zoom: 0 }

/**
 * 한 그림치 램프 확대 걸음. `zoom` > 0 이면 마지막 칸을 그 배율로 그린다(1 이면 보통과 같다).
 * `tick` 이 지난 그림보다 작으면 타석이 새로 열린 것(0xd 진입)이라 타이머만 지운다.
 */
export function stepLampZoom(memory: LampZoomMemory, count: number, tick: number): LampZoomMemory {
  if (tick === memory.tick) return memory
  let { last, timer } = memory
  if (tick < memory.tick) timer = 0
  // B-87 고친 길 — 꺼진 칸은 지난 칸 수를 0 으로 둬, 같은 수로 다시 켜져도(1 → 0 → 1) 확대가 선다. 굴림 없음
  if (count <= 0) return isBugFixed('B-87') ? { last: 0, timer: 0, tick, zoom: 0 } : { last, timer, tick, zoom: 0 }
  if (last !== count) {
    timer = LAMP_ZOOM_TIMER
    last = count
  }
  const zoom = timer
  return { last, timer: timer > 0 ? timer - 1 : 0, tick, zoom }
}

const lampZoom: Record<LampKey, LampZoomMemory> = {
  strikes: INITIAL_LAMP_ZOOM,
  balls: INITIAL_LAMP_ZOOM,
  outs: INITIAL_LAMP_ZOOM,
}

/** 정수 배 확대 — 자리 `(x − ((z−1)·w >> 1), y − ((z−1)·h >> 1))` 는 상자 w·h 로(0x37828~0x3784c), 크기 `w·z × h·z` (0x944b5) */
function drawZoomedLamp(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, scale: number): void {
  const wasSmoothing = context.imageSmoothingEnabled
  context.imageSmoothingEnabled = false
  context.drawImage(
    image,
    x - (((scale - 1) * LAMP_BOX_SIZE) >> 1),
    y - (((scale - 1) * LAMP_BOX_SIZE) >> 1),
    image.width * scale,
    image.height * scale,
  )
  context.imageSmoothingEnabled = wasSmoothing
}

/** 램프 세 종류 — 칸마다 파트를 (x + i·9, y) 에, 가장 새 램프만 배율 z 로. 그림이 아직 없어도 확대 걸음은 센다 */
export function drawLamps(context: CanvasRenderingContext2D, counts: Readonly<Record<LampKey, number>>, tick: number): void {
  for (const lamp of LAMPS) {
    const image = sprite(hudPartUrl(lamp.part))
    const count = lampCountOf(lamp, counts[lamp.key])
    lampZoom[lamp.key] = stepLampZoom(lampZoom[lamp.key], count, tick)
    if (image === null) continue
    drawLampRow(context, image, lamp, count, lampZoom[lamp.key].zoom)
  }
}

function drawLampRow(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  lamp: { readonly x: number; readonly y: number },
  count: number,
  scale: number,
): void {
  for (let index = 0; index < count; index += 1) {
    const x = lamp.x + index * LAMP_STEP
    // 가장 새 램프만 배율 z 로 그린다. z == 1 이면 보통 그리기와 같은 자리·크기다
    if (index !== count - 1 || scale <= 1) {
      context.drawImage(image, x, lamp.y)
      continue
    }
    drawZoomedLamp(context, image, x, lamp.y, scale)
  }
}
