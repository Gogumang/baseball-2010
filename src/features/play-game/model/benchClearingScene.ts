import type { RandomPort } from '@/shared/api/random/randomPort'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'

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
 * - 입자 이미터(만들기 0x6d56c · 갱신 0x6d878 · 틱 0x6dad0, R5 8절)는 0x9d468 을 쓴다 — 벤치 클리어링 **자신은 이미터를 안 만든다**
 *   (r283 직접 뜸: 쏘기 0xbbc84 의 부르는 곳 18곳(0xa45c · 0x2a24c · 0x2b20c · 0x36fb4 · 0x3706e · 0x38bce · 0x38c6a · 0x394b0 ·
 *   0x3b490 · 0x3b5f4 · 0x3b626 · 0x49dd4 · 0x49df6 · 0x4a0c8 · 0x4cd12 · 0x5fc5a · 0x8fa52 · 0x8fa94 — 함수 0xa248 · 0x29df8 · 0x2af20 ·
 *   0x36dfc · 0x38b64 · 0x393b4 · 0x3b2f4 · 0x49aec · 0x49e64 · 0x4cb1c · 0x5fb24 · 0x8fa00)과 그 아래 0x6e054 · 0x6df5c 의 부르는 곳에
 *   0x1e 의 진입 0x3a5f0 · 갱신 0x405b0/0x401d4 · 그리기 0x43228 · 키 0x40628 은 없다). 그 앞 상태(0x11 마구 꼬리 0x3b2f4 따위)가 쏜
 *   이미터는 0x1e 동안에도 프레임 끝 관리자 틱 0x6de85(0x52c50 53048 — 상태를 안 본다)가 굴리고 그린다 — 웹은 경기 장면 부품이
 *   관리자를 쥐지 않은 0x1e 에서 앱 층 `SceneParticleLayer` 가 같은 전역 난수로 그 틱을 돌린다(b2e7c87b · r100 · r105).
 *   건너뛰기 0x40628 의 지우기는 굴림이 없다(위). 그래서 이 연출에 더할 굴림은 없다.
 *
 * ## 갱신 0x405b0 → 0x401d4 (틱 = 경기+0x2c)
 * | 틱 | 하는 일 |
 * |---|---|
 * | 10 | **수비 8명** 목표 = 투수판 둘레 — rand 8 번 (아래) |
 * | 30 | 수비 선수 동작 번호 vt 0x44 — [8] 1 · [7] 1 · [6] 1 · [5] 4 · [4] 4 · [3] 3 · [2] 2 · [1] 2 → 0 · [0] 0 |
 * | 60 | 공격 8명(+0x1774..+0x1758) 목표 = 더그아웃 점, 마지막 한 명(+0x1778) 동작 3/4(st[9]) · +0xb8 = 10 |
 * | 70 · 80 | +0x1778 동작 3/4 (st[9] 에 따라) |
 * | 100 | 화면 전환 0xbdae8([0x140007c], 7, 0, 5, 1500) — 종류 7 은 굴리지 않는다(종류 8 만 0x9d468) |
 * | > 100 · 전환 끝 | 소리 멈춤 0x6e418, 다음 = 0xae24c(보통 길) — 종류 7 은 단계 0 → 32 를 한 그림에 하나씩 그려 **틱 133** 에 끝난다 |
 * 틱 10 의 굴림 (401fa~4039a): rand(1000, 2000) · rand(2000, 3000) · rand(1000, 1500) · rand(2500, 3000) ·
 * rand(1000, 1500) · rand(2500, 3000) · rand(0, 2000) · rand(0, 2000) = **8 번**.
 *
 * ## 키 0x40628 — OK(−5)·'5'
 * 소리 멈춤, 입자 지움, 같은 출구 0xae24c — **건너뛴다.** 키는 그 틱의 갱신보다 먼저 돌지만 상태는 다음 틱에
 * 바뀌므로, 틱 10 의 갱신이 한 번이라도 돌았으면 8 번 굴림은 이미 나갔다. 곧 **틱 10 전에 OK 하면 45 번,
 * 그 뒤면 53 번**이다.
 */

