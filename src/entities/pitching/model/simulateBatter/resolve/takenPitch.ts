import type { PitchResolution } from '@/entities/pitching/model/simulateBatter/otherSlices'
import type { CpuPitchOutcome } from '@/entities/pitching/model/simulateBatter/types'
import { isPitchInHitByPitchBox } from '@/entities/pitching/model/hitByPitch'
import type { Pitch } from '@/entities/pitching/model/pitch'
import { isInsideStrikeZone } from '@/shared/lib/geometry/coordinate'

/** 안 휘두르면 0x34334 가 0x34436~0x34464(+0xfdc 쓰기)를 안 지난다 — 이 공의 0x11 진입(3deb8 0x340dc memset)이 지운 0 그대로다 */
export function unswungOutcomeOf(resolution: PitchResolution, remainingBefore: number | null): CpuPitchOutcome {
  return { resolution, isSpecialSwing: false, specialSwingRemaining: remainingBefore, isUncatchable: false, buntKind: 0 }
}

/**
 * 지켜본 공의 판정 — 사구가 볼·스트라이크보다 먼저다. 상태 0x12 진입 0x3dfac 가 0x35a20 을 맨 먼저 불러 state[0x12] 에
 * 넣고(0x3dfc0~0x3dfc8), 투구 판정 0x9d57c 가 그 칸을 첫머리(0x9d582)에서 봐 곧장 4 를 돌려준다.
 * 사람 타석과 같은 함수·같은 경로다 — 0x3dfac 의 부르는 곳은 경기 장면 진입표 0xd04bc 의 0x52d28 하나뿐이고
 * 누가 치는지 가르지 않는다. 지켜보기면 0x34334 가 스윙 예약(scene+0xfe0 = 1, 0x34420)을 안 하므로
 * 스윙(0x4e0e0~ 의 vtable +0x14/+0x18)이 안 나가 스윙 객체 +0xd·+0xe 가 0 이다 → 상자 판정까지 간다.
 * 좌타 뒤집기는 0xb63c0(현재 타자)이고, 화면 배치 side(+0x17e1)는 타석 시작 0x3b084 가 같은
 * 0xb63c1(타자)로 정한 값이라 둘이 같다 — 웹 CPU 타자는 손 정보가 없어 `pitch.stageSide` 를 쓴다. 난수를 쓰지 않는다
 */
export function takenPitchResolutionOf(pitch: Pitch): PitchResolution {
  if (isPitchInHitByPitchBox(pitch, pitch.stageSide)) return { kind: '사구' }
  return isInsideStrikeZone(pitch.plate) ? { kind: '스트라이크', isSwinging: false } : { kind: '볼' }
}
