import { useCallback } from 'react'
import { YEAR_GOAL_EVENT_ID, markEventSeen } from '@/entities/season-mode/model/seasonEventFlow'
import { judgeSeasonEnding, ENDING_BONUS_GAME_POINTS } from '@/entities/season-mode/model/seasonRewards'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { ENDING_BONUS_UNIT, SEASON_STAT_MODE } from '@/app/model/seasonSession/constants/seasonConstants'
import { type SeasonScope, useSeasonValue } from '@/app/model/seasonSession/atoms/seasonScope'
import { saveAtom } from '@/app/model/seasonSession/atoms/saveAtoms'
import { sceneAtom } from '@/app/model/seasonSession/atoms/sceneAtoms'
import { openedHiddenIdsAtom } from '@/app/model/seasonSession/atoms/uiAtoms'
import { useSeasonSaveWriters } from '@/app/model/seasonSession/state/useSeasonSaveWriters'
import { useGamePointPurse } from '@/app/model/seasonSession/state/useGamePointPurse'

/** 이벤트 고르기 · 시스템 창 · 구장 히든 · 대회 히든 팀 · 엔딩 보너스 */
export function useSeasonEventActions(scope: SeasonScope) {
  const { atoms, recordStat } = scope
  const save = useSeasonValue(atoms, saveAtom)
  const { commit, updateGlobals } = useSeasonSaveWriters(scope)
  const { gainGamePoint } = useGamePointPurse(scope)
  const confirmSeasonEventChoice = useCallback(
    (_eventId: number, leftEventIds: readonly number[]) => {
      const current = atoms.get(saveAtom)
      if (current === null) return
      const record = leftEventIds.filter((id) => id !== YEAR_GOAL_EVENT_ID).reduce(markEventSeen, current.state.record)
      commit({ ...current, state: { ...current.state, record } })
    },
    [atoms, commit],
  )
  /**
   * 이벤트 system 창 답 0 — 0x7fe90(상자): 0x7b998(모드 2)이면 [[상자+0x150]+0x187] = 1, 그리고 0x22755([0x1400054], 1) 저장.
   * 이미 켜져 있어도 원본은 저장한다. 재생이 끝날 때 목표 창 이벤트를 보고 켜는 자리(`finishSeasonEvent`)는 같은 값이라 그대로 둔다.
   */
  const confirmEventSystemWindow = useCallback(() => {
    const current = atoms.get(saveAtom)
    if (current === null) return
    const { record } = current.state
    commit(record.yearGoalShown ? current : { ...current, state: { ...current.state, record: { ...record, yearGoalShown: true } } })
  }, [atoms, commit])
  /**
   * 구장 히든 아이템 해금 (`0x81d0` → `0x9f6cc(app, 종류, k, 1)`).
   * 원본 자리가 전역기록이라 시즌 레코드가 아니라 전역 칸(`SeasonGlobalSlots`)에 쌓고 곧바로 저장한다 (0x62368 → 0x1f1b9).
   * 해금 알림 창(`0x62368` → StrCOMMON[139] + [141])은 상점 화면이 완료 팝업을 닫을 때 띄운다(`StadiumShopScreen`).
   */
  const openStadiumItems = useCallback(
    (unlockIds: readonly number[]) => {
      updateGlobals((slots) => {
        const added = unlockIds.filter((id, index) => !slots.openedStadiumIds.includes(id) && unlockIds.indexOf(id) === index)
        return added.length === 0 ? slots : { ...slots, openedStadiumIds: [...slots.openedStadiumIds, ...added] }
      })
    },
    [updateGlobals],
  )
  /** 0xe684 → 0x65de4 — 전역 해금표(웹 `openedHiddenIds`, 팀은 10~14 그대로)에 쓴다. 앱이 전역 기록으로 모은다 */
  const openCupHiddenTeams = useCallback(
    (teams: readonly number[]) => {
      atoms.set(openedHiddenIdsAtom, (opened) => {
        const added = teams.filter((id) => !opened.includes(id))
        return added.length === 0 ? opened : [...opened, ...added]
      })
    },
    [atoms],
  )
  /**
   * 엔딩 보너스 팝업 0x2b 닫힘 — 0x8bd8(직접 떴다):
   * ```
   * 8bf0  [팝업+0x248] == 0x2b && 답 [+0x21c] == 0 → 답 = −1
   * 8c0e  e = 0xa3085(SR) ; 보너스 = 0xcbc2e[e] × 1000
   * 8c34  G(+0x64) += 보너스 → 0~99999 ; 0x1f1b9 전역기록 저장
   * 8c54  SR+0x7b = 1 ; 0x1fded · 0x22755(저장, 1)
   * 8c70  0x22c7d(보너스, 2)(모드 2 G 획득 통계) ; 0x1f1e1(통계 저장)
   * ```
   */
  const receiveEndingBonus = useCallback(() => {
    if (save === null || save.state.record.endingBonusReceived) return
    const endingIndex = judgeSeasonEnding(save.state.record)
    const bonus = (ENDING_BONUS_GAME_POINTS[endingIndex ?? 0] ?? 0) * ENDING_BONUS_UNIT
    gainGamePoint(bonus)
    commit({ ...save, state: { ...save.state, record: { ...save.state.record, endingBonusReceived: true } } })
    recordStat?.({ kind: 'G획득', mode: SEASON_STAT_MODE, amount: bonus })
  }, [commit, gainGamePoint, recordStat, save])
  /**
   * 엔딩을 넘긴다 — 키 0x6b3c 의 SR+0x7b ≠ 0 갈래(6b52~6b6e)가 단계 [this+0x140] 를 1 로 올리고 화면 전환(종류 1)을 건 뒤,
   * 0x8bd8 의 8ccc~8d2c 가 팝업 없이 단계 1 이고 전환이 끝나면 **SR+0x1bc = 1** · 저장(0x1fded · 0x22755) · 0xbcb49(0xc9) ·
   * 전환(종류 2). 곧 엔딩 뒤는 메인 메뉴가 아니라 관리 메뉴 0xc9 이고, SR+0x1bc 는 이때 선다 — 그 전에 끄면 phase 6 이라
   * 다시 들어오면 0xf5 로 온다(보너스를 받았으면 SR+0x7b 가 서 있어 팝업 없이).
   * 두 효과기는 화면 쪽이 돈다(r165 확정 — 틱 시계 통일 뒤): 종류 1 은 `SeasonEndingScreen` 이 단계 1 의 `SeasonScreenFade` 끝에서야
   * 이 함수를 부르고(8cd2~8cee 단계 == 1 · 끝 +0x10 == 2), 종류 2(8d1e~8d2c)는 `SeasonRoute` 가 0xc9 위에 건다. 그래서 여기는 기다리지 않는다.
   */
  const finishEnding = useCallback(() => {
    if (save === null) return
    if (!save.state.record.endingSeen) {
      commit({ ...save, state: { ...save.state, record: { ...save.state.record, endingSeen: true } } })
    }
    atoms.set(sceneAtom, SEASON_SCENE_STATE.관리메뉴)
  }, [atoms, commit, save])
  return { confirmSeasonEventChoice, confirmEventSystemWindow, openStadiumItems, openCupHiddenTeams, receiveEndingBonus, finishEnding }
}
