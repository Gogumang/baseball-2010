/**
 * 타자 그림 (binary.mod 0xb905c 자세 · 0x78cfc 레이어 — 위치 분석 5차, 바이트 확인).
 * 모든 레이어를 같은 앵커에 프레임 원점대로 겹친다. 레이어 폴더 프레임 = 자세 f + 레이어 가산값.
 *   bodyType t = 타자 폼 >> 1 (0 balancer · 1 sluger) — 웹은 폼을 넘기지 않아 0 으로 그린다 (추정)
 * 아이템 레이어: 머리 아이템(+0x1c)·손 아이템(+0x20/+0x44)은 장비 레벨과 아이템 번호의 대응이 미확인이라
 * 없는 것으로 그린다 (추정). 손 아이템이 없으면 bat/batter_batter 를 쓴다. 다리는 item_bat_leg_0 (추정).
 * 그림자는 +0x48 플래그일 때만 그리는데 플래그 뜻이 미확인이라 늘 그린다 (추정).
 */
const SPRITES = '/sprites'
const BODY_FOLDERS = [`${SPRITES}/batter_balancer/frames`, `${SPRITES}/batter_sluger/frames`]
const SHADOW = `${SPRITES}/batter_shadow/frames`
const HELMET = `${SPRITES}/batter_helmet/frames`
const BAT = `${SPRITES}/batter_batter/frames`
const LEG = `${SPRITES}/item_bat_leg_0/frames`
const GHOST = `${SPRITES}/batter_ghost/frames`

export interface BatterLayer {
  readonly folder: string
  readonly frame: number
}

interface PoseTable {
  readonly idle: readonly number[]
  readonly swingStart: number
  readonly swingLength: number
  readonly bunt: number
}

/** u > 4(일반 타자) 분기 — v 0·1 과 v 2·3 */
const POSES: readonly PoseTable[] = [
  { idle: [0, 1, 2, 3], swingStart: 6, swingLength: 7, bunt: 13 },
  { idle: [0, 1, 2, 3, 4], swingStart: 7, swingLength: 5, bunt: 12 },
]
/** 대기 칸은 카운터가 지연 3 에 닿으면 넘어간다 → 칸마다 4틱 */
const IDLE_TICKS_PER_FRAME = 4

export interface BatterPoseInput {
  /** 지금 틱 */
  readonly tick: number
  /** 스윙을 누른 틱. 스윙 중이 아니면 null */
  readonly swingTick: number | null
  readonly isBunting: boolean
  readonly bodyType: number
}

export function batterFrameAt({ tick, swingTick, isBunting, bodyType }: BatterPoseInput): number {
  const pose = POSES[bodyType] ?? POSES[0]
  if (isBunting) return pose.bunt
  if (swingTick !== null) {
    const elapsed = tick - swingTick
    if (elapsed >= 0 && elapsed < pose.swingLength) return pose.swingStart + elapsed
  }
  const cell = Math.floor(Math.max(0, tick) / IDLE_TICKS_PER_FRAME) % pose.idle.length
  return pose.idle[cell]
}

/** 겹침 규칙 표 order[f + adj] (0xd3a54) */
const ORDER_RULES = [
  [1, 1, 1, 1, 0, 0, 1, 1, 2, 1, 1, 1, 1, 2],
  [0, 0, 0, 0, 0, 0, 0, 1, 0, 2, 1, 1, 3],
]
const SLUGER_ADJUST = 14
const FRONT_OFFSETS = [14, 13]
const GHOST_FRAMES = [8, 9]
const GHOST_BALANCER_OFFSET = 6
const GHOST_SLUGER_OFFSET = 8
const GHOST_SLOT = 4
const GHOST_SLOT_LATE = 1

export function batterLayersOf(frame: number, bodyType: number): BatterLayer[] {
  const type = bodyType === 1 ? 1 : 0
  const adjust = type === 1 ? SLUGER_ADJUST : 0
  const body: BatterLayer = { folder: BODY_FOLDERS[type], frame }
  const front: BatterLayer = { folder: BODY_FOLDERS[type], frame: frame + FRONT_OFFSETS[type] }
  const shadow: BatterLayer = { folder: SHADOW, frame: frame + adjust }
  const helmet: BatterLayer = { folder: HELMET, frame: frame + adjust }
  const bat: BatterLayer = { folder: BAT, frame: frame + adjust }
  const leg: BatterLayer = { folder: LEG, frame: frame + adjust }

  const rule = ORDER_RULES[type][frame] ?? 0
  // 슬롯 0~8 = 그림자·몸통·헬멧·머리아이템·배트·몸통앞·손아이템·손추가·다리 (아이템 슬롯은 비어 있다)
  const slots: (BatterLayer | null)[] =
    rule === 1
      ? [shadow, body, helmet, null, front, bat, null, null, leg]
      : rule === 2
        ? [shadow, bat, body, helmet, null, front, null, null, leg]
        : rule === 3
          ? [shadow, bat, null, null, front, body, helmet, null, leg]
          : [shadow, body, helmet, null, bat, front, null, null, leg]

  if (GHOST_FRAMES.includes(frame)) {
    const ghost: BatterLayer = { folder: GHOST, frame: frame - (type === 0 ? GHOST_BALANCER_OFFSET : GHOST_SLUGER_OFFSET) }
    const after = frame === GHOST_FRAMES[1] ? GHOST_SLOT_LATE : GHOST_SLOT
    slots.splice(after + 1, 0, ghost)
  }
  return slots.filter((layer): layer is BatterLayer => layer !== null)
}
