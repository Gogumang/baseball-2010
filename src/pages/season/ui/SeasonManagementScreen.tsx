import { RawScreen } from '@/shared/ui'
import type { SeasonState } from '@/entities/season-mode/model/seasonRecord'
import { SEASON_GAME_COUNT } from '@/entities/season-mode/model/seasonRecord'
import {
  MANAGEMENT_MENU, managementMenuTarget, opensManagementMenu,
} from '@/entities/season-mode/model/seasonStateMachine'
import type { ManagementMenuItem, SeasonSceneState } from '@/entities/season-mode/model/seasonStateMachine'
import { SeasonListWindow } from '@/widgets/season/ui/SeasonListWindow'
import { SeasonStatusBar } from '@/widgets/season/ui/SeasonStatusBar'
import { useSeasonCursor } from '@/widgets/season/model/useSeasonCursor'
import type { SeasonListRow } from '@/widgets/season/ui/SeasonListWindow'

/** 트레이닝·외출 칸 번호 (점프표 0xcbe40 의 2·3) */
const TRAINING_INDEX = 2
const OUTING_INDEX = 3

/** 질병 이름 — StrMODE[185 + 종류] (P4 6절). 원본 문자열표가 웹에 없어 이름만 옮겼다 */
const ILLNESS_NAMES: readonly string[] = ['건강', '감기', '몸살', '식중독', '배탈']

export interface SeasonManagementScreenProps {
  readonly state: SeasonState
  /**
   * 칸을 골랐다. 원본 점프표 `0xcbe40` 이 가리키는 장면 상태를 함께 넘긴다
   * (0 시즌정보 0xcd · 1 구단관리 0xce · 2 트레이닝 0xcf · 3 외출 0xd1 · 4 아이템 0xd0 · 5 다음경기 0xd8).
   */
  readonly onSelect: (item: ManagementMenuItem, target: SeasonSceneState) => void
  /** 취소(−16) — 원본은 `0xbc290(앱, 0x103)` 으로 **메인 메뉴 장면**으로 나간다 (P4 1b) */
  readonly onExit: () => void
}

/**
 * 시즌 관리 메뉴 (장면 0x105 상태 **0xc9**, 갱신 0x4efc · 키 0x8f30 · 그리기 0x73b8).
 *
 * 6칸은 `0x6c219(메뉴, 6, 1, 1)` 로 만든 한 열짜리 메뉴다 (P4 1b 확정).
 * 이 화면은 **경기 수가 짝수일 때만** 열린다 — StrHOWTO[18] "2경기마다 관리 메뉴".
 *
 * ⚠️ 관리 메뉴 그리기(0x73b8)의 좌표는 아직 안 풀렸다 — **원본 배치 미해독 — 근사**로
 * 공용 판 (24, 54, 192, 212) 에 한 열 목록을 얹었다 (`seasonWindowLayout.ts` 머리 주석).
 */
export function SeasonManagementScreen({ state, onSelect, onExit }: SeasonManagementScreenProps) {
  const { record } = state
  // 갱신 0x4efc: SR+4 가 서 있으면 트레이닝·외출 칸을 끈다 — 이벤트 4 대사
  // "트레이닝, 외출 중 딱 한 가지 일만" 과 같은 규칙이다 (P4 3절 확정).
  const rows: readonly SeasonListRow[] = MANAGEMENT_MENU.map((label, index) => ({
    id: label,
    label,
    isDisabled: record.acted && (index === TRAINING_INDEX || index === OUTING_INDEX),
  }))

  const select = (index: number) => {
    const target = managementMenuTarget(index)
    if (target === null || rows[index].isDisabled === true) return
    onSelect(MANAGEMENT_MENU[index], target)
  }
  const { cursor, moveTo } = useSeasonCursor({ count: rows.length, onSelect: select, onCancel: onExit })

  const illness = record.illness === 0 ? '' : `\n질병 : ${ILLNESS_NAMES[record.illness] ?? '질병'}`

  return (
    <RawScreen>
      <SeasonListWindow
        title="관리 메뉴"
        rows={rows}
        cursor={cursor}
        onMoveCursor={moveTo}
        onSelect={select}
        onBack={onExit}
        backLabel="메인 메뉴"
        footer={
          `${record.yearIndex + 1}년차 ${record.games}/${SEASON_GAME_COUNT}경기` +
          `${opensManagementMenu(record) ? '' : ' (관리 메뉴가 열리는 때가 아니다)'}` +
          `${record.acted ? '\n이번 주기에는 트레이닝·외출 중 하나만 할 수 있다' : ''}` +
          illness
        }
      />
      <SeasonStatusBar record={record} teamMorale={state.teamMorale} />
    </RawScreen>
  )
}
