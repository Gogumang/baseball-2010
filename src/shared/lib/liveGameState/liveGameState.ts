/**
 * **전역 경기 상태 `[0x1552d0c]` 의 +0x6a · +0x6b** — 모든 모드가 같이 쓰는 경기 상태 한 벌이다 (직접 떴다).
 *
 * ```
 * 앱 시작 0x2ed8(0x3016 만들기 · 0x31be)  → 0xb6814: +0x6a = 6 (0xb681e~0xb6824) · 0xb6798: +0x6b = 0 (0xb67c0)
 * 0xb6814 를 전역 상태로 부르는 곳(곧 +0x6b = 0):
 *   시즌 경기 준비 0x6548(0x6622) · 나리 142 진입 0x1c46c(0x1c47a) · 일반모드 경기정보 0x30be0(0x30d5e) · 0x30f20(0x310a8) ·
 *   경기 장면 셋업 0x39fdc(0x39ff6 · 0x3a200 · 0x3a49c — 모드 갈래) · 미션 0xaa57c(0xaa5fc)
 * +0x6b 를 쓰는 다른 곳: 이닝 넘김 0xb6b6c(0xb6b8a, 경기 장면 — 모든 모드) · 미션 시작 이닝 0xaa698(레코드 바이트3 하위 4비트)
 * CPU 끼리 경기(0xc239c · 0xc2c4c ← 0xc2a48 · 0xc2760 · 0xc2dac)는 0xc0dac 에 **제 스택의 상태**(sp+0x48)를 넘겨 이 칸을 안 건드린다.
 * +0x6a 를 바꾸는 곳은 0xb6814 의 상수 6 뿐이다(`adds #0x6a` + strb 전수 — 나머지는 다른 객체).
 * ```
 * 그래서 장면이 바뀌어도 **마지막으로 돈 경기(모드 불문)의 이닝**이 남고, 앱을 새로 켜면 0 이다. 투수편 116 의 감독 글 38
 * (`+0x6a == +0x6b`, 12ad8~12af0)이 이어하기 때 이 칸의 지금 값을 본다.
 * 웹은 모듈 칸으로 든다 — 새로 고침(= 앱 다시 켜기)이면 0. 각 모드 세션이 위 자리에서 `resetLiveGameState` 를,
 * 경기 끝(· 경기 중 나가기)에 `setLiveGameInningIndex` 를 부른다.
 */

/** +0x6a — 0xb6814 가 넣는 상수 (구원 "등판 기회 없음" 판정의 7회 = 인덱스 6) */
export const LIVE_GAME_STATE_COLD_INNING_INDEX = 6

let inningIndex = 0

/** 0xb6814(전역 상태) — +0x6b = 0 (+0x6a 는 늘 6) */
export function resetLiveGameState(): void {
  inningIndex = 0
}

/** 경기 장면이 이닝을 넘길 때(0xb6b6c) · 미션 시작 이닝(0xaa698) — 웹은 경기 끝 · 나가기 때의 이닝 인덱스(0 부터) */
export function setLiveGameInningIndex(index: number): void {
  inningIndex = index
}

/** 지금 +0x6b — 마지막 경기(모드 불문)의 이닝 인덱스, 앱을 켠 뒤 경기가 없었으면 0 */
export function liveGameInningIndex(): number {
  return inningIndex
}
