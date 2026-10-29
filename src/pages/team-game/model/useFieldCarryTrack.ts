import { useState } from 'react'
import {
  NEW_FIELD_CARRY,
  type FieldCarry,
  fieldCarryAfterBenchClearing,
  fieldCarryAfterHalfInning,
  fieldCarryAfterPlay,
  fieldCarryAfterRelay,
} from '@/widgets/field-walk/lib/fieldCarry'
import type { HalfInningWalkState } from '@/widgets/field-walk/lib/halfInningWalk'
import type { BenchClearingWalkState } from '@/widgets/field-walk/lib/benchClearingWalk'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'

/**
 * **장면 +0x111c 수비 줄 자리 · 카메라 +0x1e8** — 경기 내내 같은 객체라 교대 판 0x3fac4 가 앞 장면이 남긴 그대로 읽는다
 * (`widgets/field-walk/lib/fieldCarry`). 수비 화면 0x17 이 끝난 판 · 교대 판이 닫힌 틱 · 벤치 클리어링 · 자동진행 중계(카메라만)가
 * 차례로 덮는다.
 *
 * 이름 붙인 칸 객체(`CODE_QUALITY.md` "렌더 중 곁일") — 판 · 중계는 그것이 선 **그림에서** 받고(같은 그림의 교대 판이 그 값을 본다),
 * 실시간 판 · 벤치 클리어링 · 교대 판은 끝난 **사건에서** 받는다. 칸은 이 객체 안에만 있다.
 */
export interface FieldCarryTrack {
  /**
   * 그리는 중 — 재생 갈래 · 키 없이 돈 판(`lastDefensePlay`)은 판이 정해진 자리에서, 자동진행 중계 0x21 진입 3ac04 는 카메라만
   * 투수판으로 이어 받는다(판마다 · 중계마다 한 번). 이어 받은 지금 값을 돌려준다
   */
  readonly followRender: (play: DefensePlayResult | null, relaySerial: number | null) => FieldCarry
  /** 실시간으로 돈 판 — 결과를 먹이기 앞에 자리 · 카메라를 받는다 */
  readonly afterLivePlay: (result: DefensePlayResult | undefined) => void
  /** 벤치 클리어링이 끝난 걸음 (0x3a5f0) */
  readonly afterBenchClearing: (walk: BenchClearingWalkState) => void
  /** 교대 판이 닫힌 틱의 걸음 · 카메라 (0x4f7ac 는 0x18 동안만 굴린다) */
  readonly afterHalfInning: (walk: HalfInningWalkState) => void
}

function createFieldCarryTrack(): FieldCarryTrack {
  let carry: FieldCarry = NEW_FIELD_CARRY
  let carriedPlay: DefensePlayResult | null = null
  let carriedRelay: number | null = null
  return {
    followRender(play, relaySerial) {
      if (play !== null && play !== carriedPlay) {
        carriedPlay = play
        carry = fieldCarryAfterPlay(play.ticks, carry)
      }
      if (relaySerial !== null && relaySerial !== carriedRelay) {
        carriedRelay = relaySerial
        carry = fieldCarryAfterRelay(carry)
      }
      return carry
    },
    afterLivePlay(result) {
      if (result !== undefined) carry = fieldCarryAfterPlay(result.ticks, carry)
    },
    afterBenchClearing(walk) {
      carry = fieldCarryAfterBenchClearing(walk)
    },
    afterHalfInning(walk) {
      carry = fieldCarryAfterHalfInning(walk)
    },
  }
}

/** 경기 화면 하나 동안 드는 수비 줄 자리 · 카메라 (`FieldCarryTrack`) */
export function useFieldCarryTrack(): FieldCarryTrack {
  const [track] = useState(createFieldCarryTrack)
  return track
}
