import type { Pitch } from '@/entities/pitching/model/pitch'
import { isBugFixed } from '@/shared/config/bugfixes'
import type { StageAnimationEntry } from '@/widgets/batting-stage/lib/spriteLoader'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

/**
 * **마투수(마선수 투수) 이펙트** — 투수 앵커에 겹치는 두 가지 (r112 직접 뜸).
 *
 * ## 1. `effect/effect_pitcher.pzx` (경기+0x1044) — 투수 그리기 0x38d1c 의 꼬리 0x39192~0x39262
 * ```
 * 39192  상태 [+0x1c] != 0x11 → 끝
 * 39198  [+0xfc8] == 0x16(마구) → 391c4
 * 391a2  아니면 0xb633d(마운드 투수) 참 ∧ [[+0xf98]+0x10] != 0 일 때만 391c4   ; 공+0x10 은 안 지워지는 칸(H2 3-4)
 * 391c4  (x, y) = 표 0xcfb18[+0x17e1] 투영 0xb94b5 + 카메라 (+0xff4, +0xff8)          ; = 투수 앵커
 * 3920c  [+0x1044] == 0 → 끝
 * 39224  cur = [[애니+8]] ; cur >= [애니+0x14] − 1 → 끝                              ; 마지막 칸은 안 그린다
 * 39230  0xbe8a5(목록 +0x234, x, y, 깊이 [0xcfa8c+8] − 1 = 24499, 그림, 애니 0, 0, 0, 1, 0, −1) ; 39260 0x93d91 한 칸
 * ```
 * - 그림은 타석 교대 적재 0x47cc8 이 48052~4806c 에서 버리고 4806e `0xb633d(마운드 투수)` 참일 때만 48098 이 다시 싣는다 —
 *   **마선수 투수일 때만** 있다(육성 마구 1~4 투수는 구질 22 여도 안 뜬다).
 * - 애니 0 은 0x10 진입 0x39894 가 39a96~39ace 에서 되감고(0x93d31(…, 1)) 켠다(0x93cfd) — 공마다 처음부터. 나아가는 곳은
 *   위 39260 하나(`xval 0x1044` 네 곳: 해제 0x332b8 · 이 그리기 · 0x10 진입 · 적재)라 **0x11 그림 k 번째에 칸 k** 다.
 *   effect_pitcher 애니 0 은 8칸 · 지연 0 → 0x11 처음 7 그림.
 * - 깊이 24499 는 투수(24500)보다 앞이라 **투수 뒤**에 깔린다. 목록 넣기 0xbe810 은 깊이가 같으면 먼저 넣은 것이 앞이고
 *   (be864~be86a `cmp 새, 칸 / bge` 다음 칸), 루상 주자 0x35b94(같은 24499)는 0x4d2ac 에서 0x38d1c 다음에 불리므로 주자보다도 먼저다.
 * - 조건 둘째 줄은 원본 그대로다: 마투수는 그 경기 첫 마구 뒤로 직구 · 변화구에도 공+0x10 이 남아 **공마다** 뜬다
 *   (투구 순간 소리 28 과 같은 칸 — `pitchReleaseSound`).
 *
 * ## 2. 마선수 마구 이펙트 0x46fa8 (경기+0x1038) — 0x11 그림 0x4d2ac 가 두 번 부른다
 * 0x4d714 `0x46fa8(장면, 0)` 은 배경 0x40ff0 · 공 0x3b2f4 · **목록 비우기 0xbe6a1 앞**, 0x4d74e `0x46fa8(장면, 1)` 은 그 **뒤**
 * (HUD 0x4c4bc 앞)다.
 * ```
 * 46fb6  상태 != 0x11 → 끝 ; 46fc2 [+0xfc8] != 0x16 → 끝 ; 46fcc [+0x1038] == 0 → 끝
 * 46fe2  (x, y) = 투수 앵커 (위와 같은 표 · 카메라)
 * 47028  r1 = [투수 레코드+0x18] ; r1 − 5 > 4 → 끝 ; 점프표 0xd00c8
 *          5 싸이커 0x472ba · 6 레오니 0x4703a · 7 · 8 붕붕머신 · 발렌타인 0x47250 · 9 드래고나 0x47368
 * ```
 * - 그림은 적재 0x47cc8 이 마선수 투수일 때만 순번 0xb63a1 로 고른다(480a8 점프표 0xd01bc): 0 psyker_effect · 1 leony_effect ·
 *   2 bbmachine_effect · 3 ballantine_effect · 4 dragona_effect. 갈래는 순번이 아니라 레코드 +0x18 로 가른다(웹은 둘을 같게 본다 —
 *   `aceOrderOfMagicNumber`).
 * - **붕붕머신 · 발렌타인** 0x47250: 둘째 인자 == 0(목록 비우기 앞) 일 때만. 애니 0 이 마지막 칸이면 끝(4727e), 아니면
 *   0xbe8a5(목록, x, y, 깊이 24500 + 1, 그림, 애니 0, …) 뒤 0x93d91 한 칸 — 투수 **앞** · 타자(29705) 뒤. 애니 0 은 0x10 진입
 *   39a24~39a5a 가 되감고 켠다. (발렌타인 47258 은 경기+0x1080 = 2 — 공 그림 종류는 `Pitch.ballKind` 가 싣는다.)
 * - **싸이커**(5) 0x472ba · **드래고나**(9) 0x47368: 둘째 인자 != 0(목록 비우기 뒤) 일 때만. 투수 자세 p = 0x9e0b8(투수 그림 객체)
 *   (`pitcherPoseOf`)에서 s = p − 6(싸이커, p 가 7 · 8) · p − 7(드래고나, p 가 8 · 9). 그림 0번 이미지를
 *   `0xbb91d(그림, x − (s·w)/2, y − (s·h)/2, 종류 0x12, s·10, 0x10)` — 종류 2 크기 (s·10)/10 배(최근접) · 종류 0x10 화면 섞기
 *   b = 16(`blendPixel565`, 반반) 으로 **화면에 바로** 그린다(목록이 아니다). 나눗셈은 0 쪽 자름(`(v + (v >>> 31)) >> 1`).
 *   드래고나 4736e 는 경기+0x1080 = 1(`Pitch.ballKind`).
 * - **레오니**(6) 0x4703a: 둘째 인자 != 0 일 때 자세 4~14 로 leony_effect 프레임을 0xbe8d5 로 **목록**(+0x234)에 넣지만, 이 부름은
 *   목록 비우기 0x4d744 **뒤**다. 0x4d2ac 는 그 뒤 0x4c4bc 로 끝나고 0x4c4bc 안에는 비우기(0xbe6a1 — 부르는 곳 15곳 전수)가 없으며,
 *   장면 프레임 0x52c50 이 그리기 뒤 53032~53044 에서 목록 수가 0 보다 크면 **그리지 않고** 0xbe4a9(수 = 0)로 버린다.
 *   → **레오니 이펙트는 화면에 안 나온다(원본 버그 B-82)**. 원본 길은 아무것도 안 그린다.
 *   **고침(bugfixes.json B-82, 기본 켬)**: 넣은 그림을 목록 비우기 앞에 넣은 것처럼 깊이대로 그린다(`leonyEffectDrawsOf`). 굴림 없음.
 */

