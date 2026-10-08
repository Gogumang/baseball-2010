import type { BuntStance } from '@/widgets/batting-stage/model/stageRefs'
import { buntJudgeTickOf, swingReleaseTickOf } from '@/widgets/batting-stage/lib/swingWindow'

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
 * 닿는 그 틱에 깊이 조건 없이** 판정된다. 판정의 타이밍 F 는 0x34be0 이 읽는 경기+0xfd8(번트 키를 누른 틱)이다.
 * 자세는 번트 키 틱의 다음 갱신에 서므로(`buntJudgeTickOf`) N − 1 을 지나 선 자세는 판정되지 않는다.
 */
export function isBuntJudgeFrame(frame: number, frameCount: number, stance: BuntStance): boolean {
  const judgeTick = buntJudgeTickOf(stance.frame, frameCount)
  return judgeTick !== null && frame >= judgeTick
}

/**
 * **번트 자세가 섰나** — 번트 키(틱 F)의 예약은 다음 갱신 0x4e0ce(F + 1)에서 0xb93a8 로 자세를 세우고, 자세를 바꾸는
 * 0xb915c 가 S+4 = 0 으로 내린다. 키 틱 `keyTick` 의 메시지는 그 틱 갱신 뒤에 돌므로 `keyTick ≥ F + 1` 이면 선 뒤다.
 * 선 자세에서는 스윙 · 필살 · 번트 키(0x51db6 · 0x51dee · 0x51e48 — 모두 S+4 를 본다)를 받지 않는다.
 */
export function isBuntStanceSet(stance: BuntStance, keyTick: number): boolean {
  return keyTick >= swingReleaseTickOf(stance.frame)
}

/**
 * **번트 키** '7'/'8'/'9' (0x535a4 → 메시지 0x6a7 종류 2/1/3) 를 받는 0x51e48:
 * ```
 * 51e48  경기 상태 == 0x11 이 아니면 끝
 * 51e50  S(+0xf9c)+4(스윙 받을 준비) == 0 이면 끝
 * 51e66  0xb633c(0xae89c(공격팀)) ≠ 0 — 지금 타자가 마선수(+0xa 비트6)면 끝
 * 51e84  예약(+0xfe0) 있으면 지우고 +0xfdc = 0, 없으면 +0xfe0 = 1 · +0xfdc = 종류 ; 어느 쪽이든 +0xfd8 = 지금 틱
 * ```
 * 모드 갈림은 없다(나만의리그·팀 경기·미션·홈런더비 모두 같다). 앞의 두 조건은 부르는 쪽이 본다 — 자세가 이미 섰으면
 * S+4 가 0 이라 여기 오지 않는다(`isBuntStanceSet`). 그래서 **누를 때마다 켜고 끄는 토글이 아니다** — 취소는 키를 뗄 때다
 * (`buntStanceAfterRelease`). 예약이 아직 안 풀린 같은 틱에 번트 키를 또 누르면 예약이 지워진다(51e98, 자세 없음).
 */
export function buntStanceAfterBuntKey(
  stance: BuntStance | null,
  kind: number,
  keyTick: number,
  isAceBatter: boolean,
): BuntStance | null {
  if (isAceBatter) return stance
  if (stance === null) return { kind, frame: keyTick }
  return isBuntStanceSet(stance, keyTick) ? stance : null
}

/**
 * **번트 키를 뗀다** — 키 사건 +0x1c 비트 9(뗌, 0xbca04)면 0x53670 이 0x5364c 로 '7'~'9' 를 0x6a8 로 보내고 0x51eba 가 받는다:
 * ```
 * 51eb2  경기 상태 == 0x11
 * 51ebe  +0xfdc ≠ 0 이고 S+4 == 0 (자세가 섰다) 이고 지금 타자가 마선수가 아님(0xb633c)
 * 51ef2  +0xfe0 = 0 · +0xfdc = 0 · +0xfd8 = 지금 틱 · S+0x10 = 0 · 0xb93a8(S, 0) 자세 풀기 · S+0xe = 0 · 0xb933c 다시 준비
 * ```
 * 곧 번트는 **누르고 있는 동안만** 자세다. 자세가 서기 전(누른 그 틱)에 떼면 S+4 가 아직 1 이라 못 풀고 자세가 남는다(원본 그대로).
 * 어느 '7'~'9' 를 떼도 같다. 풀리면 null, 아니면 그대로.
 */
export function buntStanceAfterRelease(stance: BuntStance | null, keyTick: number, isAceBatter: boolean): BuntStance | null {
  if (stance === null || isAceBatter) return stance
  return isBuntStanceSet(stance, keyTick) ? null : stance
}

/** 장면 +0xfdc 를 쓰는 사람 키 (상태 0x11 · S+4 — 부르는 쪽 `isFlying` 이 본다) */
export type SceneBuntKey =
  | { readonly kind: '스윙' }
  | { readonly kind: '필살' }
  | { readonly kind: '번트'; readonly buntKind: number; readonly isAceBatter: boolean }

/**
 * **사람 키가 쓰는 장면 +0xfdc** (직접 뜸 — `BattingStage` 의 `sceneBuntKind` 주석):
 * 스윙 0x51dce · 필살 0x51e2c 는 0, 번트 0x51e84 는 마선수가 아니면 종류(마선수면 키 자체를 무시 — 그대로).
 * 키가 없는 공은 0 이다 — 키는 모두 상태 0x11 안이고 그 진입 0x3de10(3deb8 0x340dc)이 공마다 +0xfdc 를 memset 한다(`BattingStage`).
 * 예약이 안 풀린 같은 틱에 번트 키를 또 누르거나(51e98) 자세를 풀면(51ef8) 0 이다 — 부르는 쪽(`BattingStage`)이 0 으로 둔다.
 */
export function sceneBuntKindAfterKey(previous: number, key: SceneBuntKey): number {
  if (key.kind !== '번트') return 0
  return key.isAceBatter ? previous : key.buntKind
}

/** 장면 +0xfdc 와 그 칸을 마지막으로 지운 공 (`sceneBuntKindOnPitch`) */
export interface SceneBuntMemory<P> {
  readonly pitch: P | null
  readonly kind: number
}

/**
 * **공마다 +0xfdc 를 지운다** — 상태 0x11 진입 0x3de10 의 3deb8 `0x340dc` = `memset(장면+0xfd8, 0, 12)`(memset 0x1400428)가
 * +0xfd8 · +0xfdc · +0xfe0 을 0 으로 둔다. 갈래가 없어 사람 · CPU 타석 모두 공마다다. 그래서 키(모두 0x11 안)를 안 누른 공은 0 이다.
 * 새 공(`pitch` 가 지난번과 다른 공)이면 0 으로 지우고 그 공을 기억한다. 공이 없으면(견제 0x34848 → 0x10 — 0x11 을 안 지난다) 그대로다.
 */
export function sceneBuntKindOnPitch<P>(memory: SceneBuntMemory<P>, pitch: P | null): SceneBuntMemory<P> {
  if (pitch === null || pitch === memory.pitch) return memory
  return { pitch, kind: 0 }
}
