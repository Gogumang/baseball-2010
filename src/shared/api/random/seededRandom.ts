/*
 * **원본 난수 생성기 — 옮김 (re.py 로 직접 뜸, 2026-10-08)**
 *
 * ## 생성기 (씨앗 칸 하나 [0x15606d4] 를 둘이 함께 굴린다)
 * ```
 * bfa54  rand(lo, hi):  s = ((s * 0x343fd + 0x269ec3) mod 2^32) >>> 1   ; 밀린 값이 씨앗에 남는다 (bfa60~bfa68)
 *                       lo == hi → lo                                   ; 그래도 씨앗은 한 걸음 간다
 *                       lo <  hi → lo + s mod (hi − lo)                 ; bfa78 subs r1, r5(hi), r4(lo) — 위끝 제외
 *                       lo >  hi → hi + s mod (lo − hi)                 ; bfa82 — 거꾸로 줘도 [hi, lo)
 * 9d468  rand(n):       n ≤ 0 (부호 있는 bgt) → 0, **씨앗 그대로**
 *                       s = (s * 0x343fd + 0x269ec3) mod 2^32             ; 밀지 않고 넣는다 (9d47a~9d480)
 *                       ((s << 1) >>> 17) mod n                          ; = (s >>> 16) & 0x7fff, 0 ~ n−1
 * bfaa0  rand(0, 2) 를 부르는 껍데기 (동전)
 * ```
 * 나머지 0xca848(veneer 0xca9f8 의 bx r3 로 부른다)은 **부호 없는** 나머지다 — 비교가 모두 bhs/blo 이고, 피제수 < 제수면 피제수를
 * 그대로 돌려준다(ca84e~ca852). 0 으로 나누기(ca902)는 두 함수 모두 닿지 않는다(lo == hi · n ≤ 0 를 먼저 거른다).
 * bfa54 의 피제수는 밀린 값이라 늘 0 ~ 2^31−1 이고, 제수 |hi − lo| 는 32비트 뺄셈을 부호 없이 본 값이다. 결과는 32비트 덧셈.
 * 부르는 곳: bfa54 는 리터럴 0xbfa55 를 읽는 곳 92 · bfaa0 은 5 함수 · 9d468 은 입자(0x6d56c · 0x6d878 · 0x6dad0) · 화면 효과
 * 0xbdae8(방향 5 의 rand(3)) · 그림 처리 0x98498 · 0x98510 · 0x9b1cc · 0x9d218 · 파일 암호화 0x69c24 · 0x69c6c.
 *
 * ## 씨앗을 세우는 곳 (전수 — [0x15606d4] 쓰기 xval: 0x2ed8 · 0x69c24 · 0x69c6c · 0xbfa54 · 0x9d468)
 * 1. 부팅 0x2ed8(2ef8~2f02): s = 0x14005c8() — 웹은 `bootSeed()` = Date.now() 아래 32비트(App 이 한 번 만든다).
 * 2. **파일 암호화 0x69c24**: s = 파일 키(객체 +8) → 바이트마다 0x9d468(16) 으로 표 0xd2d74 를 xor → 끝에서 **s = 0x14005c8()**.
 *    검사합 0x69c6c 도 같다: s = 키 → 0x9d468(0xffffff) 한 번 → 바이트마다 섞기 → 끝에서 **s = 0x14005c8()**.
 * 3. 그 둘을 부르는 곳은 쓰기 0x69e70(0x69c6c → 0x69c24)과 읽기 0x69ccc(머리 판본이 맞으면 0x69c24, 검사합 칸이 켜졌으면 0x69c6c) 뿐이다.
 *    - **쓰기**: 0x69e70 ← 0x69eec(리터럴, 0x69b58 이 열리면) ← 0x1f140(파일 쓰기) ← 넷 — 0x1f1b8(game_o.sav 전역기록, 부르는 곳 82) ·
 *      0x1f1e0(game_rg.sav, 31) · 0x211fc(모드 파일 표 0x1400094[m], 3) · 0x22754(모드 파일 — 이어하기 자동 저장 0x18 틱 0 의
 *      모드 1 · 2 · 8 · 9 갈래 포함, 67). 상태 7 갱신 3ea02 의 0xc0e60 → 0x1f1b8 도 이 길이다.
 *    - **읽기**: 0x69ccc ← 0x69e20 ← 리터럴 여섯 — 0x1f0ec(game_o.sav, 부팅 0x20138) · 0x208f0 · 0x20ac4 · 0x20d44 · 0x20fc0 ·
 *      0x212a8(모드 적재 0x213c0 의 game_nr/s/pr/br/vs/vsev.sav).
 *    → 원본은 **파일을 쓸 때마다, 그리고 맞는 파일을 읽을 때마다 씨앗이 시계로 다시 선다**(한 저장 안에서 두 번 — 마지막 값이 남는다).
 *    쓰는 동안 굴린 값(xor 키 · 검사합)은 경기 난수가 아니다 — 끝의 다시 세우기가 덮는다.
 * 4. 0x14005c8 = .data 의 플랫폼 호출 스텁(`str lr, [sp, #−4]!` · bl 디스패처 · 서비스 0x1fb · 함수 번호 **0x7d**). 64비트 **밀리초 시계**다:
 *    미션 제한 시간 0xaada4(aae02~aae1e)가 이 값과 [st+0xac] 의 64비트 차가 1000 을 넘으면 남은 초를 하나 줄이고, 0x1f1e0 · 0x211fc 머리는
 *    값 / 1000(0xcaa99)을 적는다. 씨앗은 그 아래 32비트다. ⚠️ 유력: 단말 시각(WIPI MC_knlCurrentTime 꼴)인지 켠 뒤 흐른 틱인지는 스텁 번호만으로
 *    못 가렸다 — 어느 쪽이든 사람이 고를 수 없는 값이다.
 *
 * ## 사용자 결정 (2026-10-08) — 생성기만 옮긴다
 * **저장 · 읽기 때 씨앗을 시계로 다시 세우는 것(0x69c24 · 0x69c6c 끝의 0x14005c8)은 옮기지 않는다.** 웹은 부팅 씨앗 하나에서
 * 끝까지 이어 굴린다. 까닭: 씨앗 고정 시험 · 리플레이의 **재현성**을 지키기 위해서다 — 저장마다 시계로 다시 세우면 같은 씨앗이 같은
 * 경기를 내지 않는다. 한 굴림의 분포는 다시 세우기와 무관하게 같다("알 수 없는 새 상태" 뒤 한 값의 분포는 이어 굴린 값과 같다).
 * 남는 차이(⚠️ 알려진 차이): 원본 bfa54 의 `>>> 1` 은 상태 공간을 2^31 로 줄이고 주기를 깬다 — 씨앗 4000 개를 뽑아 셌더니 평균
 * 약 23000 걸음 꼬리 뒤 길이 **63601 · 90400 · 3677 · 1752 · 1681 · 923 · 358** 의 고리로 빨려 든다(약 7% 가 4000 이하의 짧은
 * 고리). 원본은 저장(= 시계 다시 세우기)이 그 고리를 끊지만, 웹은 저장해도 끊지 않으므로 저장 없이 오래 이어 간 원본과 같은
 * 되풀이가 저장을 거친 뒤에도 이어진다.
 */
