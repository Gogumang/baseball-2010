import { type PitcherScope, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { sceneAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import { nextGameFromManagementAtom } from '@/app/model/pitcherLeagueSession/atoms/gameAtoms'
import { usePitcherSaveWriters } from '@/app/model/pitcherLeagueSession/state/usePitcherSaveWriters'

/** 109 순위표 — 관리 [다음경기] 로 들어가기 · 취소. 옛 훅처럼 그림마다 새 함수다 */
export function useNextGameStandingsActions(scope: PitcherScope) {
  const { atoms } = scope
  const scene = usePitcherValue(atoms, sceneAtom)
  const nextGameFromManagement = usePitcherValue(atoms, nextGameFromManagementAtom)
  const { commitWith } = usePitcherSaveWriters(scope)
  return {
    /** 관리 [다음경기] → 109 순위표 (이전 상태 105). 109 진입 0x10d8c — S+0x50 = 4 · 저장 (이어하기가 109 로 돌아온다) */
    openNextGameStandings: () => {
      commitWith((current) => (current.seasonEndState === 109 ? current : { ...current, seasonEndState: 109 }))
      atoms.set(nextGameFromManagementAtom, true)
      atoms.set(sceneAtom, '다음경기순위')
    },
    /** 109 취소(−16) — 이전 상태가 105 일 때만 105 로 (0x1060e). 105 진입 0x11910 이 S+0x50 = 3 · 저장(0x11990) — 웹 null */
    cancelNextGameStandings: () => {
      if (scene !== '다음경기순위' || !nextGameFromManagement) return
      commitWith((current) => (current.seasonEndState !== 109 ? current : { ...current, seasonEndState: null }))
      atoms.set(sceneAtom, '관리')
    },
  }
}
