import { useCallback } from 'react'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { applyPitcherPostseasonProgress } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_POSTSEASON_STEP_ID } from '@/entities/pitcher-career/model/pitcherYearEnd'
import { isMyTurn } from '@/entities/league/model/seasonEnd'
import {
  applyKoreanSeriesReward,
  applyRegularSeasonReward,
  popupAfterChampion,
  REGULAR_SEASON_HIDDEN_ID,
  regularSeasonOpenedHiddenIds,
  type PostseasonPopup,
} from '@/entities/career/model/postseasonFlow'
import type { PitcherScene } from '@/app/model/pitcherLeagueSession/types/scene'
import { type PitcherScope, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { careerAtom } from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'
import { sceneAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import { postseasonPopupAtom, yearEndViewedAtom } from '@/app/model/pitcherLeagueSession/atoms/yearEndAtoms'
import { usePitcherSaveWriters } from '@/app/model/pitcherLeagueSession/state/usePitcherSaveWriters'
import { useContinueYearEnd } from '@/app/model/pitcherLeagueSession/seasonEnd/useContinueYearEnd'
import { useOpenMatchPrepare } from '@/app/model/pitcherLeagueSession/nextGame/useOpenMatchPrepare'

/** 128 에 서 있고 팝업이 없다 — 팝업이 떠 있으면 키가 안 먹는다(0x1d06a 의 0x754f9) */
const isBracketKeyOpen = (scene: PitcherScene, popup: PostseasonPopup | null) => scene === '포스트시즌' && popup === null

/** 128 포스트시즌 대진 — [다음] 과 팝업 닫기 */
export function usePostseasonActions(scope: PitcherScope) {
  const { atoms, random, aceLevels, announceHiddenOpen, readRegularSeasonOtherModes } = scope
  const career = usePitcherValue(atoms, careerAtom)
  const scene = usePitcherValue(atoms, sceneAtom)
  const postseasonPopup = usePitcherValue(atoms, postseasonPopupAtom)
  const { commit } = usePitcherSaveWriters(scope)
  const continueYearEnd = useContinueYearEnd(scope)
  const openMatchPrepare = useOpenMatchPrepare(scope)
  /** 128 이 끝났다 (팝업 7 · 8 닫힘 → 132 연말) — 접어 둔 연말 사슬을 이어 연말 0x10c54 의 이벤트로 */
  const finishPostseason = useCallback(
    (finished: PitcherCareer) => {
      atoms.set(postseasonPopupAtom, null)
      continueYearEnd(finished, [...atoms.get(yearEndViewedAtom), PITCHER_POSTSEASON_STEP_ID])
    },
    [atoms, continueYearEnd],
  )
  /**
   * 대진 128 [다음] — 키 0x13da0 (팝업이 떠 있으면 키가 안 먹는다, 0x1d06a 의 0x754f9).
   * 끝났으면 [137] 우승 팀 발표(팝업 7) · 지금 라운드에 내 팀이 있으면 142 경기 준비(→ 144 → 경기 장면)
   * · 아니면 CPU 끼리 내 차례/끝까지 돌리고 128 에 머문다 — CPU 끼리 경기(0xc2760)는 리그 표의 +0x2c 로 서고 깎인 값을 남긴다
   * (회복 없음, `applyPitcherPostseasonProgress`). 0xa4f60 의 −2(그대로)는 국가대항전(S+0x12c)일 때만이다 — 포스트시즌 경기도
   * 시리즈 날짜 g 로 정규시즌처럼 맞바꾼다 (g == 0 이면 0x1b684 로 내가 0번 · 그 뒤 k = ((g−1)%6)/2+1 — 선발은 시리즈 짝수 날 등판).
   */
  const pressPostseason = useCallback(() => {
    if (career === null || career.postseason === null || !isBracketKeyOpen(scene, postseasonPopup)) return
    const series = career.postseason
    if (series.round === '종료') return atoms.set(postseasonPopupAtom, { kind: '우승발표', champion: series.champion ?? -1 })
    if (isMyTurn(series, career.teamId)) return openMatchPrepare()
    commit(applyPitcherPostseasonProgress(career, random, aceLevels))
  }, [aceLevels, atoms, career, commit, openMatchPrepare, postseasonPopup, random, scene])
  /** 정규시즌 우승 팝업 0xb 닫힘(0x15b84~0x15c52) — 보상 뒤 128 에 머문다. 0x29 "오토봇 배트" 검사는 다른 두 저장을 읽는다 */
  const receiveRegularSeasonReward = useCallback(
    (career: PitcherCareer) => {
      const otherModes = readRegularSeasonOtherModes?.()
      const rewarded = applyRegularSeasonReward(career, REGULAR_SEASON_HIDDEN_ID.투수편, otherModes)
      commit(rewarded)
      announceHiddenOpen?.(regularSeasonOpenedHiddenIds(career, rewarded, otherModes))
      atoms.set(postseasonPopupAtom, null)
    },
    [announceHiddenOpen, atoms, commit, readRegularSeasonOtherModes],
  )
  /**
   * 128 팝업 닫힘 — 틀 0x15984. 0xb 는 보상 뒤 128 에 머물고(해금 0x32 — 투수편), 7 → (내 팀 우승이면 8) → 132.
   * 0x15c4e · 0x15c76 의 0x62369 — 새로 열었으면 공용 창 알림 (0x29 먼저, 투수편 0x32 는 대기)
   */
  const closePostseasonPopup = useCallback(() => {
    if (career === null || scene !== '포스트시즌' || postseasonPopup === null) return
    if (postseasonPopup.kind === '정규시즌우승') return receiveRegularSeasonReward(career)
    if (postseasonPopup.kind !== '우승발표') return finishPostseason(applyKoreanSeriesReward(career))
    const next = popupAfterChampion(career, postseasonPopup.champion)
    if (next !== null) return atoms.set(postseasonPopupAtom, next)
    finishPostseason(career)
  }, [atoms, career, finishPostseason, postseasonPopup, receiveRegularSeasonReward, scene])
  return { pressPostseason, closePostseasonPopup }
}
