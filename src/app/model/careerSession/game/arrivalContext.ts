import type { AtBatRunner } from '@/app/model/useAtBatRunner'
import type { AtBatState } from '@/entities/at-bat/model/atBatState'
import type { AtBatPitchTally } from '@/features/play-at-bat/model/atBatPitchTally'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import type { CareerAtoms } from '@/app/model/careerSession/atoms/careerScope'
import { cupGameAtom } from '@/app/model/careerSession/atoms/gameAtoms'
import { shownCareerMirrorAtom } from '@/app/model/careerSession/atoms/careerAtoms'

/** 붙든 공 도착 판이 끝난 뒤 `continueAfterArrival` 이 쓰는 이 공의 값 (`handlePitchResolved` 가 받은 것) */
export interface ArrivalContext {
  /** 이 공을 먹인 뒤의 타석 (`runner.applyPitch`) */
  readonly nextAtBat: ReturnType<AtBatRunner['applyPitch']>
  /** 이 공까지 센 공 수 · 연속 파울 */
  readonly tally: AtBatPitchTally
  /** 필살타법이 성공한 타구인가 (0x517e6 → 0x51800) */
  readonly isUncatchable: boolean | undefined
  /** 쏜 패턴 (0xb0930 덱) */
  readonly pattern: PitchOutcomeDetail['pattern']
  /** 장면 +0xfdc — 이 공의 번트 종류 */
  readonly buntKind: number
}

/** 타자 스킬 22 압도 — 상대 투수 투구 스태미나 소모 ×2 (0xa5f0e) */
export const INTIMIDATE_SKILL_ID = 22

/** 세션 타석의 볼카운트 — 진행기 0xf 진입(`AtBatCount`)에 넘긴다 */
export const countOf = (atBat: AtBatState) => ({ strikes: atBat.strikes, balls: atBat.balls })

/** 지금 루에 선 주자 수 — 결과 배너 글이 본다 */
export const runnersOnBaseOf = ({ game: { bases } }: GameProgress) => [bases.first, bases.second, bases.third].filter(Boolean).length

/**
 * 정산의 타자 게이트 0xa56dc(ctx, 지금 타자, 1) — 국가대항전 · 포스트시즌이면 거짓. 지난 그림의 커리어를 본다(옛 `careerRef`)
 */
export function isBatterRecordedNow(atoms: CareerAtoms): boolean {
  return atoms.get(cupGameAtom) === null && atoms.get(shownCareerMirrorAtom).current?.postseason === null
}