import type { RandomPort } from '@/shared/api/random/randomPort'

const MULTIPLIER = 0x343fd
const INCREMENT = 0x269ec3

/** 원본 LCG 한 걸음 — 32비트 곱셈 넘침 그대로 (`muls` · `adds`) */
function step(state: number): number {
  return (Math.imul(state, MULTIPLIER) + INCREMENT) >>> 0
}

/**
 * **원본 난수 생성기** — 씨앗 칸 [0x15606d4] 하나를 `0xbfa54 rand(lo, hi)` 와 `0x9d468 rand(n)` 이 함께 굴린다.
 * 산술 · 확정 근거는 이 파일 머리 주석. 같은 씨앗은 원본과 같은 수열을 낸다.
 *
 * 인자는 원본 레지스터처럼 32비트 정수로 자른다(`| 0`).
 */
export function createSeededRandom(seed: number): RandomPort {
  let state = seed >>> 0

  return {
    rand(lo: number, hi: number): number {
      // bfa60~bfa68: s = (s * 0x343fd + 0x269ec3) >>> 1 — 밀린 값을 그대로 씨앗에 넣는다
      state = step(state) >>> 1
      const low = lo | 0
      const high = hi | 0
      if (low === high) return low
      // bfa74: lo > hi 면 hi + s mod (lo − hi), 아니면 lo + s mod (hi − lo) — 0xca848 은 부호 없는 나머지
      return low > high
        ? (high + (state % ((low - high) >>> 0))) | 0
        : (low + (state % ((high - low) >>> 0))) | 0
    },
    rand9d(n: number): number {
      const limit = n | 0
      // 9d46a: n ≤ 0(부호 있는 비교) 이면 씨앗을 건드리지 않고 0
      if (limit <= 0) return 0
      state = step(state)
      // 9d482~9d48a: ((s << 1) >>> 17) mod n — 0 ~ 0x7fff 를 부호 없이 나눈다
      return ((state << 1) >>> 17) % limit
    },
  }
}

/** 부팅 씨앗 — 원본 0x2ed8 은 밀리초 시계 0x14005c8 의 아래 32비트를 넣는다 */
export function bootSeed(): number {
  return Date.now() >>> 0
}
