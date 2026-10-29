import { useEffect, useState } from 'react'
import { skinNameBarsValue } from '@/shared/lib/skinNameBars/skinNameBars'
import { noteSkinShakeKey } from '@/shared/lib/cursorShake/skinShakeDirection'
import { TEAMS } from '@/shared/config/original/teams'
import { pointEntryCursor } from '@/entities/season-mode/model/entryEditor'
import type { EntryKey } from '@/entities/season-mode/model/entryEditor'
import {
  SPECIAL_EDIT_STEP,
  chooseEditTeam,
  closeEditName,
  createSpecialEditState,
  editEntryListsOf,
  editTargetOf,
  frameEditEntry,
  moveEditGrid,
  pointEditGrid,
  pressEditEntryKey,
} from '@/pages/special-edit/lib/specialEditFlow'
import { ENTRY_TABLES_WIDE, EntryEditorScreen } from '@/widgets/entry-editor'
import {
  ABILITY_CHART,
  ABILITY_RADAR_LABELS,
  ANCHOR_B,
  AbilityRadarPanel,
  SkinBackdrop,
  abilityAxisMaximumLengthOf,
} from '@/pages/special-edit/ui/specialEdit/otherSlices'
import { EditTeamSelect } from '@/pages/special-edit/ui/specialEdit/EditTeamSelect'
import { EditNamePopup } from '@/pages/special-edit/ui/specialEdit/EditNamePopup'

interface SpecialEditScreenProps {
  /** 머리띠 0x54d95 는 제목이 있으면 전역 G(mgr+0x64)를 같이 그린다 */
  readonly gamePoint: number
  /** 이름 저장 0xaa4ad(이름표, id, 글, 투수?) + 파일 저장 0x1f1b9 */
  readonly onRename: (id: number, isPitcher: boolean, name: string) => void
  /** 하위 0 의 CLR → 스페셜 목록(상태 6, 0x2b432 `0xbcb49(this+0x18, 6)`) */
  readonly onBack: () => void
}

/**
 * **스페셜 에디트** (메인 메뉴 상태 29) — 선수 이름 바꾸기. 흐름·근거는 `specialEditFlow` 머리글.
 *
 * 그리기 0x2e1e0: 배경 0x58371 → 목록 k 9(팀 고르기 본문 0x63dee, 격자 10칸)을 **늘** 그리고,
 * - 하위 0: 머리띠 `0x54d95(skin, 1 "팀선택", 5 되돌아가기)`
 * - 하위 1·2: 그 위에 엔트리 창 `0x5d055 → 0x5cfec` + 머리띠 `0x54d95(skin, 1 "팀선택", 투수 탭 ? 0xf : 0x17)`
 *
 * 배경은 메뉴 바탕 0x58371(skin, main_title, 0) — 하위 0 · 1 · 2 모두 맨 먼저 깐다(0x2e1e0 의 첫 부름).
 * 엔트리 창(넓은 표 · 커서 이름 칸만 [skin+0x438] = 1 — `EntryEditorScreen` / `widgets/entry-editor/lib/entryListWindow`).
 *
 * 엔트리 창 아래에 깔린 팀 고르기 본문(딱지 · 큰 로고 · 이름 막대 · 격자 30~267)은 판(15, 55, 210, 220) = x 15~224 안이라 가려진다.
 * 다만 능력치 도형의 오른쪽 이름 상자 둘(축 끝 x = 178 + (48·cos45 >> 16) = 211 → 상자 x 210, 폭 26 — 0x5b412~0x5b532)은
 * x 225~235 가 판 밖으로 나와 원본에서도 보인다(r166 확정) — 그래서 그 도형(커서 팀, 다 자란 값)만 엔트리 창 밑에 깐다.
 * 도형 객체 [skin+0xd4] 는 웹도 앱에 하나(`useRadarGrowth`)라 하위가 바뀌어도 다시 만들지 않고(+0x1e3 그대로) 지금값(E+8)에서
 * 한 그림 한 걸음씩 잇는다 — 다 자라기 전에 골라도 원본처럼 이어 자란다(r181 — `continueRadarGrowth`).
 * 입력 창(판 높이 0x6e · 입력 방식 표시)은 아래 `EditNamePopup`.
 */
