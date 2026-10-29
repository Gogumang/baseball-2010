import type { PassedBallPlayInput, PassedBallPlayResult } from '@/features/defense-play/model/passedBallPlay/passedBallTypes'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { RUNNER_PLAY_RESULT, type RunnerPlayEngineResult } from '@/features/defense-play/model/runnerPlayEngine'

/** 판 끝 정리 */
export function passedBallPlayResultOf(input: PassedBallPlayInput, result: RunnerPlayEngineResult): PassedBallPlayResult {
  return { ...result, shot: input.shot, batterRuns: input.batterRuns === true }
}

/**
 * 폭투·포일 판의 콜 — 결과 9 → 17 · 13 → 62/20 · 없음 → 없음. 종류 9 의 9 는 0x51c14 가 소리 객체 +5(기기 예외 바이트 — 실기에서 늘 1)
 * · +0x14(물린 소리 버퍼)를 보지만 +5 가 서 있어 늘 17 이다(`judgeCall.SAFE_CALL_SOUND` 주석).
 *
 * **함성 29 는 없다 (확정).** 판정 0x3dfac 의 폭투·포일 갈래(0x3e08c~0x3e092)가 포수 +0xb8 = 6 을 적고 0x17 을 예약하지만,
 * 29 를 내는 곳은 0x17 그리기 0x46c88 → 야수 그리기 0x43278 의 0x4381a(+0xb8 == 6 이면 예약 29)뿐이고, 한 그림의 차례가
 * G1 0x3f060(목록 틱 — 야수 틱 0xa1284 의 a12da 가 잠금이 없으면 +0xb8 −1) → 슬롯 2 → G3 그리기라 0x17 첫 그림에서 포수는
 * 이미 5 다. 0x17 진입 0x46418 은 +0xb8 을 다시 안 적는다(`adds #0xb8` 꼴로 6 을 적는 곳은 바이너리 전체에서 이 판정 하나 — 그 밖은 펌블 b4280).
 * 29 가 실제로 나는 것은 플레이 틱(슬롯 2)에서 서는 **펌블** 쪽이다 — `DefensePlayback` 의 `FUMBLE_CHEER_SOUND`.
 */
export function passedBallCallSoundIdOf(result: Pick<PassedBallPlayResult, 'resultCode' | 'tagOut'>): number | null {
  if (result.resultCode === RUNNER_PLAY_RESULT.SAFE) return 17
  if (result.resultCode === RUNNER_PLAY_RESULT.OUT) return result.tagOut ? 62 : 20
  return null
}

/** 재생 칸에 든 결과가 폭투·포일 판인가 */
export function isPassedBallPlayResult(result: DefensePlayResult | null): result is PassedBallPlayResult {
  return result !== null && 'shot' in result && 'resultCode' in result
}
