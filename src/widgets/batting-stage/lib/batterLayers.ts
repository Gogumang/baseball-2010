/**
 * 타자 그림 (binary.mod 0xb905c 자세 · 0x78cfc 레이어 — 위치 분석 5차, 바이트 확인).
 * 모든 레이어를 같은 앵커에 프레임 원점대로 겹친다. 레이어 폴더 프레임 = 자세 f + 레이어 가산값.
 *   bodyType t = 타자 폼 >> 1 (0 balancer · 1 sluger) — `bodyTypeOf` 참고.
 * 아이템 레이어: 머리 아이템(+0x1c)·손 아이템(+0x20/+0x44)은 장비 레벨과 아이템 번호의 대응이 미확인이라
 * 없는 것으로 그린다 (추정). 손 아이템이 없으면 bat/batter_batter 를 쓴다. 다리는 item_bat_leg_0 (추정).
 * 그림자는 +0x48 플래그일 때만 그리는데 플래그 뜻이 미확인이라 늘 그린다 (추정).
 */
import { outfitPaletteIndex } from '@/shared/lib/sprite/paletteSwap'

const SPRITES = './sprites'
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

/**
 * 원본 "폼" = 선수 레코드 `rec[0xb]` 의 **윗니블 = 2 × 타입 + 손** (C 5절 0x16f9a).
 * 몸통 파일 적재 0x78ab0 이 그 니블로 고른다 — `≤ 1 → bat/batter_balancer · 2·3 → bat/batter_sluger`
 * (C-create-palette 127행). 곧 **t = 폼 >> 1 = 타입**(0 타격형 · 1 장타형)이다.
 * 웹은 `career.battingTypeIndex`(타입) 와 `career.battingSide`(손) 를 들고 있어 폼을 그대로 만들 수 있다.
 */
export function bodyTypeOf(form: number): number {
  return Math.max(0, Math.trunc(form)) >> 1 === 0 ? 0 : 1
}

/**
 * 레이어 한 겹이 쓸 대체 팔레트(.mpl) 번호 — 없으면 null (C-1 확정).
 *   몸통 `bat/batter_balancer`·`batter_sluger` → **피부 × 15 + 팀** (0x78be8)
 *   헬멧 `bat/batter_helmet`                  → **팀** (0x78c14 — 헬멧엔 피부가 없다)
 * 그림자·배트·다리·잔상은 .mpl 이 아예 없어 원본도 구운 색 그대로 그린다.
 *
 * 순수 함수라 캔버스가 없는 곳(테스트)에서도 쓸 수 있다. 실제로 칠하는 것은
 * `shared/lib/sprite/paletteSwap.ts` 의 `useRecoloredSprite`(<img>) 몫이다 —
 * ⚠️ 타석 화면은 캔버스(`renderBattingStage.drawBatter`)라 이 번호를 아직 못 받는다:
 * `drawBatter` 는 피부·팀을 넘겨받지 않고 `spriteLoader.placedFrame` 도 URL 한 개만 받는다.
 */
export function batterLayerPaletteIndex(folder: string, skinIndex: number, teamIndex: number): number | null {
  if (folder === BODY_FOLDERS[0] || folder === BODY_FOLDERS[1]) return outfitPaletteIndex(skinIndex, teamIndex)
  if (folder === HELMET) return teamIndex
  return null
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
