import { useCallback } from 'react'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import { gamePointRewardOf, type PlayerCareer } from '@/entities/career/model/playerCareer'
import { BATTER_LEAGUE_MODE } from '@/entities/collection/model/annalsStats'
import type { CareerScope } from '@/app/model/careerSession/atoms/careerScope'
import { rawCareerAtom } from '@/app/model/careerSession/atoms/careerAtoms'
import { stadiumSkyRowAtom } from '@/app/model/careerSession/atoms/gameAtoms'
import { portsMirrorAtom } from '@/app/model/careerSession/atoms/portsAtoms'
import { useSetUpNariScene } from '@/app/model/careerSession/state/useSceneSetUp'
import { rollLeagueGameSettlement } from '@/app/model/careerSession/settlement/leagueGameSettlement'
import { leaveLiveGameState, recordSettlementStats } from '@/app/model/careerSession/settlement/settlementSideEffects'

/** 경기가 끝났을 때 보상·칭호를 정산하고 결과 화면으로 넘어간다. */
export function useFinishGame(scope: CareerScope): (finished: GameProgress, currentCareer: PlayerCareer) => void {
  const { atoms, aceLevels, random, recordStat, setScreen } = scope
  const setUpNariScene = useSetUpNariScene(scope)
  return useCallback(
    (finished: GameProgress, currentCareer: PlayerCareer) => {
      // 경기 장면 0x104 를 지나 나리 장면이 새로 선다 — 장면+0x288 이 0 (다음 142 에서 다시 굴린다) · 반복 이벤트 · 커서 · mgr+0x304
      setUpNariScene()
      // 정산 진입 0x4ea0c 의 0x4f3d6 — 전역기록 +0x4c + 모드(+0x50) = 0
      atoms.get(portsMirrorAtom).current.nariGameSave?.clear()
      leaveLiveGameState(finished)
      const settled = rollLeagueGameSettlement(finished, currentCareer, random, aceLevels)
      if (settled.tookFirstPlace) recordStat({ kind: '리그1위', mode: BATTER_LEAGUE_MODE })
      atoms.set(rawCareerAtom, settled.career)
      // 경기 끝 0x4ea0c: 기록 달성 G 합을 저장 G 에 더한 뒤 획득 GP 통계에 적는다 · 기록 달성 횟수 · 플레이 시간
      const { summary, evaluation, dynamite, streak } = settled
      recordSettlementStats(recordStat, gamePointRewardOf(summary), summary.recordIds ?? [])
      setScreen({
        kind: '경기결과',
        summary,
        gamePointReward: gamePointRewardOf(summary),
        // 원본 116 은 0x1a1c0 칭호를 띄우지 않는다 — 얻은 칭호는 관리 화면에서 하나씩 팝업으로 받는다. 39 만 116 이 준다
        newTitles: dynamite === null ? [] : [dynamite],
        evaluation,
        streakNotices: streak.notices,
        streakRewards: streak.rewards,
        // 0x4ea0c 꼬리 4f41a~ 의 정산 효과 — 하늘 칸은 경기 끝 이닝 (구장객체 +0x14), 하늘 줄은 경기를 세울 때 고른 구장 +0x10
        settlementInning: finished.game.inning,
        settlementPlayerSide: finished.game.playerSide,
        settlementSkyRow: atoms.get(stadiumSkyRowAtom),
      })
    },
    [aceLevels, atoms, random, recordStat, setScreen, setUpNariScene],
  )
}
