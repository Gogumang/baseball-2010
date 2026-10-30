import type { Pitch } from '@/entities/pitching/model/pitch'
import type { StageAnimationEntry } from '@/widgets/batting-stage/lib/spriteLoader'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

/**
 * 마구 공 이펙트 — **공 그림 자리에 겹치는 한 벌** (경기+0x1040).
 *
 * 원본 자리: 타석 공 그리기 `0x3b2f4` 안, 구질 갈래표 `0xcff20` 의 첫 칸(`0x3b546`).
 * 확인한 그대로 옮긴 것만 여기 있다:
 *
 * ```
 *   3b4da: ldrb r2,[r5,#0x18]      ; 투수 레코드 +0x18 (마구 번호)
 *   3b4e0: ldr  r3,[게임+0xfc8]    ; 이번 구질
 *   3b4e2: cmp  r3,#0x16           ; 22 = 마구가 아니면 아무것도 안 그린다
 *   3b4e8: subs r3,r2,#1           ; 갈래표 0xcff20 = 마구 번호 1~9
 *   3b546: movs r2,#0x82 / lsls #5 ; 경기+0x1040 = effect_fire · effect_shinning 이 실린 칸
 *   3b54e: cmp  r2,#0 / beq        ; 그림이 없으면 건너뛴다
 *   3b554: cmp  r3,#7 / ble        ; **공 경로 번호(경기+0x1098) 가 7 을 넘어야** 뜬다
 *   3b56e: cur=[[애니+8]] · cnt=[애니+0x14]
 *   3b576: cmp cur,cnt-1 / bge     ; **마지막 칸은 안 그린다** (한 번만 돌고 멈춘다)
 *   3b598: r1=[sp+0x4c] r2=[sp+0x50] ; **자리 = 공의 화면 좌표 그대로** (0x35854 가 채운 값)
 *   3b5a4: bl 0x93d91              ; 그린 틱에만 애니가 한 칸 넘어간다
 * ```
 *
 * 그러니 좌표계는 **화면 좌표**이고, 원점은 공과 같다(effect_fire/origins.json 이 −9,−9 로
 * 가운데를 잡아 둔다). 뒤집기·배율은 없다 (`sp[8]=sp[0xc]=0`).
 *
 * 어느 그림이 경기+0x1040 에 실리는지는 적재 `0x47cc8` 의 투수 갈래(0x4816c~0x481e4)다:
 *   - 마구 번호 1 → `effect/effect_fire.pzx`
 *   - 마구 번호 4 **이고** `0xb6e24(폼) >> 1 == 0` 일 때만 → `effect/effect_shinning.pzx`
 *   - 그 밖(2·3, 폼이 다른 4)은 아예 안 싣는다 — 원본도 이 두 경우엔 그림 이펙트가 없고
 *     파티클(`0xbbc85` id 0x15~0x18)만 쓴다 (`0x3b4fa`·`0x3b510`·`0x3b5ae`·`0x3b5cc`).
 *
 * 마선수 마구(번호 5~9)의 이펙트는 여기 없다 — 그쪽은 경기+0x1038 을 쓰는 `0x46fa8` 과 투수 쪽 effect_pitcher(+0x1044)이고
 * `acePitcherEffect.ts` 가 옮겼다(r112 — 레오니는 원본에서도 화면에 안 나온다).
 */

/** `effect/effect_fire.pzx` — 마구 번호 1 */
export const EFFECT_FIRE_FRAMES = assetUrl('./sprites/effect_fire/frames')
/** `effect/effect_shinning.pzx` — 마구 번호 4, 폼 묶음 0 */
export const EFFECT_SHINNING_FRAMES = assetUrl('./sprites/effect_shinning/frames')

/** `0x3b554 cmp r3,#7 / ble` — 공 경로 번호가 **8 이 되는 틱부터** 그린다 */
export const MAGIC_BALL_EFFECT_FIRST_PATH_INDEX = 8

const FIRE_MAGIC_NUMBER = 1
const SHINNING_MAGIC_NUMBER = 4

/** 어느 이펙트 폴더를 겹칠지. 겹칠 게 없으면 null */
export function magicBallEffectFolderOf(pitch: Pitch): string | null {
  if (pitch.isMagicPitch !== true) return null
  const number = pitch.pitcherMagicNumber ?? 0
  if (number === FIRE_MAGIC_NUMBER) return EFFECT_FIRE_FRAMES
  // 0x481c4 — 폼 묶음(폼 >> 1)이 0 일 때만 effect_shinning 을 싣는다
  if (number === SHINNING_MAGIC_NUMBER && Math.floor(Math.max(0, pitch.pitcherForm ?? 0) / 2) === 0) {
    return EFFECT_SHINNING_FRAMES
  }
  return null
}

