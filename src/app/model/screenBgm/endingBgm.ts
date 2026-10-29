import type { SoundPort } from '@/shared/api/audio/soundPort'
import { SCREEN_BGM } from '@/app/model/screenBgm/screenBgmTable'

/** 엔딩 141 에서 부상 · 방출 · 판정 없음(e ≤ 1) 쪽 배경음 0x34 */
const ENDING_SAD_BGM = 52

/**
 * 나리 엔딩 141 의 배경음 — 진입 0x12300 이 e = 0xa3a85(S) 를 구한 뒤(12310) 곧바로:
 * ```
 * 12328  cmp e, #1 ; bgt 12332      ; 부호 있는 비교 — e = −1(판정 없음) · 0(부상) · 1(방출)은 0x34
 * 1232e  r1 = 0x34                  ; 그 밖(은퇴 2~9)은 12334 r1 = 0x2e
 * 1233c  0x6ea6d(소리, r1, −1, 1)    ; 반복 즉시 재생
 * ```
 * 모드 갈림이 없어 타자편 · 투수편 같다.
 */
export function endingBgmOf(endingIndex: number): number {
  return endingIndex <= 1 ? ENDING_SAD_BGM : SCREEN_BGM.엔딩
}

/** 엔딩 141 이어하기의 배경음 4 (1be38 `movs r1, #4`) */
const ENDING_CONTINUE_BGM = 4

/**
 * 엔딩 141 의 이어하기(팝업 0x32 예) — 틀 0x1bbc4 는 부상(곧장 105, 1bddc~1be1e)과 방출(새 시즌 0x1b768, 1be26) 두 갈래가
 * 1be2a 에서 만나 `0x6e419(소리)`(1be30 — 끊기) 뒤 `0x6ea6d(소리, 4, −1, 1)`(1be40)을 부른다. 모드 갈림이 없어 타자편 · 투수편 같다.
 * 부상 갈래는 화면이 '관리' 로 바뀌어 화면 표가 4 를 틀지만, 방출 갈래는 141 이 효과기 끝을 기다린 뒤 137 → 105 로 그 4 를 잇는다
 * (`carriesYearCoverBgm`) — 그래서 방출 갈래는 세션이 이 함수로 그 자리에서 튼다.
 */
export function playEndingContinueBgm(sound: SoundPort): void {
  sound.stop()
  sound.playBgm(ENDING_CONTINUE_BGM)
}

/**
 * 시즌모드(장면 0x105) 10년차 엔딩 상태 0xf5 의 배경음 — 진입 0x6be8 (직접 떴다):
 * ```
 * 6bfc  r5 = 0xa3085(SR)            ; 시즌 엔딩 판정 0xa3084 (`judgeSeasonEnding`) — 연차 idx ≠ 9 면 −1, 그 밖 0~4
 * 6c0c  0x87919(엔딩 판, r5)
 * 6c12  cmp r5, #0 ; bne            ; 0(비 인기 구단)이면 SR+0x7b = 1 · 저장(6c16~6c2e)
 * 6c4a  cmp r5, #0 ; bne 6c54       ; 0 → r1 = 0x34(52) · 그 밖(1~4 · −1) → 0x2e(46)
 * 6c5a  0x6e499(소리, r1, 1)         ; 예약 · 반복
 * ```
 * 나리 141(`endingBgmOf`, e ≤ 1 이면 52)과 달리 **0 하나만** 52 다. r5 는 0xa3084 의 엔딩 번호 그대로다(1 지역 인기 구단도 46).
 */
export function seasonEndingBgmOf(endingIndex: number | null): number {
  return endingIndex === 0 ? ENDING_SAD_BGM : SCREEN_BGM.엔딩
}
