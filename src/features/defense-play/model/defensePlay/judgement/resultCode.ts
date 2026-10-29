import { requiredBasesOnBounce, requiredBasesOnFlyCatch } from '@/entities/fielding/model/autoAdvance'
import { baseAtPoint } from '@/entities/fielding/model/coverAssignment'
import { isSamePoint } from '@/entities/fielding/model/fieldGeometry'
import { type FielderState, NONE } from '@/entities/fielding/model/fieldingState'
import { type PlayEndState, isFoulEnded, playEndResultCode } from '@/entities/fielding/model/playGate'
import { isAtTarget } from '@/features/defense-play/model/defensePlay/runners/mutableRunner'
import type { TickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import type { DefensePlayState, MutableRunner } from '@/features/defense-play/model/defensePlay/types/defensePlayState'
import { pushPlayLog } from '@/features/defense-play/model/playLog'

/**
 * **이 플레이 틱의 결과 코드** — 포구 틱의 9(b4292) → 6c 의 9(b4412) → 6d 의 판 끝 판정 0x9d5bc → 이번 틱 vt90 아웃이면 13(b4540).
 * 뒤에 선 코드가 앞을 덮는다.
 */
export function resultCodeOfTick(s: DefensePlayState, t: TickFrame): number {
  const arrivedSafe = markHolderArrivedSafe(s, t)
  const contactCode = firstContactResultCode(s, t)
  if (t.outJudgedThisTick) return 13
  if (contactCode !== null) return contactCode
  return arrivedSafe ? 9 : t.catchResultCode
}

/**
 * **6c. 결과 코드 9·13** — 틱 끝의 CPU 송구 결정, **사람 수비·수동 송구에서도 돈다** (직접 뜬 것)
 * ```
 * b43ec: H = 공 가진 야수 ; b = H.vt68()(목표점이 루 b 인가) ≠ −1 이고
 * b4400:   R = 0xa97a0(b) = 아웃 아닌 주자 중 +0x8c(마지막으로 닿은 루) == b 인 첫 주자가 있고
 * b4412:   H.vt18()(목표점에 있음) && H+0x3b(막 닿음) && H+0xe0(쥠) && R.vt18()(주자도 목표점) → 결과 코드 9
 * b4540: 이번 틱 vt90 결과 ≠ 0 → 결과 코드 13 (b4556, 9 를 덮는다)
 * b4562: 코드 ≠ 0 → vt44 · vt54 · 메시지 0xbba(코드) (b457c, 0xbfbac = 곧바로 부른다)
 * 51a56: 화면 0xbba 처리 → 점프표 0xd0488[코드 − 1] → 0x51d40
 * 51d40: 결과 코드 ∈ {9, 13} 이면
 * 51d4e:   0x3403c(수비 조작 객체 +0x10 == 1, CPU) || 0x33fe4(== 0, 사람) 면 통과 — 사람·CPU 모두
 *          (그 밖의 종류 2 조작만 설정+0xf4 를 본다)
 * 51d7a:   0x33c98(경기 상태 ∈ 6·0x17·…) && 아웃 state[6] ≤ 2 이면
 * 51da8:     플레이+0x128 = 1 ; 0xaf8e0(제어기) = vt0xc = 0xafa60 CPU 송구 결정 (한 번)
 * ```
 * 0xafa60 은 공 가진 야수가 준비(vtC4)돼 있어야 던진다 — 포구 틱의 뜬공 아웃은 준비 틱이 남아 안 던진다.
 * 코드 9 는 "공 든 야수가 루에 막 닿았는데 주자가 이미 서 있다(세이프)" — 들고 뛰기(AI 6)·직접 밟기(0xb2a48)로
 * 루에 닿는 틱에만 선다. H+0x3b 는 그림 N 의 목록 틱(앞 판 틱의 6 절 이동)에서 막 닿았나다(`fielderArrivals`).
 * 그 뒤 b444e~b453c 가 **공이 처음 땅에 닿거나 담장선을 넘는 틱**에 결과 코드를 판 끝 판정 0x9d5bc 로 덮고(6d),
 * b4540 이 이번 틱 vt90 결과가 있으면 13 으로 다시 덮는다.
 * 받은 야수가 다시 던지는 병살 송구도 이 길이다 — 다만 송구를 받는 틱의 아웃은 쥐기가 준비 틱을 막 넣어
 * 그 자리 0xafa60 이 못 던지고, 사람 수비·수동 송구에서는 그 뒤 0xafa60 을 부르는 곳이 없어 이어 던지지 않는다.
 * (CPU 송구가 도는 쪽은 4c 절이 준비가 끝난 틱에 던진다.)
 */
function markHolderArrivedSafe(s: DefensePlayState, t: TickFrame): boolean {
  if (t.outJudgedThisTick || s.play.finished || !s.play.held) return false
  const holder = s.fielders[s.play.ballHolderSlot]
  if (holder === undefined) return false
  const holderBase = baseAtPoint(holder.target)
  if (holderBase === NONE) return false
  const standing = runnerStandingOn(s, holderBase)
  if (standing === undefined || !isHolderJustArrivedWithBall(s, holder)) return false
  pushPlayLog(s.log, () => `${t.tick}틱 결과 코드 9 — ${holder.slot}번 야수가 ${holderBase}루에 닿았지만 ${standing.state.index}번 주자가 서 있다`)
  return true
}

/** 0xa97a0(b) — 아웃 아닌 주자 중 +0x8c(마지막으로 닿은 루) == b 인 첫 주자가 목표점에 서 있으면 그 주자 */
function runnerStandingOn(s: DefensePlayState, base: number): MutableRunner | undefined {
  const runner = s.runners.find((candidate) => !candidate.state.isOut && candidate.state.startBase === base)
  return runner !== undefined && isAtTarget(runner.state) ? runner : undefined
}

function isHolderJustArrivedWithBall(s: DefensePlayState, holder: FielderState): boolean {
  return isSamePoint(holder.position, holder.target) && s.fielderArrivals[holder.slot] === true && holder.holdingBall
}

/**
 * **6d. 공이 처음 땅에 닿거나 담장선을 넘는 틱** — 플레이 틱 b444e~b453c (직접 뜬 것)
 * ```
 * b444e  +0x112 ≠ 0 → b4540 (아래를 건너뜀)
 * b445a  +0x114 ≠ 0 && 이번 틱 사건 없음 → b4540     ; +0x114 는 +0x112 와 함께만 서서 실제로는 안 닿는 갈래
 * b446c  공+0x68 == 공+0xaa4(담장선) && 사건 없음 → +0x110(파울) == 0 이면 +0x112 = +0x114 = +0x115 = 1
 * b4492  아니고 공+0x68 == 공+0xaa0(낙구) && 사건 없음 → +0x112 = 1 · +0x113 = 1 · state[0x1e] = 1 · 소리 0x51c
 * b44be  사건(sp+0x24 = 포구 틱의 필살타법 표시 공 0xbc3 · 펌블 0xbc2)이 있고 +0x112 == 0 → state[0x1b] = 1
 * b44d6  (+0x112 || +0x114) && 사건 없음 → 결과 코드 = 0x9d5bc(state)          ; ★ b44f6
 * b44f8  +0x112 || +0x114 || 사건 → +0x12b == 0 이면 (0xb68dc 파울 ? 0xa9620 리터치 : 0xa95e8 포스) ; 0xa95c0(+0x94 = 1)
 * b4540  이번 틱 vt90 결과 ≠ 0 → (state[0x1f] 면 +0x12b = 1) 결과 코드 = 13
 * b4562  코드 ≠ 0 → vt44 = 0xb2bc4(코드) · vt54 = 0xb2c58(코드) · 메시지 0xbba(코드)
 * ```
 * +0x112 를 세우는 곳은 쥐기 0xb2710(b2766) · 담장 b4486 · 낙구 b44a2 셋뿐이고 지우는 곳은 판 시작 0xb0edc 뿐이다.
 * 그래서 0x9d5bc 는 **판에 많아야 한 번** — 아무도 쥐기 전에 공이 떨어지거나 담장선을 넘는 그 틱에만 돈다.
 * (예전 미해결 메모의 "첫 포구 뒤 매 틱 0x9d5bc" 는 b4454 의 `+0x112 ≠ 0 → b4540` 을 놓친 것이었다.)
 * 굴러간 공의 포스(0xa95e8)도 이때 선다 — 웹은 예전에 포구 틱에 세웠다.
 * 사건(sp+0x24 = 펌블 0xbc2 · 필살타법 타구 0xbc3)이 있는 틱은 결과 코드를 안 내고(b44d6) 포스만 세운다(b44f8).
 * 그 공은 틱 끝 0xb3148 이 다시 쏘아 새 궤적의 낙구 틱에 다시 이 절을 지난다.
 * 공+0xaa4 는 **담장(또는 파울 관중석) 위로 넘는** 충돌 첫 틱이다(0x9f7e8 의 +0x29/+0x2a → 0xa2bf0). 높이 ≤ 1999 에서
 * 담장 면에 맞은 공은 공+0xaa8(`wallTick`)로 따로 적혀 state[0x20] 이 안 선다. state[0x20] · [0x80] 은 타구 시작 511ea · 511f4 가
 * 미리 깐 궤적의 aa4 · ab0 를 통째로 옮긴 값이라, 낙구 틱의 0x9d5bc 도 아직 오지 않은 담장 넘김을 본다(원본 그대로).
 */
function firstContactResultCode(s: DefensePlayState, t: TickFrame): number | null {
  if (s.ballContacted) return null
  if (t.ballEventThisTick) {
    // b44f8 — 사건만으로도 +0x12b == 0 이면 포스(0xa95e8, 파울이면 0xa9620) · 0xa95c0. 결과 코드(b44d6)는 없다
    setRequiredBases(s, requiredBasesOnBounce(s.runners.map((runner) => runner.state)))
    return null
  }
  const contact = contactOfTick(s, t)
  if (contact === null) return null
  s.ballContacted = true
  const landedNow = contact === '낙구'
  // b4492 — +0x112 = +0x113 = 1 (낙구 틱에 아무도 안 쥐었다). 슬롯 2 꼬리 52b62 의 함성 60 이 이 칸을 본다
  if (landedNow) t.landedUncaughtThisTick = true
  const endState = playEndStateOfContact(s, landedNow)
  const resultCode = playEndResultCode(endState)
  pushPlayLog(s.log, () => `${t.tick}틱 ${contact} — 판 끝 결과 코드 ${resultCode} (0x9d5bc)`)
  // b4510~b453c: 파울이면 0xa9620(리터치), 아니면 0xa95e8(포스) · 0xa95c0
  const runners = s.runners.map((runner) => runner.state)
  setRequiredBases(s, isFoulEnded(endState) ? requiredBasesOnFlyCatch(runners) : requiredBasesOnBounce(runners))
  return resultCode
}

/** b446c 담장선(파울이 아닐 때) · b4492 낙구 — 이 틱에 공이 처음 닿는가 */
function contactOfTick(s: DefensePlayState, t: TickFrame): '담장선' | '낙구' | null {
  if (t.tick === s.trajectory.fenceTick && !s.foulFlag) return '담장선'
  if (t.tick === s.trajectory.landingTick) return '낙구'
  return null
}

function playEndStateOfContact(s: DefensePlayState, landedNow: boolean): PlayEndState {
  return {
    flyOut: false,
    specialEvent: s.input.specialEvent === true,
    // state[0x1c] — 쏜 공의 파울 각 (511b8)
    foulAngle: s.foulAngle,
    // 스트라이크는 파울 갈래(코드 11)에서만 본다
    strikes: s.input.strikes ?? 0,
    buntKind: s.input.buntKind ?? 0,
    poleTick: s.trajectory.poleTick,
    fenceTick: s.trajectory.fenceTick,
    ballTouched: landedNow,
  }
}

function setRequiredBases(s: DefensePlayState, required: readonly number[]): void {
  s.runners.forEach((runner, index) => {
    runner.state = { ...runner.state, requiredBase: required[index] }
  })
}
