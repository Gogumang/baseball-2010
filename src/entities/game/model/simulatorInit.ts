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
 * ⚠️ 굴린 값 `sim+4` 의 쓰임은 안 읽었다 — 웹은 굴림 차례만 맞춘다.
 */
export function rollSimulatorInit(random: RandomPort): void {
  random.nextInRange(0, 2)
}
