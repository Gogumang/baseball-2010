import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/**
 * 기록달성 지급 0xa77f0 의 **첫 관문** — `ctx+0x24` 첫 바이트가 0 이어야 한 건이라도 들어온다.
 *
 * 그 바이트의 뜻은 R15 10절이 확정했다: **"사람 투수가 강판되어 남은 경기를 간이 엔진이
 * 끝까지 돌리는 중"** (0xc1b48 에서 1 — R8 1절의 "30G 자동진행" 해석은 틀렸고, 30G 자동진행은
 * `engine+0xa0` 을 쓴다). 웹판에서 그 표시가 곧 `simpleEngineRunning` 이다.
 *
 * → 감독 강판이든 스스로 강판이든 **강판된 뒤에는 경기 끝 기록(28~31·37~39)까지 포함해
 *   아무 기록도 들어오지 않는다.** 강판 전에 받아 둔 기록은 그대로 남는다.
 */
export function recordsAllowed(progress: PitcherGameProgress): boolean {
  return !progress.simpleEngineRunning
}

/**
 * `0xa56dc(R, 내 투수, …)` — 내 투수의 기록을 **셀 대상인가**. 모드 3 갈래(점프표 0xd8204[1] → 0xa571c)는
 * 시즌 객체 S(0x1fa2d)의 **+0xb4(포스트시즌)·+0x12c(국가대항전)가 둘 다 0** 일 때만 참이다
 * (그 다음 마선수 0xb633d 검사는 투수편 내 투수에게 늘 통과).
 *
 * 이 게이트가 거짓이면 원본은 아무것도 세지 않는다:
 *   - 사건 함수 0xa57f8 의 코드 0x14~0x1f (0xa5844~0xa585a) — R+0x124~+0x150: 피안타 0x12c · 탈삼진 0x134(+연속 0x14c) ·
 *     타자 수 0x138 · 아웃 0x13c · 볼넷 0x144 · 사구 0x148 · 등판 때 앞섬 0x150 ·
 *     (코드 0x20 R+0x154 삼자범퇴 이닝 · 0x21 R+0x158 은 이 게이트 밖이라 그대로 센다)
 *   - 정산 0xa8024 의 R+0x128 (0xa8f3c) · 레코드 +0x22 실점 (0xa8ef4) · +0x20 아웃 · +0x26 탈삼진 ([sp+0x38], 0xa8cb0·0xa8d00)
 * 웹 `seasonDelta` 의 아웃·탈삼진·실점은 이 R 칸에서 나오므로 함께 0 이 된다 (원본 +0x20·+0x26·+0x22 와 같다).
 *
 * 포스트시즌(`isPostseason`)과 국가대항전(`isNationalCup`) 둘 다 본다.
 */
export function countsMyPitcherRecord(progress: PitcherGameProgress): boolean {
  return !progress.options.isPostseason && progress.options.isNationalCup !== true
}
