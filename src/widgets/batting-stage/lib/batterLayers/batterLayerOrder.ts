/** 자세마다 겹을 쌓는 차례 (0x78cfc) — 일반 타자 · 마타자 */
import {
  type BatterEquipment,
  NO_EQUIPMENT,
  handLayer,
  handOverlayLayer,
  handThirdLayer,
  headItemLayer,
  legItemLayer,
} from '@/widgets/batting-stage/lib/batterLayers/batterEquipment'
import { BODY_FOLDERS, type BatterLayer, GHOST, HELMET, SHADOW, SPRITES } from '@/widgets/batting-stage/lib/batterLayers/batterFolders'

/** 겹침 규칙 표 order[f + adj] (0xd3a54) */
const ORDER_RULES = [
  [1, 1, 1, 1, 0, 0, 1, 1, 2, 1, 1, 1, 1, 2],
  [0, 0, 0, 0, 0, 0, 0, 1, 0, 2, 1, 1, 3],
]

const SLUGER_ADJUST = 14

const FRONT_OFFSETS = [14, 13]

/**
 * 몸통 앞 프레임 중 **원본 PZX 에 파트가 하나도 없는 칸** — balancer 23 · 27(자세 9 · 13 + 14), sluger 22(자세 9 + 13).
 * 원본 0x78cfc 는 이 칸도 그리기를 부르지만 파트가 없어 아무것도 안 나온다. 뽑기(`tools/decode_pzx.py`)는 빈 칸을 PNG 로 안 내므로
 * 웹이 그 겹을 청하면 없는 그림을 받으러 간다(r311 이 찾은 derby-pick · derby-start 의 `frames/023 · 027.png` 와 번호 지도).
 * 그린 것이 같도록 겹 목록에서 뺀다 (r319, `bat/batter_balancer.pzx` · `batter_sluger.pzx` 프레임 구간을 다시 풀어 확인).
 */
const EMPTY_FRONT_FRAMES: readonly (readonly number[])[] = [[23, 27], [22]]

const GHOST_FRAMES = [8, 9]

const GHOST_BALANCER_OFFSET = 6

const GHOST_SLUGER_OFFSET = 8

const GHOST_SLOT = 4

const GHOST_SLOT_LATE = 1

/**
 * 자세 f 의 레이어 목록 — `equipment` 를 안 주면 아무것도 장착하지 않은 선수다.
 *
 * 슬롯 0~8 = 그림자 · 몸통 · 헬멧 · 머리아이템 · 배트(손) · 몸통앞 · 손덧그림 · 손셋째 · 다리.
 * 규칙 1·2·3 의 자리바꿈(0x78e54·0x78e66·0x78e88)을 슬롯 순서 표로 적어 둔 것이라
 * 아이템 슬롯도 그 표의 빈 자리에 그대로 들어간다 (바이트 단위로 다시 확인했다).
 * `withShadow` = `fig+0x48` — false 면 슬롯 0 을 비운다 (0x78dc6, 파일 머리 주석의 여섯 자리 표).
 */
export function batterLayersOf(frame: number, bodyType: number, equipment: BatterEquipment = NO_EQUIPMENT, withShadow = true): BatterLayer[] {
  const type = bodyType === 1 ? 1 : 0
  const slots = batterSlotsOf(frame, type, equipment, withShadow)
  const rule = ORDER_RULES[type][frame] ?? 0
  const ordered: (BatterLayer | null)[] = (SLOT_ORDERS[rule] ?? DEFAULT_SLOT_ORDER).map((slot) => slots[slot])
  if (GHOST_FRAMES.includes(frame)) {
    const after = frame === GHOST_FRAMES[1] ? GHOST_SLOT_LATE : GHOST_SLOT
    ordered.splice(after + 1, 0, ghostLayerOf(frame, type))
  }
  return ordered.filter((layer): layer is BatterLayer => layer !== null)
}

/** 슬롯 0~8 의 겹 — 빈 슬롯은 null */
interface BatterSlots {
  readonly shadow: BatterLayer | null
  readonly body: BatterLayer
  readonly helmet: BatterLayer | null
  readonly head: BatterLayer | null
  readonly front: BatterLayer | null
  readonly bat: BatterLayer | null
  readonly handOverlay: BatterLayer | null
  readonly handThird: BatterLayer | null
  readonly leg: BatterLayer | null
}

