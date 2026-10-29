import { PITCHER_ABILITY_NAMES, PITCHER_ABILITY_ORDER } from '@/entities/pitcher-career/model/pitcherAbility'
import type { PitcherAbility } from '@/entities/pitcher-career/model/pitcherAbility'

/** 타입 이름 — 표 0x1400080 [2 + 타입] (0x187be `ldr r1,[r3,#8]`) */
export const PITCHER_TYPE_NAMES: readonly string[] = ['오버핸드', '사이드암', '언더스로']

export interface PitcherTrainingMenu {
  readonly id: string
  readonly name: string
  /** 올리는 능력치 칸. 비어 있으면 **마구 칸**(상태 0x78 창) */
  readonly ability: keyof PitcherAbility | null
}

/**
 * 훈련 메뉴 다섯 칸. 칸 0~3 결과 글은 StrMODE[40+칸] 이름을 쓴다 (R7 3절 — 타자는 [35+칸]).
 * 칸 4 이름 "마구" 는 H-4 의 "필살타법(투수는 마구)" 표기를 따른다.
 */
export const PITCHER_TRAINING_MENUS: readonly PitcherTrainingMenu[] = [
  ...PITCHER_ABILITY_ORDER.map((ability, slot) => ({
    id: PITCHER_ABILITY_NAMES[slot],
    name: PITCHER_ABILITY_NAMES[slot],
    ability,
  })),
  { id: '마구', name: '마구', ability: null },
]

/** 훈련 칸 4 — 마구와 구질 훈련이 같은 칸 [sp+0x40] = 4 로 0x17f5c 를 돈다(훈련 수 +0x4b+4) */
export const MAGIC_TRAINING_MENU = PITCHER_TRAINING_MENUS[PITCHER_TRAINING_MENUS.length - 1]
/** 훈련 칸 4 ([sp+0x40]) — 마구 · 구질 훈련 */
export const MAGIC_TRAINING_SLOT = 4
