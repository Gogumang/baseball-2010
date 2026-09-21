import type { EventPortrait } from '@/shared/config/original/eventTypes'
import { PORTRAIT_OTHER_PEOPLE_PALETTE, portraitPaletteIndex } from '@/shared/lib/sprite/paletteSwap'

/** 원작 자리 목표 거리 (binary.mod 0xd4770). 왼쪽은 x = 거리, 오른쪽은 x = 화면폭 − 거리. */
export const SLOT_OFFSETS = [45, 75, 105] as const
/** 한쪽에 설 수 있는 자리 수 */
const SLOTS_PER_SIDE = SLOT_OFFSETS.length
/** 한 번 갱신에 목표 거리의 1/6 씩 들어온다 (0x7f998). */
export const SLIDE_DIVISOR = 6

export interface PlacedPortrait {
  readonly portrait: EventPortrait
  readonly slot: number
  /** 자리 목표 x (화면 기준) */
  readonly targetX: number
  /** 같은 자리에 같은 인물이 이어지면 다시 미끄러져 들어오지 않게 쓰는 열쇠 */
  readonly key: string
}

/** 명령의 초상화 목록을 좌우 자리에 나눈다. 나온 순서대로 자리를 채우고 넘치면 버린다. */
export function placePortraits(portraits: readonly EventPortrait[], screenWidth: number): PlacedPortrait[] {
  const used = { left: 0, right: 0 }
  const placed: PlacedPortrait[] = []
  for (const portrait of portraits) {
    const slot = used[portrait.side]
    if (slot >= SLOTS_PER_SIDE) continue
    used[portrait.side] += 1
    const offset = SLOT_OFFSETS[slot]
    placed.push({
      portrait,
      slot,
      targetX: portrait.side === 'left' ? offset : screenWidth - offset,
      key: `${portrait.side}-${slot}-${portrait.file}`,
    })
  }
  return placed
}

// ── 주인공(육성 선수) 초상화 — 피부 팔레트와 장타형 프레임 +8 ────────────────────
// 근거: C-create-palette.md C-1 · 5절 "event_char_0.mpl" (확정) · CORRECTIONS.md 2절 (V2).

/** 주인공 표정 수. `event_char_0` 애니 0~7 = 타격형 · 8~15 = 장타형 (프레임 표 0xd0ae6 은 -1 = 표에 없음). */
export const HERO_EXPRESSION_COUNT = 8
/** 타자 모드이고 타입 니블 > 1(장타형) 이면 애니 번호에 **+8** 을 더한다 (0x63a6a~0x63a78). */
export const SLUGER_ANIMATION_OFFSET = 8

/**
 * 이 초상화가 육성 선수(주인공)인가.
 * 주인공만 `event_char_0.pzx` 를 **자기 피부 .mpl 로 다시 칠해** 들고, 장타형 몸을 따로 가진다.
 * 그 밖의 인물은 같은 그림을 기본 팔레트(= 황인)로 쓰므로 손대지 않는다.
 */
export function isHeroPortrait(portrait: EventPortrait): boolean {
  return portrait.file === 'event_char_0' && portrait.animation < HERO_EXPRESSION_COUNT * 2
}

/**
 * 실제로 재생할 애니 번호. 주인공이 장타형이면 표정 번호에 +8 을 더한다.
 * 이벤트 데이터가 이미 8~15 를 적어 두었더라도 표정만 뽑아 쓰므로 두 번 더해지지 않는다.
 */
export function portraitAnimationOf(portrait: EventPortrait, battingTypeIndex: number): number {
  if (!isHeroPortrait(portrait)) return portrait.animation
  const expression = portrait.animation % HERO_EXPRESSION_COUNT
  return battingTypeIndex >= 1 ? expression + SLUGER_ANIMATION_OFFSET : expression
}

/**
 * 이 초상화가 쓸 `event_char_0.mpl` 팔레트 번호 — 없으면 null (구운 그림 그대로).
 * 주인공만: 피부 0 황인 → 안 씀(PZX 기본 팔레트가 이미 황인) · 1 백인 → 0 · 2 흑인 → 1 (0x63a7e).
 *
 * ⚠️ 팔레트 2(`PORTRAIT_OTHER_PEOPLE_PALETTE`)는 **이벤트 인물 8·9 전용**이다 (0x63a50).
 * 그 둘의 애니 기준은 표 0xd0ae6[8]=58 · [9]=65 지만, 이벤트 대본이 적어 둔 애니 번호 중
 * 58~71 을 쓰는 것이 하나도 없어(events.json 전수) **지금 화면에 뜰 일이 없다** — 그래서 안 쓴다.
 */
export function portraitPaletteOf(portrait: EventPortrait, skinIndex: number): number | null {
  return isHeroPortrait(portrait) ? portraitPaletteIndex(skinIndex) : null
}

/** 인물 8·9 의 애니 번호 범위 (표 0xd0ae6[8]=58 · [9]=65, 표정 7가지) — 아직 쓰는 데가 없다. */
export const OTHER_PEOPLE_ANIMATIONS = { from: 58, to: 71, palette: PORTRAIT_OTHER_PEOPLE_PALETTE } as const

/** 미끄러져 들어온 뒤의 x. 자리 목표 거리의 1/6 씩, 갱신 횟수만큼 들어온다. */
export function slideX(placed: PlacedPortrait, update: number, screenWidth: number): number {
  const offset = SLOT_OFFSETS[placed.slot]
  const travelled = Math.min(offset, (offset / SLIDE_DIVISOR) * Math.max(0, update))
  return placed.portrait.side === 'left' ? travelled : screenWidth - travelled
}
