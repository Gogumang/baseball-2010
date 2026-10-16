import { PITCH_RELEASE_SOUND } from '@/features/play-at-bat/model/atBatSounds'
import { MAGIC_PITCH_TYPE_NUMBER } from '@/entities/pitcher-career/model/magicPitch'
import { isAceMagicNumber } from '@/entities/pitching/model/magicPitchGame'

/** 투구 순간 소리 (마구) — `shared/config/original/sounds` 의 28 */
export const MAGIC_PITCH_RELEASE_SOUND = 28

export interface PitchReleaseSoundInput {
  /** 이번 구질 번호 = 게임+0xfc8 (1~21, 마구 22) */
  readonly typeNumber: number
  /** 던진 투수 레코드 +0x18 — 마선수 레코드는 5~9 (`isAceMagicNumber`) */
  readonly pitcherMagicNumber: number
  /** 공 객체 +0x10 = `Pitch.magicNumber` (0x3de10 이 실은 값, 되돌리지 않는다 — H2 3-4) */
  readonly ballMagicNumber: number
}

/**
 * **투구 순간 소리 번호** — 0x3f378 (갱신 0x5308e) 의 끝 가지 0x3f46a~0x3f4b0 그대로:
 * ```
 * 3f46a: ldr r3,[게임+0xfc8] ; cmp r3,#0x16 ; beq 3f49a        ; 구질 22(마구) → 28
 * 3f474: r0 = 0xae83d([게임+0x224])  ; 수비 팀 마운드 투수
 * 3f47c: bl 0xb633d ; beq 3f4a2                                  ; 마선수(rec+0xa 비트6)가 아니면 → 12
 * 3f488: ldr r3,[[게임+0xf98]] ; ldr r3,[r3,#0x10] ; cmp #0      ; 공+0x10 ≠ 0 → 28, 아니면 12
 * 3f49a: play([0x1400058], 0x1c = 28, −1, 0)  /  3f4a2: play(…, 0xc = 12, −1, 0)
 * ```
 * 사람·CPU 를 가르는 줄이 없다 — 누가 던지든 같은 식이다. 모드도 안 본다 — 머리(3f37a~3f39c)가 견주는
 * `[게임+0x1c]` 는 **경기 상태**(뒤 3f422 가 같은 칸을 0x13 과 견준다)라 7 = 경기 준비 · 0x19 정산 ·
 * 0x1a 홈런더비 결과(R10 표)이고, 그때와 경기 멈춤 `+0x1993` 일 때만 건너뛴다. 공이 날아가는 동안에는
 * 어느 것도 아니므로 홈런더비 공도 소리가 난다 (R2 8절·atBatSounds 주석의 "모드 7" 은 이 칸을 잘못 읽은 것).
 *
 * ⚠️ **원본 그대로**: 공+0x10 은 마구를 한 번 실으면 안 지워져서(H2 3-4) 마투수는 그 경기 첫 마구 뒤로
 *    직구·변화구에도 **28** 이 난다. 육성 투수(rec+0xa 비트7 — 투수편·투수 미션)는 0xb633d 가 거짓이라
 *    구질 22 일 때만 28 이다.
 * 머리의 다른 두 문 — `[[게임+0xf98]+4] == 0`(3f3d4) · `[게임+0xf1c] == 0`(3f3e0) 이면 건너뛴다 — 는 공이 날아가는
 *    동안 늘 열려 있다(확인 r112): [게임+0xf98](웹이 '공 객체'라 부르는 vtable 0xd73d0 객체 — 상태 걸기 0x9dff8 · 단계 0x9e0b8 을 가진 투수 동작 객체다)의 +4 바이트는 '보임' 칸이다 —
 *    vt+0x10 = 0x9e0b0 이 +4 = 1, vt+0xc = 0x9df78 이 +4~+7 = 0. 0x11 진입 0x3de10 이 3de6a~3de74 에서 vt+0x10 을
 *    불러 +4 = 1 로 세우고, 지우는 곳은 vt+0xc(0xf · 0xd 진입 0x35650)와 0x18 진입 0x3ac9e 뿐이라 0x11 안에서는 1 이다.
 *    [게임+0xf1c] 는 경기 준비(상태 7) 갱신 0x3e340 이 만드는 그림 객체 포인터로, 지우는 곳은 0x355b8(정산 0x4ea0c ·
 *    더비 결과 0x4f574 가 부른다)과 소멸 0x332b8 뿐이라 투구 중에는 0 이 아니다. → 웹은 두 문을 따로 두지 않는다.
 * ⚠️ 미확인(바이너리 밖): 28 의 이름("마구 투구음")은 갈래 조건에서 읽은 것이다 — 소리 파일을 들어 보는 일은 역어셈으로 할 수 없다.
 */
export function pitchReleaseSoundIdOf(input: PitchReleaseSoundInput): number {
  if (input.typeNumber === MAGIC_PITCH_TYPE_NUMBER) return MAGIC_PITCH_RELEASE_SOUND
  if (isAceMagicNumber(input.pitcherMagicNumber) && input.ballMagicNumber !== 0) return MAGIC_PITCH_RELEASE_SOUND
  return PITCH_RELEASE_SOUND
}
