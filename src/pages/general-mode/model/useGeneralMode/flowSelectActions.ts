import type { Dispatch, SetStateAction } from 'react'
import type { PlayerSide } from '@/entities/game/model/gameState'
import { chooseAiTeam, chooseFirstBat, chooseStadium, chooseUserTeam, moveFirstBat, moveStadium } from '@/pages/general-mode/lib/generalModeFlow'
import type { GeneralModeFlowState } from '@/pages/general-mode/lib/generalModeFlow'

/** 상태 18~20 고르기 — 준비 기록 · 단계 규칙(`generalModeFlow`)을 그대로 적는 손잡이 여섯 */
export function flowSelectActionsOf(setFlow: Dispatch<SetStateAction<GeneralModeFlowState>>) {
  return {
    selectUserTeam: (teamId: number) => setFlow((current) => chooseUserTeam(current, teamId)),
    selectAiTeam: (teamId: number) => setFlow((current) => chooseAiTeam(current, teamId)),
    moveFirstBat: (side: PlayerSide) => setFlow((current) => moveFirstBat(current, side)),
    selectFirstBat: (side: PlayerSide) => setFlow((current) => chooseFirstBat(current, side)),
    moveStadium: (stadiumId: number) => setFlow((current) => moveStadium(current, stadiumId)),
    selectStadium: (stadiumId: number) => setFlow((current) => chooseStadium(current, stadiumId)),
  }
}
