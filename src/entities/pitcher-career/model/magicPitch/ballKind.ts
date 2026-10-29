import { isBugFixed } from '@/shared/config/bugfixes'
import { MAGIC_PITCH_TYPE_NUMBER } from '@/entities/pitcher-career/model/magicPitch/names'

/**
 * ball.pzx 공 그림 종류 (경기+0x1080) — 색인 = 투수 레코드 +0x18(마구 번호).
 * ball.pzx 는 종류 3 × 크기 11칸이다: 000~010 보통 · 011~022 불꽃 · 023~033 날개.
 *
 * **확정 (디스어셈 전수, 쓰는 곳 여섯)**: 경기+0x1080 은 `0x84 << 5` 로 만들어 리터럴 검색에 안 잡힌다 —
 * 그 꼴로 만드는 곳 9군데(0x36f3a·0x3b232·0x3b362·0x3b62e·0x3d78e·0x3d97a·0x467fe·0x4725c·0x4736e)를
 * 보면 쓰기는 다섯이고, **0x3b362 가 만든 주소를 스택 sp+0x24 에 넣어 두었다가 0x3b55e 에서 그리로 1 을 쓰는
 * 여섯째가 있다** (주소를 곧바로 쓰지 않아 이전 조사가 놓쳤다. 0x36f3a 도 sp+0x3c 에 넣지만 읽기만 한다):
 *   0 으로 — 0x3d78e(상태 0x13 진입 0x3d720) · 0x3d988(새 투구 준비 0x3d954) · 0x467fe
 *   2 로   — 0x4725c (`0x46fa8` 마투수 갈래, `cmp r1,#8` → 마구 8 발렌타인, 다크 일루전)
 *   1 로   — 0x4736e (`0x46fa8`, 마구 9 드래고나, 브레스 웨폰)
 *   1 로   — **0x3b55e** (타석 공 그리기 0x3b2f4 의 구질 갈래 0x3b546, 아래 `magicBallKindAtPath`)
 * 이 표는 **던질 때 정해지는 값**(0x46fa8 쪽)만 담는다. 육성 마구 1(과 폼 묶음 0 인 마구 4)은 공이
 * 날아가는 도중 경로 번호 8 부터 불꽃(1)으로 바뀐다 — 그건 `magicBallKindAtPath` 가 덮는다.
 * 되돌리기: 새 투구 준비 0x3d954 와 상태 0x13 진입 0x3d720 이 0 으로 지운다 — 공+0x10 과 달리
 * 여기엔 되돌리는 코드가 있어서 다음 공에 남지 않는다.
 */
export const MAGIC_BALL_KIND_BY_NUMBER: readonly number[] = [0, 0, 0, 0, 0, 0, 0, 0, 2, 1]

/** 마구 번호(투수 +0x18) → 공 그림 종류. 마구가 아니면(0) 보통 공이다 */
export function magicBallKindOf(number: number): number {
  return MAGIC_BALL_KIND_BY_NUMBER[number] ?? 0
}

/** `0x3b554 cmp r3,#7 / ble` — 경로 번호(경기+0x1098)가 7 을 넘는 틱부터 */
export const FIRE_BALL_FIRST_PATH_INDEX = 8
const FIRE_BALL_KIND = 1
const FIRE_EFFECT_MAGIC_NUMBER = 1
const SHINNING_EFFECT_MAGIC_NUMBER = 4

/**
 * 공이 날아가는 도중의 공 그림 종류 (경기+0x1080) — 타석 공 그리기 `0x3b2f4` 안 (확정, 디스어셈):
 * ```
 *   3b496: 게임 상태(+0x1c) != 0x11 → 건너뜀
 *   3b4da: r2 = 투수 레코드 +0x18 (마구 번호) · 3b4e2: 게임+0xfc8 != 0x16(마구) → 건너뜀
 *   3b4e8: 갈래표 0xcff20[번호−1] — 1 → 3b546 · 4 → 3b528(폼 0xb6e25 >> 1 이 0 이면 3b546) · 그 밖은 아님
 *   3b546: [경기+0x1040](effect_fire / effect_shinning) == 0 → 건너뜀
 *   3b552: [경기+0x1098](공 경로 번호) <= 7 → 건너뜀
 *   3b55a: ldr r0,[sp,#0x24] / movs r3,#1 / str r3,[r0]   ; sp+0x24 = 경기+0x1080 (0x3b362·0x3b378 에서 넣음)
 * ```
 * 실제 공 그리기(0xbe8d5, 그림 번호 = 종류 × 11 + 크기)는 이 갈래 **뒤**인 0x3b62e·0x3b6ae 에서 0x1080 을
 * 다시 읽으므로, 경로 번호 8 인 그 틱부터 곧바로 불꽃 공이 된다. 이펙트 애니가 끝나도(0x3b576) 쓰기는 그 앞이라
 * 공은 계속 불꽃이다. 0 으로 되돌리는 것은 다음 투구 준비(0x3d954)·상태 0x13 진입(0x3d720)뿐이다.
 * 마구 4 의 폼 묶음 0 갈래도 같은 3b546 으로 가므로 **effect_shinning 마구도 공은 불꽃(1)** 이 된다 — 원본 그대로.
 * 경기+0x1040 이 실리는 조건(적재 0x47cc8 의 0x4816c~0x481e4)은 마구 1, 그리고 폼 묶음 0 인 마구 4 라
 * 위 갈래 조건과 같다 (`widgets/batting-stage/lib/magicBallEffect.ts` 의 `magicBallEffectFolderOf`).
 *
 * `selectedBallKind` 는 던질 때 정해진 값(`magicBallKindOf`, 마투수 0x46fa8)이다. 이 갈래에 안 걸리면 그대로 둔다.
 * 경로 번호는 웹 `scene.frame` 과 같은 칸이다(`magicBallEffectFrameAt` 과 같은 기준).
 */
