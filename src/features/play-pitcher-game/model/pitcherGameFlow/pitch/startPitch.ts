import { runnerCountOf } from '@/entities/game/model/baseState'
import { type CpuPitchOutcome, pitchAgainstBatterDetailed } from '@/entities/pitching/model/simulateBatter'
import { rollCpuStealStart, stealStartSceneOf } from '@/features/defense-play/model/pitchArrivalPlay'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { MAGIC_PITCH_TYPE_NUMBER } from '@/entities/pitcher-career/model/magicPitch'
import { myDefenseAbilitiesOf, runAbilitiesOnBaseOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/fielding/fielderInputs'
import { isPitchTurn } from '@/features/play-pitcher-game/model/pitcherGameFlow/pitch/pitchTurn'
import { type MyRolledPitch, rollMyPitch } from '@/features/play-pitcher-game/model/pitcherGameFlow/pitch/rollMyPitch'
import { afterPitchOf, cpuBatterTraitsOf, rollReleasedPitchRest } from '@/features/play-pitcher-game/model/pitcherGameFlow/pitch/startPitchRest'
import { opponentBatterAbility, opponentRosterSlotOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/opponentBatters'
import type { PitchInput } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/pitchStateTypes'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/**
 * 공 하나를 던지고 **인플레이 타구면 거기서 멈춘다** — 주자 처리를 뒤로 미룬다.
 *
 * 인플레이 타구는 진행기에 넘길 `DefensePlayInput` 만 만들어 `pendingDefensePlay` 에 얹고
 * 경기 상태(루·아웃·점수·기록)는 **한 톨도 건드리지 않은 채** 돌려준다. 그 동안 다음 공이
 * 나가지 않는 것이 이 칸의 뜻이다 (원본 상태 0x17 이 도는 동안 0xf 로 안 가는 것과 같은 자리).
 * 주자 처리·기록·돌발 판정은 화면이 다 돌고 `resolveDefensePlay` 를 부를 때 한 번에 한다.
 *
 * 삼진·볼넷·홈런은 수비가 개입할 것이 없어 여기서 곧장 끝낸다 (타자편 `startPlayerOutcome` 과 같다).
 *
 * 굴림 차례: 내 공(등급 → 궤적 → 실투, `rollMyPitch`) → CPU 도루 출발 → 도루 판 CPU 송구 결정 → CPU 타자 결정 → 공 도착 · 판.
 */
export function startPitch(
  progress: PitcherGameProgress,
  input: PitchInput,
  random: RandomPort,
  /**
   * 화면이 도는 갈래 — 공 도착의 도루 · 폭투 판을 붙들어(`pendingRunnerPlay`) 화면이 키(+0x160)를 받으며 실시간으로 돌리게 한다.
   * 안 주면 예전처럼 키 없이 미리 돌린다(`throwPitch` · 시험)
   */
  live = false,
  /**
   * 화면 갈래 — 못 맞힌 공의 공 도착 0x3dfac 을 0x12 진입 틀까지 붙든다(`pendingPitchArrival`). 부르는 쪽이 그 틀
   * (놓은 틀에서 `pitchResultEntryDelayTicksOf` 뒤)에 `enterPitchResult` 를 부른다. 안 주면 예전처럼 놓는 걸음에 다 돌린다
   */
  holdsArrival = false,
): PitcherGameProgress {
  if (!canThrow(progress, input)) return progress
  const mine = rollMyPitch(progress, input, random)
  const steal = rollCpuStealOnPitch(progress, random)
  const thrown = rollCpuBatterDecision(progress, mine, random)
  const afterPitch = afterPitchOf(progress, { ...mine, thrown, ...steal })
  return rollReleasedPitchRest(progress, afterPitch, { thrown, pitch: mine.pitch, grade: mine.grade, live, holdsArrival }, random)
}

/** 사람 차례이고 붙든 공이 없고, 마구면 남은 횟수가 있다 */
function canThrow(progress: PitcherGameProgress, input: PitchInput): boolean {
  if (!isPitchTurn(progress) || progress.pendingPitchArrival != null) return false
  return input.typeNumber !== MAGIC_PITCH_TYPE_NUMBER || progress.magicRemaining > 0
}

/**
 * CPU 도루 0x520de — 상태 0x11 의 10번째 틱(0x537dc → 메시지 0x583)이라 실투 판정(0x4dea0) 뒤, CPU 타자 결정
 * (11번째 틱 0x34334) **바로 앞**이다. 후보가 있을 때만 rand(0,1000) 한 번 → 0xa9bd4 출발 (`rollCpuStealStart`).
 * 같은 메시지 0x583 의 52222 — CPU 송구 결정 0xafa60 한 번(앞 판이 끝난 그대로의 우리 수비). 11번째 틱 CPU 타자 결정보다 먼저다
 * (`stealStartSceneOf`, r214 — 예전 웹은 공 도착 판 맨 앞에서 굴렸다). 수비 · 주자 칸은 공 도착 판(`arrivePitcherPitch`)과 같다
 */
function rollCpuStealOnPitch(progress: PitcherGameProgress, random: RandomPort) {
  const bases = progress.game.bases
  const stealingFrom = rollCpuStealStart({ bases, offenseIsCpu: true, runAbilityOf: (base) => runAbilitiesOnBaseOf(progress)[base] ?? 0 }, random)
  const stealScene = stealStartSceneOf(
    {
      scene: progress.defenseScene,
      bases,
      outs: progress.game.outs,
      defenseAbilities: myDefenseAbilitiesOf(progress),
      runAbilities: runAbilitiesOnBaseOf(progress),
    },
    stealingFrom,
    random,
  )
  return { stealingFrom, stealScene }
}

/** CPU 타자 결정 0x34334 — 원본이 보는 상황은 state 의 볼카운트·아웃과 주자 유무(0xa9599) */
function rollCpuBatterDecision(progress: PitcherGameProgress, mine: MyRolledPitch, random: RandomPort): CpuPitchOutcome {
  const batter = opponentBatterAbility(progress.options, opponentRosterSlotOf(progress))
  const situation = {
    strikes: progress.atBat.strikes,
    balls: progress.atBat.balls,
    outs: progress.game.outs,
    hasRunner: runnerCountOf(progress.game.bases) > 0,
  }
  const traits = cpuBatterTraitsOf(progress, mine.isMistake, mine.staminaPercent, mine.opponentBatter)
  return pitchAgainstBatterDetailed(
    mine.pitch,
    batter,
    random,
    { control: mine.fatigued.control, velocity: mine.fatigued.velocity },
    situation,
    traits,
  )
}
