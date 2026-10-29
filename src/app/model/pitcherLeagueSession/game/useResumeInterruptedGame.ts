import { nextPitcherOpponentOf, type PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { nationalCupMatchupOf } from '@/entities/national-cup/model/nationalCup'
import { nariTeamsOf, recordMatchAcesOf, seatNariMatchAces } from '@/entities/career/model/nariTeamRecord'
import type { NariGameMatch } from '@/pages/management/lib/nariMatchPrepare'
import { resetLiveGameState } from '@/shared/lib/liveGameState/liveGameState'
import { type PitcherScope, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { careerAtom } from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'
import { sceneAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import {
  cupGameAtom,
  cupMatchAtom,
  cupViewAtom,
  gameOptionsAtom,
  matchAcesAtom,
  matchPreparedAtom,
} from '@/app/model/pitcherLeagueSession/atoms/gameAtoms'
import { usePitcherSaveWriters } from '@/app/model/pitcherLeagueSession/state/usePitcherSaveWriters'
import { cupGameOptionsOf } from '@/app/model/pitcherLeagueSession/game/gameOptions'
import { useBeginGame } from '@/app/model/pitcherLeagueSession/game/useBeginGame'

/** 마선수는 저장의 나리 팀 레코드에 있다. 레코드가 없던 옛 저장이면 모드 저장 칸에 남겨 둔 그림자를 넣는다 */
function withSavedMatchAces(career: PitcherCareer, match: NariGameMatch | null): PitcherCareer {
  const aces = match?.aces
  if (career.nariTeams !== undefined || aces === null || aces === undefined) return career
  return { ...career, nariTeams: seatNariMatchAces(nariTeamsOf(career), career.teamId, nextPitcherOpponentOf(career), aces) }
}

/**
 * [14] 투수편·[최근게임](모드 3) 의 "곧장 경기" — 0x327b8 모드 3 갈래(+0x43 && +0x4f) → 0x213c0(앱, 3, 0) → 장면 0x104.
 * 0x213c0 이 올린 투수편 저장으로 장면 0x104 의 셋업 0x39fdc 모드 3 갈래가 경기를 새로 세운다(반 이닝 저장이 없어 처음부터 ·
 * 142 를 안 거쳐 굴림 없음 · 명부의 마선수 그대로). 경기 뒤 나리 장면이 새로 선다. 옛 훅처럼 그림마다 새 함수다.
 */
export function useResumeInterruptedGame(scope: PitcherScope) {
  const { atoms, gaugeSettingOn, throwModeManual } = scope
  const career = usePitcherValue(atoms, careerAtom)
  const { commit } = usePitcherSaveWriters(scope)
  const beginGame = useBeginGame(scope)
  /**
   * 대회 경기 — 셋업 0x39fdc 모드 3 갈래가 올린 저장의 S+0x12c · 대회 칸(L+0xa8~)과 142 가 고쳐 둔 대표팀 칸 두 개로
   * 그 경기를 처음부터 다시 세운다(0x1f940 — 팀 10 → +0xbc4 · 그 밖 → +0xbe0). 142 를 안 거쳐 구장 굴림이 없다.
   * 대회가 없는 옛 웹 저장이면(대회를 저장하지 않던 때) 이어하기 자리(장면이 선 그대로)로 둔다
   */
  const resumeCupGame = (current: PitcherCareer) => {
    const cup = current.nationalCup
    const matchup = cup === undefined ? null : nationalCupMatchupOf(cup)
    if (cup === undefined || matchup === null) return
    atoms.set(matchAcesAtom, null)
    atoms.set(cupViewAtom, null)
    atoms.set(cupMatchAtom, { matchup, cup })
    atoms.set(cupGameAtom, cup)
    resetLiveGameState()
    atoms.set(gameOptionsAtom, cupGameOptionsOf(current, matchup, cup, { gaugeSettingOn, throwModeManual }))
    atoms.set(sceneAtom, '경기')
  }
  return (match: NariGameMatch | null) => {
    if (career === null) return
    atoms.set(matchPreparedAtom, false)
    if (match?.isNationalCup === true) return resumeCupGame(career)
    const loaded = withSavedMatchAces(career, match)
    if (loaded !== career) commit(loaded)
    atoms.set(matchAcesAtom, recordMatchAcesOf(nariTeamsOf(loaded), loaded.teamId, nextPitcherOpponentOf(loaded)))
    beginGame(loaded)
  }
}