/**
 * ## 사구가 0x1e 에 닿기까지 — 0x12 대기 (A-22, r289)
 * ```
 * 틀 T       0x3dfac 공 도착 — 판정 v = 4(사구) · 밀어내기 판(종류 2)을 열고 0x12 예약
 * 틀 T+1..   0x12 그림 32 장(상태 틱 0~31, 그리기 0x4ce9c) — 틀마다 끝에 관리자 틱 0x6de85(입자 굴림, 경기 난수)
 * 틱 31 갱신 0x4e6d4: 4e72c [+0x2c] ≥ 0x1f → 4e744 st[0xb] == 4 → 4e74c rand(0, 99) ≤ 19 · 돌발 0x8eb95 → 0x1e 예약
 *            (안 들어가면 판정 A 0xae24c — 진루 0x17 · 정산 · 0x21) → 그 틀 끝 관리자 틱
 * 다음 틀    0x1e 진입 0x3a5f0 — 굴림 45 번(`rollBenchClearingEntry`) → 그리기 0x43228(틱 0)
 * ```
 * 웹 진행기는 공 도착 걸음에 사구를 **붙들기만** 하고(단계 `'wait'`), 화면이 0x12 대기를 장면 틱으로 센 뒤 판정(`'entry'` 또는 보통 길)과
 * 진입(`'scene'`)을 한 틀씩 부른다(`pages/defense/model/useHitByPitchWait`). 끼어들 사람이 없는 길(시험 · 자동)은 끝내기
 * (`resolveBenchClearing`)가 남은 단계를 한꺼번에 돈다 — 굴림 차례(판정 → 진입 45 → 틱 10 의 8 → 사구 보통 길)는 같다.
 */
export type HitByPitchHoldPhase =
  /** 0x12 대기 — 아직 판정(4e74c) 앞. 사구 결과 · 밀어내기 판 · 정산이 모두 붙들려 있다 */
  | 'wait'
  /** 틱 31 의 판정이 0x1e 를 예약했다 — 진입 0x3a5f0(굴림 45 번)은 다음 틀 */
  | 'entry'
  /** 진입 굴림 45 번을 냈다 — 연출(0x1e)이 돈다 */
  | 'scene'

/**
 * **0x12 대기 끝까지 붙드는 타석 결과인가** — 볼넷 · 사구 (r295) · 공 도착 판이 안 열린 삼진 (r298).
 *
 * 공 도착 0x3dfac 은 v = 3 · 4 면 판 종류를 2 로 두고(0x3e1b4 `0xb0cb8(플레이, 2)`) 0x12 만 예약한다. 0x12 갱신 0x4e6d4 가
 * 문턱(4e6de~4e6f0 — st[0xb] ∈ {3, 4, 5} 면 0x1f)에 닿은 틀(4e72c)에서 사구면 4e74c 벤치 클리어링 굴림, 그 밖은 판정 A 0xae24c
 * (4e78c — ae344~ae35c: st[0xb] ∈ {3, 4} → 0x17 밀어내기 판)로 간다. 볼넷도 사구와 같은 틀에 판정 A 를 지나므로 진행기는 둘 다
 * 굴림 없이 붙들고(`'wait'`) 화면이 0x12 대기를 센 뒤(`useHitByPitchWait`) 판정을 부른다. 볼넷은 4e744 st[0xb] == 4 가 거짓이라
 * 벤치 클리어링 굴림 없이 판정 A 의 보통 길(밀어내기 판 재생 · 정산)만 돈다(`rollsIntoBenchClearing` 의 `isHitByPitch`).
 *
 * 삼진(st[0xb] = 5)도 같은 문턱 · 같은 틀이다(r298 — 0x3dfac · 0x4e6d4 · 0xae24c 직접 뜸):
 * ```
 * 3e15e  v == 5 — 0xa5e01 · 0xb8ced · 0xaf021(…, 0) · 3e1a6 st[6]++ (아웃은 0x12 진입에서 오른다) — 0x17 예약 없음 → 0x12 대기
 * 4e72c  [+0x2c] ≥ 0x1f → 4e744 st[0xb] ≠ 4 라 굴림 없이 4e78c 판정 A
 * ae33c  st[6] > 2 → 0x18 · ae344 st[0xb] == 5 → 0xd — 둘 다 ae362 정산 0xa8024 · 4e796 칸 채우기 · 4e7ca 돌발 판정
 * ```
 * 그래서 공 도착 판이 안 열린 삼진은 볼넷처럼 붙들고 판정 때 정산한다(굴림 없음 — 정산 · 뒤 자동진행의 굴림이 0x12 32 그림의
 * 관리자 틱 굴림 뒤로 간다). 판이 열린 삼진은 0x12 를 안 기다린다:
 * - 낫아웃 · 삼진 그대로인 폭투·포일(종류 9) — 3e062 판이 서면 3e09a 가 곧장 0x17 을 예약하고 판 끝 판정 B 0xae3e8 이 정산한다
 *   (3e0a2~3e0e0 이 낫아웃이면 v 를 0 으로 지우고 st[0x1a] = 1).
 * - 삼진 + 도루(종류 5) — 3e0e4 도루 칸이 서고 아웃 ≤ 1(3e0f4) 이면 3e114 가 0x17 · 판정 B 가 종류 5 로 한 번 정산. 아웃이 2 면
 *   (3e0fa v == 5) 판이 안 열려 위 보통 삼진 길이다 — 웹 `openPitchArrivalPlay` 도 같은 조건이라 판이 null 로 온다.
 */
