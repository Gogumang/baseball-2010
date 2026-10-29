import { useCallback, useEffect, useState } from 'react'
import { activeSound } from '@/shared/api/audio/soundPort'
import { PITCHER_CHANGE_SOUND } from '@/pages/team-game/model/teamGameSounds'
import type { TeamGameSession } from '@/pages/team-game/model/useTeamGame'
import type { ChangeWindowKind } from './teamGameSceneProps'

/** `#` 교체 화면(경기 상태 0xb)이 떠 있는가 — 수비 중이면 투수 교체, 공격 중이면 대타 */
export function useChangeWindow(actions: TeamGameSession['actions']) {
  const [changeWindow, setChangeWindow] = useState<ChangeWindowKind | null>(null)
  // 교체 화면에 **들어설 때** "Time!" 22 (상태 0xb 진입 0x3ae08 → 0x3af06) — 대타도 같은 화면이다
  const audio = activeSound()
  useEffect(() => {
    if (changeWindow === null) return
    audio.play(PITCHER_CHANGE_SOUND)
  }, [audio, changeWindow])
  /**
   * 교체 창 닫기 — 원본 `0x495fc` 의 '#'·CLR 가지는 예약을 지우고 경기 상태 **0xe** 로 간다. 0xe 의 메시지 1 이
   * 돌발 굴림 0x8f158 과 0xf 진입 0x3d954 를 다시 돌리므로 진행기에도 알린다 (`cancelSubstitution`).
   */
  const closeChangeWindow = useCallback(() => {
    if (changeWindow === null) return
    setChangeWindow(null)
    actions.cancelSubstitution()
  }, [actions, changeWindow, setChangeWindow])
  /** 제안 대사를 이미 보여 준 돌발 행 번호 */
  const [shownProposal, setShownProposal] = useState<number | null>(null)
  return { audio, changeWindow, setChangeWindow, closeChangeWindow, shownProposal, setShownProposal }
}
