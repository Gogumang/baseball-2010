import type { StageAnimationEntry } from '@/widgets/batting-stage/lib/spriteLoader'

/**
 * **필살 스윙 연출 그림** — 스윙 그리기 0x49e64 가 부르는 0x49aec (2026-10-14 직접 떴다).
 *
 * 0x49e64 는 타자 그림(+0xf18)을 그리기 목록에 넣은 뒤 49f7c 에서 **상태 0x13 이거나 (맞음 +0xfd2 ∧ 0xb9271(스윙) == 0)** 이면
 * 0x49aec 를 부른다 — 헛스윙은 0x13 도 +0xfd2 도 없어 안 부른다. 0x49aec:
 * ```
 * 49b4e  0xb633d(타자) — 마타자면 그림 = 경기 +0x1034(타석 교대 0x47e1c: 순번 0 medica_effect · 1 effect_frame · 2 effect_power ·
 *        3 effect_tornado · 4 effect_meteor), 아니면 +0x103c(0x47ec0: 번호 +0x18 1 effect_power · 2 effect_frame · 3 effect_tornado ·
 *        4 effect_meteor). 그림이 없거나 스윙 S+0x10 == 0 이면 끝(아래 표시도 안 선다)
 * 49ba8  [sp+0x60] = 1 — 0x49e64 가 이걸 보고 보통 타격 불꽃(game_effect 애니 2 · 3 + ptc 006 · 007, 49faa~4a0ce)을 건너뛴다
 *        점 (x, y) = 타격점 (+0x10dc, +0x10e0) 투영 0xb94b5 + 카메라 (+0xff4, +0xff8)
 * 49bba  마타자 1(어거지죠) · 49c5c 번호 2(플레임): 0xb63c1(타자) == 0(우타)이면 효과 0x11 · 깊이 −1
 * 49c80  마타자 3(크라이져) · 번호 3(토네이도): y + 25
 * 49c8a  번호 4: 0xb8e6d(타자) — 폼 니블 2 · 3(장타형 = 메테오)이면 파티클만. 아니면(타격형 = 미라지) **타자 그림 +0xf18 을 한 장 더**:
 *          표 0xcfb34(우타일 때) / 0xcfb2c(좌타일 때) = **반대쪽 타석 앵커** 투영 + 카메라 에 그림 +0x3c = !손 으로(반대 손 자세)
 *          스윙 단계 s = 0xb905d(스윙) 그대로 vt+0x10(그리기 목록) — 뒤 +0x3c 를 손으로 되돌린다. 좌우 이동(+0xfe4)은 안 더한다
 * 49d48  애니 = 그림 애니 0 — 0x93d91(한 칸) · 0x93cfd(애니, 0) 뒤 끝 비트([애니+8][2] & 4)가 없으면
 *        0xbe8a5(그리기 목록, x, y, 깊이 [0xcfa8c+0x14] + (−1 | 0), 그림, 애니 0, 효과, 0, 1, 0, −1)
 * 49da4  +0x196b == 0 이면 파티클 둘(`hitParticles.specialSwingParticlesOf`)을 같은 (x, y) 에 쏘고 +0x196b = 1
 * ```
 * 그림 애니는 0x10 진입 0x39894 가 공마다 되감는다(칸 0 · 틱 0 · 돌림). 그리기 목록은 깊이 오름차순 · 같은 깊이는 넣은 차례라
 * (0xbe810) 깊이 29705(= 타자 0xd3a70[5])인 그림은 타자 · 미라지 다음, 29704 인 그림은 타자 **아래**다.
 * 목록 그리기(0xbe6a1)는 넣을 때가 아니라 비울 때 애니의 지금 칸을 그리므로 k 번째 부름은 **k 칸 나아간 뒤**의 칸을 그린다.
 * 부름 차례(2026-10-24 직접 떴다): 맞은 틀 J 의 0x11 그림이 첫 부름이다 — 스윙 객체는 틀 머리 0x3f060 끝(3f320 vt+8)에서 한 칸
 * 넘어가고, 같은 틀 갱신 0x4e060 이 0xb9270(상태 [+0x18] == 3 이면 1 − 프레임 [+0x1c], 아니면 999) == 0 에서 판정(+0xfd2)하므로 그
 * 틀 그리기의 49f8c 도 0xb9271 == 0 을 본다. 그 뒤 0x13 은 그림마다 부르므로 0x13 틱 d 의 그림이 d + 2 번째 부름이다
 * (`useStageAnimation` 의 `specialSwingEffectNow`). ⚠️ 근사: 타격점은 맞은 틱의 공 자리(`BattingStage` 의 보통 타격 불꽃과 같은 근사).
 */

