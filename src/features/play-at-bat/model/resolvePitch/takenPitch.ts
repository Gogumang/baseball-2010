import type { Pitch } from '@/entities/pitching/model/pitch'
import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
import { isHitByPitch, isStrikeZonePitch } from '@/features/play-at-bat/model/resolvePitch/plateJudgement'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch/types'

/**
 * **스윙하지 않은 공** — 사구가 볼·스트라이크보다 먼저다 (0x9d57c 첫머리 0x9d582 — state[0x12] 면 곧장 4).
 * 그다음 스트라이크 상자(0x3dfd8)에 들면 루킹 스트라이크, 아니면 볼. 굴림이 없다.
 */
export function takenPitchDetailOf(pitch: Pitch, batterHand: number): PitchOutcomeDetail {
  return { resolution: takenPitchResolutionOf(pitch, batterHand), hasSwung: false, isBunt: false, resultCode: null, contactSoundId: null, batterHand }
}

function takenPitchResolutionOf(pitch: Pitch, batterHand: number): PitchResolution {
  if (isHitByPitch(pitch, batterHand)) return { kind: '사구' }
  if (isStrikeZonePitch(pitch)) return { kind: '스트라이크', isSwinging: false }
  return { kind: '볼' }
}

/**
 * **판정 없는 스윙** — 스윙은 나갔지만 0x6aa 판정을 안 탄 공(공이 타자 근처가 아니던 헛스윙 · 키 틱 N 의 늦은 스윙).
 * 0x12 진입 0x3dfac 는 스윙 객체 +0xe(스윙함)를 st[0x10] 에 적고(3dfbe) 사구 판정 0x35a20 은 그 칸이 서 있으면 0 —
 * 헛스윙 스트라이크다. 굴림이 없다. 소리는 판정 없는 헛스윙에서만 0x4e21c 의 8/27 (`unjudgedWhiffSoundIdOf`), 늦은 스윙은 없다.
 */
export function unjudgedSwingDetailOf(contactSoundId: number | null, batterHand: number): PitchOutcomeDetail {
  return {
    resolution: { kind: '스트라이크', isSwinging: true },
    hasSwung: true,
    isBunt: false,
    resultCode: null,
    contactSoundId,
    batterHand,
  }
}
