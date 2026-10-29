/**
 * 타석 키 동작(`StageActions`) — 스윙 · 번트 누름/뗌 · 좌우 이동 · 필살 스윙. 키는 다음 틀의 키 처리 0x498d4(52d9e)가 읽는다
 * (`useStageControls` 가 받은 장면 틱으로 부른다)
 */
import type { MutableRefObject } from 'react'
import { nextBatterShift } from '@/features/play-at-bat/model/batterShift'
import { canSpecialSwing } from '@/entities/batting/model/specialSwing'
import { canSkipHitPause } from '@/widgets/batting-stage/lib/hitPause'
import { acceptsBattingKey, keyTickOf, swingReleaseTickOf } from '@/widgets/batting-stage/lib/swingWindow'
import { buntStanceAfterBuntKey, buntStanceAfterRelease, isBuntStanceSet, sceneBuntKindAfterKey } from '@/widgets/batting-stage/lib/buntStance'
import { ballFrameOf, type StageRefs } from '@/widgets/batting-stage/model/stageRefs'
import type { StageActions } from '@/widgets/batting-stage/model/useStageControls'

/** 동작이 읽고 쓰는 칸 · 이 타자의 필살 표지 */
export interface StageActionDeps {
  readonly refs: Pick<
    StageRefs,
    | 'buntRef'
    | 'hitSkipKeyTickRef'
    | 'latestRef'
    | 'pendingHitRef'
    | 'phaseEntryRef'
    | 'phaseRef'
    | 'phaseStartTickRef'
    | 'pitchRef'
    | 'shiftRef'
    | 'swingRef'
  >
  readonly sceneBuntKindRef: MutableRefObject<number>
  readonly sceneBuntKindOfThisPitch: () => number
  readonly specialSwingNumber: number
  readonly aceBatterIndex: number
  readonly specialSwingRemaining: number | undefined
}

/**
 * 키를 받은 장면 틱 `tick` 에 보이던 공 틱 — 단계 시작 틱과 같은 장면 틱 격자로 센다. 그 틀의 그림은 이미 돌았으므로 키는
 * 다음 틀의 키 처리 0x498d4(52d9e)가 읽는다(`keyTickOf`)
 */
function frameNowOf({ refs }: StageActionDeps, tick: number): number {
  return ballFrameOf(tick - refs.phaseStartTickRef.current, refs.latestRef.current.acePitcher?.order)
}

/** 키가 읽히는 틱 = 경기+0xfd8 — 보이던 공 틱 + 1 (`keyTickOf`) */
function keyTickNowOf(deps: StageActionDeps, tick: number): number {
  return keyTickOf(frameNowOf(deps, tick))
}

/** 스윙·번트는 공이 나는 동안(상태 0x11)만 받는다 — 릴리스 전에는 무시한다 */
function isFlyingAt(deps: StageActionDeps, tick: number): boolean {
  const { refs } = deps
  return refs.phaseRef.current === '투구중' && refs.pitchRef.current !== null && frameNowOf(deps, tick) >= 0
}

/**
 * 0x51db6 · 0x51dee 의 S+4 — 키 틱 F 가 1~N 이고(`acceptsBattingKey`) 이 공에 스윙이 아직 안 나갔을 때만.
 * 스윙이 나가면 0xb915c 가 S+4 를 내리고 +0xe 가 서 있어 0xb933c 가 다시 안 세운다 — 공마다 한 번이다.
 * 같은 그림 안에서 다시 누르면(예약이 아직 안 풀림) 0x51db6 이 같은 틱으로 다시 적는다.
 */
function takesKeyAt(deps: StageActionDeps, tick: number): boolean {
  const { refs } = deps
  const pitch = refs.pitchRef.current
  if (pitch === null || !acceptsBattingKey(frameNowOf(deps, tick), pitch.frameCount)) return false
  const keyTick = keyTickNowOf(deps, tick)
  // 스윙이 나간 틱(F + 1) 뒤면 0xb915c(S, 3)가 S+4 를 내렸다 — 루프가 아직 못 풀었어도 틱으로 본다
  const swing = refs.swingRef.current
  if (swing !== null && (swing.isReleased || keyTick >= swingReleaseTickOf(swing.frame))) return false
  // 번트 자세가 섰으면 0xb915c(S, 4)가 S+4 를 내렸다 — 스윙 · 필살 · 번트 키 모두 무시
  const bunt = refs.buntRef.current
  return bunt === null || !isBuntStanceSet(bunt, keyTick)
}

