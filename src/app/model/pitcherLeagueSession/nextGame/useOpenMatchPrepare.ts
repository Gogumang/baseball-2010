import { useCallback } from 'react'
import { nextPitcherOpponentOf, prepareMyPitcherMatch } from '@/entities/pitcher-career/model/pitcherCareer'
import { nariTeamsOf, seatNariMatchAces } from '@/entities/career/model/nariTeamRecord'
import { PITCHER_LEAGUE_MODE } from '@/entities/collection/model/annalsStats'
import { rollNariMatchAces, rollNariMatchInfoStage } from '@/pages/management/lib/nariMatchPrepare'
import { pitcherGameOptionsOf } from '@/pages/pitcher-league/model/pitcherGameOptions'
import { resetLiveGameState } from '@/shared/lib/liveGameState/liveGameState'
import { type PitcherScope, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { careerAtom } from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'
import { sceneAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import { entryViewAtom, matchAcesAtom, matchInfoStageAtom, matchPreparedAtom } from '@/app/model/pitcherLeagueSession/atoms/gameAtoms'
import { usePitcherSaveWriters } from '@/app/model/pitcherLeagueSession/state/usePitcherSaveWriters'

/** 142 경기 준비에 들어선다 — 이 장면에서 처음이면 마선수 넷을 굴린다(난수 4) */
export function useOpenMatchPrepare(scope: PitcherScope) {
  const { atoms, gaugeSettingOn, openedAces, random, throwModeManual } = scope
  const career = usePitcherValue(atoms, careerAtom)
  const { commitWith } = usePitcherSaveWriters(scope)
  return useCallback(() => {
    // 142 진입 0x1c46c 의 첫 줄(0x1c47a) — 0xb6814(전역 상태): +0x6b = 0
    resetLiveGameState()
    if (!atoms.get(matchPreparedAtom)) {
      atoms.set(matchPreparedAtom, true)
      const aces = rollNariMatchAces(random, openedAces)
      atoms.set(matchAcesAtom, aces)
      // 1c574~1c5ea — 내 팀 투수 배열을 오늘 준비대로(g == 0 0x1b684 · 0xa4f60 돌리기/맞바꿈), 포지션 코드 · g == 0 스태미나
      // (0x1c8a8) 도 같은 문 안이다. 1c62e~1c660 — 굴린 넷을 두 팀 레코드에 넣는다(저장에 남는다 — 빼는 코드가 없다)
      commitWith((current) => {
        const prepared = prepareMyPitcherMatch(current)
        return { ...prepared, nariTeams: seatNariMatchAces(nariTeamsOf(prepared), prepared.teamId, nextPitcherOpponentOf(prepared), aces) }
      })
    }
    // 1c7ae~1c87c — 무대 · 구장 0x78664(무대, 홈 팀) · 0x5fd04. 리그 팀은 0~9 라 굴리지 않는다(마선수 굴림 뒤 자리)
    if (career !== null) {
      const options = pitcherGameOptionsOf(career, { gaugeSettingOn, throwModeManual })
      const stage = rollNariMatchInfoStage(random, {
        mode: PITCHER_LEAGUE_MODE,
        myTeamId: career.teamId,
        opponentTeamId: options.opponentTeamId,
        mySide: options.playerSide,
        dayCounter: options.dayCounter,
      })
      atoms.set(matchInfoStageAtom, stage)
    }
    atoms.set(entryViewAtom, null)
    atoms.set(sceneAtom, '경기준비')
  }, [atoms, career, commitWith, gaugeSettingOn, openedAces, random, throwModeManual])
}
