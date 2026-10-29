import { judgeCallSoundIdOf } from '@/features/defense-play/model/judgeCall'

/**
 * **판 안의 판정 콜** — 플레이 틱 꼬리 b4562 가 결과 코드(포구 b4292 의 9 · b4540 의 13)를 메시지 0xbba 로 보내면
 * (0xbfbac → 0xbfb78 이 받는 곳의 vt+0xc 를 곧바로 부른다 — 큐가 아니다) 0x51a56 이 판정 스위치 0xd0488 로 가른다
 * (`judgeCall.judgeCallSoundIdOf` — 타구 판과 같은 길):
 * - 9 → 0x51c14: 플레이 +0x118(종류)이 4 · 5 면 다른 검사 없이 17(51c1e~51c24 → 51c38). 그 밖(종류 9)은 소리 객체
 *   `[[0x1400058]+5]`(PHONEMODEL 조회가 되면 0x6e852 가 늘 1 로 쓰는 기기 예외 바이트)가 서 있으면 17, 아니면 `+0x14`(물린 소리 파일
 *   버퍼)가 0 일 때만 17 — 실기에서는 +5 가 1 이라 종류 9 도 늘 17 이다(`judgeCall.SAFE_CALL_SOUND` 주석).
 * - 13 → 0x51b36: state[0x1f](바운드 없이 잡은 아웃) 또는 state[0x87](그 아웃을 낸 판정이 태그)이면 62, 아니면 20.
 *   주자 판에는 타구가 없어 state[0x1f] 는 안 선다 — 그 틱의 태그 칸(`tagOut`)만 본다.
 * 소리는 play 0x6ea6c(…, −1, 0) — 51b18 → 51c54. 판 결과 칸은 첫 번째만 적지만 메시지는 그 틱마다 가므로 콜도 그 틱마다 난다.
 */
export function runnerPlayCallSoundIdOf(messageCode: number, tagOut: boolean): number | null {
  return judgeCallSoundIdOf(messageCode, { caughtOnTheFly: false, tagOut })
}
