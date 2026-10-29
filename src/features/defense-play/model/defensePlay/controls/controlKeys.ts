import { type InPlayCommand, inPlayCommandOf } from '@/entities/defense-controls/model/defenseKeys'
import { SLIDING_SOUND_EFFECT, SLIDING_SPEED_BONUS, slideOnKey } from '@/entities/defense-controls/model/sliding'
import { applyBaserunningKey } from '@/entities/fielding/model/baserunningKey'
import { slidingRunnerOf } from '@/features/defense-play/model/defensePlay/runners/mutableRunner'
import type { TickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import { framePressesOf } from '@/features/defense-play/model/defensePlay/types/defenseKeyPress'
import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'

/**
 * **0. 사람 조작** (상태 0x17 갈래 0x53420 — I-controls 0·2b·3b절). 이번 틱에 눌린 키를 받는다(예전에는 `input.controls?.keyAt(tick)`
 * 로 미리 물어봤다). 한 틀에 누름 · 되풀이가 함께 오면 0x498d4 가 누름 → 되풀이 차례로 0x53420 에 둘 다 보낸다.
 */
export function applyControlKeys(s: DefensePlayState, t: TickFrame): void {
  const keyControls = s.input.controls
  if (keyControls === undefined) return
  for (const keyPress of framePressesOf(t.key)) {
    // 누르고 있어서 되풀이된 키는 귀루 셋이 안 먹는다 — 원본 `[조작+0x1c] & 0xf0`(경기+0x6c 비트 4~7)
    const command = inPlayCommandOf(keyPress.key, keyControls.side, { isHoldRepeat: keyPress.isRepeat === true })
    if (command === null || s.play.finished) continue
    applyInPlayCommand(s, t, command)
  }
}

function applyInPlayCommand(s: DefensePlayState, t: TickFrame, command: InPlayCommand): void {
  switch (command.kind) {
    case '송구':
      // 메시지 0x588 → 플레이 vt0x60 → 플레이+0x160. 자동 규칙(0xb1c90)보다 늘 앞선다
      s.play = { ...s.play, manualThrowBase: command.target }
      s.log.push(`${t.tick}틱 사람이 ${command.target}루로 송구 지시`)
      return
    case '슬라이딩':
      applySlideKey(s, t)
      return
    default:
      applyRunnerKey(s, t, command)
  }
}

/** 메시지 0x585 → 0x518da */
function applySlideKey(s: DefensePlayState, t: TickFrame): void {
  const decision = slideOnKey({
    playKind: s.play.kind,
    // 인플레이 진행기는 페어 타구만 돌린다 — 파울이면 여기까지 오지 않는다
    isFoulBattedBall: false,
    runners: s.runners.map(slidingRunnerOf),
    isSoundPlaying: false,
    hasPlayedSoundThisPlay: s.slidingSoundPlayed,
  })
  if (decision.playsSound) {
    s.slidingSoundPlayed = true
    t.slidingSoundThisTick = true
    // 키 처리 0x498d4 는 그림 머리 0x3f060(52e16) 카메라보다 먼저다 — 이 틱 소리 차례의 맨 앞
    t.tickSounds.unshift({ kind: 'sound', soundId: SLIDING_SOUND_EFFECT })
  }
  for (const index of decision.slidRunnerIndexes) {
    const runner = s.runners[index]
    if (runner.state.sliding) continue
    // 슬라이딩의 이득은 딱 하나, 속도 +40 (0xa0164 · R3 3절)
    runner.state = { ...runner.state, sliding: true, speed: runner.state.speed + SLIDING_SPEED_BONUS }
  }
  if (decision.slidRunnerIndexes.length > 0) {
    s.log.push(`${t.tick}틱 슬라이딩 — 주자 ${decision.slidRunnerIndexes.join('·')}`)
  }
}

/**
 * 메시지 0x582(진루) · 0x584(귀루) → 0x5209e / 0x5222a → 0xa9b04 (`entities/fielding/model/baserunningKey`).
 * 0x5209e 는 플레이+0x111(홈런)이면 아무것도 안 하고, 아니면 경기+0x24 = 0 뒤 0xa9b04 — 주자를 움직이면 경기+0x24 = 1 ·
 * 플레이+0x128 = 1. 앞뒤가 서로 밀어내는 것이 **원본 그대로**라 그 순서를 지킨다. 판 종류는 0xae794 가 {1, 4, 5, 9} 만 받는다
 * (사건 6 · 7 · 10 이 판 종류를 바꾼 뒤로는 안 먹는다)
 */
function applyRunnerKey(s: DefensePlayState, t: TickFrame, command: Extract<InPlayCommand, { kind: '진루' | '귀루' }>): void {
  const keyed = applyBaserunningKey(
    {
      playKind: s.play.kind,
      homeRunFlag: s.homeRunFlag,
      runners: s.runners.map((runner) => runner.state),
      previousTargets: s.runners.map((runner) => runner.previousTarget),
    },
    command.kind,
    command.runner,
  )
  if (keyed.handled) s.autoBaserunning = false
  s.runners.forEach((runner, index) => {
    runner.state = keyed.runners[index] ?? runner.state
    runner.previousTarget = keyed.previousTargets[index] ?? runner.previousTarget
  })
  if (!keyed.succeeded) return
  s.autoBaserunning = true
  s.play = { ...s.play, wantsThrow: true }
  s.log.push(`${t.tick}틱 ${command.kind} — 주자 ${keyed.retargeted.map((index) => s.runners[index]?.state.index).join('·')}`)
}
