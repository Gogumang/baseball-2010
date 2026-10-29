import { useCallback } from 'react'
import { type SeasonSceneState, SEASON_SCENE_STATE, SEASON_PHASE } from '@/entities/season-mode/model/seasonStateMachine'
import { YEAR_GOAL_EVENT_ID, cursorAfterCalling } from '@/entities/season-mode/model/seasonEventFlow'
import { activeSound } from '@/shared/api/audio/soundPort'
import { SEASON_EVENT_BGM } from '@/app/model/seasonSession/constants/seasonConstants'
import type { SeasonScope } from '@/app/model/seasonSession/atoms/seasonScope'
import { saveAtom } from '@/app/model/seasonSession/atoms/saveAtoms'
import { sceneAtom } from '@/app/model/seasonSession/atoms/sceneAtoms'
import { eventPlaybackAtom } from '@/app/model/seasonSession/atoms/uiAtoms'
import { eventCursorAtom, playbackSerialAtom } from '@/app/model/seasonSession/atoms/eventAtoms'

/**
 * 번호로 이벤트를 틀고 0xd3 으로 — `0x8bdc8` 은 커서 +0x2c 를 그 레코드 다음으로 옮긴다(0xae170).
 * 연초 목표 내장 이벤트(0x8a680)는 커서를 건드리지 않는다.
 */
export function useStartEvent({ atoms }: SeasonScope) {
  return useCallback(
    (eventId: number, returnScene: SeasonSceneState) => {
      if (eventId !== YEAR_GOAL_EVENT_ID) atoms.set(eventCursorAtom, (cursor) => cursorAfterCalling(cursor, eventId))
      const serial = atoms.get(playbackSerialAtom) + 1
      atoms.set(playbackSerialAtom, serial)
      atoms.set(eventPlaybackAtom, { eventId, returnScene, serial })
      atoms.set(sceneAtom, SEASON_SCENE_STATE.이벤트재생)
      // 0xd3 진입 0x5110 — 0x8be21(이벤트 시작) 뒤 SR+0x50(phase) ≠ 2(정규시즌 경기 끝)이고 내장 이벤트([관리자+0x39f],
      // 연초 목표 0xc038 → 0x8a680)가 아니면 배경음 40 (512c~5152, 나리 114 0x11d00 과 같은 두 가드)
      const phase = atoms.get(saveAtom)?.state.record.phase
      if (eventId !== YEAR_GOAL_EVENT_ID && phase !== SEASON_PHASE.경기끝) activeSound().playBgm(SEASON_EVENT_BGM)
    },
    [atoms],
  )
}
