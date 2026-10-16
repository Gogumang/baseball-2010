import type { PitcherAbility, PitcherRepertoireInfo } from '@/entities/pitching/model/pitch'
import { aceLevelOf, aceLevelSlotOf } from '@/entities/mission/model/aceLevel'
import { MAGIC_PITCH_TYPE_NUMBER, ballMagicNumberAfterPitch, magicPitchCountOf } from '@/entities/pitcher-career/model/magicPitch'

/**
 * 상대(CPU) 투수의 한 경기 마구 상태 — 원본에서 경기에 걸쳐 남는 두 칸이다.
 *   `remaining`        = 팀+0x28 (0xaea10 이 읽고 0xae9c4 가 쓴다). 타석 교대 0xaebe4 가
 *                        **경기 전체에 한 번** 채우고, 이닝이 바뀌어도 다시 차지 않는다 (H2 1-2).
 *   `ballMagicNumber`  = 공 객체 +0x10 (0x3de10 이 쓴다). 되돌리는 코드가 **없다** (H2 3-4, 확정).
 *
 * 구질 고르기(0x344dc) → 소모(0x345fc) → 싣기(0x3de10) 순서를 그대로 흉내 내려면 이 두 칸이
 * 투구마다 이어져야 해서, `selectPitch` 는 이 객체를 받아 **제자리에서 고친다**(원본이 팀·공
 * 객체를 고치는 것과 같다).
 */
export interface MagicPitchGameState {
  /** 남은 마구 횟수 */
  remaining: number
  /** 공 객체 +0x10 — 이번 공에 실린 마구 번호 (0 = 마구 보정 없음) */
  ballMagicNumber: number
}

/** 마구 번호(투수 레코드 +0x18)가 마투수 것인가 — 마선수 레코드는 모두 5~9 다 (H2 4-1) */
export function isAceMagicNumber(magicNumber: number): boolean {
  return magicNumber >= 5 && magicNumber <= 9
}

/**
 * 마투수 순번 0~4 (0xb63a1 = 마선수면 `rec[0xa] & 0x1f`) — 마선수 레코드 +0x18 마구 번호 5~9 에서 5 를 뺀 값과
 * 같다 (H2 4-1 "순번 = 번호 − 5"). 마투수가 아니면 −1.
 * 레벨 칸 `mgr[0x13a + 순번]` 을 고르는 데 쓴다 (마투수는 열 칸 중 앞 다섯 칸 0~4).
 */
export function aceOrderOfMagicNumber(magicNumber: number): number {
  return isAceMagicNumber(magicNumber) ? magicNumber - 5 : -1
}

export interface MagicPitchGameOptions {
  /**
   * 마투수 레벨 0~4 (`s8 전역기록[0x13a + 순번]` — 타석 교대 0xaebe4 가 이 칸으로 0xd8509 를 색인한다,
   * aeec2~aeeea: `0xb63a1(P) + mgr + 0x138` 의 +2 바이트를 ldrsb → `ldrsb [0xd8509 + 레벨]`, 표 = [3,4,5,6,7]).
   * 저장은 `entities/mission/model/useAceLevels`(레벨업 0x5fb24). 안 넘기면 0 = Lv1 이다.
   * 부르는 곳 `widgets/batting-stage/model/useStageAnimation` 이 `BattingStage` 의 `aceLevels` 로 채운다.
   */
  readonly aceLevel?: number
  /** 투수 스킬 23 혼신 (마구 횟수 +2). CPU 투수 스킬을 아직 읽지 않아 기본 false (근사) */
  readonly hasSpiritSkill?: boolean
}

/**
 * 경기 시작 때 한 번 만든다 (0xaebe4 가 남은 횟수를 채우는 자리).
 * 공 객체는 갓 만들어진 상태라 +0x10 = 0 이다 (0x1239 new 의 0 채움은 원본 미확인 — H2 3-4).
 */
export function createMagicPitchGameState(
  repertoire: PitcherRepertoireInfo,
  options: MagicPitchGameOptions = {},
): MagicPitchGameState {
  return {
    remaining: magicPitchCountOf({
      number: repertoire.magicId,
      isAce: isAceMagicNumber(repertoire.magicId),
      aceLevel: options.aceLevel ?? 0,
      hasSpiritSkill: options.hasSpiritSkill ?? false,
    }),
    ballMagicNumber: 0,
  }
}

/**
 * 한 번 던진 뒤 두 칸을 원본 순서대로 고친다.
 *   ① 소모 0x345fc — `구질 == 22 && 공+0x10 != 0 && 남은 > 0` 이면 남은−1.
 *      ⚠️ **원본 버그 그대로**: 조건이 "공에 이미 마구가 실려 있을 때" 라서 **그 경기 첫 마구는
 *      공짜다**. 그래서 한 경기에 나가는 마구는 표 값보다 하나 많다.
 *   ② 싣기 0x3de10 — `구질 == 22 && 남은 > 0` 이면 공+0x10 = 투수+0x18.
 *      상태 예약(0xbcb48) 때문에 ① 다음에 돌고, 0 으로 되돌리는 줄이 없다.
 *
 * **홈런더비(모드 7)** 는 ① 이 없다 — 0x345fc 가 0x3460e 에서 0x348d6 으로 바로 끝나 소모 0x34894 를 안 지난다
 * (`isHomeRunDerby`). ② 0x3de10 은 모드를 안 가린다. 채우기 0xaebe4 도 모드를 안 가리고(0x48d50 이 마투수 레코드를
 * 복사한 뒤 0x48ddc 에서 부른다), 일반 투수(+0x18 = 0)일 때는 0xae9c4 가 안 써서 팀+0x28 이 −1 로 남았다가
 * 마투수가 오른 첫 타석에 0xd8509[레벨] 로 찬다 — 그 뒤 줄지 않으니 **마투수의 마구는 늘 공+0x10 에 번호가 실린다**.
 */
