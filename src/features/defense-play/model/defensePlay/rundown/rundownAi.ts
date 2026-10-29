import { baseAtPoint } from '@/entities/fielding/model/coverAssignment'
import { type WorldPoint, basePosition, isSamePoint } from '@/entities/fielding/model/fieldGeometry'
import { acceptsTargetVt14, withPoseCleared } from '@/entities/fielding/model/fielderPose'
import { type FielderState, NONE } from '@/entities/fielding/model/fieldingState'
import { NO_RUNDOWN, type RundownAction, endRundown, rundownAction } from '@/entities/fielding/model/rundown'
import { groundPointOf } from '@/features/defense-play/model/defensePlay/ball/ballPoint'
import { contextAt } from '@/features/defense-play/model/defensePlay/step/defenseContext'
import type { TickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import { rollThrowBall } from '@/features/defense-play/model/defensePlay/throw/throwBall'
import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'
import { pushPlayLog } from '@/features/defense-play/model/playLog'

/**
 * **AI 8 = 0xb48b6 — 협살 야수 한 칸** (플레이 vt4c 야수 고리의 분기표 0xd8808[8], 직접 뜬 것, r313):
 * ```
 * b48b6  s = (s8)P+0x1ec == 칸 ? 0 : 1 ; 짝 = (s8)P+0x1ec[1 − s]          ; 기록칸 그대로
 * b48f0  0xb3a04(지역 8바이트, P) — 계획을 **지금 상태로 다시 셈**(기록칸 P+0x1ec 는 안 건드린다)
 * b48f6  0xb398c() == −1 이거나 지역 [0] · [1] 어느 쪽도 이 칸이 아니면 0xb26b8 협살 종료(b4912) → 다음 칸
 * b4940  R = 0xa9564(P+0x1f0) — 기록칸의 주자 그대로(아웃인지 안 본다)
 * b496e  이 칸 == +0x130(공 가진 야수):
 *   b49dc  +0xe0 == 0 → 포구 점의 (x, 0, z) 로 0xa100c(= vt14) (b4b50)
 *   b4a30  커버[R+0x7c] == 칸 || R.vt1c(짝 위치) > vtb4(짝) + 5 → vt4c(R) = vt14(R 위치) (b4a96)
 *   b4a3a  아니고 +0x12c(쥠) 면 플레이.vt5c(짝, 0) = 0xb2e38 보통 송구 (b4a4a) — 아니면 아무것도 안 한다
 * b4a58  아니면 r = R.vt1c(내 위치) ; r0 = 짝.vtb4(나) ;
 *        r > r0 + 4 → vt4c(R) ; r > r0 → vt10 0xa124c ; 아니면 vt48(P+0x1ee[s] 루) = vt14(루 좌표)
 * ```
 * vt4c 0xa0a5c · vt48 0xa0a18 · 0xa100c 는 모두 vt14 0xa14c8 로 목표만 적는다 — 관문(잠금 +0xb4 ≤ 0 · vtc8)이 막으면 목표는
 * 그대로이고, 걸음은 다른 AI 처럼 다음 목록 틱(6 절 `moveFielder` — 야수 틱 a1376)이 한다. 태그 아웃은 이 함수가 아니라 아웃 판정
 * 0xb36d0(6b 절 · 쥐기 b2758)이 낸다(결과 3 → 0xb3946 이 협살을 끝낸다).
 * (예전 웹은 2b 절에서 두 야수를 back · front 차례로 돌리며 자리를 곧바로 한 걸음 옮기고(관문 없이), 그 자리에서 태그를 따로
 * 보고, 쫓던 주자가 아웃이면 협살을 풀었다 — r313 에서 걷었다)
 */
export function rollRundownAi(s: DefensePlayState, t: TickFrame, slot: number): void {
  const action = rundownAction({ ...contextAt(s, t.tick), plan: s.rundown, slot, ballTarget: s.catchPoint })
  if (action.kind === '협살해제') {
    // 0xb26b8 — 기록칸을 지우고 상태 8 인 야수를 전부 상태 0 으로. 날아가던 짝 송구는 보통 송구 공이라 그대로 날아가 예보가 고른 야수가 받는다
    s.fielders = endRundown(s.fielders)
    s.rundown = NO_RUNDOWN
    pushPlayLog(s.log, () => `${t.tick}틱 협살 종료 — ${slot}번 야수의 협살 AI 가 풀었다 (b4912)`)
    return
  }
  const self = s.fielders[slot]
  if (self === undefined) return
  if (action.kind === '짝에게송구') {
    rollPartnerThrow(s, t, slot, action.toSlot)
    return
  }
  if (action.kind === '대기') {
    waitInRundown(s, slot)
    return
  }
  const target = rundownTargetOf(s, action)
  if (target !== null) retargetThroughGate(s, slot, self, target)
}

/**
 * 목표만 바꾸는 갈래의 목표점 — 주자추적: vt4c 0xa0a5c(주자의 지금 위치 +0x20 그대로) · 공쫓기: 포구 점의 (x, 0, z) ·
 * 루로: vt48 0xa0a18(표 0xd78f0[루 % 4] 좌표)
 */
function rundownTargetOf(s: DefensePlayState, action: Extract<RundownAction, { kind: '주자추적' | '공쫓기' | '루로' }>): WorldPoint | null {
  if (action.kind === '주자추적') return s.runners[action.runnerIndex]?.state.position ?? null
  if (action.kind === '공쫓기') return groundPointOf(action.target)
  return basePosition(action.base)
}

/** vt14 0xa14c8 — 관문이 열려 있을 때만 목표를 받는다 */
function retargetThroughGate(s: DefensePlayState, slot: number, self: FielderState, to: WorldPoint): void {
  if (!acceptsTargetVt14(self) || isSamePoint(self.target, to)) return
  s.fielders = s.fielders.map((fielder) => (fielder.slot === slot ? { ...fielder, target: to } : fielder))
}

/**
 * b4a4a 플레이.vt5c(짝, 0) = **0xb2e38 보통 송구** (A-34, r312) — 준비(vtC4) · 계획 0xb3444 · 미루기(AI 9) ·
 * 0xa1620 악송구 · 흔들림 굴림 · 세계 공 · 예보 vt24(0) · 고르기 vt34(받을 야수 AI 1 · +0x130) · 커버 vt30 이 모두 같다.
 * 계획 [7](+0x153, 목표 루)은 0xb3444 b347c~b34b2 가 낸다:
 *   [7] = 짝.vt68()(목표점이 루 좌표인가) ; < 0 이면 [7] = 바이트[P + 0x1ef + (s8)P+0x1f1] — 협살 칸 [3 + 공 쥔 쪽]
 * 공 쥔 쪽 [5](+0x1f1)는 시작 0xb3a94 가 적은 값 그대로다(0xb3444 밖에서 읽는 곳이 없다). 0 이면 [3] 짝의 루, 1 이면
 * [4] 주자 번호다 — 1 은 두 루의 커버가 한 야수일 때만이고 그때 짝 = 자신이라 공 쥔 쪽은 늘 주자를 쫓아(b4976) 닿지 않는다.
 * 던진 야수는 0xb2c90 을 거치지 않아 AI 0 이 안 되고 8 그대로다 — 다음 칸부터 +0x130 이 받을 야수라 공 없는 갈래(b4a58)를 탄다.
 * 참이어도 미뤘으면(AI 9) 공은 아직 손에 있다(+0x12c 그대로)
 */
function rollPartnerThrow(s: DefensePlayState, t: TickFrame, slot: number, toSlot: number): void {
  const partner = s.fielders[toSlot]
  if (partner === undefined) return
  const thrown = rollThrowBall(s, t, slot, toSlot, partnerThrowBaseOf(s, partner), '협살', false)
  if (!thrown || s.play.held) return
  pushPlayLog(s.log, () => `${t.tick}틱 협살 송구 ${slot}→${toSlot} — ${s.throwArrivalTick}틱 도착 (${s.chaserSlot}번 야수가 받는다)`)
}

function partnerThrowBaseOf(s: DefensePlayState, partner: FielderState): number {
  const partnerBase = baseAtPoint(partner.target)
  if (partnerBase !== NONE) return partnerBase
  return s.rundown.holderSide === 1 ? s.rundown.runnerIndex : s.rundown.frontBase
}

/**
 * 공 없는 야수(b4aa0~b4aaa: 주자 틱 r > 짝 송구 틱 r0 이고 r ≤ r0 + 4)는 vt10 0xa124c(목표 = 위치 · 동작 · 자세 워드 0, r176).
 * 공 가진 야수의 '대기'(b4a3a — 안 쥠 +0x12c == 0)는 b4c60 으로 끝나 아무것도 안 한다
 */
function waitInRundown(s: DefensePlayState, slot: number): void {
  if (slot === s.play.ballHolderSlot) return
  s.fielders = s.fielders.map((fielder) => (fielder.slot === slot ? withPoseCleared(fielder) : fielder))
}
