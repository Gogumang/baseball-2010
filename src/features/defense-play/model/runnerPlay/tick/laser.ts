import { NONE, recordPlayerAbilityOf } from '@/entities/fielding/model/fieldingState'
import { fireLaser } from '@/features/defense-play/model/defenseScene'
import { canFireLaserNow, laserWindowTick } from '@/features/defense-play/model/laserTick'
import type { DefenseKeyPress } from '@/features/defense-play/model/runDefensePlay'
import { DEFAULT_ABILITY } from '@/features/defense-play/model/runnerPlay/constants'
import type { RunnerPlayFrame } from '@/features/defense-play/model/runnerPlay/frame/runnerPlayFrame'
import { pushPlayLog } from '@/features/defense-play/model/playLog'

/**
 * **0d. 레이저 송구** — 슬롯 2 머리 524c4(+0x1992 == −1)의 0x523bc 굴림 · 0x4e858 반짝임 · 0x400bc 발사 (`laserTick`, r201).
 * 판 종류를 안 가린다 — 타구 진행기 0b · 0c 절과 같은 차례다. 굴림은 공 가진 야수(+0x130)가 외야수일 때만(523e6) 돌아, 이 판에서는
 * 송구 · 튕긴 공을 외야수가 쫓을 때만 선다. 창(0xb2648)은 마지막 고르기 0xb3b38 의 포구 틱(+0x174) 기준 −10 ~ +8 틱
 */
export function rollRunnerPlayLaser(g: RunnerPlayFrame, tick: number, press: DefenseKeyPress | null): void {
  const holder = g.fielders[g.play.ballHolderSlot]
  g.laserFlags = laserWindowTick({
    flags: g.laserFlags,
    random: g.input.random,
    effectStep: g.scene.effectStep,
    ticksSinceCatch: tick - (g.chase?.catchTick ?? g.play.catchTick),
    hasChosenThrowTarget: g.manualThrowBase !== NONE,
    isBallHeld: g.play.held,
    holder,
    holderAbility: recordPlayerAbilityOf(g.abilities, g.play.ballHolderSlot, DEFAULT_ABILITY),
    holderSkillIds: g.input.fielderSkillIds?.[g.play.ballHolderSlot] ?? [],
    defenseIsCpu: g.input.defenseIsCpu === true,
    press,
  }).flags
  const ready = canFireLaserNow({
    effectStep: g.scene.effectStep,
    pausedAtHead: g.pausedAtHead,
    confirmed: g.laserFlags.confirmed,
    hasChosenThrowTarget: g.manualThrowBase !== NONE,
    isBallHeld: g.play.held,
    holder,
  })
  if (ready) fireRunnerPlayLaser(g, tick)
}

/** 0x400bc — 연출 단계 0 · 잔상 · **경기 멈춤 +0x1993** · 플레이 vt64(1). 앞 틱 끝에서 센 G2(52502)는 524e6 뒤라 원본은 부르지 않았다 */
function fireRunnerPlayLaser(g: RunnerPlayFrame, tick: number): void {
  g.scene = fireLaser(g.scene)
  g.gamePaused = true
  g.laserArmed = true
  g.laserTrailOn = true
  g.pausedThisTick = true
  g.endCounter = g.counterBeforeHead
  pushPlayLog(g.log, () => `${tick}틱 레이저 발사 (0x400bc) — 경기 멈춤 +0x1993`)
}
