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

/**
 * **번트 키** '7'/'8'/'9' (0x535a4 → 메시지 0x6a7 종류 2/1/3) 를 받는 0x51e48:
 * ```
 * 51e48  경기 상태 == 0x11 이 아니면 끝
 * 51e50  S(+0xf9c)+4(스윙 받을 준비) == 0 이면 끝
 * 51e66  0xb633c(0xae89c(공격팀)) ≠ 0 — 지금 타자가 마선수(+0xa 비트6)면 끝
 * 51e84  예약(+0xfe0) 있으면 지우고, 없으면 +0xfe0 = 1 · +0xfdc = 종류 ; 어느 쪽이든 +0xfd8 = 지금 틱
 * ```
 * 모드 갈림은 없다(나만의리그·팀 경기·미션·홈런더비 모두 같다). 앞의 두 조건은 부르는 쪽(`isFlying`)이 본다.
 */
export function buntStanceAfterBuntKey(
  stance: BuntStance | null,
  kind: number,
  frame: number,
  isAceBatter: boolean,
): BuntStance | null {
  if (isAceBatter) return stance
  return stance === null ? { kind, frame } : null
}
