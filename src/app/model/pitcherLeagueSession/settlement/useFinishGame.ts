import { useCallback } from 'react'
import {
  applyPitcherSeasonEnd,
  enterPitcherGameEvaluation,
  NO_LAST_EVALUATION,
  type PitcherCareer,
} from '@/entities/pitcher-career/model/pitcherCareer'
import { applyPitcherBurstRewards } from '@/entities/pitcher-career/model/pitcherBurstReward'
import { recordGamePointsOf } from '@/entities/game/model/gameRecords'
import { PITCHER_LEAGUE_MODE } from '@/entities/collection/model/annalsStats'
import type { PitcherGameSummary } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { pitcherGameOutcomeOf } from '@/pages/pitcher-league/model/pitcherGameOptions'
import { activeSound, playSoundIds } from '@/shared/api/audio/soundPort'
import { type PitcherScope, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { careerAtom } from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'
import { sceneAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import { cupGameAtom, gameOptionsAtom, matchPreparedAtom } from '@/app/model/pitcherLeagueSession/atoms/gameAtoms'
import { portsMirrorAtom } from '@/app/model/pitcherLeagueSession/atoms/portsAtoms'
import { usePitcherSaveWriters } from '@/app/model/pitcherLeagueSession/state/usePitcherSaveWriters'
import { useSetUpPitcherScene } from '@/app/model/pitcherLeagueSession/state/useSceneSetUp'
import { useFinishCupGame } from '@/app/model/pitcherLeagueSession/nationalCup/useFinishCupGame'
import { pitcherEvaluationJingleIdOf } from '@/app/model/pitcherLeagueSession/save/evaluationJingle'
import { leaveLiveGameState, recordSettlementStats } from '@/app/model/pitcherLeagueSession/settlement/settlementStats'
import { recordedLeagueCareerOf, rollLeagueDayOf } from '@/app/model/pitcherLeagueSession/settlement/leagueGameRecords'
import { evaluatedCareerOf, pitcherLastGameOf, streaksAfterGameOf } from '@/app/model/pitcherLeagueSession/settlement/gameEvaluation'

const burstDeltasOf = (summary: PitcherGameSummary) => summary.burstRewardDeltas ?? []

const evaluationJingleIdOf = (career: PitcherCareer) => pitcherEvaluationJingleIdOf((career.lastEvaluation ?? NO_LAST_EVALUATION).popularityChange)

/**
 * 경기 뒤 정산 — 성적·스태미나·전적을 넣고, 같은 날 나머지 네 경기를 돌린 뒤
 * 정규시즌·포스트시즌을 넘긴다 (타자편 `finishGame` 과 같은 차례다). 국가대항전 경기는 커리어 정산을 타지 않고 대회 하루를
 * 넘긴다 (142 → 경기 → 101 → 134, `useFinishCupGame`).
 */
export function useFinishGame(scope: PitcherScope) {
  const { atoms, random, aceLevels, recordStat } = scope
  const career = usePitcherValue(atoms, careerAtom)
  const gameOptions = usePitcherValue(atoms, gameOptionsAtom)
  const { commit } = usePitcherSaveWriters(scope)
  const setUpPitcherScene = useSetUpPitcherScene(atoms)
  const finishCupGame = useFinishCupGame(scope)
  return useCallback(
    (summary: PitcherGameSummary) => {
      if (career === null || gameOptions === null) return
      const cupGame = atoms.get(cupGameAtom)
      if (cupGame !== null) return finishCupGame(summary, cupGame, gameOptions)
      // 경기 중 돌발 보상 0x8e34c — 정산 0x4ea0c 보다 앞(경기 중)에 선수 레코드에 들어가 있던 값이다 (`applyPitcherBurstRewards`)
      const played = applyPitcherBurstRewards(career, burstDeltasOf(summary))
      // 경기 장면 0x104 를 지나 나리 장면이 새로 선다 — 장면+0x288 = 0 · 반복 이벤트 · 커서 · mgr+0x304
      atoms.set(matchPreparedAtom, false)
      setUpPitcherScene()
      // 정산 진입 0x4ea0c 의 0x4f3d6 — 전역기록 +0x4c + 모드(+0x4f) = 0
      atoms.get(portsMirrorAtom).current.nariGameSave?.clear()
      // 기록 달성 G 는 요약이 들고 온다 (0xa77f0 → 0x4ea0c). 강판당한 경기는 원본이 전면 차단해 0 이다
      const outcome = pitcherGameOutcomeOf(summary, gameOptions, {
        entered: summary.hasEntered,
        gamePointReward: recordGamePointsOf(summary.recordIds),
      })
      const recorded = recordedLeagueCareerOf(played, summary, gameOptions, outcome)
      recordSettlementStats(recordStat, summary, outcome.gamePointReward)
      const day = rollLeagueDayOf(played, recorded, summary, gameOptions, random, aceLevels)
      // 45경기째면 하루 끝(0xb818c)이 정규시즌을 닫고 대진(0xb80a8)을 연다. CPU 끼리의 포스트시즌 경기는
      // 여기서 돌리지 않는다 — 원본은 대진 128 의 [확인](0x13da0)에서 돌린다 (`pressPostseasonBracket`)
      const seasoned = applyPitcherSeasonEnd(day)
      // 하루 끝 0xb818c 의 1위 갈래(b8266~b829c) — S+0x7a 다음에 통계 [mgr+0xc8]+0xfe(기록연감 셀 9 "나리 투수편 우승") +1 · 저장
      if (seasoned.regularSeasonFirstCount > day.regularSeasonFirstCount) recordStat({ kind: '리그1위', mode: PITCHER_LEAGUE_MODE })
      const withEvaluation = played.postseason === null ? evaluatedCareerOf(seasoned, summary) : seasoned
      const lastGame = pitcherLastGameOf(played, withEvaluation, summary, gameOptions)
      const streaks = streaksAfterGameOf(played, withEvaluation, summary)
      leaveLiveGameState(summary, gameOptions)
      atoms.set(gameOptionsAtom, null)
      // S+0x50 = 2 · 저장 → 평가 창 → 경기 뒤 카운터 → 저장, 평가 징글 (`enterPitcherGameEvaluation`)
      commit(enterPitcherGameEvaluation({ ...withEvaluation, lastGame, streaks }))
      playSoundIds(activeSound(), [evaluationJingleIdOf(withEvaluation)])
      atoms.set(sceneAtom, '경기결과')
    },
    [aceLevels, atoms, career, commit, finishCupGame, gameOptions, random, recordStat, setUpPitcherScene],
  )
}