/** 0x11 이고 스윙 · 번트 키를 받는 때 */
function takesBattingKeyAt(deps: StageActionDeps, tick: number): boolean {
  return isFlyingAt(deps, tick) && takesKeyAt(deps, tick)
}

/**
 * 상태 0x13 은 감상 플래그(+0x199a)가 켜진 큰 타구만 OK(−5)·'5' 로 건너뛴다 (0x406e8 40708~40712).
 * 꺼진 타구(틱 8)는 키를 안 본다. 어느 쪽이든 스윙 키는 이 단계에서 스윙이 아니다
 * 키는 다음 틀의 0x13 갱신 0x406e8 이 [장면+0x40] 으로 읽는다 — 그 틀(키 틱 + 1)에 루프가 넘긴다. 0x13 을 예약한 틀(판정 틱)에
 * 누른 키도 다음 틀(0x13 틱 0)의 갱신이 읽는다. 0x13 이면 참
 */
function applyHitSkipKey({ refs }: StageActionDeps, tick: number): boolean {
  if (refs.phaseRef.current !== '타격' && refs.phaseEntryRef.current?.phase !== '타격') return false
  const pending = refs.pendingHitRef.current
  if (pending !== null && canSkipHitPause(pending.watchesBigHit) && refs.hitSkipKeyTickRef.current === null) {
    refs.hitSkipKeyTickRef.current = tick + 1
  }
  return true
}

/**
 * 스윙 키 — 0x51dce 는 +0xfdc = 0 을 쓴다(번트 자세가 선 뒤에는 S+4 가 0 이라 여기 오지 않는다). 같은 틱에 예약이 아직 안 풀린
 * 번트(자세 전)는 덮는다. 0x51db6: 예약 +0xfe0 = 1 · +0xfd8 = 지금 틱 — 스윙은 다음 갱신(F + 1)에 나가고 F + 2 에 판정한다
 */
function applySwingKey(deps: StageActionDeps, tick: number): void {
  if (applyHitSkipKey(deps, tick) || !takesBattingKeyAt(deps, tick)) return
  deps.sceneBuntKindRef.current = sceneBuntKindAfterKey(deps.sceneBuntKindOfThisPitch(), { kind: '스윙' })
  deps.refs.buntRef.current = null
  deps.refs.swingRef.current = { frame: keyTickNowOf(deps, tick), isSpecial: false, isReleased: false, isUnjudgedWhiff: false }
}

/**
 * 번트 키 '7'/'8'/'9' 누름 (0x535a4 → 메시지 0x6a7 → 0x51e48). 상태 0x11 · S+4 가 아니면 무시하고, 지금 타자가
 * 마선수(0xb633c)면 예약하지 않는다(`buntStanceAfterBuntKey`). 모드 갈림은 없다 — 화면은 `canBunt` 로 키를 연다.
 * 자세는 누르고 있는 동안만이다 — 떼면 `releaseBunt`.
 */
function applyBuntPress(deps: StageActionDeps, kind: number, tick: number): void {
  const { refs } = deps
  if (!takesBattingKeyAt(deps, tick)) return
  const isAceBatter = deps.aceBatterIndex >= 0
  if (isAceBatter) return
  const keyTick = keyTickNowOf(deps, tick)
  if (refs.swingRef.current !== null) {
    // 51e98 — 같은 틱의 스윙 예약(+0xfe0)이 남아 있으면 지우고 +0xfdc = 0: 스윙도 번트도 안 나간다
    refs.swingRef.current = null
    deps.sceneBuntKindRef.current = 0
    return
  }
  // 0x51e84 — 예약이 없으면 +0xfdc = 종류(다음 갱신 0x4e100 이 풀어 자세를 세운다), 같은 틱 예약이 있으면 지우고 0
  const stance = buntStanceAfterBuntKey(refs.buntRef.current, kind, keyTick, isAceBatter)
  deps.sceneBuntKindRef.current =
    stance === null ? 0 : sceneBuntKindAfterKey(deps.sceneBuntKindOfThisPitch(), { kind: '번트', buntKind: kind, isAceBatter })
  refs.buntRef.current = stance
}

