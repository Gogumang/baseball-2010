import type { RandomPort } from '@/shared/api/random/randomPort'
import { computerPitchTypeOf, pitchListOf, targetKindOf } from '@/entities/pitching/model/pitchIntelligence'
import { cpuPickoffBaseOf, derbyPitchTargetOf, isCpuPickoff, pitchTargetOf } from '@/entities/pitching/model/pitchTarget'
import { DEFAULT_REPERTOIRE } from '@/entities/pitching/model/selectPitch/pitchFace'
import type { CpuPitchAim, CpuPitchArgs, PitcherChangeTickRoll } from '@/entities/pitching/model/selectPitch/types'

/**
 * CPU 구질 굴림 틱 수(0xf 진입부터 0x10 예약까지, 0xf 틱 0~8) — 원본은 구질을 **공마다 9번** 고른다(마지막 값이 남는다).
 *   매 틱 0x52c50: 상태 갱신 0xbc9c9(같은 상태면 틱+1) → 진입 처리 → 조작 0x498d4 → 상태 틱 처리.
 *   0x498d4 가 CPU 조작(0x49a92, 종류 1·2)에 (상태, 틱)을 넘기고(0x537b0) 0x53874 를 부른다.
 *   상태 0xf 면 0x53850 — 수비 쪽(+0xc ≠ 0)이면 **가드 없이** 메시지 0x644 → 0x51212 → 0x344dc(+0xfc8 = 0 부터 다시).
 *   0xf 틱 처리 0x39c1c 는 틱 > 7 이고 +0xfc8 ≠ 0 이어야 0x10 을 예약하고, 예약은 다음 틱 0xbc9c9 에서 선다
 *   → 0xf 는 틱 0~8 의 9 틱이고 조작은 그 9 틱 모두에서 0x344dc 를 부른다.
 * 9번 사이에 볼카운트·주자·남은 마구가 바뀌지 않으니 마구 조건 갈래는 9번 모두 굴림이 없고(구질 22),
 * 아니면 rand(0,6) 을 9번 굴린다. 홈런더비(모드 7, 0x344ea)는 굴림이 없다.
 */
export const CPU_PITCH_TYPE_TICKS = 9

/**
 * **상태 0xf 틱 하나의 구질 고르기 0x344dc** (0x53850 → 0x644 → 0x51212). 홈런더비(모드 7, 0x344ea)는 굴림 없이
 * `derbyPitchType`, 마구 조건이면 굴림 없이 22, 아니면 rand(0,6) 한 번. 마지막으로 부른 값이 그 공의 구질이다
 */
export function cpuPitchTypeTickOf(args: CpuPitchArgs, random: RandomPort): number {
  if (args.derbyPitchType !== undefined) return args.derbyPitchType
  const repertoire = args.pitcher.repertoire ?? DEFAULT_REPERTOIRE
  const list = pitchListOf(repertoire.pitchMask, repertoire.magicId !== 0)
  return computerPitchTypeOf({ list, magicCount: args.magic?.remaining ?? 0, ...args.situation }, random)
}

/**
 * **상태 0x10 틱 6 의 목표 고르기 0x345fc** (0x53824 → 0x645 → 0x5121c) — 종류 0x9eeac · 목표점, 또는 종류 4 견제 0x34848.
 * 홈런더비(0x3460e)는 굴림 없이 존 한가운데
 */
export function cpuPitchAimOf(args: CpuPitchArgs, random: RandomPort): CpuPitchAim {
  const { situation, cpuPickoff } = args
  // 0x3460e: 모드 7 이면 종류·목표점을 굴리지 않고 존 한가운데 (0x34612~0x34644)
  if (args.derbyPitchType !== undefined) return { kind: '목표', target: derbyPitchTargetOf(situation.side) }
  const kind = targetKindOf(args.difficulty, situation, random)
  if (cpuPickoff !== undefined && isCpuPickoff(kind, situation)) {
    // 0x34848: 루 = rand(1,4) 를 주자 있는 루까지 반복 → 메시지 0x10 → 0x348d6(에필로그). 그 뒤 굴림은 없다
    return { kind: '견제', base: cpuPickoffBaseOf(cpuPickoff.hasRunnerOnBase, random) }
  }
  return { kind: '목표', target: pitchTargetOf(kind, situation, random) }
}

/**
 * **CPU 투수 교체 틱의 구질 굴림 한 번** — 0xf 진입 0x3d954 가 CPU 투수 교체(0xac428 → 0xaf09c)로 22 "Time!" · 0x16 을
 * 예약한 그 틱(0xf 틱 0)에도, 진입 처리 **뒤** 조작 0x498d4 → CPU 조작 0x53850 이 수비 쪽(+0xc ≠ 0)이라 가드 없이
 * 메시지 0x644 → 0x51212 → 0x344dc 를 부른다(예약은 다음 틱 0xbc9c9 에서 선다). 값은 버려진다 — 0x16 → 0xd → 0xe → OK
 * 뒤 0xf 에 다시 들어서면 `selectPitch` 가 틱 0~8 의 9번을 새로 굴린다. 마구 조건이면 굴림이 없다(0x344dc).
 * 사람이 수비하는 쪽(CPU 대타 0xac228 로 0x16)은 CPU 조작이 공격 쪽이라 0x644 가 없다.
 */
export function rollCpuPitchTypeOnPitcherChangeTick(input: PitcherChangeTickRoll, random: RandomPort): void {
  const repertoire = input.repertoire ?? DEFAULT_REPERTOIRE
  computerPitchTypeOf(
    {
      list: pitchListOf(repertoire.pitchMask, repertoire.magicId !== 0),
      magicCount: input.magicRemaining ?? 1,
      runnerCount: input.runnerCount,
      strikes: input.strikes,
      balls: input.balls,
    },
    random,
  )
}
