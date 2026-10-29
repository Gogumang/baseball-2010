import type { SeasonSceneState } from '@/entities/season-mode/model/seasonStateMachine'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { SeasonSave } from '@/app/model/seasonSession/save/seasonSave'
import type { SeasonAutobotBatInput } from '@/entities/season-mode/model/seasonRewards'
import type { SeasonEntryRecordSource } from '@/entities/season-mode/model/seasonEntry'
import type { SeasonAtoms } from '@/app/model/seasonSession/atoms/seasonScope'

/** 장면 진입 함수(0xe9ac 의 상태별 진입)가 받는 것 — 막 들어온 장면과 그 그림의 시즌, 쓰기 손잡이 */
export interface SceneEntry {
  readonly atoms: SeasonAtoms
  readonly scene: SeasonSceneState
  readonly save: SeasonSave
  readonly random: RandomPort
  readonly commit: (next: SeasonSave) => void
  readonly startEvent: (eventId: number, returnScene: SeasonSceneState) => void
  /** 전역기록 +0xbe — 이벤트 100 을 받았는가 (폴링 판정) */
  readonly event100Awarded: boolean
  /** this+0x148 — CPU 트레이드 요청이 서 있는가 (관리 메뉴 알림) */
  readonly isTradeRequested: boolean
  /** 결산 0x29 검사가 읽는 다른 두 모드 저장 · 전역 해금표 — 진입 머리 배경음 뒤에 읽는다 */
  readonly readAutobotBatInput: () => SeasonAutobotBatInput | undefined
  readonly openedHiddenIds: readonly number[]
  readonly recordSourceNow: () => SeasonEntryRecordSource | undefined
}

/** 레코드만 바꾼 시즌 */
export function withSeasonRecord(save: SeasonSave, record: SeasonSave['state']['record']): SeasonSave {
  return { ...save, state: { ...save.state, record } }
}
