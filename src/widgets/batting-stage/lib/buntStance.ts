import type { BuntStance } from '@/widgets/batting-stage/model/stageRefs'

/**
 * **번트 판정 시점** — 상태 0x11 갱신 0x4e060 (확정, 직접 뜸):
 * ```
 * 4e15c  r7 = S+8(번트 자세 = 0xb93a8 이 쓰는 번트 종류) != 0 && 경기+0x1098(지금 틱) == 경기+0x109c(N) − 1
 * 4e18a  판정 끝(+0xfe5)이면 건너뜀
 * 4e192  0xb9270(S) == 0 (스윙 그림 상태 3 · 프레임 1 = 맞힐 프레임) 이거나 r7 이어야 아래로 — 아니면 건너뜀
 * 4e1a6  r4 = |표 0xcfbcc[side].z − 공 경로[min(틱, N−1)].z| ≤ 3000
 * 4e1ec  r7 이면 0xa5fac(경기+0x230)                       ; 기록 칸(번트 수 쪽, P7)
 * 4e1fe  r4 || r7 → 메시지 0x6aa(판정 0x51226) · +0xfe5 = 1 ; 아니면 헛스윙 바람 소리 8/27
 * ```
 * 번트 자세는 그림 상태 4(0xb93a8 → 0xb915c(S,4))라 0xb9270 의 "상태 3" 에 걸리지 않는다 — 곧 번트는 **공이 N−1 틱에
 * 닿는 그 틱에 깊이 조건 없이** 판정된다. 판정의 타이밍 F 는 0x34be0 이 읽는 경기+0xfd8(마지막 키를 누른 틱)이다.
 */
export function isBuntJudgeFrame(frame: number, frameCount: number): boolean {
  return frame >= frameCount - 1
}

/**
 * 번트 자세에서 스윙 키(OK·5 → 0x6a5, '0' → 0x6a6)를 누르면 — 키 처리(0x51db6 · 0x51dee)는 그대로 예약하고
 * 경기+0xfd8 = 지금 틱으로 덮지만, 0x4e060 이 부르는 스윙 시작 0xb9374 가 `S+8 != 0`(번트 자세)이면 아무것도 안 한다.
 * 곧 **스윙은 나가지 않고 번트 판정의 F 만 이 틱으로 바뀐다**.
 */
export function buntStanceAfterSwingKey(stance: BuntStance, frame: number): BuntStance {
  return { kind: stance.kind, frame }
}