/** effect_pitcher.pzx (+0x1044) */
export const EFFECT_PITCHER_FRAMES = assetUrl('./sprites/effect_pitcher/frames')

/** 마투수 순번 0xb63a1 → 적재 0x47cc8 이 +0x1038 에 싣는 그림 (점프표 0xd01bc) */
const ACE_EFFECT_FOLDERS = [
  assetUrl('./sprites/psyker_effect'),
  assetUrl('./sprites/leony_effect'),
  assetUrl('./sprites/bbmachine_effect'),
  assetUrl('./sprites/ballantine_effect'),
  assetUrl('./sprites/dragona_effect'),
] as const

const PSYKER_NUMBER = 5
const LEONY_NUMBER = 6
const BBMACHINE_NUMBER = 7
const BALLANTINE_NUMBER = 8
const DRAGONA_NUMBER = 9
/** 0xbb91d 종류 0x10 섞기 b (0x473c0 `movs r3, #0x10`) */
export const ACE_EFFECT_BLEND_WEIGHT = 0x10

/** 마운드 투수 · 이번 공 — 이펙트 갈래가 보는 칸 */
export interface AcePitcherEffectInput {
  /** 마투수 순번 0xb63a1 (0~4) — 마선수 투수가 아니면 null (그림이 안 실린다) */
  readonly aceOrder: number | null
  /** 이번 공 — 구질 22(`isMagicPitch`) · 투수 레코드 +0x18(`pitcherMagicNumber`) · 공+0x10(`magicNumber`) */
  readonly pitch: Pick<Pitch, 'isMagicPitch' | 'pitcherMagicNumber' | 'magicNumber'> | null
  /** 0x11 진입 뒤 그림 수 (0 = 진입 그림). 0x11 이 아니면 null */
  readonly pitchStateDraw: number | null
}

/** 애니를 그림마다 한 칸씩 나아가게 그릴 때 k 번째 그림의 칸 — 칸 길이 max(1, 지연)(0x93d90), 마지막 칸은 안 그린다 */
export function oneShotAnimationFrameAt(entries: readonly StageAnimationEntry[], drawCall: number): number | null {
  if (drawCall < 0) return null
  let remaining = drawCall
  for (let index = 0; index < entries.length - 1; index += 1) {
    const length = Math.max(1, entries[index].delay)
    if (remaining < length) return entries[index].frame
    remaining -= length
  }
  return null
}