export function holdsUntilResultWaitEnd(
  outcome: AtBatOutcome,
  /** 이 공의 0x3dfac 이 연 공 도착 판(밀어내기 종류 2 · 폭투 9 · 도루 5) — 없으면 null */
  arrivalPlay: { readonly kind: number } | null | undefined,
): boolean {
  if (outcome.kind === '사구' || outcome.kind === '볼넷') return true
  return outcome.kind === '삼진' && arrivalPlay == null
}

/**
 * **0x12 대기 동안 HUD 에 그릴 아웃** — 붙든 삼진(`'wait'`)이면 진입 3e1a6 이 이미 올린 st[6] (`min(3, 아웃 + 1)`).
 * 웹 진행기는 삼진을 판정(틱 31)에 정산하므로 그 전 그림은 이 값으로 그린다(r298). 볼넷 · 사구는 0x12 진입이 아웃을 안 건드린다.
 */
export function outsShownDuringResultWait(
  outs: number,
  hold: { readonly phase: HitByPitchHoldPhase; readonly outcome: AtBatOutcome } | null | undefined,
): number {
  return hold != null && hold.phase === 'wait' && hold.outcome.kind === '삼진' ? Math.min(3, outs + 1) : outs
}

/** 공격 쪽 선수 수 — 진입 루프 i = 8..0 */
const OFFENSE_PLAYERS = 9

/** 진입 0x3a5f0 이 공격 쪽 칸 i 하나에 굴린 다섯 — 그림 0x43228 이 이것으로 공격 9명을 세운다 (`widgets/field-walk`) */
export interface BenchClearingEntryRoll {
  /** 3a780 rand(0, 200): x = 더그아웃.x − (r + 100)·(8 − i) */
  readonly scatterX: number
  /** 3a79c rand(100, 300): z = 더그아웃.z − (r + 100)·(8 − i) */
  readonly scatterZ: number
  /** 3a7be rand(200, 400): 걸음 0xbec7c — 곧이어 0xa21bc 가 220 으로 덮는다(원본 그대로) */
  readonly speed: number
  /** rand(−1000, 1000): 목표 x = 표 칸.x + r */
  readonly targetX: number
  /** rand(−1000, 8000): 목표 z = 표 칸.z + r */
  readonly targetZ: number
}

/** 진입 0x3a5f0 의 굴림 45 번 — 값은 그림(선수 자리·목표)에만 쓰인다. 칸 i 의 값이 `[i]` 에 든다(굴림 차례는 i = 8 → 0) */
export function rollBenchClearingEntry(random: RandomPort): readonly BenchClearingEntryRoll[] {
  const rolls: BenchClearingEntryRoll[] = []
  for (let index = OFFENSE_PLAYERS - 1; index >= 0; index -= 1) {
    const scatterX = random.rand(0, 200)
    const scatterZ = random.rand(100, 300)
    const speed = random.rand(200, 400)
    // 측 0 · 측 1 갈래가 목표 표 칸만 다르고 굴림 범위·차례는 같다
    const targetX = random.rand(-1000, 1000)
    const targetZ = random.rand(-1000, 8000)
    rolls[index] = { scatterX, scatterZ, speed, targetX, targetZ }
  }
  return rolls
}

/**
 * 틱 10 에 수비 8명 목표를 다시 줄 때의 굴림 8 번 (0x401d4) — 굴린 차례 그대로 돌려준다
 * (칸 8 x · 칸 6 x · 칸 5 x · 칸 3 z · 칸 2 z · 칸 1 x · 칸 0 x · 칸 0 z — `benchClearingWalk` 가 쓴다)
 */
export function rollBenchClearingTargets(random: RandomPort): readonly number[] {
  return [
    random.rand(1000, 2000),
    random.rand(2000, 3000),
    random.rand(1000, 1500),
    random.rand(2500, 3000),
    random.rand(1000, 1500),
    random.rand(2500, 3000),
    random.rand(0, 2000),
    random.rand(0, 2000),
  ]
}

/** 수비 목표 굴림이 나가는 틱 */
export const BENCH_CLEARING_TARGET_TICK = 10
/**
 * 화면 전환이 걸리는 틱 — 그 뒤 전환이 끝나면 나간다. 전환(종류 7 원 닫기)의 길이 · 그림은 `widgets/field-walk/lib/benchClearingWalk`
 * (`BENCH_CLEARING_EXIT_TICK`). 예전 웹은 0xbdae8 의 마지막 인자 1500 을 ms 로 읽었으나 종류 7 은 그 인자를 안 쓴다(bdb14).
 */
export const BENCH_CLEARING_TRANSITION_TICK = 100
/** 진입 꼬리 0x3aba4 — `0x6e498(음, 0x2c, 0)` (loop 0) */
export const BENCH_CLEARING_SOUND = 44
