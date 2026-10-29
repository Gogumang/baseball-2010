import { type InPlayCommand, inPlayCommandOf } from '@/entities/defense-controls/model/defenseKeys'
import { SLIDING_SOUND_EFFECT, SLIDING_SPEED_BONUS, slideOnKey } from '@/entities/defense-controls/model/sliding'
import { applyBaserunningKey } from '@/entities/fielding/model/baserunningKey'
import { type DefenseKeyPress, framePressesOf } from '@/features/defense-play/model/runDefensePlay'
import type { RunnerPlayFrame } from '@/features/defense-play/model/runnerPlay/frame/runnerPlayFrame'
import { runnerStates, slidingRunnerOf } from '@/features/defense-play/model/runnerPlay/runners/playRunners'
import { pushPlayLog } from '@/features/defense-play/model/playLog'

/**
 * **0b · 0c. 사람 조작** — 상태 0x17 키 0x53420. 한 틀에 누름 · 되풀이가 함께 오면 0x498d4 가 누름 → 되풀이 차례로 둘 다 0x53420 에
 * 보낸다(`framePressesOf`). 판이 끝난 뒤의 키는 안 받는다.
 */
export function applyRunnerPlayKeys(g: RunnerPlayFrame, tick: number, press: DefenseKeyPress | null): void {
  const side = g.input.controls?.side
  if (side === undefined) return
  for (const keyPress of framePressesOf(press)) {
    if (g.play.finished) return
    const command = inPlayCommandOf(keyPress.key, side, { isHoldRepeat: keyPress.isRepeat === true })
    if (command === null) continue
    if (side === '수비') applyDefenseKey(g, tick, command)
    else applyOffenseKey(g, tick, command)
  }
}

/**
 * 0b — 수비면 0x533c8 → 메시지 0x588(목표 루) → 0x51890 → 플레이 vt60 0xb3118 → +0x160.
 * 판 종류를 안 가린다. 키 반복(누르고 있기)도 0x536bc 가 0x17 갈래로 보낸다
 */
function applyDefenseKey(g: RunnerPlayFrame, tick: number, command: InPlayCommand): void {
  if (command.kind !== '송구') return
  g.manualThrowBase = command.target
  g.play = { ...g.play, manualThrowBase: g.manualThrowBase }
  pushPlayLog(g.log, () => `${tick}틱 사람이 ${command.target}루로 송구 지시`)
}

/** 0c — 공격이면 0x53420 이 주루 0x5331c(0x582 진루 · 0x584 귀루) · OK 0x585(슬라이딩) */
function applyOffenseKey(g: RunnerPlayFrame, tick: number, command: InPlayCommand): void {
  if (command.kind === '슬라이딩') applySlideKey(g, tick)
  if (command.kind === '진루' || command.kind === '귀루') applyRunnerKey(g, tick, command)
}

/**
 * 0x518da — 종류 2 · 3 · 파울(이 판엔 타구가 없다) · 걸어 나가는 주자(이 진행기에 +0xba 연출이 없다) 뒤 0xa96ec 로 슬라이딩,
 * 그 뒤에야 소리 재생 중 · +0x31c 잠금을 본다. 0xa04d0: +0xb8 = 1 · vt44(6) — 0xa0164 가 속도 = vt64() + 40
 */
function applySlideKey(g: RunnerPlayFrame, tick: number): void {
  const decision = slideOnKey({
    playKind: g.input.kind,
    isFoulBattedBall: false,
    runners: g.runners.map((runner) => slidingRunnerOf(runner.state)),
    isSoundPlaying: false,
    hasPlayedSoundThisPlay: g.slidingSoundPlayed,
  })
  if (decision.playsSound) {
    g.slidingSoundPlayed = true
    g.sound.slidingThisTick = true
    g.sound.thisTick.push(SLIDING_SOUND_EFFECT)
  }
  for (const index of decision.slidRunnerIndexes) {
    const runner = g.runners[index]
    if (runner === undefined || runner.state.sliding) continue
    runner.state = { ...runner.state, sliding: true, speed: runner.state.speed + SLIDING_SPEED_BONUS }
  }
  if (decision.slidRunnerIndexes.length > 0) pushPlayLog(g.log, () => `${tick}틱 슬라이딩 — 주자 ${decision.slidRunnerIndexes.join('·')}`)
}

/** 0x5209e / 0x5222a → 0xa9b04 — 성공하면 플레이+0x128 = 1. 플레이 +0x111(홈런 사건 8)은 타구가 없는 이 판에서 서지 않는다 */
function applyRunnerKey(g: RunnerPlayFrame, tick: number, command: Extract<InPlayCommand, { kind: '진루' | '귀루' }>): void {
  const keyed = applyBaserunningKey(
    {
      playKind: g.input.kind,
      homeRunFlag: false,
      runners: runnerStates(g),
      previousTargets: g.runners.map((runner) => runner.previousTarget),
    },
    command.kind,
    command.runner,
  )
  g.runners.forEach((runner, index) => {
    runner.state = keyed.runners[index] ?? runner.state
    runner.previousTarget = keyed.previousTargets[index] ?? runner.previousTarget
  })
  if (!keyed.succeeded) return
  g.play = { ...g.play, wantsThrow: true }
  pushPlayLog(g.log, () => `${tick}틱 ${command.kind} 키 — 주자 ${keyed.retargeted.map((index) => g.runners[index]?.state.index).join('·')}`)
}
