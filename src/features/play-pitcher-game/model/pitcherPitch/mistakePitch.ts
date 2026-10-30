import { ZONE_CENTERS } from '@/entities/pitching/model/pitchCurve'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import type { Pitch } from '@/entities/pitching/model/pitch'
import { humanPitchPathOf } from '@/features/play-pitcher-game/model/pitcherPitch/pitchPath'
import { plateOf } from '@/features/play-pitcher-game/model/pitcherPitch/zone'
import type { MistakeHumanPitchInput } from '@/features/play-pitcher-game/model/pitcherPitch/types'

/**
 * 실투 공의 점 수 N — 0x4dec0: 구질(+0xfc8) == 1 이면 0x12(18), 아니면 0x14(20) 를 +0x109c 에 쓰고
 * 0x9e301(공, N) 로 공 점 수를 바꾼다 (CPU `selectPitch` 와 같은 줄)
 */
const MISTAKE_PITCH_FRAMES_FASTBALL = 18
const MISTAKE_PITCH_FRAMES = 20
const FASTBALL_TYPE_NUMBER = 1

/**
 * **사람 투구의 실투** — 0x4dc78 은 사람·CPU 를 가르지 않고 실투 판정 0x33cbc(4dea0)를 부르고, 참이면
 * 곡선 0x9e3c9(4df5e) 앞에서 공을 한가운데로 다시 놓는다 (CPU 는 `selectPitch` 가 따른다):
 *   4dec0  N(scene+0x109c) = 구질(scene+0xfc8) == 1 ? 0x12(18) : 0x14(20)
 *   4df1e  0x9e301(공, N) — 공+0x10(점 수)만 바꾼다. 레코드·구속 단계(0x9e669)는 그대로
 *   4df22  목표점 = 표 0xcfbcc[scene+0x17e1](타자 좌우별 존 한가운데) — 조준점·제구 흩어짐 낸 점 대신
 *   4df5e  0x9e3c9(공, 투수판 0xcfa8c, 그 목표점)
 * 부르는 쪽은 `buildHumanPitch`(제구 흩어짐 굴림) → `isMistakePitch`(rand(0,100)) 뒤에 실투면 이것으로 공을 바꾼다.
 * 곡선은 굴림이 없어 난수 차례는 그대로다. 실투 공의 `plate` 는 (0, 0), `frameCount` 는 18 · 20 이다.
 */
export function mistakeHumanPitchOf(pitch: Pitch, input: MistakeHumanPitchInput): Pitch {
  const target = ZONE_CENTERS[input.side] ?? ZONE_CENTERS[0]
  const frames = input.typeNumber === FASTBALL_TYPE_NUMBER ? MISTAKE_PITCH_FRAMES_FASTBALL : MISTAKE_PITCH_FRAMES
  const worldPath = humanPitchPathOf(input, target, frames)
  return {
    ...pitch,
    plate: plateOf(target, input.side),
    flightDurationMilliseconds: worldPath.length * millisecondsPerFrame(),
    frameCount: worldPath.length,
    worldPath,
  }
}