/**
 * 번트 키 '7'~'9' 뗌 (+0x1c 비트 9 → 0x5364c → 0x6a8 → 0x51eba) — 자세가 섰으면 풀고 +0xfdc = 0. 풀린 뒤 곧 0xb933c 가
 * S+4 를 다시 세워 그 공에 다시 스윙 · 번트할 수 있다. 상태 0x11 이 아니면 무시한다.
 */
function applyBuntRelease(deps: StageActionDeps, tick: number): void {
  const { refs } = deps
  if (refs.phaseRef.current !== '투구중' || refs.pitchRef.current === null) return
  const stance = refs.buntRef.current
  const released = buntStanceAfterRelease(stance, keyTickNowOf(deps, tick), deps.aceBatterIndex >= 0)
  if (released === stance) return
  refs.buntRef.current = released
  deps.sceneBuntKindRef.current = 0
}

/**
 * 좌우 이동 '4'/'6' (0x53470 → 0x6a4 → 0x50f86) — 0x53470 은 상태 0xf · 0x10 · 0x11 의 키 함수에서만 불린다.
 * 웹 '대기'(0xf + 0x10, 타석이 끝나 쉬는 동안 제외) · '투구중'(0x11)만 받고 0x13 · 결과에서는 무시한다.
 */
function applyBatterMove({ refs }: StageActionDeps, direction: -1 | 1): void {
  const phase = refs.phaseRef.current
  const takesShift = phase === '투구중' || (phase === '대기' && !refs.latestRef.current.isPaused)
  if (!takesShift) return
  refs.shiftRef.current = nextBatterShift(refs.shiftRef.current, direction)
}

/**
 * '0' 은 **그 자리에서 필살 스윙**이다 (0x535a4 → 메시지 0x6a6 → 0x51dee). 일반 스윙(0x6a5 → 0x51db6)과
 * 똑같이 경기+0xfe0 = 1 · +0xfdc(번트) = 0 · +0xfd8 = 지금 틱으로 스윙을 예약하고, S+0x10 에 0 대신
 * 타자 +0x18 을 쓰는 것만 다르다 (0x51e40). 상태 0x11(공이 나는 중)·S+4 가 아니면 무시한다.
 */
function applySpecialSwingKey(deps: StageActionDeps, tick: number): void {
  if (!takesBattingKeyAt(deps, tick)) return
  // 0x51e14: 남은 횟수 0xaea30 이 0 이면 무시 — 번호(+0x18)가 0 이면 늘 0 이다
  if (!canSpecialSwing(deps.specialSwingNumber, deps.aceBatterIndex >= 0, deps.specialSwingRemaining)) return
  // 0x51e2c — 필살 키도 +0xfdc = 0 (번트 자세가 선 뒤에는 S+4 가 0 이라 여기 오지 않는다)
  deps.sceneBuntKindRef.current = sceneBuntKindAfterKey(deps.sceneBuntKindOfThisPitch(), { kind: '필살' })
  deps.refs.buntRef.current = null
  // 0x51dee: 일반 스윙과 같은 예약에 S+0x10 = 타자 +0x18. 남은 횟수 −1 은 예약이 풀리는 틱(0x4e136, `releaseSwing`)
  deps.refs.swingRef.current = { frame: keyTickNowOf(deps, tick), isSpecial: true, isReleased: false, isUnjudgedWhiff: false }
}

export function createStageActions(deps: StageActionDeps): StageActions {
  return {
    // 화면 탭 배치만 본다 — 공이 나는 동안은 판 전체가 스윙(r256, `useStageControls`). 키 '4'/'6' 은 그대로 이동이다
    isBallInFlight: (tick) => isFlyingAt(deps, tick),
    swing: (tick) => applySwingKey(deps, tick),
    pressBunt: (kind, tick) => applyBuntPress(deps, kind, tick),
    releaseBunt: (tick) => applyBuntRelease(deps, tick),
    moveBatter: (direction) => applyBatterMove(deps, direction),
    specialSwing: (tick) => applySpecialSwingKey(deps, tick),
  }
}
