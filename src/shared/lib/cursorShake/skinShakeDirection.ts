import { cursorShakeDirectionOfKey } from '@/shared/lib/cursorShake/cursorShake'
import type { CursorShakeDirection } from '@/shared/lib/cursorShake/cursorShake'

/**
 * **까딱임 방향 칸 [skin+0x8c]** — 앱에 하나 (Q-10, 2026-10-27 직접 떴다).
 *
 * 스킨은 앱 초기화 0x2ed8 이 한 번 만들어(0x53b25 → 0x5390c) 메인 메뉴 [this+0x120] · 나리 · 시즌 장면이 같은 객체를 든다
 * (`skinFrameSlide` 머리말). 0x5390c 의 539f8~539fe 가 [skin+0x8c] = 0(← 방향)으로 두고, 그 뒤로 이 칸을 쓰는 곳은 0x5550c 하나다:
 * ```
 * 5550e  키 −3(←) → 0 · −4(→) → 1 · −1(↑) → 2 · −2(↓) → 3 을 [skin+0x8c] 에 — 그 밖의 키는 안 적는다 (지우는 곳도 없다)
 * ```
 * 그래서 화면을 건너 마지막 화살표가 남는다 — 앱을 켠 뒤 화살표를 한 번도 안 눌렀으면 0(←)이다.
 * 0x5550d 를 부르는 곳(25곳)은 저마다 키 처리기다 — 웹은 메인 메뉴 나무의 다섯 화면에 붙였다:
 * 메인 메뉴 하위 4 · 5 · 9(0x29454 29518 · 0x28cb0 28e58 · 0x28ad4 28b82 — 앞 칸 · 뒤 칸 갈래에서 날 키) ·
 * 스페셜 목록 0x28b9c 28c88(같은 꼴) · 환경설정 0x29550 2958a · 0x288ac 288e4 · 0x2c6d8 2c706(격자가 바꾼 키) ·
 * 기록연감 0x2b7a0 2b85c(본문 초점일 때 격자가 바꾼 키) · 미션 고르기 0x1daa4 1dacc(머리 — 격자가 바꾼 키).
 * ⚠️ 근사(남김): 나머지 부르는 곳 — 팀 고르기(0x8250 · 0x8da4 · 0x14114 · 0x29b38 · 0x29c98) · 시즌(0x83cc · 0xa248) · 일반모드
 * (0x311a8 · 0x2896c) · 마선수 고르기 · 에디트(0x29df8 · 0x2ac00 · 0x2af20 · 0x2b2e0) · 도움말 0x637d0 · 목록 0x62568 · 경기 0x3c158 ·
 * 0x28808 — 는 아직 이 칸에 안 적는다. 그 화면의 마지막 화살표가 메인 메뉴를 숫자키 · 누름으로만 지나 스페셜 숫자키 까딱임까지 남는 길만 다르다.
 * 읽는 곳: 스페셜 설명 판 0x252c6 · 환경설정 0x59462 · 기록연감 · 공용 격자 0x7a571(`gridCursorBounce`).
 */
let direction: CursorShakeDirection = 'left'

/** 지금 [skin+0x8c] */
export function skinShakeDirection(): CursorShakeDirection {
  return direction
}

/** 0x5550c(skin, 키) — 화살표만 적는다. 적었으면 그 방향, 아니면 null */
export function noteSkinShakeKey(key: string): CursorShakeDirection | null {
  const noted = cursorShakeDirectionOfKey(key)
  if (noted !== null) direction = noted
  return noted
}

/** 격자가 숫자키를 방향으로 바꾼 뒤 넘기는 곳(환경설정 · 기록연감 · 미션 고르기) — 방향을 곧장 적는다 */
export function noteSkinShakeDirection(next: CursorShakeDirection): void {
  direction = next
}

/** 시험 — 앱을 새로 켠 것처럼(0x5390c) */
export function resetSkinShakeDirectionForTest(): void {
  direction = 'left'
}
