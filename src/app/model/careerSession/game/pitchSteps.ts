import {
  arrivePitch,
  recordMyBuntAttempt,
  stageOpponentPitcherAbilityOf,
  throwOpponentPitch,
  type GameProgress,
  type PitchArrivalStep,
} from '@/features/play-game/model/gameFlow'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { AtBatState } from '@/entities/at-bat/model/atBatState'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { CareerAtoms } from '@/app/model/careerSession/atoms/careerScope'
import { shownCareerMirrorAtom } from '@/app/model/careerSession/atoms/careerAtoms'
import { progressAtom } from '@/app/model/careerSession/atoms/gameAtoms'
import { INTIMIDATE_SKILL_ID, isBatterRecordedNow } from '@/app/model/careerSession/game/arrivalContext'

/**
 * 공이 손을 떠날 때 상대 투수 투구 수·스태미나를 깎는다 (0x3dec6 → 0xa5e14(ctx, 구질)).
 * 타자 스킬 22 압도(0xb62b4(현재 타자, 22) — 장착 비트)면 소모 ×2
 */
export function applyThrownPitch(atoms: CareerAtoms, detail: PitchOutcomeDetail, aceLevels: Readonly<Record<number, number>> | undefined): void {
  const beforePitch = atoms.get(progressAtom)
  if (beforePitch === null || detail.pitchTypeNumber === undefined) return
  const thrown = throwOpponentPitch(beforePitch, detail.pitchTypeNumber, {
    batterIntimidates: atoms.get(shownCareerMirrorAtom).current?.equippedSkillIds.includes(INTIMIDATE_SKILL_ID) ?? false,
    // 소모 0x345fc(0x51214 → 0x5121e) · 싣기 0x3de10 — 수비 팀 +0x28 · 공 +0x10 을 경기 동안 이어 든다
    magic: { pitcher: stageOpponentPitcherAbilityOf(beforePitch, aceLevels), aceLevels },
  })
  atoms.set(progressAtom, thrown)
}

/**
 * 번트 판정을 받은 공(자세가 틱 N − 1 까지 섬) — 0x4e1f8 → 스윙 시작 0xa5fac → 코드 11 → G+0xf8 번트 수 +1.
 * 게이트 0xa56dc(R, 지금 타자, 1) 은 국가대항전 · 포스트시즌이면 거짓 (`recordMyBuntAttempt`)
 */
export function applyBuntAttempt(atoms: CareerAtoms, detail: PitchOutcomeDetail, buntKind: number): void {
  const beforeBunt = atoms.get(progressAtom)
  if (beforeBunt === null || !detail.hasSwung || buntKind === 0) return
  atoms.set(progressAtom, recordMyBuntAttempt(beforeBunt, { isRecorded: isBatterRecordedNow(atoms) }))
}

/** 공 도착 0x3dfac — 못 맞힌 공이면 0.1% 폭투·포일(종류 9)이나 출발한 도루(종류 5) 판을 연다 (`arrivePitch`). 진행이 없으면 null */
export function rollPitchArrival(
  atoms: CareerAtoms,
  random: RandomPort,
  detail: PitchOutcomeDetail,
  nextAtBat: AtBatState,
  buntKind: number,
): { readonly beforeArrival: GameProgress | null; readonly arrival: PitchArrivalStep | null } {
  const beforeArrival = atoms.get(progressAtom)
  if (beforeArrival === null) return { beforeArrival, arrival: null }
  const arrival = arrivePitch(
    beforeArrival,
    // 못 맞힌 번트의 번트 종류(장면 +0xfdc)도 싣는다 — 도루 판 리드 0x3d7b8
    // 맞은 공의 결과 코드는 경기 +0xfd4 로 남는다(다음 견제 판이 본다)
    {
      resolution: detail.resolution,
      outcomeAfter: nextAtBat.outcome,
      buntKind,
      resultCode: detail.resultCode,
      // 타자 손 0xb63c0 — 밀어내기 · 낫아웃 판의 타자주자 타석 자리
      batterHand: detail.batterHand,
    },
    random,
    {
      // 정산 0xa59c0 의 타자 게이트 0xa56dc(ctx, 지금 타자, 1) — 포스트시즌 · 국가대항전이면 거짓
      isRecorded: isBatterRecordedNow(atoms),
      // 판정 A 0xae24c 가 이 공을 먹인 카운트 — 타석이 이어지면 0xf 진입의 교체 틱 굴림(0x344dc)이 본다
      countAfter: { strikes: nextAtBat.strikes, balls: nextAtBat.balls },
      // 도루 · 폭투 판(종류 5 · 9)은 사람 주루 키(0x5331c · 0x585)를 받으므로 붙들어 화면이 실시간으로 돌린다
      live: true,
    },
  )
  return { beforeArrival, arrival }
}
