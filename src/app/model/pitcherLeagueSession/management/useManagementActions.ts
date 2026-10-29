import { useCallback } from 'react'
import { awardPitcherTitles, nextPitcherTitleOf } from '@/entities/pitcher-career/model/pitcherTitles'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { leagueUsageOf, PITCHER_LEAGUE_MODE } from '@/entities/collection/model/annalsStats'
import { restartsManagementBgmFrom } from '@/app/model/screenBgm'
import { type PitcherScope, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import {
  freshSceneAtom,
  heldTitleAtom,
  isResultWindowOpenAtom,
  managementBgmRestartAtom,
  managementReentryCountAtom,
  sceneAtom,
} from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import type { PitcherScene } from '@/app/model/pitcherLeagueSession/types/scene'
import { usePitcherSaveWriters } from '@/app/model/pitcherLeagueSession/state/usePitcherSaveWriters'
import { useShownCareer } from '@/app/model/pitcherLeagueSession/state/useShownCareer'

/** 관리 화면(105) — 칭호 확인 · 다시 들어옴 · 결과 창 · 확인 키 · 화면이 계산한 커리어 저장 · 화면 옮기기 */
export function useManagementActions(scope: PitcherScope) {
  const { atoms, recordStat } = scope
  const heldTitle = usePitcherValue(atoms, heldTitleAtom)
  const shown = useShownCareer(scope)
  const { commit, commitWith } = usePitcherSaveWriters(scope)
  /** 칭호 팝업 확인 0x1b1e4 — 직전 값을 받아 붙인다(지갑 다리가 맞춰 둔 G를 옛 값으로 되돌리지 않는다) */
  const confirmTitle = useCallback(() => {
    atoms.set(heldTitleAtom, null)
    commitWith((current) => {
      const title = heldTitle ?? nextPitcherTitleOf(current)
      return title === null ? current : awardPitcherTitles(current, [title])
    })
  }, [atoms, commitWith, heldTitle])
  /** 화면이 '관리' 인 채 105 에 다시 들어온다 — `from` 이 0x1aec4 의 배경음 4 목록에 들면 4 를 다시 튼다(`managementBgmRestart`) */
  const reenterManagement = useCallback(
    (from?: number) => {
      atoms.set(managementReentryCountAtom, (count) => count + 1)
      if (from !== undefined && restartsManagementBgmFrom(from)) atoms.set(managementBgmRestartAtom, (count) => count + 1)
    },
    [atoms],
  )
  const setResultWindowOpen = useCallback((isOpen: boolean) => atoms.set(isResultWindowOpenAtom, isOpen), [atoms])
  /** 105 관리 메뉴 확인 키 — 0x12654 가 메뉴 칸을 보기 전에 mgr+0x304 = 0 */
  const pressManagementConfirm = useCallback(() => atoms.set(freshSceneAtom, false), [atoms])
  /**
   * 관리 화면(구질 훈련 창 포함)이 계산해 돌려준 커리어를 저장한다 — `actions.save`.
   *
   * 이 길로 G 가 줄어드는 것은 세 가지뿐이고, 원본은 셋 다 G 를 뺀 뒤 `0x22c29(모드 3 → 2, 비용)` 로 투수편 소모 GP 에 적는다:
   * 슬롯 확장(0x148d8) · 마구 훈련(훈련 적용 0xa3bac 종류 4 → 0xa3cac) · 구질 훈련(종류 5 → 0xa3d76).
   * 화면 쪽(관리 메뉴·구질 훈련 창)은 다른 작업 구역이라 여기서 보이는 G 와 견줘 줄어든 만큼을 적는다
   * (세 길 모두 G 가 모자라면 막혀 0 으로 잘리는 일이 없어 줄어든 값 = 비용).
   */
  const save = useCallback(
    (next: PitcherCareer) => {
      const spent = shown === null ? 0 : shown.gamePoint - next.gamePoint
      commit(next)
      if (spent > 0) recordStat({ kind: 'G사용', usage: leagueUsageOf(PITCHER_LEAGUE_MODE), amount: spent })
    },
    [commit, recordStat, shown],
  )
  const goto = useCallback((next: PitcherScene) => atoms.set(sceneAtom, next), [atoms])
  return { confirmTitle, reenterManagement, setResultWindowOpen, pressManagementConfirm, save, goto }
}
