import type { Pitch } from '@/entities/pitching/model/pitch'
import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'
import { advanceMagicPitchGameState } from '@/entities/pitching/model/magicPitchGame'
import { DEFAULT_REPERTOIRE, isMagicTypeNumber, pitchNameOf, pitchTypeRowOf, plateOf } from '@/entities/pitching/model/selectPitch/pitchFace'
import type { CpuPitchArgs } from '@/entities/pitching/model/selectPitch/types'

/**
 * **0x11 틱 0~9(와인드업) 동안의 공 자리** — 놓기 0x4dc78 은 틱 10 이라 그 전에는 곡선 · 제구 오차가 아직 없다.
 * 타석 화면이 와인드업을 그리고(투수 폼 · 손) 0x11 인지 묻는 데만 쓴다: 곡선이 비어 있고(`frameCount` 0, 공 틱 < 0 이라
 * 그리지도 판정하지도 않는다) 존 자리는 0x10 의 목표점이다. 독수리눈(이글아이)은 와인드업 동안에도 같은 0x10 목표점을 본다 —
 * 0x11 그리기 0x4d2ac 는 틱을 안 가리고 4d2dc~4d2ea 에서 [경기+0x10b8](0x10 틱 6 의 0x345fc 가 쓴 점)을 떠 투영한다(r309 직접 뜸).
 * 그래서 `aimTarget` 도 싣는다. 틱 10 에 `releaseCpuPitch` 의 공으로 바꾼다
 */
export function windUpCpuPitchOf(args: CpuPitchArgs, typeNumber: number, target: WorldPoint): Pitch {
  const repertoire = args.pitcher.repertoire ?? DEFAULT_REPERTOIRE
  const isMagic = isMagicTypeNumber(typeNumber)
  // 공+0x10 은 0x11 **진입** 0x3de10(3de3e)이 싣는다 — 웹은 마구 칸을 놓기(틱 10)에 고치므로(`releaseCpuPitch`) 와인드업 자리 공에는
  // 같은 셈을 사본에 돌린 값을 미리 싣는다(마투수 투수 이펙트 0x39192 가 0x11 첫 그림부터 본다). 굴림 · 상태는 안 바꾼다
  const magicPreview = { ...(args.magic ?? { remaining: 0, ballMagicNumber: 0 }) }
  advanceMagicPitchGameState(magicPreview, typeNumber, repertoire.magicId, args.derbyPitchType !== undefined)
  const type = pitchTypeRowOf(typeNumber)
  return {
    type: pitchNameOf(typeNumber, repertoire),
    plate: plateOf(target, args.situation.side),
    // 0x4d2ac 이글아이가 와인드업 동안에도 투영하는 0x10 목표점(+0x10b8)
    aimTarget: target,
    breakOffset: { x: type.horizontalBreak, y: type.verticalBreak },
    flightDurationMilliseconds: 0,
    frameCount: 0,
    controlTier: 0,
    worldPath: null,
    stageSide: args.situation.side,
    magicNumber: magicPreview.ballMagicNumber,
    isMagicPitch: isMagic,
    pitcherMagicNumber: repertoire.magicId,
    pitcherForm: repertoire.form,
  }
}
