import { useEffect, useEffectEvent } from 'react'
import { noteSkinShakeDirection } from '@/shared/lib/cursorShake/skinShakeDirection'
import { RawScreen } from '@/shared/ui'
import { TEAMS } from '@/shared/config/original/teams'
import { EDIT_GRID_SHAPE, EDIT_TEAM_COUNT } from '@/pages/special-edit/lib/specialEditFlow'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { useGridCursorBounce } from '@/shared/lib/gridCursorBounce/gridCursorBounce'
import { useListPageEntry } from '@/widgets/screen-frame/model/useListPageEntry'
import { SkinBackdrop, moveGridCursor, teamGridOpenShapeOf } from '@/pages/special-edit/ui/specialEdit/otherSlices'
import type { AnnalsDirection } from '@/pages/special-edit/ui/specialEdit/otherSlices'
import { EditTeamDetail } from '@/pages/special-edit/ui/specialEdit/EditTeamDetail'
import { EditTeamGrid } from '@/pages/special-edit/ui/specialEdit/EditTeamGrid'

export interface EditTeamSelectProps {
  readonly cursor: number
  readonly gamePoint: number
  readonly onMove: (direction: AnnalsDirection) => void
  readonly onPoint: (index: number) => void
  readonly onChoose: () => void
  readonly onBack: () => void
  /** 머리띠가 미끄러져 들어오는가 — 상태 29 에 처음 선 하위 0 만 (`ScreenFrame` 의 `slides`) */
  readonly slides: boolean
}

/** 에디트 10칸 격자의 열림 애니 꼴 — 2줄 · 세로틈 8 (k 9, 0x64032~0x6403c) */
const EDIT_GRID_OPEN = teamGridOpenShapeOf(EDIT_TEAM_COUNT)

/** 격자 키 — 방향키와 숫자 2·4·6·8 (격자 키 처리 0x6c299 의 표 0xd2e7c) */
const ARROW_DIRECTIONS: ReadonlyMap<string, AnnalsDirection> = new Map([
  ['ArrowLeft', 'left'],
  ['ArrowRight', 'right'],
  ['ArrowUp', 'up'],
  ['ArrowDown', 'down'],
  ['4', 'left'],
  ['6', 'right'],
  ['2', 'up'],
  ['8', 'down'],
])
const CHOOSE_KEYS: ReadonlySet<string> = new Set(['Enter', '5'])
/** CLR(−16) — 웹은 다른 화면과 같이 Escape · Backspace 둘 다 CLR 로 받는다 (갱신 0x2b2e0 하위 0) */
const BACK_KEYS: ReadonlySet<string> = new Set(['Escape', 'Backspace'])

/**
 * 하위 0 — 목록 k 9 = 팀 고르기 본문 0x63dee (P6 2a-2): A (58,110) 에 팀 로고·이름 막대, B (178,96) 에 능력치 도형,
 * 딱지 157 "PLAYER" · 159 "ABILITY", 격자 `0x79ed5(…, 9, 120, 182, …, 40, 5열, 행 = 10/5)`.
 * 팀 0~9 는 늘 열려 있어 잠김 그림이 없다.
 */
export function EditTeamSelect({ cursor, gamePoint, onMove, onPoint, onChoose, onBack, slides }: EditTeamSelectProps) {
  const team = TEAMS[cursor] ?? TEAMS[0]
  // 갱신 0x2b2e0 은 하위 0([skin+0xe6] == 0, 0x2b30e~0x2b318)에서 맨 앞에 [[0x1552cfc]+0xe4] == 0 이면 아무것도 안 한다(0x2b31a~0x2b326)
  // — 머리띠가 미끄러지는 동안(본문 없음)과 격자 열림 애니(0x79fa8) 동안이다. 애니는 [skin+0xe8] = 넷째 인자 1 이라 미끄러질 때 돈다
  const entry = useListPageEntry({ slides, grid: { shape: EDIT_GRID_OPEN, isAnimated: slides } })
  const { keyLock } = entry
  const gridOpen = entry.grid
  // 격자 시작 0x7a005(격자, [skin+0xe8], 1, 1) — [격자+6] = 1 이라 칸이 바뀐 키에 커서 튕김 (0x6409c)
  const bounce = useGridCursorBounce()

  const handleKey = useEffectEvent((event: KeyboardEvent) => {
    if (keyLock.current) return
    const direction = ARROW_DIRECTIONS.get(event.key)
    if (direction !== undefined) {
      // 하위 0: 격자 vt+0x18(숫자키 꼴 1)이 바꾼 키를 0x5550d 에 넘긴다(2b328~2b33e) — '2' '4' '6' '8' 도 방향으로 남는다(Q-10)
      noteSkinShakeDirection(direction)
      event.preventDefault()
      if (moveGridCursor(EDIT_GRID_SHAPE, cursor, direction) !== cursor) bounce.start(direction)
      return onMove(direction)
    }
    if (CHOOSE_KEYS.has(event.key)) {
      event.preventDefault()
      return onChoose()
    }
    if (BACK_KEYS.has(event.key)) {
      event.preventDefault()
      onBack()
    }
  })
  // 등록 차례는 옛 그대로 — deps 가 바뀔 때만 다시 건다(다른 처리기와의 차례 유지). 처리는 그때 렌더 값으로
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => handleKey(event)
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onMove, onChoose, onBack, keyLock, cursor, bounce.start])

  return (
    <RawScreen>
      {/* 0x2e1e0 첫 부름 — 메뉴 바탕 0x58371(skin, main_title, 0) */}
      <SkinBackdrop kind="메뉴바탕" />
      {gridOpen !== null && (
        <>
          <EditTeamDetail team={team} cursor={cursor} slides={slides} />
          <EditTeamGrid
            cursor={cursor}
            shape={EDIT_GRID_OPEN}
            gridOpen={gridOpen}
            bounce={bounce.offset}
            onPress={(index) => (index === cursor ? onChoose() : onPoint(index))}
          />
        </>
      )}

      {/* 머리띠 0x54d95(skin, 1 "팀선택", 5 되돌아가기) — 0x2e224 */}
      <ScreenFrame title="팀선택" gamePoint={gamePoint} onBack={onBack} footer={5} slides={slides} />
    </RawScreen>
  )
}
