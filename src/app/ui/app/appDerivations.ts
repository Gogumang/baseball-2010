import type { Screen } from '@/app/model/screen'
import type { PitcherLeagueSession } from '@/app/model/usePitcherLeagueSession'
import type { useCareerSession } from '@/app/model/useCareerSession'
import type { SeasonSession } from '@/app/model/useSeasonSession'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { myBatterIndexOf, nariTeamRecordOf, nariTeamsOf } from '@/entities/career/model/nariTeamRecord'
import { pitcherCollectorHiddenIdsOf } from '@/entities/collection/model/collection'
import { judgeSeasonEnding } from '@/entities/season-mode/model/seasonRewards'
import { SEASON_PHASE } from '@/entities/season-mode/model/seasonStateMachine'

type CareerSession = ReturnType<typeof useCareerSession>
type MaybeCareer = PlayerCareer | null | undefined
type MaybePitcherCareer = PitcherCareer | null | undefined

/** 투수편 엔딩 141 의 판정 — 커리어가 없으면 null */
export function pitcherEndingIndexOf(pitcherSession: PitcherLeagueSession): number | null {
  return pitcherSession.career?.endingIndex ?? null
}

/** 투수편 114 이벤트의 맥락 — 이벤트가 없으면 null */
export function pitcherStoryContextOf(pitcherSession: PitcherLeagueSession) {
  return pitcherSession.story?.context ?? null
}

/** 지금 화면의 배경음 — 투수편은 안쪽 장면(128 이어하기 4)을 본다 */
export function sceneBgmOf(screen: Screen, pitcherBgm: number | null, screenBgm: number | null): number | null {
  return screen.kind === '투수편' ? pitcherBgm : screenBgm
}

/** 이어하기 길의 137 — 타자편 '연차표지'(이어하기) · 투수편 안쪽 '연차표지'(이어하기) */
export function isResumeCoverOf(screen: Screen, pitcherSession: PitcherLeagueSession): boolean {
  if (screen.kind === '연차표지') return screen.fromResume === true
  return screen.kind === '투수편' && pitcherSession.scene === '연차표지' && pitcherSession.yearCoverFromResume
}

/** 타자 미션 0xb53f0 의 k = 나리 타자편 저장 선수 +0xa & 0x1f — 자기 나리 팀 레코드의 내 줄 첨자 (없으면 −1) */
export function missionBatterRecordSlotOf(career: MaybeCareer): number {
  if (career === null || career === undefined) return -1
  return myBatterIndexOf(nariTeamRecordOf(nariTeamsOf(career), career.teamId))
}

/** 마선수 대결의 사람 칸 팀 (0xaa57c aa6dc~aa728) — g[0xf6] 모드 저장 레코드 +1 = 그 편 나리 저장의 팀 */
export function missionNariTeamIdsOf(batterCareer: MaybeCareer, pitcherCareer: MaybePitcherCareer) {
  return {
    ...(batterCareer === null || batterCareer === undefined ? {} : { batter: batterCareer.teamId }),
    ...(pitcherCareer === null || pitcherCareer === undefined ? {} : { pitcher: pitcherCareer.teamId }),
  }
}

/** 투수편이 연 히든 — 커리어 칸과 장비 컬렉터(보유에서 다시 센다, `pitcherCollectorHiddenIdsOf`) */
export function pitcherOpenedHiddenIdsOf(pitcherCareer: MaybePitcherCareer): readonly number[] {
  if (pitcherCareer === null || pitcherCareer === undefined) return []
  return [...pitcherCareer.openedHiddenIds, ...pitcherCollectorHiddenIdsOf(pitcherCareer)]
}

/** 시즌 엔딩 — phase 6(엔딩)이면 판정 0xa3084, 아니면 null */
export function seasonEndingIndexOf(state: SeasonSession['state']): number | null {
  const record = state?.record ?? null
  return record !== null && record.phase === SEASON_PHASE.엔딩 ? judgeSeasonEnding(record) : null
}

/** 세 모드의 정규시즌 1위 횟수 — 오토봇 배트 0x29 검사 · 나리 우승 팝업이 다른 모드 몫을 본다 */
export function regularSeasonFirstsOf(pitcherSession: PitcherLeagueSession, careerSession: CareerSession, seasonSession: SeasonSession) {
  return {
    pitcherEditionFirsts: pitcherSession.career?.regularSeasonFirstCount ?? 0,
    batterEditionFirsts: (careerSession.career ?? careerSession.savedCareer)?.regularSeasonFirstCount ?? 0,
    seasonModeFirstCount: seasonSession.state?.record.regularSeasonFirsts ?? 0,
  }
}
