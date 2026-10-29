import { NONE, recordPlayerAbilityOf } from '@/entities/fielding/model/fieldingState'
import { fireLaser } from '@/features/defense-play/model/defenseScene'
import { canFireLaserNow, laserWindowTick } from '@/features/defense-play/model/laserTick'
import { DEFAULT_ABILITY } from '@/features/defense-play/model/pickoff/constants'
import type { PickoffFrame } from '@/features/defense-play/model/pickoff/frame/pickoffFrame'
import type { DefenseKeyPress } from '@/features/defense-play/model/runDefensePlay'

/** 4d 절 */
export function rollPickoffLaser(g: PickoffFrame, tick: number, press: DefenseKeyPress | null): void {
  // ── 4d. 레이저 송구 — 슬롯 2 머리 524c4(+0x1992 == −1)의 0x523bc 굴림 · 0x4e858 반짝임 · 0x400bc 발사 (`laserTick`, r201) ──
  // 굴림은 공 가진 야수(+0x130)가 외야수일 때만(523e6) — 판 시작은 투수가 쥐고(b28be) 견제를 받는 커버도 내야수라, 악송구 · 튕긴 공을
  // 외야수가 쫓을 때만 선다. 창(0xb2648)은 송구 b307c 의 고르기 0xb3b38 이 적은 포구 틱(+0x174) 기준 −10 ~ +8 틱이다(앞 판이 남긴
  // +0x174 를 견제 시작이 안 고쳐도 그동안은 투수가 공 가진 야수라 굴림이 없다)
  {
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
    if (
      canFireLaserNow({
        effectStep: g.scene.effectStep,
        pausedAtHead: g.pausedAtHead,
        confirmed: g.laserFlags.confirmed,
        hasChosenThrowTarget: g.manualThrowBase !== NONE,
        isBallHeld: g.play.held,
        holder,
      })
    ) {
      g.scene = fireLaser(g.scene)
      g.gamePaused = true
      g.laserArmed = true
      g.laserTrailOn = true
      g.pausedThisTick = true
      // 앞 틱 끝에서 센 G2(52502)는 524e6 뒤라 원본은 부르지 않았다
      g.endCounter = g.counterBeforeHead
      g.log.push(`${tick}틱 레이저 발사 (0x400bc) — 경기 멈춤 +0x1993`)
    }
  }
}
