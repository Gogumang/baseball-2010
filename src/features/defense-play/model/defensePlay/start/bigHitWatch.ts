import { contactOfOutcome } from '@/entities/batting/model/battedContact'
import { isBigHitWatch } from '@/entities/batting/model/bigHitWatch'
import type { DefensePlayInput } from '@/features/defense-play/model/defensePlay/types/defensePlayInput'

/** 0x392ac — 판 입력의 타구로 큰 타구 감상 플래그를 본다 (`bigHitWatch` 를 안 준 판) */
export function bigHitWatchOf(input: Pick<DefensePlayInput, 'outcome' | 'trajectory'>): boolean {
  return isBigHitWatch({
    resultCode: contactOfOutcome(input.outcome)?.resultCode ?? null,
    poleTick: input.trajectory.poleTick,
    carryScale: input.trajectory.carryScale ?? 0,
  })
}
