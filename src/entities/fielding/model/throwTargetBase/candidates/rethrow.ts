import { isBugFixed } from '@/shared/config/bugfixes'
import { NONE } from '@/entities/fielding/model/fieldingState'
import { planThrow } from '@/entities/fielding/model/throwPlan'
import { wrapBase, type BaseCandidate, type ThrowTargetInput } from '@/entities/fielding/model/throwTargetBase/types'

/** 커버가 없는 루로의 재송구에 쓰는 큰 값 (0xafe1e) */
const NO_RETHROW_TICKS = 100

/** s8 자르기 — 원본이 재송구 틱을 바이트 칸에 넣었다가 부호 있는 바이트로 읽는다 (0xafe8c) */
function toSignedByte(value: number): number {
  const byte = ((value % 256) + 256) % 256
  return byte > 127 ? byte - 256 : byte
}

/** 루 b 로 보낸 뒤 다시 루 r 로 보내는 틱 (S7 2-5) */
export function rethrowTicks(input: ThrowTargetInput, from: number, to: number): number {
  const { play } = input
  const coverTo = play.coverOfBase[wrapBase(to)] ?? NONE
  if (coverTo === NONE) return NO_RETHROW_TICKS
  const coverFrom = play.coverOfBase[wrapBase(from)] ?? NONE
  const throwerSlot = coverFrom !== NONE ? coverFrom : input.fielders[play.ballHolderSlot].slot
  const plan = planThrow({
    fielders: input.fielders,
    fromSlot: throwerSlot,
    finalSlot: coverTo,
    base: to,
  })
  // ⚠️ 원본 버그(B-60): 중계 포함 전체 틱([6])이 아니라 1구간 틱([5])을 쓴다 → 외야 재송구를 실제보다 짧게 본다
  // (0xafe7e: res = sp+0x9c 에서 [sp+0xa0] 의 둘째 바이트 = res[5], S7 4-1).
  // 고침(bugfixes.json B-60, 기본 켬): 전체 틱 res[6](중계면 1구간 + 2구간 + 3, 중계가 아니면 [5] 와 같다)을 같은 s8 로 읽는다. 굴림 없음
  return toSignedByte(isBugFixed('B-60') ? plan.totalTicks : plan.firstLegTicks)
}

/** 후보표의 재송구 칸을 모두 채운다 (자기 루 칸은 0 그대로) */
export function fillRethrowTicks(input: ThrowTargetInput, table: readonly BaseCandidate[]): void {
  table.forEach((candidate, base) => {
    for (let other = 0; other < 4; other += 1) {
      if (other !== base) candidate.rethrow[other] = rethrowTicks(input, base, other)
    }
  })
}
