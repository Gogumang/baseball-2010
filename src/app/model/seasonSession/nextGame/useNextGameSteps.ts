import { useCallback } from 'react'
import { clearSeasonGameRecord } from '@/entities/season-mode/model/seasonReputation'
import { SEASON_SCENE_STATE, SEASON_PHASE } from '@/entities/season-mode/model/seasonStateMachine'
import { SQUAD_PURPOSE, PRE_GAME_ACES_START } from '@/entities/season-mode/model/preGameFlow'
import { withSceneSetupIncome } from '@/app/model/seasonSession/game/sceneSetup'
import type { SeasonSave } from '@/app/model/seasonSession/save/seasonSave'
import type { PendingSeasonGame } from '@/app/model/seasonSession/types/session'
import type { SeasonScope } from '@/app/model/seasonSession/atoms/seasonScope'
import { saveAtom } from '@/app/model/seasonSession/atoms/saveAtoms'
import { sceneAtom } from '@/app/model/seasonSession/atoms/sceneAtoms'
import {
  isMatchSettingsOpenAtom,
  nextGameFromMenuAtom,
  pendingGameAtom,
  preGameAcesAtom,
  squadPurposeAtom,
} from '@/app/model/seasonSession/atoms/nextGameAtoms'
import { useSeasonSaveWriters } from '@/app/model/seasonSession/state/useSeasonSaveWriters'

/** 경기 앞 단계 셋 — 여러 하위 훅(다음경기 · 경기정보 · 경기 뒤 · 포스트시즌)이 같이 부른다. 그림의 값을 안 보는 콜백뿐이다 */
export function useNextGameSteps(scope: SeasonScope) {
  const { atoms } = scope
  const { commit } = useSeasonSaveWriters(scope)
  /**
   * 평판 기록 16칸(SR+0x1a0..0x1af)을 0 으로 — 원본 `0xa3424` = `memset(SR+0x1a0, 0, 16)`.
   *
   * **경기가 끝날 때가 아니라 시작할 때 지운다.** 부르는 곳은 경기 직전 경기정보 화면
   * (시즌 상태 0xdd)의 "경기 시작" 키 `0x83cc` **한 곳뿐**이고, 거기서 곧장 경기 장면으로
   * 넘어간다 (0x84ac `SR = [this+0xa0]` → `ldr r3,[0x85c8] = 0xa3425` → 0xa3424).
   * 웹판은 0xdd 의 확인(`startPendingGame`)과, 화면을 건너뛰는 `playNextGame` 이 이 자리를 맡는다.
   * 근거: `docs/re/S4-season-reputation.md` 2a·7절, `docs/re/R13-season-leftovers.md` 4절.
   */
  const clearGameRecord = useCallback(
    (current: SeasonSave, opponentTeamId: number) => {
      // 0xdd OK 의 0xa3424 뒤 곧장 경기 장면 셋업 — 정규시즌이면 관중·수입 0xa34b8 이 돈다 (`withSceneSetupIncome`)
      commit(
        withSceneSetupIncome(
          {
            ...current,
            state: {
              ...current.state,
              record: { ...current.state.record, gameRecord: clearSeasonGameRecord() },
            },
          },
          opponentTeamId,
        ),
      )
    },
    [commit],
  )
  /**
   * 다음경기 화면 0xd8 에 들어간다 — 들어옴 `0x4cb8`:
   * ```
   * 4cc2  SR+0x50(phase) = 4
   * 4cc8  이전 상태 ≠ 0xd7 이면 0x1fded(app) · 0x22755(app, 1)   ; 저장
   * 4ce0  [this+0x90] vtable+0x14(0, 0)                          ; 1×1 격자 커서를 (0,0) 에 — 보이는 일 없음 (NextGameScreen 주석)
   * ```
   * phase 4 가 저장에 남으므로 이 화면에서 끄고 다시 들어오면 **관리 메뉴가 아니라 0xd8** 로 온다
   * (진입 분기 0xcb 는 짝수 경기라도 phase ∈ {1,3} 일 때만 관리 메뉴다).
   */
  const nextGameEntered = useCallback(
    (current: SeasonSave, fromMenu: boolean, fromSquad = false) => {
      const entered: SeasonSave = {
        ...current,
        state: { ...current.state, record: { ...current.state.record, phase: SEASON_PHASE.다음경기 } },
      }
      // 4cc8 — 이전 상태가 0xd7(경기 전 마선수 고르기 CLR)이면 phase 4 는 메모리에만 쓰고 저장하지 않는다
      if (fromSquad) {
        atoms.set(saveAtom, entered)
      } else {
        commit(entered)
      }
      atoms.set(nextGameFromMenuAtom, fromMenu)
      atoms.set(sceneAtom, SEASON_SCENE_STATE.다음경기)
    },
    [atoms, commit],
  )
  /**
   * 0xd7 경기 전 마선수 고르기로 (this+0x11c = 1). 들어옴 0x5268 이 메뉴+0xd0 = 1 이라 늘 마투수부터다.
   */
  const enterPreGameSquad = useCallback(
    (pending: PendingSeasonGame) => {
      atoms.set(pendingGameAtom, pending)
      atoms.set(squadPurposeAtom, SQUAD_PURPOSE.경기전)
      atoms.set(preGameAcesAtom, PRE_GAME_ACES_START)
      atoms.set(isMatchSettingsOpenAtom, false)
      atoms.set(sceneAtom, SEASON_SCENE_STATE.선수단)
    },
    [atoms],
  )
  return { clearGameRecord, nextGameEntered, enterPreGameSquad }
}