/** 규칙 0(그대로) · 1 · 2 · 3 의 자리바꿈(0x78e54 · 0x78e66 · 0x78e88)을 슬롯 순서로 적은 표 */
const DEFAULT_SLOT_ORDER: readonly (keyof BatterSlots)[] = ['shadow', 'body', 'helmet', 'head', 'bat', 'front', 'handOverlay', 'handThird', 'leg']
const SLOT_ORDERS: Readonly<Record<number, readonly (keyof BatterSlots)[]>> = {
  0: DEFAULT_SLOT_ORDER,
  1: ['shadow', 'body', 'helmet', 'head', 'front', 'bat', 'handOverlay', 'handThird', 'leg'],
  2: ['shadow', 'bat', 'body', 'helmet', 'head', 'front', 'handOverlay', 'handThird', 'leg'],
  3: ['shadow', 'bat', 'handOverlay', 'handThird', 'front', 'body', 'helmet', 'head', 'leg'],
}

function batterSlotsOf(frame: number, type: 0 | 1, equipment: BatterEquipment, withShadow: boolean): BatterSlots {
  const adjust = type === 1 ? SLUGER_ADJUST : 0
  const frontFrame = frame + FRONT_OFFSETS[type]
  return {
    shadow: withShadow ? { folder: SHADOW, frame: frame + adjust } : null,
    body: { folder: BODY_FOLDERS[type], frame },
    // 머리 장비가 등급 2 이상이면 원본은 **헬멧을 지운다** (0x78df4 — 헬멧 슬롯에 0 을 넣는다)
    helmet: equipment.head > 1 ? null : { folder: HELMET, frame: frame + adjust },
    head: headItemLayer(equipment.head, frame + adjust),
    front: EMPTY_FRONT_FRAMES[type].includes(frontFrame) ? null : { folder: BODY_FOLDERS[type], frame: frontFrame },
    bat: handLayer(equipment.hand, frame + adjust),
    handOverlay: handOverlayLayer(equipment.hand, frame + adjust),
    handThird: handThirdLayer(equipment.hand, frame + adjust),
    leg: legItemLayer(equipment.leg, frame + adjust),
  }
}

/** 유령 겹 — 자세 8 · 9 에 몸통 종류마다 다른 칸 */
function ghostLayerOf(frame: number, type: 0 | 1): BatterLayer {
  return { folder: GHOST, frame: frame - (type === 0 ? GHOST_BALANCER_OFFSET : GHOST_SLUGER_OFFSET) }
}

/**
 * 마타자 몸통 파일 (적재 0x78ab0 의 `+0x3d ≥ 0` 갈래 — 점프표 0xd3adc, 이름표 0xd3b08~0xd3b60):
 * 순번 0 `ace/batter_medica` · 1 `batter_kao` · 2 `batter_roze` · 3 `batter_death` · 4 `batter_tiger`.
 * 순번은 폼이 아니라 적재 둘째 스택 인자 = `0xb63a0(rec)` 다 (타석 교대 0x47d98~0x47dd6 `[sp+4]`). 팔레트 −1(구운 색).
 */
const ACE_BATTER_FOLDERS = ['medica', 'kao', 'roze', 'death', 'tiger'].map((name) => `${SPRITES}/batter_${name}/frames`)

/**
 * 마타자 그림의 겹 — 그리기 0x78cfc 의 `+0x3d ≥ 0` 갈래(78d26~78d90)는 **몸통 +0xc 의 프레임 f 한 장**만 그린다.
 * 그림자 · 헬멧 · 배트 · 장비 겹(0x47e80 의 0x78fd8 이 실어 두어도)은 안 그리고, 좌우 뒤집기(+0x3c == 0 → 효과 0x11)만 같다.
 */
export function aceBatterLayersOf(frame: number, aceOrder: number): BatterLayer[] {
  const folder = ACE_BATTER_FOLDERS[aceOrder]
  return folder === undefined ? [] : [{ folder, frame }]
}

/* ── 투수 장비 레이어 (적재 0x79790 · 겹치기 0x79524 — 이번에 다시 떠서 확인했다) ───────── */
