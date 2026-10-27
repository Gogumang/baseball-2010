import type { RandomPort } from '@/shared/api/random/randomPort'
import {
  isLaserWindowOpen,
  judgeLaserInput,
  LASER_WINDOW_FIRST_TICK,
  rollLaserThrow,
} from '@/entities/defense-controls/model/laserThrow'
import { isReadyToThrow } from '@/entities/fielding/model/fielderPose'
import type { FielderState } from '@/entities/fielding/model/fieldingState'
import type { DefenseKeyPress } from '@/features/defense-play/model/runDefensePlay'

/**
 * **레이저 송구 — 슬롯 2 머리의 세 함수** (0x523bc 굴림 · 0x4e858 반짝임 · 0x400bc 발사). 타구 진행기 `runDefensePlay` 0b · 0c 절과
 * 주자 판(`runnerPlayEngine` — 도루 · 폭투 · 밀어내기) · 견제 판(`pickoffPlay`)이 함께 쓴다. 원본도 판 종류를 안 가리고 슬롯 2 머리
 * 524c4 에서 `+0x1992 == −1`(연출 단계가 쉴 때)이면 셋을 차례로 부른다.
 *
 * ## 0x523bc — 굴림 (직접 뜸, r201)
 * ```
 * 523cc  [sp] = 0xb0c90(P)            ; 공 가진 야수(+0x130) — 굴림 0x66a8c 의 둘째 인자
 * 523d6  +0x19af ≠ 0 → 끝              ; 한 판 한 번
 * 523e0  +0x1094 > 0 → 끝              ; 판 진행 관문이 닫힌 뒤 세는 칸 — 진행기 안에서는 늘 0
 * 523e6  0xb0c90(P) ≠ 0 이면 0xb8da8(야수+0x80) — [야수+0x88](수비 칸) ∈ 6~8 이 아니면 끝   ; ★ 외야수만
 * 52408  state[0x19] ≠ 0 → 끝          ; 0.1% 사건 — 진행기 판에는 서지 않는다
 * 5240e  +0x19ad 면 0xb2648 한 번 더(거짓이면 +0x19ad = 0)
 * 5242a  0xb2648(P) 거짓 → 끝          ; 창
 * 5243e  주자 목록 크기 0xa9598(= +0xc) == 0 → 끝   ; 아웃 · 득점 주자도 센다 — 진행기 판에는 늘 1 이상
 * 52456  0x66a8c(장면, [sp]) 굴림 → 통과면 사람 수비 +0x19ad(반짝임) / CPU +0x19ae(확정) · 52488 늘 +0x19af = 1
 * ```
 * 0xb8da8 은 `ldr r3,[r0,#8] ; subs #6 ; cmp #2 ; bhi` — 수비 칸 6~8(외야) 판정이다(P2 1a 절의 같은 함수). 예전 웹 주석은 이것을
 * "공 가진 야수가 준비됐는지" 로 읽어 관문을 옮기지 않았다 — 그래서 내야수가 쫓는 타구에서도 굴림이 돌았다. 굴림의 능력치도 같은 공
 * 가진 야수의 것이다. 밀어내기 판(종류 2 · 3)도 공 가진 야수가 있다 — 판 시작 vt18(표 0xd877c[1] · [2] = 0xb288c, r309 직접 뜸)이
 * b28a2~b28a8 에서 P+0x130 = 1(포수)을 적으므로 523e6 은 포수(내야)에서 끝나 굴리지 않는다(`walkPlay.ts` 와 같은 읽기).
 *
 * 창 0xb2648 의 카운터(+0x1e4 — 판 시작 vt1c b0f44 가 −1)는 0x4e858 이 매 틱 한 번씩 올리므로 웹은 포구 틱 기준 −10 ~ +8 틱으로 본다
 * (`isLaserWindowOpen` — 타구 진행기와 같은 근사. 0x523bc 가 외야 관문을 지나 한 번 더 부르는 틀에는 굴림이 곧바로 +0x19af 를 세워
 * 다음 틀부터 523d6 에서 끝난다 — 그래서 "틱당 2~3번 → 7~9틱"(B-12)은 원본 버그가 아니다. r272 정정, `laserThrow.ts` 창 주석).
 */
export interface LaserFlags {
  /** 경기+0x19ad — 반짝임 (사람 수비) */
  readonly shining: boolean
  /** 경기+0x19ae — 레이저 확정 */
  readonly confirmed: boolean
  /** 경기+0x19af — 이 판에 굴림을 마쳤다 */
  readonly rolled: boolean
}

export const NO_LASER_FLAGS: LaserFlags = { shining: false, confirmed: false, rolled: false }

/** 외야수인가 — 0xb8da8(야수+0x80): [+0x88] − 6 ≤ 2 */
export function isOutfieldSlot(slot: number): boolean {
  return slot >= 6 && slot <= 8
}