/**
 * 공 경로 번호(= 경기+0x1098, 웹의 `scene.frame`)에서 그릴 그림 번호를 낸다.
 *
 * 애니는 **그린 틱에만** 한 칸 넘어가므로(0x3b5a4) 흐른 틱 = `경로번호 − 8` 이다.
 * 칸 길이는 판정 글자와 같은 `max(1, 지연)` 틱이고(0x93d90), **마지막 칸은 안 그린다**.
 */
export function magicBallEffectFrameAt(entries: readonly StageAnimationEntry[], ballPathIndex: number): number | null {
  if (entries.length < 2) return null
  if (ballPathIndex < MAGIC_BALL_EFFECT_FIRST_PATH_INDEX) return null

  let remaining = ballPathIndex - MAGIC_BALL_EFFECT_FIRST_PATH_INDEX
  for (let index = 0; index < entries.length - 1; index += 1) {
    const length = Math.max(1, entries[index].delay)
    if (remaining < length) return entries[index].frame
    remaining -= length
  }
  return null
}

/** 마구 공 파티클 한 벌 — 0xbbc85(x, y, id, img, 0, −1, 0, 0) */
export interface MagicBallParticle {
  readonly id: number
  readonly img: number
}

/**
 * **0x11 의 마구 공 파티클** — 공 그리기 0x3b2f4 의 3b496 갈래(상태 [+0x1c] == 0x11)가 구질 [+0xfc8] == 22 이면 지금 투수 레코드 +0x18
 * (마구 번호 1~9)로 갈래표 0xcff20 을 탄다 (2026-10-24 직접 떴다). 그림마다 공의 화면 자리 [sp+0x4c] · [sp+0x50](0x35854 —
 * 공 틱 [+0x1098] 을 0 ~ N − 1 로 자른 점)에 쏜다:
 * ```
 * 0xcff20  1 → 3b546 (effect_fire 그림 — 파티클 없음) · 2 → 3b4fa · 3 → 3b510 · 4 → 3b528 · 5~8 → 3b62c(없음) · 9 → 3b610
 * 3b4fa  번호 2: id 0x15, img 15                 3b510  번호 3: id 0x15, img 16            3b610  번호 9: id 0x15, img 14
 * 3b528  번호 4: 폼(0xb6e25) >> 1 이 0 → 3b546(effect_shinning 그림) · 1 → 3b5ae · 2 → 3b5cc · 그 밖 없음
 * 3b5ae    공 틱 == 0 일 때만 id 0x18, img 15
 * 3b5cc    공 틱 ≤ trunc(N / 2) 일 때만 id 0x16, img 14 · id 0x17, img 14 (N = [+0x109c])
 * ```
 * 0x11 진입(0x3de10)이 보임 칸을 세워 0x11 그리기 0x4d64c 는 첫 그림부터 0x3b2f4 를 부르므로 놓기(틱 10) 전 와인드업 그림에도 쏜다.
 */
export function magicBallParticlesOf(
  pitch: Pick<Pitch, 'isMagicPitch' | 'pitcherMagicNumber' | 'pitcherForm'>,
  ballTick: number,
  frameCount: number,
): readonly MagicBallParticle[] {
  if (pitch.isMagicPitch !== true) return []
  const magicNumber = pitch.pitcherMagicNumber ?? 0
  if (magicNumber === SHINNING_MAGIC_NUMBER) return shinningParticlesOf(pitch.pitcherForm ?? 0, ballTick, frameCount)
  const particle = FLAT_MAGIC_PARTICLES.get(magicNumber)
  return particle === undefined ? [] : [{ ...particle }]
}

/** 3b4fa · 3b510 · 3b610 — 번호 2 · 3 · 9 는 공 틱과 상관없이 한 개 */
const FLAT_MAGIC_PARTICLES: ReadonlyMap<number, MagicBallParticle> = new Map([
  [2, { id: 0x15, img: 15 }],
  [3, { id: 0x15, img: 16 }],
  [9, { id: 0x15, img: 14 }],
])

/** 3b528 — 번호 4: 폼 >> 1 이 1 이면 공 틱 0 에만 · 2 면 공 틱 ≤ trunc(N / 2) 동안 둘 */
function shinningParticlesOf(form: number, ballTick: number, frameCount: number): readonly MagicBallParticle[] {
  const formGroup = form >> 1
  if (formGroup === 1) return ballTick === 0 ? [{ id: 0x18, img: 15 }] : []
  if (formGroup !== 2 || ballTick > Math.trunc(frameCount / 2)) return []
  return [
    { id: 0x16, img: 14 },
    { id: 0x17, img: 14 },
  ]
}
