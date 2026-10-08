import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * **간이 시뮬레이터 초기화 `0xc0dac`** 가 쓰는 굴림 하나 — `c0df6 0xbfa54(0, 2)` = rand(0, 2) → `sim+4`.
 *
 * ```
 * 0xc0dac(sim, state, …):
 *   c0dc2  memset(sim+0x58, 0, 8)
 *   c0dca~c0dfa  sim+0x60..+0x8c = 인자들 (state · 팀 · 주자관리 …)
 *   c0df6  sim+4 = rand(0, 2)                 ; ← 조건 없이 한 번
 *   c0e06  sim+0x94 = 0 · sim+0x98 = −1 · sim[0] = 0 · sim[1] = 인자
 *   c0e20  state[1] == 2(시즌) 이면 sim+0x90 = 0x1f55c(전역)   ; 굴림 아님
 *   c0e38  sim+0x9c = 0 · sim+0x9d = 0 · sim+0xa8 = sim+0xa4 = −1
 * ```
 * 부르는 곳(사람 경기 장면): 상태 9 갱신 `0x3f584` 의 `0x3fa0e`(**경기 시작** — 모드 점프 뒤 공통 꼬리라 모든 모드),
 * 경기 중 메뉴 자동진행 `0x3c93c`. CPU 경기 `0xc2760`·`0xc2a48`·`0xc2dac` 도 부른다.
 *
 * **`sim+4` 를 읽는 곳은 없다** — 굴림은 난수 차례만 하나 먹고 값은 버려진다(쓰기만 하는 칸). 웹도 굴림 차례만 맞춘다.
 * 찾아본 곳 (2026-10-06):
 * - 시뮬 함수 전부(0xc0dac~0xc2760)와 CPU 경기 세 곳(0xc2760·0xc2a48·0xc2dac, 시뮬 포인터 r6/r7)의 `+4` 접근 —
 *   `[sp, #4]`·state(`sim+0x60`)[4] 바이트(0xc1654·0xc170e·0xc174a·0xc18cc)·vtable 해제 `[[r0], #4]` 뿐이다.
 *   `c0e14 str r0, [r7, #4]` 가 유일한 쓰기다.
 * - 시뮬 함수가 부르는 바깥 함수 81곳의 머리(첫 인자와 그 사본의 `[+4]` 읽기) — 걸린 0xaaa6c 는 미션 객체를 받는다.
 * - 경기 장면이 시뮬 포인터(`장면+0x1780`, 0xbc << 5)를 꺼내는 18곳 — 꺼낸 포인터로 `+4` 를 읽지 않는다.
 *   (`장면+0x1784` 리터럴 8곳은 시뮬이 아니라 장면 자신의 바이트 칸이다 — 0x21 진입 0x3abf0 이 1 을 쓴다.)
 */
export function rollSimulatorInit(random: RandomPort): void {
  random.rand(0, 2)
}
