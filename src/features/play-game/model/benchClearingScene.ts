import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'

/**
 * **벤치 클리어링 연출** — 경기 장면 상태 0x1e 의 진입·갱신·키 (R10 6절, 디스어셈 대조 2026-10-05).
 * 판정과 상태 변화(투구 수 +10 · 스태미나 −1000 · S[1])는 `entities/game/model/benchClearing` 이 이미 갖고 있다.
 * 여기는 그 뒤 화면이 도는 동안 쓰는 **전역 난수**와 틱 표다.
 *
 * ## 진입 0x3a5f0 — 공격 쪽 9명을 더그아웃에 흩뿌리고 목표점을 준다 (rand 45 번)
 * 수비 9명(+0x111c..)은 투수판 둘레 고정 자리(표 0xcfa8c+0x60−12k)에 세우기만 한다 — 굴림 없음.
 * 공격 9명(+0x1758.., 0xa0e08 로 새로 만든다)은 i = 8 → 0 마다 (st[9] = 공격 측으로 표 0xcfaf8 의 더그아웃 점):
 * ```
 * 3a780: rand(0, 200)        x = 더그아웃.x − (r + 100)·(8 − i)
 * 3a79c: rand(100, 300)      z = 더그아웃.z − (r + 100)·(8 − i)        → 0xbee84 자리
 * 3a7be: rand(200, 400)      걸음 속도 0xbec7c
 * 측 0:  3a7e8 rand(−1000, 1000) · 3a7f8 rand(−1000, 8000)  목표 = 0xcfa8c+0x30 둘레
 * 측 1:  3a810 rand(−1000, 1000) · 3a820 rand(−1000, 8000)  목표 = 0xcfa8c+0x18 둘레     → 0xa21bc 목표점
 * ```
 * 부르는 함수(0xbee84·0xbec7c·0xa21bc·0xa0e08·선수 vtable 0xd7934 전부)는 rand(0xbfa54·0xbfaa0·0x9d468)를 안 부른다.
 *
 * ## 같은 시드를 쓰는 두 rand — 웹 `RandomPort` 한 줄기로 옮겨도 되는가 (2026-10-05 디스어셈 대조)
 * ```
 * 0xbfa54 rand(a, b):  s = (s·0x343fd + 0x269ec3) >> 1 을 [0x15606d4] 에 **넣고** s mod (b−a) + a   ; a == b 여도 한 걸음 간다
 * 0xbfaa0 rand(0, 2):  0xbfa54(0, 2) 한 번
 * 0x9d468 rand(n):     n ≤ 0 이면 0 (시드 **안 건드림**) · 아니면 s = s·0x343fd + 0x269ec3 (>>1 없이 넣음),
 *                      ((s << 1) >> 17) mod n                                                    ; 비트 16..30
 * ```
 * 셋 다 같은 칸 0x15606d4 를 **부를 때마다 한 걸음** 민다 — 저장 방식(>>1)이 달라 같은 시드에서 내는 수는 다르지만
 * 웹은 원본 LCG 값을 흉내 내지 않고 차례(몇 번째 굴림인가)만 맞추므로, 부를 때마다 `next()` 한 번이면 맞다.
 * 0x9d468(n ≤ 0) 만 굴림이 없다.
 * 연출 함수의 호출 그래프(6단, 상수 풀의 함수 포인터 포함):
 * - 0x3fac4(교대 판 걸음) · 0x3a5f0(진입) · 0x401d4(틱 10) → **0xbfa54 만**.
 * - 0x401d4 → 0xbdae8(화면 전환) → 0x9d468: 종류 8 만 굴린다 — 여기 종류 7 은 안 굴린다.
 * - 0x40628(키, 건너뛰기) → 0x6dee4(입자 지움) → 0x6de30 → 0x6dc08 → 0x6d878: 0x6dc08 이 이미터 +0x28/+0x29 를 0 으로
 *   만든 뒤 부르므로 0x6d878 이 6d898 에서 6d9f2 로 건너뛰어 0x6d89e 의 0x9d468 에 안 닿는다 — **굴림 없음**.
 * - 0x417ac(인트로 그리기) → 0x40ff0 → 0x7725c → "0x7ffe" 는 상수 0x7fff 를 함수로 잘못 본 것 — 굴림 없음.
 * - 0x4f928(0x18 갱신) → 0x22754(이어하기 저장, 모드 1·2·8·9) → 0x69c24·0x69c6c: 파일 열쇠로 시드를 **덮어쓰고**
 *   0x9d468 로 바이트를 섞은 뒤, 0x14005c8 의 값으로 시드를 **다시 심는다** — 저장마다 난수열이 끊긴다.
 *   (2026-10-05 보강) 0x14005c8 은 64비트 밀리초 시계다 — 0x3f554 가 r0·r1 을 경기+0x19d8 에 시작 시각으로 두고
 *   0xbfe1c 가 경과 시간을 빼며, 0x22b7e 는 같은 값을 1000 으로 나눠 저장 시각(+0xd8)에 쓴다. 재시드 값은 그 아래 32비트.
 *   재시드는 `0x22754(obj, 1)` (인자 ≠ 0 → 0x1f140 파일 쓰기 → 0x69eec → 0x69e70 → 0x69c6c·0x69c24)일 때만 돈다.
 *   경기 장면 안에서 인자 1 로 부르는 곳과 모드:
 *   - 0x18 틱 0 (0x4faa8): 모드 마스크 0x306 = **1·2·8·9 만** — 모드 3·4 는 반 이닝마다 끊기지 않는다.
 *   - 상태 9 경기 초기화 0x39fdc 의 모드 3·4 갈래(점프표 0xcfef8 칸 3·4 = 0x3a0e8) 끝 **0x3a34a** — 나만의리그 경기 시작에 한 번.
 *   - 상태 0x19 정산 진입 0x4ea0c 의 **0x4f3c0** — 모드를 가리지 않는 꼬리라 모드 3·4 경기 끝에 한 번.
 *   즉 모드 3·4 는 경기 시작·경기 끝에 시드가 시계로 바뀐다. 웹은 앱이 `Date.now()` 로 한 번 심은 줄기를 쓰고 원본 LCG 값을
 *   흉내 내지 않으므로(차례만 맞춤), 시계로 다시 심는 것은 "새 엔트로피" 일 뿐 관찰할 차이가 없다 — 옮기지 않는다
 *   (옮기면 씨앗 테스트만 비결정이 된다). 경기 안의 굴림 차례는 그대로다.
 * - 입자 이미터(만들기 0x6d56c · 갱신 0x6d878 · 틱 0x6dad0, R5 8절)는 0x9d468 을 쓴다 — 경기 중 입자 연출이
 *   돌면 같은 줄기를 먹지만 웹에 입자 연출이 없어 빠져 있다(미해결).
 *
 * ## 갱신 0x405b0 → 0x401d4 (틱 = 경기+0x2c)
 * | 틱 | 하는 일 |
 * |---|---|
 * | 10 | **수비 8명** 목표 = 투수판 둘레 — rand 8 번 (아래) |
 * | 30 | 수비 선수 동작 번호 (vt 0x44: 1·1·1·4·4·3·2·2·0) |
 * | 60 | 공격 8명(+0x1774..+0x1758) 목표 = 더그아웃 점, 마지막 한 명(+0x1778) 동작 3/4(st[9]) · +0xb8 = 10 |
 * | 70 · 80 | +0x1778 동작 3/4 (st[9] 에 따라) |
 * | 100 | 화면 전환 0xbdae8([0x140007c], 7, 0, 5, 1500) — 종류 7 은 굴리지 않는다(종류 8 만 0x9d468) |
 * | > 100 · 전환 끝 | 소리 멈춤 0x6e418, 다음 = 0xae24c(보통 길) |
 * 틱 10 의 굴림 (401fa~4039a): rand(1000, 2000) · rand(2000, 3000) · rand(1000, 1500) · rand(2500, 3000) ·
 * rand(1000, 1500) · rand(2500, 3000) · rand(0, 2000) · rand(0, 2000) = **8 번**.
 *
 * ## 키 0x40628 — OK(−5)·'5'
 * 소리 멈춤, 입자 지움, 같은 출구 0xae24c — **건너뛴다.** 키는 그 틱의 갱신보다 먼저 돌지만 상태는 다음 틱에
 * 바뀌므로, 틱 10 의 갱신이 한 번이라도 돌았으면 8 번 굴림은 이미 나갔다. 곧 **틱 10 전에 OK 하면 45 번,
 * 그 뒤면 53 번**이다.
 */