export function SpecialEditScreen({ gamePoint, onRename, onBack }: SpecialEditScreenProps) {
  const [state, setState] = useState(createSpecialEditState)
  // 머리띠 미끄러짐 [skin+0x84] 는 상태 29 진입 0x24804(24846) 와 그림 0x2e1e0 의 공용 목록 0x63b14(상태 틱 0 인 첫 그림)만 세운다.
  // 하위 0 ↔ 1 ↔ 2 는 [skin+0xe6] 만 바뀌고 상태 틱은 이어지므로 다시 미끄러지지 않는다 — 처음 선 하위 0 에서만 미끄러진다
  const [hasLeftTeamSelect, setLeftTeamSelect] = useState(false)
  if (state.step !== SPECIAL_EDIT_STEP.팀고르기 && !hasLeftTeamSelect) setLeftTeamSelect(true)
  // 하위 1(선수 고르기 — 엔트리 창, [skin+0xe6] == 1)은 갱신 0x2b2e0 의 2b444~2b44e 가 **날 키**를 0x5550d 에 넘긴 뒤 창 키 0x55865 에
  // 준다([skin+0xe4] 확인 없이) — 화살표면 까딱임 방향 [skin+0x8c] 에 남는다(Q-10). 하위 2(이름 창)는 안 넘긴다
  useEffect(() => {
    if (state.step !== SPECIAL_EDIT_STEP.선수고르기) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      noteSkinShakeKey(event.key)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [state.step])

  if (state.step === SPECIAL_EDIT_STEP.팀고르기) {
    return (
      <EditTeamSelect
        cursor={state.gridCursor}
        gamePoint={gamePoint}
        slides={!hasLeftTeamSelect}
        onMove={(direction) => setState((previous) => moveEditGrid(previous, direction))}
        onPoint={(index) => setState((previous) => pointEditGrid(previous, index))}
        onChoose={() => setState((previous) => chooseEditTeam(previous))}
        onBack={onBack}
      />
    )
  }

  const lists = editEntryListsOf(state.team)
  const onKey = (key: EntryKey) => setState((previous) => pressEditEntryKey(previous, key))
  const onFrame = () => setState(frameEditEntry)

  return (
    <EntryEditorScreen
      editor={state.editor}
      lists={lists}
      underlay={
        <>
          <SkinBackdrop kind="메뉴바탕" />
          {/* 팀 고르기 본문 0x63dee 의 ABILITY 판 — 오른쪽 이름 상자가 엔트리 창 오른쪽 밖으로 나온다(머리말) */}
          <AbilityRadarPanel
            center={{ x: ANCHOR_B.x + ABILITY_CHART.dx, y: ANCHOR_B.y + ABILITY_CHART.dy }}
            radius={ABILITY_CHART.radius}
            maximumLength={abilityAxisMaximumLengthOf(ABILITY_CHART.radius)}
            labelFrames={ABILITY_RADAR_LABELS.team}
            targets={(TEAMS[state.team] ?? TEAMS[0]).values.slice(2)}
            restartKey={state.team}
            fromZero={false}
          />
        </>
      }
      teamName={TEAMS[state.team]?.name ?? ''}
      isAceLocked={false}
      gamePoint={gamePoint}
      title="팀선택"
      slides={false}
      tables={ENTRY_TABLES_WIDE}
      // 0x2b2e0 은 [skin+0x333] 을 세우지 않는다 — 앞 화면이 남긴 값이다. 부팅 뒤 처음이면 0 — skin 할당 0x1238 → 0x2ac4 가
      // 할당 뒤 memset(0) 한다(2ad4). 이 칸에 쓰는 곳은 모두 1 이다(시즌 엔트리 · 0x16af8 · 0x2648c · 교체 창 0x37904 · 0x37e5c —
      // `shared/lib/skinNameBars`, 확정 r166) — 그 화면을 한 번이라도 거쳤으면 이름 칸을 덧그린다
      showsNameBars={skinNameBarsValue() !== 0}
      isCursorNameOnly
      onFrame={onFrame}
      ticksEveryFrame
      onKey={onKey}
      onMoveCursor={(index) => setState((previous) => ({ ...previous, editor: pointEntryCursor(previous.editor, lists, index) }))}
      onCloseAceLocked={() => undefined}
      overlay={
        state.step === SPECIAL_EDIT_STEP.이름입력 && (
          <EditNamePopup
            onConfirm={(name) => {
              const target = editTargetOf(state)
              if (target !== null) onRename(target.id, target.isPitcher, name)
              setState((previous) => closeEditName(previous))
            }}
            onCancel={() => setState((previous) => closeEditName(previous))}
          />
        )
      }
    />
  )
}
