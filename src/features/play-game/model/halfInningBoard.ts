import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * **공수 교대 판** — 경기 장면 상태 0x18 의 교대 가지 (진입 0x3ac90 · 갱신 0x4f928 · 그리기 0x4fe9c, R10 5절).
 *
 * ## 판이 서서 OK 를 기다리는 때 (0x4f928 틱 0, 4fab6~4fb1e)
 * ```
 * 경기 끝(0xb68fc)이면 결과 판 가지 — 여기 아님
 * 4fab6: 이전 상태(경기+0x28) == 0x21(자동진행 중계)  → +0x1784 = 1
 * 4facc: 0xc2198(sim, 1) 참(다음 장면도 자동)          → +0x1784 = 1, 상태 0x21   ; 판 없이 중계로
 * 4fb08: 아니고 +0x1784 == 1                            → 메시지 1 을 스스로 → 0xd  ; 판 없이 다음 타석
 * 그 밖                                                 → 사람이 OK 를 누를 때까지 판이 선다
 * 4fb20: 0x3fac4(경기)                                  ; 모드 ≠ 0 · +0x1784 == 0 · 경기 중일 때만 몸통이 돈다
 * ```
 * 곧 **판이 서는 것은 앞 장면이 사람 장면이었고(0x21 이 아님) 다음 장면도 사람이 잡을 때**뿐이고,
 * 그때만 0x3fac4 가 난수를 쓰고 징글 13 이 난다(0x4f7ac 도 +0x1784 == 0 일 때만, 틱 2).
 * 1회초 판도 같은 상태다 — 인트로 0xc 의 끝(0x39e3c)이 0x18 로 보낸다(아래 `introSkipsFirstBoard`).
 *
 * ## 난수 — 0x3fac4 (틱 0, 야수·주자가 제자리로 가는 걸음)
 * i = 8 → 0 (아홉 번) 마다 전역 rand(0xbfa54) 넷:
 * ```
 * 3fbfa: 공격 쪽 선수 걸음 속도  i ≤ 5 ? rand(160, 240) : rand(300, 400)
 * 3fc2c: rand(0, 200)             ; 수비수 시작점 x 흩뿌림  (−(r+100)·(8−i))
 * 3fc46: rand(100, 300)           ; 수비수 시작점 z 흩뿌림
 * 3fc8c: 수비수 걸음 속도         i ≤ 5 ? rand(160, 240) : rand(300, 400)
 * ```
 * 합 **36** 굴림. 같은 판의 다른 함수(0x3ac90·0x4f928·0x4f7ac·0x4fe9c)는 굴리지 않는다(호출 그래프 6단 확인).
 *
 * ## 화면 (그리기 0x4fe9c)
 * 틱 ≤ 69 는 0x4fb8c 운동장 전경(야수 0x43010 두 번 — 위 걸음), 틱 ≥ 70 은 점수판 틀 0x41440(경기, 0, 0, 0, 0, 0) 과
 * 두 팀 판 0x42364 · 0x420dc(현재 투수 이름 카드 — 0xae83c(팀[st[0xa]]) → 0xb62c0) 를 (W/2 − 판폭/2, H/2 − 2) ·
 * (W/2 + 판폭/2 − 76, H/2 − 2) 에, 초(st[9] = 0)면 왼쪽이 0x42364 · 말이면 0x420dc.
 * - 점수판 틀 0x41440 은 확정·적용 — `widgets/scoreboard-frame`(0x4ff12, 경기 끝 판이면 y 3), 판은 `widgets/game-scene/ui/HalfInningBoard`.
 * - 두 팀 판 0x42364("DUE UP") · 0x420dc("PITCHER") 도 확정·적용 — 판폭 212(game_ui 프레임 19 상자 4)라 (14, 158) · (150, 158),
 *   `widgets/game-scene/lib/halfInningCardsLayout`.
 * - ⚠️ 미해결 — 운동장 전경 0x4fb8c (틱과 상관없이 늘 바탕, 틱 ≤ 69 는 이것만).
 */

/** 0x3fac4 루프 — i = 8..0 */
const FIELDER_COUNT = 9
/** `cmp i, #5 ; bgt` — 타순 뒤쪽(i ≤ 5)은 느린 걸음 */
const SLOW_STEP_LAST_INDEX = 5

/** 공수 교대 판 틱 0 의 야수 걸음 굴림 36 개 (0x3fac4) — 값은 그림에만 쓰여 버린다 */
export function rollHalfInningFielders(random: RandomPort): void {
  for (let index = FIELDER_COUNT - 1; index >= 0; index -= 1) {
    const slow = index <= SLOW_STEP_LAST_INDEX
    random.rand(slow ? 160 : 300, slow ? 240 : 400)
    random.rand(0, 200)
    random.rand(100, 300)
    random.rand(slow ? 160 : 300, slow ? 240 : 400)
  }
}

/** 판이 OK 를 기다리는 동안 내는 징글 13 의 틱 — 0x4f7ac `틱 == 2` */
export const HALF_INNING_JINGLE_TICK = 2
/** 이 틱부터 운동장 대신 점수판·두 팀 판을 그린다 (0x4ff00 `cmp 틱, #0x45 ; bgt`) */
export const HALF_INNING_SCOREBOARD_TICK = 70

/**
 * 인트로(0xc) 끝 `0x39e3c` 의 갈림 — **모드 1 이고 경기진행 설정이 종류 1(이닝)·값 0(전체)** 이면
 * 1회초 판(0x18)을 건너뛰고 곧장 0xd 로 간다. 그 밖은 0x18.
 * (설정 칸 기록+0x12c · +0x146 — R10 3절, 칸의 뜻은 J-3 과 같은 자리로 본다.)
 */
export function introSkipsFirstBoard(mode: number, settings: { readonly kind: number; readonly value: number }): boolean {
  return mode === 1 && settings.kind === 1 && settings.value === 0
}
