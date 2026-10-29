import {
  contactOfPattern,
  drawScenePattern,
  hitDirectionOf,
  launchPatternOf,
  provisionalOutcomeOf,
  registerContact,
  rollSpecialSwing,
} from '@/entities/pitching/model/simulateBatter/otherSlices'
import type { BattedContact } from '@/entities/pitching/model/simulateBatter/otherSlices'
import { swungOutcomeOf } from '@/entities/pitching/model/simulateBatter/resolve/swingPlan'
import type { CpuSwingPlan } from '@/entities/pitching/model/simulateBatter/resolve/swingPlan'
import type { BatterSituation, CpuBatterTraits, CpuPitchOutcome } from '@/entities/pitching/model/simulateBatter/types'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 0x517e6 의 필살 스윙 재료 — 마타자만 필살을 쓰므로 늘 마타자 표지가 붙는다 */
type SpecialSwingMaterial = NonNullable<BattedContact['specialSwing']>

/** 쏜 패턴 · 결과 코드에 0x51682 0xb63c1(타자) = 화면 배치 `stageSide`(0x3b084 가 같은 함수로 둔다)와 필살 재료를 묶은 공 */
function battedContactOf(
  pitch: Pitch,
  pattern: BattedContact['pattern'],
  code: number,
  specialSwing: SpecialSwingMaterial | undefined,
): BattedContact {
  return { pattern, resultCode: code, batterHand: pitch.stageSide, ...(specialSwing === undefined ? {} : { specialSwing }) }
}

/**
 * 판을 안 도는 파울 각 공 — 0x517e6 — 메시지 0x11(필살수비 · 표시 패턴 · 폴 굴림) 뒤. 마타자는 0x34c74 가 번호와 무관하게 30%.
 * 판을 도는 공은 재료만 쏜 공에 실어 수비 판 시작(`startDefensePlay`)이 그 차례에 굴린다 — 판을 안 도는
 * 옛 호출(`playsFoulBall` 없음)의 파울 · 판정 11 만 여기서 굴린다 (페어 타구는 굴리지 않는다 — 필살 표시는 판 시작 몫)
 */
function rollUnplayedFoulAngle(kind: '파울' | '번트파울아웃', plan: CpuSwingPlan, random: RandomPort): CpuPitchOutcome {
  const isUncatchable = plan.isSpecialSwing && rollSpecialSwing(plan.specialNumber, random, true)
  if (kind === '파울') return swungOutcomeOf(plan, { kind: '파울' }, isUncatchable)
  return swungOutcomeOf(plan, { kind: '타구', outcome: registerContact({ kind: '아웃', detail: '직선타아웃' }, null) }, isUncatchable)
}

/**
 * 맞은 공 (0x51430~) — 방향 · 장면 덱 패턴 · 특수 타구 표를 굴리고, 파울 각만 여기서 가른다. 페어 타구의 안타·아웃은 수비 판이 낸다
 * (`battedBallOutcome.contactOfPattern` 머리말). 2스트라이크 번트 파울은 아웃 (0x9d5e2) — 사람 타석(resolvePitch)과 같은 판정이다
 */
export function rollCpuBattedBall(
  resultCode: number,
  pitch: Pitch,
  situation: BatterSituation,
  traits: CpuBatterTraits,
  plan: CpuSwingPlan,
  random: RandomPort,
): CpuPitchOutcome {
  const code = resultCode + hitDirectionOf({ code: resultCode, frame: plan.frame, frameCount: pitch.frameCount, batterSide: 0 }, random)
  // 0x51490 — 사람 타석과 같은 장면 덱(0x3e340 이 경기 시작에 연 하나, `openScenePatternDeck`)에서 꺼낸다.
  // 장면을 열지 않은 호출(시험 · 옛 길)만 덱 없이 한 장을 굴린다(`drawScenePattern`)
  const drawn = drawScenePattern(code, random)
  // 0x514f2 — 코드 25·26 의 2% 특수 타구 표
  const pattern = launchPatternOf(code, drawn, random)
  const contact = contactOfPattern(code, pattern, { strikes: situation.strikes, buntKind: plan.buntKind })
  const specialSwing = plan.isSpecialSwing ? { number: plan.specialNumber, isAceBatter: true } : undefined
  const isFoulAngle = contact.kind !== '타구'
  if (isFoulAngle && traits.playsFoulBall === true) {
    // 파울 각이라도 판을 돈다 — 필살타법 굴림까지 판 시작(메시지 0x11 뒤 517e6)에 맡긴다. 2스트라이크 번트 파울(판정 11)도
    // 같은 판이다 — 판 끝 결과 코드 0x9d5bc 가 이 공 앞 스트라이크 · 번트 종류로 11 을 낸다(9d5e2~9d600)
    return { ...swungOutcomeOf(plan, { kind: '파울' }, false), foulContact: battedContactOf(pitch, pattern, code, specialSwing) }
  }
  if (contact.kind !== '타구') return rollUnplayedFoulAngle(contact.kind, plan, random)
  // 타석을 끝내는 임시 결과 — 쏜 패턴을 묶어 투수편 진행기가 그 패턴으로 판을 돌린다(`battedContact`).
  // 페어 번트 판도 이 공의 번트 종류(장면 +0xfdc)를 싣는다 — 판 시작 리드 · 필살수비 관문 · 정산이 본다
  const outcome = registerContact(provisionalOutcomeOf(pattern), battedContactOf(pitch, pattern, code, specialSwing))
  return swungOutcomeOf(plan, { kind: '타구', outcome }, false)
}