export interface LaserWindowTickInput {
  readonly flags: LaserFlags
  readonly random: RandomPort | undefined
  /** 장면 +0x1992 — −1 이 아니면(연출 중) 슬롯 2 머리가 셋을 안 부른다 */
  readonly effectStep: number
  /** 포구 틱(+0x174)을 0 으로 센 지금 틱 */
  readonly ticksSinceCatch: number
  /** 플레이+0x160 ≠ −1 */
  readonly hasChosenThrowTarget: boolean
  /** 플레이+0x12c */
  readonly isBallHeld: boolean
  /** 공 가진 야수 0xb0c90(P+0x130). 없으면 undefined */
  readonly holder: FielderState | undefined
  /** 굴림 0x66a8c 의 수비 능력치 — 공 가진 야수+0xec 의 수비. 선수가 없으면(투수 칸 0 의 지명타자 없는 판 등) null → 굴림 없이 실패 */
  readonly holderAbility: number | null
  readonly holderSkillIds: readonly number[]
  /** `경기[0x31 + 경기[0xa]]` — 수비가 CPU 면 반짝임 없이 확정 */
  readonly defenseIsCpu: boolean
  /** 이번 틀의 키 (0x4e858 은 새로 누른 키만 받는다) */
  readonly press: DefenseKeyPress | null | undefined
}

export interface LaserWindowTickResult {
  readonly flags: LaserFlags
  /** 이번 틱에 0x66a8c 를 굴렸다 */
  readonly rolledThisTick: boolean
  readonly passed: boolean
}

/** 0x523bc(굴림) → 0x4e858(반짝임 · 확정) 한 틱 */
export function laserWindowTick(input: LaserWindowTickInput): LaserWindowTickResult {
  let { shining, confirmed, rolled } = input.flags
  let rolledThisTick = false
  let passed = false
  if (input.random === undefined || input.effectStep !== -1) {
    return { flags: input.flags, rolledThisTick, passed }
  }
  const windowOpen = isLaserWindowOpen({
    ticksSinceCatch: input.ticksSinceCatch,
    hasChosenThrowTarget: input.hasChosenThrowTarget,
    isBallHeld: input.isBallHeld,
    // b2666~b2670 — 공 가진 야수(0xb0c90 = +0x130).vtC4 (`fielderPose.isReadyToThrow`)
    isThrowerReady: input.holder !== undefined && isReadyToThrow(input.holder),
  })
  // 523e6 — 공 가진 야수가 있으면 외야수(0xb8da8)일 때만 굴린다. 밀어내기 판(종류 2 · 3)은 시작 0xb288c(b28a2~b28a8)가
  // P+0x130 = 1(포수)을 적어 여기서 끝난다 — `walkPlay` 가 `ballHolderSlot: CATCHER_SLOT` 으로 넘겨 같다(r309 직접 뜸).
  // holder 가 없는(undefined) 길은 진행기가 늘 공 가진 야수를 세워 오지 않는다
  const holderGate = input.holder !== undefined && isOutfieldSlot(input.holder.slot)
  if (
    !rolled &&
    holderGate &&
    windowOpen &&
    input.ticksSinceCatch >= LASER_WINDOW_FIRST_TICK
  ) {
    rolled = true
    rolledThisTick = true
    passed = rollLaserThrow({ defenseAbility: input.holderAbility, skillIds: input.holderSkillIds }, input.random)
    if (passed) {
      if (input.defenseIsCpu) confirmed = true
      else shining = true
    }
  }
  // 0x4e858 — 조건 없이 매 틱: 창이 닫히면 +0x19ad 를 내리고, 반짝이는 중에 새로 누른 키가 오면 +0x19ae
  const judged = judgeLaserInput({
    isShining: shining,
    isWindowOpen: windowOpen,
    key: input.press?.key ?? null,
    isRepeat: input.press?.isRepeat === true,
  })
  shining = judged.isShining
  if (judged.isLaserConfirmed) confirmed = true
  return { flags: { shining, confirmed, rolled }, rolledThisTick, passed }
}

/**
 * **0x400bc — 레이저 발사** (슬롯 2 머리 524e2, 직접 뜸):
 * ```
 * 400ce  +0x19ae(확정) · 플레이+0x160 ≠ −1 · 플레이+0x12c(쥠) · 공 가진 야수.vtC4(준비)
 * 40100  → +0x1992 = 0 · +0x1991 = +0x1990 = 1 · +0x1993 = 1(경기 멈춤) · 플레이 vt64(1)(+0x1f4 = 1)
 * ```
 * 앞 그림에서 이미 멈춰 있으면(머리 +0x1993) 슬롯 2 가 없어 부르지 않는다.
 */
export function canFireLaserNow(input: {
  readonly effectStep: number
  readonly pausedAtHead: boolean
  readonly confirmed: boolean
  readonly hasChosenThrowTarget: boolean
  readonly isBallHeld: boolean
  readonly holder: FielderState | undefined
}): boolean {
  return (
    input.effectStep === -1 &&
    !input.pausedAtHead &&
    input.confirmed &&
    input.hasChosenThrowTarget &&
    input.isBallHeld &&
    input.holder !== undefined &&
    input.holder.holdingBall &&
    isReadyToThrow(input.holder)
  )
}
