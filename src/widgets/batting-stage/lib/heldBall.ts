import type { StagePhaseSnapshot } from '@/widgets/batting-stage/lib/softKeyLabels'

/**
 * **상태 0x12(안 친 공 결과)의 공** — 0x12 그리기 0x4ce9c 가 4ceb8 에서 타석 공 그리기 0x3b2f4 를 그대로 부른다.
 * 0x3b2f4 는 상태가 0x11 이 아니면 3b496 → 3b6ac 로 건너뛰어 **마구 이펙트(0x3b546) 없이 공만** 그린다 (직접 뜸):
 * ```
 * 3b42a  공 화면 점 = 0x35854(장면, 공 틱 [+0x1098])     ; 안에서 0x35820 이 틱을 [0, N − 1] 로 잘라 경로 점을 고른다
 * 3b360  크기 = 0x358fc(장면, 점)                         ; 상태 ≠ 0x13 이면 경로 [N − 1] · [0] 과 견준 깊이 칸
 * 3b6ac  0xbe8d5(공 그림 [+0x234], 크기 + 11 × 종류 [+0x1080], 점 x · y, …)
 * ```
 * 공 틱은 0x12 에서도 장면 틱 0x3f378(3f450)이 +1 하므로 0x35820 이 늘 N − 1 로 잘라 **마지막 점**에 머문다.
 * 종류 [+0x1080] 은 0x12 에서 안 바뀐다(0x3b55e 는 0x11 만, 되돌리기는 0x3d954 · 0x3d720) — 0x11 마지막 값 그대로다.
 * 같은 꼬리의 강속구 불꽃(`fastballFlame`)이 이 자리 위에 얹힌다.
 */

/**
 * 0x12 에 공을 그릴 공 틱 — 웹 공 그리기(`ballPixelAt` · `ballFrameIndexAt`)는 이 값을 N − 1 로 잘라 마지막 점 · 마지막 크기를 고른다.
 * 종류 [+0x1080] 은 0x11 마지막 틱(공 틱 N)의 값이라 N 을 넘긴다.
 * ⚠️ 근사: 웹은 0x11 이 끝난 정확한 공 틱을 들고 있지 않아 N 으로 본다(마구 불꽃 공 전환은 경로 번호 8 부터라 N ≥ 9 면 같다).
 * 웹에서 0x12 는 안 친 공 · 헛스윙의 '결과'(`isInPlay` 거짓)다 — 맞은 공의 '결과'는 인플레이(0x17)라 이 길이 아니다. 0x12 가 아니면 null.
 */
export function heldBallTickOf(phase: StagePhaseSnapshot | undefined, frameCount: number): number | null {
  if (phase?.kind !== '결과' || phase.isInPlay === true) return null
  return frameCount
}
