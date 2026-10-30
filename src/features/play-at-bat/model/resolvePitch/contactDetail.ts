import { contactOfPattern } from '@/entities/batting/model/battedBallOutcome'
import { provisionalOutcomeOf, registerContact } from '@/entities/batting/model/battedContact'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import { contactSoundIdOf } from '@/features/play-at-bat/model/atBatSounds'
import type { BattingContext, BattingSwing, PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch/types'

/** 헛스윙 — 바람 소리 8 / 필살 스윙 27 (0x51350). 헛스윙(경기+0xfd2 == 0)은 0x5135c 에서 0x51840 으로 건너뛰어 필살 굴림이 없다 */
export function whiffDetailOf(swing: BattingSwing, batterHand: number): PitchOutcomeDetail {
  const contactSoundId = contactSoundIdOf({
    hasSwung: true,
    hasHit: false,
    buntKind: swing.buntKind,
    isSpecialSwing: swing.isSpecial === true,
    resultCode: null,
    pattern: null,
  })
  return { resolution: { kind: '스트라이크', isSwinging: true }, hasSwung: true, isBunt: false, resultCode: null, contactSoundId, batterHand }
}

/**
 * 필살 성공 굴림 0x34c74 → 0x517e6 의 재료 — 맞은 공(0xfd2 ≠ 0)이면 어느 갈래든 0x517c8 로 모인다. 원본 차례는 메시지 0x11
 * (0x515c6 → 0x50faa: 필살수비 굴림 · 표시 패턴 · 쏘기의 폴 굴림) **뒤**라, 맞은 공은 모두(페어 타구 · 파울 각 공 · 2스트라이크
 * 번트 파울) 굴림 재료만 쏜 공에 실어 보내고 수비 판 시작(`startDefensePlay`)이 그 차례에 굴린다 — 여기서는 굴리지 않는다
 */
function specialSwingOf(swing: BattingSwing, context: BattingContext) {
  if (swing.isSpecial !== true) return undefined
  return { number: context.specialSwing?.number ?? 0, isAceBatter: context.specialSwing?.isAceBatter === true }
}

/**
 * **맞은 공** — 쏜 패턴의 각 하나로 파울 각(state[0x1c], 0x9d660)만 여기서 가른다. 페어 각은 판이 결과를 낸다(`battedContact` 머리말).
 * 2스트라이크 번트 파울은 아웃이다 (0x9d5e2~0x9d600). `situation.strikes` 는 이 공을 먹이기 전의 카운트다.
 * 0x51682 0xb63c1(지금 타자) — [경기+0xf2c] 공의 d 를 고른다 (좌타 뒤집기 0x35a6c 와 같은 손).
 */
export function contactDetailOf(code: number, pattern: BattedBallPattern, swing: BattingSwing, context: BattingContext): PitchOutcomeDetail {
  const contact = contactOfPattern(code, pattern, { strikes: context.situation.strikes, buntKind: swing.buntKind })
  const specialSwing = specialSwingOf(swing, context)
  // 타격음 7·9·5·59·6 — 쏜 패턴의 각·세기·높이로 고른다 (0x515de~0x5164a — 0x514f2 의 특수 표 덮어쓰기 뒤)
  const contactSoundId = contactSoundIdOf({ hasSwung: true, hasHit: true, buntKind: swing.buntKind, resultCode: code, pattern })
  const batterHand = context.situation.batterSide
  const shot = { pattern, resultCode: code, batterHand, ...(specialSwing === undefined ? {} : { specialSwing }) }
  // 2스트라이크 번트 파울(판정 11)도 파울 각 공이다 — 원본은 이 공도 판(상태 0x17)을 돌아 낙구 · 담장선 틱의 0x9d5bc 가
  // (state[4] > 1 && 번트) 로 11 을 낸다(9d5e2~9d600). 낙구 전에 잡히면 다른 파울처럼 뜬공 아웃(13)이다
  if (contact.kind === '파울' || contact.kind === '번트파울아웃') {
    // 파울 각이라도 판을 돈다 — 부르는 쪽이 이 쏜 공으로 판을 돌린다(필살타법 굴림까지 판 시작에 맡긴다)
    return { resolution: { kind: '파울' }, hasSwung: true, isBunt: false, resultCode: code, pattern, foulContact: shot, contactSoundId, batterHand }
  }
  // 페어 타구 — 결과는 수비 판이 낸다. 타석에 싣는 결과는 **타석을 끝내기 위한 임시 값**이고(`provisionalOutcomeOf`),
  // 쏜 패턴은 그 결과 객체에 묶어 둔다(`contactOfOutcome`) — 경기 진행기가 그 패턴으로 판을 돌린다
  return {
    resolution: { kind: '타구', outcome: registerContact(provisionalOutcomeOf(pattern), shot) },
    hasSwung: true,
    isBunt: contact.kind === '타구' && contact.isBunt,
    resultCode: code,
    pattern,
    contactSoundId,
    batterHand,
  }
}
