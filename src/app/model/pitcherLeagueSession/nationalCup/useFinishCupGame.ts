import { useCallback } from 'react'
import type { NationalCup } from '@/entities/national-cup/model/nationalCup'
import { advanceNationalCupDay } from '@/entities/national-cup/model/nationalCupPlay'
import { nariCupGameResultOf } from '@/entities/career/model/nariCupGame'
import { nariMoraleAfterBurst } from '@/entities/career/model/nariMorale'
import { recordGamePointsOf } from '@/entities/game/model/gameRecords'
import { PITCHER_LEAGUE_MODE } from '@/entities/collection/model/annalsStats'
import type { PitcherGameOptions, PitcherGameSummary } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type { PitcherScope } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { sceneAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import { cupGameAtom, cupMatchAtom, cupViewAtom, gameOptionsAtom, matchPreparedAtom } from '@/app/model/pitcherLeagueSession/atoms/gameAtoms'
import { portsMirrorAtom } from '@/app/model/pitcherLeagueSession/atoms/portsAtoms'
import { usePitcherSaveWriters } from '@/app/model/pitcherLeagueSession/state/usePitcherSaveWriters'
import { useSetUpPitcherScene } from '@/app/model/pitcherLeagueSession/state/useSceneSetUp'
import { leaveLiveGameState, recordSettlementStats } from '@/app/model/pitcherLeagueSession/settlement/settlementStats'
import { cupDaySettledCareerOf } from '@/app/model/pitcherLeagueSession/nationalCup/cupDaySettlement'

/**
 * 국가대항전 사람 경기가 끝났다 — 경기 끝 판(상태 0x18, 웹은 경기 화면의 `GameEndBoard`) [OK] 뒤 정산 0x4ea0c 차례(기록 달성 G →
 * 내 경기 승패 0xb76dc/0xb77e0 → S+4 = 0 → 같은 라운드 CPU 경기 0xc2dac → 하루 끝 0xb818c → 부상 경기 수 · S+0x7c)를 하고, 재진입
 * 0x1c154 가 S+0x12c 를 보고 134 로 돌려보낸다(116 을 안 지난다 — 4f03a 의 S+0x50 = 2 는 대회가 아닐 때만). 기록 G · 행동 · 부상 · 질병
 * 칸은 `settleNariCupGame`(타자편과 같다). 리그 승패 · 평가 · 스태미나 · 시즌 기록은 안 건드린다 — 내 기록은 대표팀 칸 복사본에
 * 쌓이고(0xa56dc 거짓) 대회 끝 0x1faa1 이 포인터를 원래 레코드로 돌린다.
 * ⚠️ 정산 그림 0x4a384(YOU WIN/LOSE · 보상 글)는 웹 투수편이 정규 경기에서도 안 그린다 — 대회도 같다.
 */
export function useFinishCupGame(scope: PitcherScope) {
  const { atoms, random, recordStat } = scope
  const { commitWith } = usePitcherSaveWriters(scope)
  const setUpPitcherScene = useSetUpPitcherScene(atoms)
  return useCallback(
    (summary: PitcherGameSummary, cup: NationalCup, options: PitcherGameOptions) => {
      atoms.set(cupGameAtom, null)
      // 경기 장면 0x104 를 지나 나리 장면이 새로 선다 — 장면+0x288 = 0 · 반복 이벤트 · 커서 · mgr+0x304
      atoms.set(matchPreparedAtom, false)
      setUpPitcherScene()
      // 정산 진입 0x4ea0c 의 0x4f3d6 — 모드를 가리지 않고 +0x4c + 모드 = 0
      atoms.get(portsMirrorAtom).current.nariGameSave?.clear()
      // 전역 경기 상태 +0x6b 는 대회 경기도 남긴다 — 측별 팀 +0x28 · 점수 +0x7e 도 (`setLiveGameSides`)
      leaveLiveGameState(summary, options)
      // 0x4ea0c 4f072~4f136 — 후공(측 1) 점수가 더 많을 때만 후공 승, 동점이면 선공(측 0) 승 (`nariCupGameResultOf`, 타자편과 같다)
      const { winner, loser } = nariCupGameResultOf({
        mySide: options.playerSide,
        myTeam: options.ourTeamId,
        opponentTeam: options.opponentTeamId,
        myScore: summary.ourScore,
        opponentScore: summary.opponentScore,
      })
      // 같은 날 CPU 경기 두 나라는 상대국 칸 레코드를 쓴다 — 사람 경기 끝 상대 투수 칸별 +0x2c 에서 선다(701a7a9)
      // 그 CPU 경기(0xc2dac)의 간이 엔진도 0xb570c b5768 로 두 나라 레코드 +2 에 나리 사기 — 대회 중이라 상대국 칸 +2, 곧 사람 경기
      // 끝의 그 칸(경기 중 돌발 보상 사기가 쌓인 값)이다 (`nariMorale`)
      const next = advanceNationalCupDay(cup, winner, loser, random, summary.pitcherStaminas?.opponent, {
        mode: PITCHER_LEAGUE_MODE,
        nariMorale: nariMoraleAfterBurst(options.teamMorale, summary.burstRewardDeltas ?? []),
      })
      // 기록 달성 G (4ebaa~4ec7c — 사람 팀 공·수로 거른 기록이라 대회 경기도 쌓인다. 강판 뒤는 0xa77f0 이 막아 요약에 없다)
      const gamePointReward = recordGamePointsOf(summary.recordIds)
      recordSettlementStats(recordStat, summary, gamePointReward)
      commitWith((current) => cupDaySettledCareerOf(current, next, summary, options, gamePointReward))
      atoms.set(gameOptionsAtom, null)
      atoms.set(cupMatchAtom, null)
      atoms.set(cupViewAtom, { cup: next, atStandings: false })
      atoms.set(sceneAtom, '국가대항전')
    },
    [atoms, commitWith, random, recordStat, setUpPitcherScene],
  )
}
