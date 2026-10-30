import { MAGIC_PITCH, pitchListOf } from '@/entities/pitching/model/pitchIntelligence'
import { PITCH_TYPES } from '@/shared/config/original/pitchTypes'
import { MAGIC_PITCH_TYPE_NUMBER, MAGIC_PITCH_SLOT, magicPitchNameOf } from '@/entities/pitcher-career/model/magicPitch'
import type { PitcherRepertoire, PitchSlot } from '@/features/play-pitcher-game/model/pitcherPitch/types'

/** 구질 칸 수 (0xb6d2c 의 표 0xd8920, 칸 6개) */
export const PITCH_SLOT_COUNT = 6

/**
 * 구질 칸 6개 (`0xb6d2c`). 칸 5 는 `+0x18 != 0` 일 때만 마구로 채운다 (0xb6d6a).
 * 이름은 일반 구질이면 `pitchTypes` 표, 마구면 번호·폼으로 고른 StrCOMMON 이름이다.
 */
export function pitchSlotsOf(repertoire: PitcherRepertoire): readonly PitchSlot[] {
  const list = pitchListOf(repertoire.pitchMask, repertoire.magicNumber !== 0)
  return list.map((typeNumber, slot) => {
    if (typeNumber === MAGIC_PITCH) {
      return {
        slot,
        typeNumber: MAGIC_PITCH_TYPE_NUMBER,
        name: magicPitchNameOf(repertoire.magicNumber, repertoire.form) ?? '마구',
        isMagic: true,
      }
    }
    return {
      slot,
      typeNumber,
      name: typeNumber === 0 ? '' : (PITCH_TYPES[typeNumber - 1]?.name ?? ''),
      isMagic: false,
    }
  })
}

/** 그 칸을 지금 고를 수 있는가 — 마구 칸은 남은 횟수가 0 이면 막힌다 (0x50db8) */
export function canSelectSlot(slot: PitchSlot, magicRemaining: number): boolean {
  if (slot.typeNumber === 0) return false
  if (slot.slot === MAGIC_PITCH_SLOT && slot.isMagic) return magicRemaining > 0
  return true
}