export function advanceMagicPitchGameState(
  state: MagicPitchGameState,
  typeNumber: number,
  pitcherMagicNumber: number,
  isHomeRunDerby = false,
): void {
  const isMagic = typeNumber === MAGIC_PITCH_TYPE_NUMBER
  if (!isHomeRunDerby && isMagic && state.ballMagicNumber !== 0 && state.remaining > 0) state.remaining -= 1
  state.ballMagicNumber = ballMagicNumberAfterPitch(
    state.ballMagicNumber,
    typeNumber,
    pitcherMagicNumber,
    state.remaining,
  )
}

/**
 * **팀+0x28 의 "안 채움"** — 팀 new 0xb891c 가 −1 로 두고(b89b4~b89ba), 투수 교체 가지가 다시 −1 로 비운다(0xaebe4 aec7a).
 * 타석 교대 0xaebe4 는 aeea8 `0xaea10(팀) ≥ 0` 이면 채우지 않고 건너뛰므로(aeeae `bge`) **같은 투수가 서 있는 동안 남은 횟수는
 * 경기 내내 이어진다** — 반 이닝이 바뀌거나 화면이 다시 서도 다시 차지 않는다.
 */
export const UNFILLED_MAGIC_REMAINING = -1

/** 0xaebe4 aef08 `0xb62b4(투수, 0x17)` — 투수 스킬 비트 23 혼신이면 채운 값 + 2 */
const SPIRIT_SKILL_BIT = 23

/**
 * **진행기가 경기 동안 드는 CPU 마구 두 칸** — 수비 팀 +0x28(`remaining`, 안 채웠으면 −1)과 경기에 하나뿐인 공 객체 +0x10.
 * 타석 화면(`BattingStage.cpuMagic`)은 공마다 이 값의 사본으로 고르고, 던진 뒤 진행기가 같은 차례로 고친다
 * (`heldCpuMagicAfterPitch`).
 */
export interface HeldCpuMagic {
  readonly remaining: number
  readonly ballMagicNumber: number
}

/** 새 경기 — 팀 new 의 −1 · 공 객체 new 의 0 (0x1239 new 의 0 채움은 원본 미확인 — H2 3-4) */
export const FRESH_HELD_CPU_MAGIC: HeldCpuMagic = { remaining: UNFILLED_MAGIC_REMAINING, ballMagicNumber: 0 }

/**
 * 0xaebe4 가 마운드 투수로 채우는 횟수 (aeea8~aef24): 마투수(0xb633d)면 `0xd8509[mgr[0x13a + 순번(0xb63a1)]]`,
 * 아니면 `0xd84ff[+0x18]` 에 혼신(스킬 23) +2. 마구가 없는 투수(+0x18 = 0)는 0xae9c4 가 안 쓴다(0 과 같다).
 */
export function magicCountOfPitcherAbility(
  pitcher: PitcherAbility,
  aceLevels: Readonly<Record<number, number>> | undefined,
): number {
  const magicId = pitcher.repertoire?.magicId ?? 0
  const order = aceOrderOfMagicNumber(magicId)
  return magicPitchCountOf({
    number: magicId,
    isAce: order >= 0,
    aceLevel: order < 0 ? 0 : aceLevelOf(aceLevels, aceLevelSlotOf('투수', order + 1)),
    hasSpiritSkill: (((pitcher.skillBits ?? 0) >>> SPIRIT_SKILL_BIT) & 1) === 1,
  })
}

/** 이번 공을 고를 때 볼 두 칸 — 안 채웠으면(−1) 지금 마운드 투수로 채운다(0xaebe4 aeea8 의 갈래) */
export function cpuMagicStateOf(
  held: HeldCpuMagic,
  pitcher: PitcherAbility,
  aceLevels: Readonly<Record<number, number>> | undefined,
): MagicPitchGameState {
  return {
    remaining: held.remaining < 0 ? magicCountOfPitcherAbility(pitcher, aceLevels) : held.remaining,
    ballMagicNumber: held.ballMagicNumber,
  }
}

/** 던진 뒤 — 소모 0x345fc · 싣기 0x3de10 을 원본 차례로 밟은 두 칸 */
export function heldCpuMagicAfterPitch(
  held: HeldCpuMagic,
  pitcher: PitcherAbility,
  aceLevels: Readonly<Record<number, number>> | undefined,
  typeNumber: number,
): HeldCpuMagic {
  const state = cpuMagicStateOf(held, pitcher, aceLevels)
  advanceMagicPitchGameState(state, typeNumber, pitcher.repertoire?.magicId ?? 0)
  return { remaining: state.remaining, ballMagicNumber: state.ballMagicNumber }
}

/** 수비 팀 투수 교체 — 0xaebe4 aec7a `0xae9c4(팀, −1)` 로 남은 횟수를 비운다. 공 +0x10 은 경기에 하나라 그대로다 */
export function heldCpuMagicAfterPitcherChange(held: HeldCpuMagic): HeldCpuMagic {
  return held.remaining === UNFILLED_MAGIC_REMAINING ? held : { ...held, remaining: UNFILLED_MAGIC_REMAINING }
}