/** 공격 쪽 선수 수 — 진입 루프 i = 8..0 */
const OFFENSE_PLAYERS = 9

/** 진입 0x3a5f0 의 굴림 45 번 — 값은 그림(선수 자리·목표)에만 쓰여 버린다 */
export function rollBenchClearingEntry(random: RandomPort): void {
  for (let index = OFFENSE_PLAYERS - 1; index >= 0; index -= 1) {
    randomIntegerBelow(random, 0, 200)
    randomIntegerBelow(random, 100, 300)
    randomIntegerBelow(random, 200, 400)
    // 측 0 · 측 1 갈래가 목표 표 칸만 다르고 굴림 범위·차례는 같다
    randomIntegerBelow(random, -1000, 1000)
    randomIntegerBelow(random, -1000, 8000)
  }
}

/** 틱 10 에 수비 8명 목표를 다시 줄 때의 굴림 8 번 (0x401d4) */
export function rollBenchClearingTargets(random: RandomPort): void {
  randomIntegerBelow(random, 1000, 2000)
  randomIntegerBelow(random, 2000, 3000)
  randomIntegerBelow(random, 1000, 1500)
  randomIntegerBelow(random, 2500, 3000)
  randomIntegerBelow(random, 1000, 1500)
  randomIntegerBelow(random, 2500, 3000)
  randomIntegerBelow(random, 0, 2000)
  randomIntegerBelow(random, 0, 2000)
}

/** 수비 목표 굴림이 나가는 틱 */
export const BENCH_CLEARING_TARGET_TICK = 10
/** 화면 전환이 걸리는 틱 — 그 뒤 전환이 끝나면 나간다 */
export const BENCH_CLEARING_TRANSITION_TICK = 100
/** 0xbdae8 의 마지막 인자 — 전환 길이 1500 (ms 로 보인다, 유력) */
export const BENCH_CLEARING_TRANSITION_MS = 1500
/** 진입 꼬리 0x3aba4 — `0x6e498(음, 0x2c, 0)` (loop 0) */
export const BENCH_CLEARING_SOUND = 44
