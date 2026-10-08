import { MessageBox, RawScreen } from '@/shared/ui'
import type { SeasonState } from '@/entities/season-mode/model/seasonRecord'
import {
  MANAGEMENT_MENU, managementMenuTarget,
} from '@/entities/season-mode/model/seasonStateMachine'
import type { ManagementMenuItem, SeasonSceneState } from '@/entities/season-mode/model/seasonStateMachine'
import { SEASON_COMMAND_SLOTS } from '@/pages/season/lib/seasonCommandBar'
import { SeasonCommonFrame } from '@/pages/season/ui/SeasonCommonFrame'
import { useSeasonCursor } from '@/widgets/season/model/useSeasonCursor'

/** 트레이닝·외출·다음경기 칸 번호 (점프표 0xcbe40 의 2·3·5) */
const TRAINING_INDEX = 2
const OUTING_INDEX = 3
const NEXT_GAME_INDEX = 5

/**
 * 0x4efc 가 끄는 칸 — 메뉴 켬 표(메뉴 +0x28) 를 0 으로: SR+4(행동함) 면 칸 2·3, SR+0x1bc(엔딩 본 시즌) 면 칸 2·3·5.
 * 꺼진 칸은 커맨드 줄이 흑백(0xc37a8)으로 그린다.
 *
 * **다시 켜는 곳은 장면을 새로 지을 때뿐이다**(직접 떴다): 장면 0x105 생성 0xfe58 → 0xf684 가 메뉴 [this+0x70] 을 만들고
 * vt+0x1c = 0x6c4bc 가 켬 표를 (행 × 열) 바이트로 새로 잡아 memset(1) 한다. 0x4efc 는 끄기만 한다. SR+4 는 경기 정산
 * (0x4f158 — 장면 0x104)에서 지워지고 경기 뒤에는 장면 0x105 를 새로 지으므로, 들어올 때 레코드로 정하는 이 식과 같다.
 */
export function disabledManagementIndexesOf(record: SeasonState['record']): readonly number[] {
  const disabled = new Set<number>()
  if (record.acted) [TRAINING_INDEX, OUTING_INDEX].forEach((index) => disabled.add(index))
  if (record.endingSeen) [TRAINING_INDEX, OUTING_INDEX, NEXT_GAME_INDEX].forEach((index) => disabled.add(index))
  return [...disabled].sort((a, b) => a - b)
}

export interface SeasonManagementScreenProps {
  readonly state: SeasonState
  /**
   * 칸을 골랐다. 원본 점프표 `0xcbe40` 이 가리키는 장면 상태를 함께 넘긴다
   * (0 시즌정보 0xcd · 1 구단관리 0xce · 2 트레이닝 0xcf · 3 외출 0xd1 · 4 아이템 0xd0 · 5 다음경기 0xd8).
   */
  readonly onSelect: (item: ManagementMenuItem, target: SeasonSceneState) => void
  /** 취소(−16) — 원본은 `0xbc290(앱, 0x103)` 으로 **메인 메뉴 장면**으로 나간다 (P4 1b) */
  readonly onExit: () => void
  /**
   * 진입에서 띄운 예·아니오 알림 — CPU 트레이드 요청 StrMODE[203] (팝업 id 0x27, 0xec10).
   * 떠 있는 동안 메뉴는 키를 안 받는다(원본 `this+0xc0 +0x99 ≠ 0` 이면 키 무시). 답은 0x73b8 이 받는다.
   */
  readonly alert?: { readonly text: string; readonly onAnswer: (accept: boolean) => void } | null
  /**
   * 메뉴 커서 — 원본 메뉴 객체 this+0x70 은 장면이 사는 동안 남아 커서가 상태를 넘어 이어진다(세션이 든다).
   * 안 주면 화면이 0 에서 들고 시작한다.
   */
  readonly cursor?: number
  readonly onCursorChange?: (index: number) => void
  /** 머리띠 G포인트 (저장 +0x64) */
  readonly gamePoint?: number
  /** 가운데 판이 미끄러져 들어오는가 — 이전 상태가 1 · 0xd3 · 0xcb · 0xf5 · 0xf1 이면 0x8a2d8 (0x5044~0x505e) */
  readonly centerSlidesIn?: boolean
}