export function magicBallKindAtPath(input: {
  /** 이번 공이 마구(구질 22)인가 — 게임+0xfc8 == 0x16 */
  readonly isMagicPitch: boolean
  /** 투수 레코드 +0x18 */
  readonly magicNumber: number
  /** 투수 폼 (0xb6e25) — 마구 4 는 `폼 >> 1 == 0` 일 때만 */
  readonly pitcherForm: number
  /** 공 경로 번호 (경기+0x1098) */
  readonly pathIndex: number
  readonly selectedBallKind: number
}): number {
  if (!input.isMagicPitch) return input.selectedBallKind
  const takesFireBranch =
    input.magicNumber === FIRE_EFFECT_MAGIC_NUMBER || (input.magicNumber === SHINNING_EFFECT_MAGIC_NUMBER && input.pitcherForm >> 1 === 0)
  if (!takesFireBranch) return input.selectedBallKind
  return input.pathIndex >= FIRE_BALL_FIRST_PATH_INDEX ? FIRE_BALL_KIND : input.selectedBallKind
}

/**
 * ⚠️ **원본 버그(B-01) — 이 함수는 원본 길이다**: 공 객체 +0x10(이번 공의 마구 번호)을
 * 0 으로 되돌리는 코드가 원본에 **없다**(H2 3-4). 고친 길은 아래 `ballMagicNumberOfPitch`. 그래서 한 번 마구를 던지고 나면
 * 직구·변화구에도 마구 보정이 계속 붙고, 투수가 바뀌어도 값이 남는다.
 * 같은 이유로 **CPU 가 그 경기 첫 마구를 던질 때는 횟수가 줄지 않는다**(소모 조건이 `공+0x10 != 0`).
 *
 * **부재 증명 재확인 (확정)**: 경기+0xf98(공 객체)을 읽는 26곳을 전수로 훑어 그 뒤 60명령 안의
 * `+0x10` 쓰기를 찾으면 `0x3de40 str r3,[공,#0x10]` 하나뿐이다. 공 클래스 vtable `0xd73d0`
 * (메서드 0x9df54·0x9df60·0x9e004·0x9df78·0x9e0b0) 안에는 +0x10 쓰기가 없고,
 * 0x9e15a·0x9e304 는 다른 클래스 `0xd7518`(0x9e148·0x9e850) 쪽이다.
 * 새 투구 준비 0x35650 도 스윙 쪽 상태(+0x10·+0x11)만 지우고 공 객체는 건드리지 않는다.
 *
 * 이 모델은 원본 값을 그대로 돌려주기만 한다 — 실제로 어느 쪽을 쓸지는 경기 쪽에서 정한다.
 */
export function ballMagicNumberAfterPitch(
  previousBallMagicNumber: number,
  pitchTypeNumber: number,
  pitcherMagicNumber: number,
  remaining: number,
): number {
  if (pitchTypeNumber === MAGIC_PITCH_TYPE_NUMBER && remaining > 0) return pitcherMagicNumber
  // 원본에는 여기서 0 으로 되돌리는 줄이 없다 — 직전 값이 그대로 남는다
  return previousBallMagicNumber
}

/**
 * **이번 공의 공+0x10** — 소모(남은 횟수 깎기) 앞뒤의 남은 횟수를 함께 받아 원본 길과 고친 길을 가른다.
 *
 * - 원본(B-01 끔): `ballMagicNumberAfterPitch(직전 값, 구질, 투수 번호, 소모 뒤 남은)` — 0x3de10 은 소모 **뒤**에 돌아
 *   마지막 한 개(1 → 0)는 안 싣고, 0 으로 되돌리는 줄이 없어 앞 마구의 번호가 그 뒤 모든 공(투수가 바뀌어도)에 남는다.
 * - **고침(B-01, `bugfixes.json`)**: 마구 보정은 **마구로 던진 그 공에만** 붙는다 — 이번 공이 마구(구질 22)이고
 *   던지기 전에 남은 횟수가 있었으면 던진 투수의 번호, 아니면 0. 마지막 한 개도 실린다(고를 수 있었던 공이므로).
 *   굴림을 안 쓰므로 이 함수만으로는 난수 차례가 안 바뀐다(보정값이 바뀌어 결과가 달라질 뿐이다).
 */
export function ballMagicNumberOfPitch(input: {
  /** 직전 공+0x10 */
  readonly previous: number
  readonly pitchTypeNumber: number
  /** 던진 투수 레코드 +0x18 */
  readonly pitcherMagicNumber: number
  /** 이 공을 고를 때(소모 전) 남은 횟수 */
  readonly remainingBefore: number
  /** 소모 뒤 남은 횟수 — 원본 0x3de10 이 보는 값 */
  readonly remainingAfter: number
}): number {
  if (isBugFixed('B-01')) {
    return input.pitchTypeNumber === MAGIC_PITCH_TYPE_NUMBER && input.remainingBefore > 0 ? input.pitcherMagicNumber : 0
  }
  return ballMagicNumberAfterPitch(input.previous, input.pitchTypeNumber, input.pitcherMagicNumber, input.remainingAfter)
}
