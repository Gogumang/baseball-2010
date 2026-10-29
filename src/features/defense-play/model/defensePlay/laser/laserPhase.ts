import { NONE, recordPlayerAbilityOf } from '@/entities/fielding/model/fieldingState'
import { DEFAULT_ABILITY } from '@/features/defense-play/model/defensePlay/constants'
import type { TickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'
import { fireLaser } from '@/features/defense-play/model/defenseScene'
import { canFireLaserNow, laserWindowTick } from '@/features/defense-play/model/laserTick'

/**
 * **0b. 레이저 송구 반짝임 창** (0x523bc · 0xb2648 · 0x4e858 — I-controls 2d).
 *
 * ⚠️ 굴림(0x66a8c)은 **사람·CPU 를 가리지 않고** 돈다. 0x523bc 를 그대로 읽으면
 * ```
 * 0x523d6  [this+0x19af] ≠ 0 → 반환        ; 한 플레이 한 번
 * 0x523e0  [this+0x1094] > 0  → 반환
 * 0x523e6  공 가진 야수가 있으면 외야수(0xb8da8 — 칸 6~8)가 아닐 때 반환, 없으면 건너뜀
 * 0x52408  [경기+0x19] ≠ 0 → 반환
 * 0x5242a  창 0xb2648(플레이) 거짓 → 반환
 * 0x5243e  주자 수 0xa9598 == 0 → 반환
 * 0x52456  0x66a8c(…) 굴림 → 떨어져도 0x5248c 에서 `+0x19af = 1`
 * 0x52468  통과하면 `경기[0x31 + 경기[0xa]]` 가 0(사람)이면 `+0x19ad`(반짝임), 아니면(CPU) `+0x19ae`(곧바로 레이저)
 * ```
 * 즉 **굴림은 갈림 앞**에 있다. 예전 웹판은 `controls.side === '수비'` 로 굴림째 막아
 * CPU 수비 타구에서 난수를 한 번 덜 뽑아 원본과 차례가 어긋났다 — 그 자리를 바로잡는다.
 *
 * 주자 수(0xa9598) 관문은 따로 옮기지 않았다 — 이 진행기의 `runners` 에는 타자주자가 늘 들어 있어 타구 플레이에서는 언제나 참이다.
 * 슬롯 2 머리 524c4: +0x1992 == −1(레이저 연출이 쉴 때)일 때만 0x523bc · 0x4e858 · 0x400bc 를 돈다.
 * 0x523e6 의 외야 관문(공 가진 야수 0xb8da8 — 칸 6~8)은 `laserWindowTick` 이 본다(r201 — 예전 웹은 "준비됐는지" 로 읽어 빠뜨렸다)
 */
export function rollLaserWindow(s: DefensePlayState, t: TickFrame): void {
  if (s.uncatchable) return
  const windowTick = laserWindowTick({
    flags: { shining: s.laserShining, confirmed: s.laserConfirmed, rolled: s.laserRolled },
    random: s.input.random,
    effectStep: s.scene.effectStep,
    ticksSinceCatch: t.tick - s.catchTick,
    hasChosenThrowTarget: s.play.manualThrowBase !== NONE,
    isBallHeld: s.play.held,
    holder: s.fielders[s.play.ballHolderSlot],
    // 66a94: 공 가진 야수(0xb0c90)+0xec 의 수비 — 투수 칸 0 은 공수 교대 판이 넣은 지명타자(`recordPlayerAbilityOf`)
    holderAbility: recordPlayerAbilityOf(s.abilities, s.play.ballHolderSlot, DEFAULT_ABILITY),
    holderSkillIds: s.input.fielderSkillIds?.[s.play.ballHolderSlot] ?? [],
    defenseIsCpu: s.defenseIsCpu,
    press: t.key,
  })
  s.laserShining = windowTick.flags.shining
  s.laserConfirmed = windowTick.flags.confirmed
  s.laserRolled = windowTick.flags.rolled
}

/**
 * **0c. 레이저 발사 0x400bc** (슬롯 2 머리 524e2) → 경기 멈춤 +0x1993 (직접 뜸)
 * ```
 * 400ce  +0x19ae(레이저 확정) · 플레이+0x160 ≠ −1(사람이 고른 송구 목표) · 플레이+0x12c(쥠) · 공 가진 야수(0xb0c90).vtC4(준비)
 * 40100  → +0x1992 = 0(연출 단계) · +0x1991 = +0x1990 = 1 · **+0x1993 = 1** · 플레이 vt64(1)(+0x1f4 = 1)
 * 524e6  +0x1993 이면 슬롯 2 를 통째로 건너뛴다(G2 · 플레이 틱 · 자동 진루 · CPU 송구) — 이 그림부터
 * ```
 * 다음 그림은 0x3f060(3f0a4 — G1 · 목록 틱) · 0x3f378(3f392 — G4) · 슬롯 2 가 모두 건너뛰고, 그리기 0x46c88 만 돈다(0x4403c 단계 ·
 * G3). 연출 0x4403c(그리기 46e08)가 단계 0 에서 +0x1997 · +0x19ad · +0x19ae 를 내리고 단계 1 에서 줌 0xbb39d 와 함께 +0x1993 = 0 —
 * 곧 **발사한 그림의 슬롯 2 와 다음 그림의 갱신 전부**가 빠진다. 송구는 그 뒤 그림의 플레이 틱(사람 목표 b4660)이 +0x1f4 로 던진다.
 * +0x1993 을 세우는 곳은 0x400bc 하나다(0x441c4 · 0x44398 은 내리기만 한다) — 멈춤은 레이저 송구 판에만 선다.
 */
export function fireLaserIfReady(s: DefensePlayState, t: TickFrame): void {
  const ready = canFireLaserNow({
    effectStep: s.scene.effectStep,
    pausedAtHead: t.pausedAtHead,
    confirmed: s.laserConfirmed,
    hasChosenThrowTarget: s.play.manualThrowBase !== NONE,
    isBallHeld: s.play.held,
    holder: s.fielders[s.play.ballHolderSlot],
  })
  if (!ready) return
  s.scene = fireLaser(s.scene)
  s.gamePaused = true
  s.laserArmed = true
  s.laserTrailOn = true
  t.pausedThisTick = true
  // 앞 틱 끝에서 센 G2(52502)는 524e6 뒤라 원본은 부르지 않았다
  s.endCounter = s.counterBeforeHead
  s.log.push(`${t.tick}틱 레이저 발사 (0x400bc) — 경기 멈춤 +0x1993`)
}