/**
 * 시즌 관리 메뉴 (장면 0x105 상태 **0xc9**, 진입 0x4efc · 키 0x8f30 · 틀 0x73b8 · 그리기 0x9fe4 → 공통 틀 0x9f60).
 *
 * 6칸은 `0x6c219(메뉴, 6, 1, 1)` 로 만든 한 열짜리 메뉴다 (P4 1b 확정) — 위·아래로 옮긴다.
 * 이 화면은 **경기 수가 짝수일 때만** 열린다 — StrHOWTO[18] "2경기마다 관리 메뉴".
 *
 * 그리기는 공통 틀(`SeasonCommonFrame`): 공 무늬 바탕 · 커맨드 줄 0x7e418(표 0xd47f4 · 0xd4800 — `lib/seasonCommandBar`) ·
 * 상태판 0x7d34c · 가운데 판 0x7f814(감독 · 코치) · 머리띠(시즌모드, 되돌아가기).
 * 틀 0x73b8 은 상태 틀 수로 칸 등장 0x7ff8c 을 돌리고, 틀 2 에 이전 상태가 0xcb·0xcc·0xe3·0xde·0xf9·0xe4·0xe6·0xe5·0xd3·1 이면
 * `0x6ea6d([0x1400058], 4, −1, 1)` = **배경음 4(관리 화면) 반복** 즉시 재생(L 1-A — 0x6ea6c play(obj, n, vol, loop)).
 * 배경음은 앱이 튼다 — `app/model/screenBgm` 의 `useSeasonMenuBgm`(App 이 시즌 장면 번호를 넘긴다).
 */
export function SeasonManagementScreen({
  state, onSelect, onExit, alert = null, cursor: heldCursor, onCursorChange, gamePoint = 0, centerSlidesIn = false,
}: SeasonManagementScreenProps) {
  const { record } = state
  const disabled = disabledManagementIndexesOf(record)
  const disabledIds = new Set(disabled.map((index) => MANAGEMENT_MENU[index]))

  const select = (index: number) => {
    const target = managementMenuTarget(index)
    if (target === null || disabled.includes(index)) return
    onSelect(MANAGEMENT_MENU[index], target)
  }
  const { cursor, moveTo } = useSeasonCursor({
    count: MANAGEMENT_MENU.length, onSelect: select, onCancel: onExit, isEnabled: alert === null,
    // 0x6c444 — 꺼진 칸(켬 표 0)은 위·아래가 건너뛴다
    disabled,
    ...(heldCursor === undefined ? {} : { cursor: heldCursor }),
    ...(onCursorChange === undefined ? {} : { onCursorChange }),
  })

  return (
    <RawScreen>
      <div role="group" aria-label="관리 메뉴">
        <SeasonCommonFrame record={record} teamMorale={state.teamMorale} gamePoint={gamePoint} onBack={onExit}
          centerSlidesIn={centerSlidesIn}
          commandBar={{
            slots: SEASON_COMMAND_SLOTS, cursor, parent: null, disabledIds,
            onHover: moveTo,
            onSelect: (id) => select(MANAGEMENT_MENU.findIndex((label) => label === id)),
          }} />
      </div>
      {alert !== null && (
        // 팝업 0x27 답: 0 예 · 1 아니오 · 0x14 취소 — 아니오·취소는 같은 갈래다 (7488~749e)
        <MessageBox text={alert.text} buttons={['예', '아니오']} onAnswer={(answer) => alert.onAnswer(answer === 0)} />
      )}
    </RawScreen>
  )
}
