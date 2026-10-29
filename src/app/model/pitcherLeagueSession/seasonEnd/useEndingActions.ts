import { useCallback } from 'react'
import {
  applyPitcherEndingBonus,
  canContinueAfterPitcherEnding,
  continueAfterPitcherEnding,
  PITCHER_CONTINUE_COST_GAME_POINT,
  PITCHER_INJURY_ENDING,
  pitcherEndingBonusOf,
} from '@/entities/pitcher-career/model/pitcherSeasonFlow'
import { leagueUsageOf, PITCHER_LEAGUE_MODE } from '@/entities/collection/model/annalsStats'
import { activeSound } from '@/shared/api/audio/soundPort'
import { playEndingContinueBgm } from '@/app/model/screenBgm'
import { type PitcherScope, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { careerAtom, isSaveErasedAtom } from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'
import { sceneAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import {
  heldEndingIndexAtom,
  isYearCoverHeldAtom,
  yearCoverAfterHoldAtom,
  yearCoverFromResumeAtom,
} from '@/app/model/pitcherLeagueSession/atoms/yearEndAtoms'
import { portsMirrorAtom } from '@/app/model/pitcherLeagueSession/atoms/portsAtoms'
import { usePitcherSaveWriters } from '@/app/model/pitcherLeagueSession/state/usePitcherSaveWriters'
import { useContinueYearEnd } from '@/app/model/pitcherLeagueSession/seasonEnd/useContinueYearEnd'
import { useFinishEnding } from '@/app/model/pitcherLeagueSession/seasonEnd/useFinishEnding'

/** 엔딩 141 — 이어하기 · 보너스 · 명예의 전당 · 떠나기, 그리고 웹 전용 연말 사슬 진입점 */
export function useEndingActions(scope: PitcherScope) {
  const { atoms, random, recordStat, store } = scope
  const career = usePitcherValue(atoms, careerAtom)
  const { commit } = usePitcherSaveWriters(scope)
  const continueYearEnd = useContinueYearEnd(scope)
  /**
   * **웹 전용 디버그(시험용 진입점)** — 지금 커리어로 136 의 392 "올해의 목표" 부터 연말 사슬을 곧장 튼다. 화면은 이 길을
   * 부르지 않는다: 원본 길은 116 끝(`confirmGameResult`)이 [114 → 136] 으로 곧장 간다.
   */
  const beginYearEnd = useCallback(() => {
    if (career === null) return
    continueYearEnd(career, [])
  }, [career, continueYearEnd])
  /**
   * 엔딩 141 의 팝업 0x32 — 5000 G포인트로 이어하기. 팝업 0x32 예 → 0x1bdc6 `0x22c29(모드 3 → 2, 5000)`.
   * 판정 0(부상)은 곧장 105(1bddc~1be1e), 방출은 새 시즌 0x1b768(1be26) 뒤 141 이 엔딩 판을 그리며 효과기 끝을 기다려 137(1beb4~1beea).
   * 1be2a~1be40 — 두 갈래가 만나 소리를 끊고 4 를 튼다. 방출은 화면이 엔딩 그대로라 여기서 (`playEndingContinueBgm`)
   */
  const continueAfterEnding = useCallback(() => {
    if (career === null || career.endingIndex === null) return false
    if (!canContinueAfterPitcherEnding(career, career.endingIndex)) return false
    commit(continueAfterPitcherEnding(career, random))
    recordStat({ kind: 'G사용', usage: leagueUsageOf(PITCHER_LEAGUE_MODE), amount: PITCHER_CONTINUE_COST_GAME_POINT })
    if (career.endingIndex === PITCHER_INJURY_ENDING) {
      atoms.set(sceneAtom, '관리')
      return true
    }
    playEndingContinueBgm(activeSound())
    atoms.set(yearCoverFromResumeAtom, false)
    atoms.set(yearCoverAfterHoldAtom, false)
    atoms.set(heldEndingIndexAtom, career.endingIndex)
    atoms.set(isYearCoverHeldAtom, true)
    return true
  }, [atoms, career, commit, random, recordStat])
  /**
   * 엔딩 보너스 팝업 0x2b 를 닫았다 — 141 틀 0x1bbc4 의 1bbf4~1bc70(모드 3 · 4 공용): 보너스 0xcc40c[e] × 1000 을 전역 G 에 더하고
   * `0x22c7d(보너스, 모드 3)` 통계 · 전역기록 저장 · **S+0x7b = 1** · 커리어 저장(S+0x50 = 6 째 — 다시 켜면 141, `pitcherResumePointOf`)
   */
  const receiveEndingBonus = useCallback(() => {
    if (career === null || career.endingIndex === null || career.endingBonusReceived === true) return
    const endingIndex = career.endingIndex
    commit({ ...applyPitcherEndingBonus(career, endingIndex), endingBonusReceived: true })
    recordStat({ kind: 'G획득', mode: PITCHER_LEAGUE_MODE, amount: pitcherEndingBonusOf(endingIndex) })
  }, [career, commit, recordStat])
  /**
   * 명예의 전당 등록이 된 그 순간 — 0x62dbe 의 0x224ec(저장, 3): 모드 저장을 지운다(경기 중간 저장 칸도). 원본은 등록 완료 창을
   * 닫기 전에 지우므로 그 창에서 앱을 꺼도 저장은 없다. 저장소에 `clear` 가 없어 **이름 없는 빈 덩어리**를 덮어쓴다 —
   * `normalizePitcherCareer` 가 null 로 읽는다
   */
  const eraseSaveForHallOfFame = useCallback(() => {
    atoms.set(isSaveErasedAtom, true)
    atoms.get(portsMirrorAtom).current.nariGameSave?.clear()
    store.save({})
  }, [atoms, store])
  return { beginYearEnd, continueAfterEnding, receiveEndingBonus, eraseSaveForHallOfFame, finishEnding: useFinishEnding(scope) }
}