/** 마타자 순번 → +0x1034 그림 (0x47e1c 점프표 0xd01a8) */
const ACE_BATTER_EFFECT_FOLDERS: readonly string[] = [
  './sprites/medica_effect/frames',
  './sprites/effect_frame/frames',
  './sprites/effect_power/frames',
  './sprites/effect_tornado/frames',
  './sprites/effect_meteor/frames',
]

/** 필살 번호(레코드 +0x18) → +0x103c 그림 (0x47ec0~0x47f0a) */
const SPECIAL_SWING_EFFECT_FOLDERS: Readonly<Record<number, string>> = {
  1: './sprites/effect_power/frames',
  2: './sprites/effect_frame/frames',
  3: './sprites/effect_tornado/frames',
  4: './sprites/effect_meteor/frames',
}

/** 마타자 1(어거지죠) · 번호 2(플레임) — 우타면 효과 0x11, 늘 깊이 −1 */
const ACE_FLIPPED_ORDER = 1
const FLIPPED_SPECIAL_NUMBER = 2
/** 마타자 3(크라이져) · 번호 3(토네이도) — y + 0x19 (49c84) */
const ACE_RAISED_ORDER = 3
const RAISED_SPECIAL_NUMBER = 3
const RAISED_OFFSET_Y = 0x19
/** 번호 4 — 0xb8e6d 거짓(폼 니블 2 · 3 아님)이면 미라지 그림 */
const MIRAGE_SPECIAL_NUMBER = 4
const RIGHT_HANDED = 0

export interface SpecialSwingStageEffect {
  /** 그림(+0x1034 · +0x103c) 폴더 — 애니 0 을 그린다 */
  readonly folder: string
  /** 효과 0x11 (좌우 뒤집기, 점 x 를 축으로) */
  readonly isMirrored: boolean
  /** 깊이 −1 — 타자 그림 아래에 그린다 */
  readonly isBehindBatter: boolean
  /** 점 y 에 더하는 값 (49c84) */
  readonly offsetY: number
  /** 미라지 — 타자 그림을 반대쪽 타석에 반대 손으로 한 장 더 (49c9c~49d40) */
  readonly showsMirage: boolean
}

/**
 * 이 필살 스윙이 0x49aec 의 그림 갈래를 타는가 — 타면 그 모습, 안 타면 null(보통 타격 불꽃이 나간다).
 * `swingNumber` 는 레코드 +0x18(1~4), `aceBatterIndex` 는 0xb63a1(마타자 0~4, 아니면 음수), `batterHand` 는 0xb63c1.
 */
export function specialSwingStageEffectOf(
  swingNumber: number,
  batterForm: number,
  aceBatterIndex: number,
  batterHand: number,
): SpecialSwingStageEffect | null {
  const isRightHanded = batterHand === RIGHT_HANDED
  if (aceBatterIndex >= 0) {
    const folder = ACE_BATTER_EFFECT_FOLDERS[aceBatterIndex]
    if (folder === undefined) return null
    const isFlipped = aceBatterIndex === ACE_FLIPPED_ORDER
    return {
      folder,
      isMirrored: isFlipped && isRightHanded,
      isBehindBatter: isFlipped,
      offsetY: aceBatterIndex === ACE_RAISED_ORDER ? RAISED_OFFSET_Y : 0,
      showsMirage: false,
    }
  }
  const folder = SPECIAL_SWING_EFFECT_FOLDERS[swingNumber]
  if (folder === undefined) return null
  const isFlipped = swingNumber === FLIPPED_SPECIAL_NUMBER
  return {
    folder,
    isMirrored: isFlipped && isRightHanded,
    isBehindBatter: isFlipped,
    offsetY: swingNumber === RAISED_SPECIAL_NUMBER ? RAISED_OFFSET_Y : 0,
    // 0xb8e6d — 폼 니블 2 · 3(장타형)이면 참 → 미라지 그림 없음
    showsMirage: swingNumber === MIRAGE_SPECIAL_NUMBER && batterForm >> 1 !== 1,
  }
}

/**
 * k 번째 부름(1 부터)에 그릴 그림 칸. 애니는 되감긴 칸 0 · 틱 0 에서 부를 때마다 한 칸 나아가고(0x93d90: 칸 길이 max(1, 지연)),
 * 마지막 칸을 넘겨 0 으로 돌면 끝 비트가 서 더는 안 그린다 → null.
 */
export function specialSwingEffectFrameAt(entries: readonly StageAnimationEntry[], drawCall: number): number | null {
  if (drawCall < 1) return null
  let remaining = drawCall
  for (const entry of entries) {
    const length = Math.max(1, entry.delay)
    if (remaining < length) return entry.frame
    remaining -= length
  }
  return null
}