/** 0x39192~0x391c2 — effect_pitcher 를 그리는가 (그림이 실린 마선수 투수 · 0x11 · 마구거나 공+0x10 이 남았다) */
export function showsEffectPitcher(input: AcePitcherEffectInput): boolean {
  if (input.aceOrder === null || input.pitch === null || input.pitchStateDraw === null) return false
  if (input.pitch.isMagicPitch === true) return true
  return (input.pitch.magicNumber ?? 0) !== 0
}

/** effect_pitcher 애니 0 의 이번 그림 칸 — 안 그리면 null */
export function effectPitcherFrameAt(input: AcePitcherEffectInput, entries: readonly StageAnimationEntry[]): number | null {
  if (!showsEffectPitcher(input) || input.pitchStateDraw === null) return null
  return oneShotAnimationFrameAt(entries, input.pitchStateDraw)
}

/** 0x46fa8 의 공통 문 — 0x11 · 구질 22 · +0x1038 이 실렸다. 통과하면 레코드 +0x18 · 실린 그림 폴더 */
function aceMagicBranchOf(input: AcePitcherEffectInput): { readonly number: number; readonly folder: string } | null {
  if (input.aceOrder === null || input.pitch === null || input.pitchStateDraw === null) return null
  if (input.pitch.isMagicPitch !== true) return null
  const folder = ACE_EFFECT_FOLDERS[input.aceOrder]
  if (folder === undefined) return null
  return { number: input.pitch.pitcherMagicNumber ?? 0, folder }
}

/** 0x47250 붕붕머신 · 발렌타인 — 목록 비우기 앞 · 깊이 24501 에 넣는 애니 0 칸 */
export interface AceMagicAnimationDraw {
  readonly framesFolder: string
  readonly frame: number
}

export function aceMagicAnimationDrawOf(
  input: AcePitcherEffectInput,
  entriesOf: (framesFolder: string) => readonly StageAnimationEntry[] | null,
): AceMagicAnimationDraw | null {
  const branch = aceMagicBranchOf(input)
  if (branch === null || input.pitchStateDraw === null) return null
  if (branch.number !== BBMACHINE_NUMBER && branch.number !== BALLANTINE_NUMBER) return null
  const framesFolder = `${branch.folder}/frames`
  const entries = entriesOf(framesFolder)
  if (entries === null) return null
  const frame = oneShotAnimationFrameAt(entries, input.pitchStateDraw)
  return frame === null ? null : { framesFolder, frame }
}

/** 0x472ba 싸이커 · 0x47368 드래고나 — 목록 비우기 뒤 화면에 바로 그리는 키운 그림 */
export interface AceMagicScaledDraw {
  /** 그림 0번 이미지 */
  readonly imageUrl: string
  /** 배율 s (0xbb91d 의 a = s·10) */
  readonly scale: number
}

/** 472ce `subs r3, r0, #7 / cmp #1 / bls` · 47386 `subs r3, #8 / cmp #1 / bls` — 키운 그림을 그리는 두 자세의 첫 자세 */
const SCALED_FIRST_POSE: ReadonlyMap<number, number> = new Map([
  [PSYKER_NUMBER, 7],
  [DRAGONA_NUMBER, 8],
])

/** 472d8 s = p − 6 · 4738e s = p − 7 — 첫 자세면 1, 다음 자세면 2. 그 밖 자세는 null */
function aceMagicScaleOf(aceNumber: number, pose: number): number | null {
  const first = SCALED_FIRST_POSE.get(aceNumber)
  if (first === undefined || (pose !== first && pose !== first + 1)) return null
  return pose - first + 1
}

export function aceMagicScaledDrawOf(input: AcePitcherEffectInput, pose: number): AceMagicScaledDraw | null {
  const branch = aceMagicBranchOf(input)
  if (branch === null) return null
  const scale = aceMagicScaleOf(branch.number, pose)
  if (scale === null) return null
  return { imageUrl: `${branch.folder}/000.png`, scale }
}

/** 0 쪽으로 자른 반 — 47304 · 47310 `lsrs #0x1f / adds / asrs #1` */
export const halfTowardZero = (value: number): number => (value + (value < 0 ? 1 : 0)) >> 1

/** 키운 그림의 왼쪽 위 — (x − (s·w)/2, y − (s·h)/2) */
export function aceMagicScaledOriginOf(
  anchor: { readonly x: number; readonly y: number },
  scale: number,
  width: number,
  height: number,
): { readonly x: number; readonly y: number } {
  return { x: anchor.x - halfTowardZero(scale * width), y: anchor.y - halfTowardZero(scale * height) }
}

/** leony_effect 프레임 폴더 (0x67 겹이 있다 — `FRAME_LAYER_FOLDERS`) */
export const LEONY_EFFECT_FRAMES = assetUrl('./sprites/leony_effect/frames')
/** [0xcfa8c+8] — 투수 깊이 24500. 레오니 그림은 이것 −1(투수 뒤) · +1(투수 앞)로 넣는다 */
const LEONY_BASE_DEPTH = 24500

/** 0xbe8d5 로 넣는 한 장 — 투수 앵커에서 (dx, dy) 떨어진 자리에 프레임을 그 원점대로 */
export interface LeonyEffectDraw {
  readonly frame: number
  readonly dx: number
  readonly dy: number
  readonly depth: number
}

/**
 * **레오니(6) 0x4703a** — 투수 자세 p = 0x9e0b8(4~14, 점프표 0xd00dc)마다 leony_effect 프레임을 0xbe8d5(목록, x, y, 깊이, 그림, 프레임,
 * 0, 0, 1, 0, −1)로 넣는다. 상자 (w, h) = 0xba815(그림, 프레임, 1)(합집합 상자 = origins 의 폭 · 높이):
 * ```
 * p 4 · 5      47066 · 47072  프레임 5 · 6 을 앵커에                         깊이 D − 1
 * p 6 · 7      4707e · 470d2  프레임 7 · 8 을 앵커에, 그 뒤 프레임 2 · 3 을 (0, −h)   깊이 D − 1
 * p 8          47142          프레임 4 를 (0, −h)                               깊이 D − 1
 * p 9          47184          프레임 0 을 (−w/2, −h/2)                          깊이 D + 1
 * p 10         471d6          프레임 1 을 (−w/2, −w/2) — y 도 폭으로 뺀다(원본 그대로)  깊이 D + 1
 * p 11~14      47224          프레임 p − 2 를 앵커에                            깊이 D − 1
 * ```
 * D = [0xcfa8c+8] = 24500(투수), /2 는 0 쪽 자름. **원본은 이 부름이 목록 비우기 0x4d744 뒤라 아무것도 안 나온다(B-82)** — 원본 길은 빈 목록.
 */
export function leonyEffectDrawsOf(
  input: AcePitcherEffectInput,
  pose: number,
  boxOf: (frame: number) => { readonly width: number; readonly height: number } | null,
): readonly LeonyEffectDraw[] {
  if (!isBugFixed('B-82')) return []
  const branch = aceMagicBranchOf(input)
  if (branch === null || branch.number !== LEONY_NUMBER) return []
  return leonyPoseDrawsOf(pose, boxOf)
}

type LeonyBoxOf = Parameters<typeof leonyEffectDrawsOf>[2]

const LEONY_BEHIND_DEPTH = LEONY_BASE_DEPTH - 1
const LEONY_FRONT_DEPTH = LEONY_BASE_DEPTH + 1

const leonyAt = (frame: number, dx = 0, dy = 0, depth = LEONY_BEHIND_DEPTH): LeonyEffectDraw => ({ frame, dx, dy, depth })

/** 프레임을 (0, −h) 에 — 상자를 모르면 없음 */
function leonyAbove(frame: number, boxOf: LeonyBoxOf): LeonyEffectDraw | null {
  const box = boxOf(frame)
  return box === null ? null : leonyAt(frame, 0, -box.height)
}

const presentDraws = (draws: readonly (LeonyEffectDraw | null)[]) => draws.filter((draw): draw is LeonyEffectDraw => draw !== null)

const isPoseIn = (pose: number, first: number, last: number): boolean => pose >= first && pose <= last

/** p 9 · 10 — 프레임 0 · 1 을 (−w/2, −h/2) · (−w/2, −w/2)(y 도 폭으로 — 원본 그대로), 투수 앞 */
function leonyFrontDraws(pose: number, boxOf: LeonyBoxOf): readonly LeonyEffectDraw[] {
  const frame = pose - 9
  const box = boxOf(frame)
  if (box === null) return []
  const dy = pose === 9 ? box.height : box.width
  return [leonyAt(frame, -halfTowardZero(box.width), -halfTowardZero(dy), LEONY_FRONT_DEPTH)]
}

/** 자세 p 의 레오니 그림 (위 표) */
function leonyPoseDrawsOf(pose: number, boxOf: LeonyBoxOf): readonly LeonyEffectDraw[] {
  if (isPoseIn(pose, 4, 5)) return [leonyAt(pose + 1)]
  if (isPoseIn(pose, 6, 7)) return presentDraws([leonyAt(pose + 1), leonyAbove(pose - 4, boxOf)])
  if (pose === 8) return presentDraws([leonyAbove(4, boxOf)])
  if (isPoseIn(pose, 9, 10)) return leonyFrontDraws(pose, boxOf)
  return isPoseIn(pose, 11, 14) ? [leonyAt(pose - 2)] : []
}
