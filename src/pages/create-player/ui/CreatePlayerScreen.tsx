import { useEffect, useState } from 'react'
import { Button, FrameSprite, MessageBox, RawScreen, TextField } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import {
  DEFAULT_ROOKIE_PROFILE, DEFAULT_TEAM_ID, MAXIMUM_NAME_BYTES, nameByteLengthOf, rookieAbilityOf,
} from '@/entities/career/model/playerCareer'
import type { RookieProfile } from '@/entities/career/model/playerCareer'
import { TEAMS } from '@/shared/config/original/teams'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { batterLayersOf } from '@/widgets/batting-stage/lib/batterLayers'
import type { BatterLayer } from '@/widgets/batting-stage/lib/batterLayers'
// 원본은 등록 화면을 관리 화면 기본정보 카드(0x15e20)로 그린다 — 카드 좌표·레이더를 그대로 가져다 쓴다
import { FIGURE_BOX, FIGURE_FOOT, INFO_BOARD, RIGHT_PANEL } from '@/pages/management/lib/basicInfoLayout'
import { RadarChart } from '@/pages/management/ui/RadarChart'
import {
  ACTION_ROW, ARROW, BACKDROP, CHOICES, CURSOR_COLOR, FIGURE_POSE_FRAME, HINT_BOX, INFO_CELLS,
  INFO_FRAME, ROOKIE_BATTING_ORDER, ROW_HINTS, ROW_ORDER, choiceStepped, cursorRectOf, isCursorVisibleAt,
} from '@/pages/create-player/lib/createPlayerLayout'
import type { CreatePlayerRowId, InfoCellId } from '@/pages/create-player/lib/createPlayerLayout'
import * as styles from '@/pages/create-player/ui/CreatePlayerScreen.css'

const MODE_UI = './sprites/mode_ui/frames'
const IMG_TEXT = './sprites/img_text/frames'

const frameSrc = (folder: string, frame: number) => `${folder}/${String(frame).padStart(3, '0')}.png`

interface CreatePlayerScreenProps {
  readonly onCreate: (name: string, profile: RookieProfile) => void
  readonly onCancel: () => void
}

/**
 * 선수 등록 (나만의리그 상태 0x66 — 갱신 0x16f28 · 그리기 0x15f34, C-4 · C-6 확정).
 *
 * 원본은 **관리 화면 기본정보 카드(0x15e20)** 를 그대로 그리고, 고른 줄의 값 칸에 노란 깜빡이 커서만
 * 얹는다. 고르는 줄은 다섯 — **이름 · 타입 · 포지션 · 손 · 피부** 순서다(줄 목록 [this+0x74], 0x17360).
 * 등록 화면에 **타순 선택은 없다**(C-4 확정) — 타순 칸은 보여 주기만 하고 신인 9번은 0xa4c2c 가 넣는다.
 *
 * ⚠️ 팀 고르기(0x65)는 웹에 아직 없어 기본 팀(서울 드래곤즈)으로 둔다 — 팀명 칸은 그래서 붙박이다.
 * ⚠️ 피부를 바꿔도 그림 색이 바뀌지 않는다. 원본은 몸통 팔레트를 **피부×15 + 팀** 번호의 .mpl 로
 *    갈아 끼우는데(C-1), 웹 스프라이트는 "팀 2 · 황인" 한 벌로 구워져 있고 .mpl 적용은 tools/ 몫이다.
 */
export function CreatePlayerScreen({ onCreate, onCancel }: CreatePlayerScreenProps) {
  const [name, setName] = useState('')
  const [profile, setProfile] = useState<RookieProfile>(DEFAULT_ROOKIE_PROFILE)
  const [selectedRow, setSelectedRow] = useState(0)
  const [isConfirming, setIsConfirming] = useState(false)
  const [tick, setTick] = useState(1)
  const labelOrigins = useFrameOrigins(IMG_TEXT)
  const uiOrigins = useFrameOrigins(MODE_UI)

  const trimmedName = name.trim()
  const ability = rookieAbilityOf(profile.battingTypeIndex, profile.positionIndex)
  const selectedId = ROW_ORDER[selectedRow]

  const valueOf = (id: InfoCellId): string => {
    if (id === '팀명') return (TEAMS[DEFAULT_TEAM_ID] ?? TEAMS[0]).name
    if (id === '이름') return name
    // 필살 = 선수 +0x18 필살 번호의 이름. 신인은 필살타법이 없어 빈 칸이다
    if (id === '필살') return ''
    if (id === '타순') return String(ROOKIE_BATTING_ORDER)
    const choice = CHOICES[id]
    return choice.options[choice.valueOf(profile)] ?? ''
  }

  /** 값 바꾸기 — 원본 목록의 좌우 키 ([0x7c] 타입 · [0x78] 포지션 · [0x80] 손 · [0x84] 피부) */
  const changeValue = (id: CreatePlayerRowId, step: number) => {
    setProfile((previous) => choiceStepped(previous, id, step))
  }

  const askToCreate = () => {
    // 빈 이름으로는 확인할 수 없다 (R11 1b — 원본 입력기도 strlen 0 이면 OK 를 안 받는다)
    if (trimmedName.length > 0) setIsConfirming(true)
  }

  // 커서 깜빡임용 틱. 원본은 게임 루프의 갱신 횟수([this+0x2c])를 그대로 쓴다
  useEffect(() => {
    const timer = window.setInterval(() => setTick((previous) => previous + 1), millisecondsPerFrame())
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isTyping = event.target instanceof HTMLInputElement
      if (event.key === 'Escape') {
        event.preventDefault()
        return onCancel()
      }
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault()
        const step = event.key === 'ArrowDown' ? 1 : -1
        return setSelectedRow((previous) => (previous + step + ROW_ORDER.length) % ROW_ORDER.length)
      }
      // 이름 칸에서는 좌우가 글자 커서 몫이다 (원본 입력기도 좌우를 입력 모드 전환에 쓴다)
      if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && !isTyping && selectedId !== '이름') {
        event.preventDefault()
        return changeValue(selectedId, event.key === 'ArrowRight' ? 1 : -1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const cursor = cursorRectOf(selectedRow)
  const labelWidthOf = (frame: number) => labelOrigins?.[String(frame).padStart(3, '0')]?.width ?? 0

  return (
    <RawScreen>
      {/* 바탕 = 공용 창 0x55e60 판 (F-8). 원본 바탕 0x7f4ed 는 미해독이라 이 판으로 빈 칸을 메운다 */}
      <div className={styles.backdrop}
        style={{ left: BACKDROP.x, top: BACKDROP.y, width: BACKDROP.width, height: BACKDROP.height }} />

      {/* 기본정보 카드 0x15e20 — 그림칸 · 오른쪽 판 · 선수 그림 · ABILITY 레이더 · 정보 칸 */}
      <div className={styles.cardPanel}
        style={{ left: FIGURE_BOX.x, top: FIGURE_BOX.y, width: FIGURE_BOX.width, height: FIGURE_BOX.height }} />
      <div className={styles.cardPanel}
        style={{ left: RIGHT_PANEL.x, top: RIGHT_PANEL.y, width: RIGHT_PANEL.width, height: RIGHT_PANEL.height }} />

      {/*
        줄 1(타입)·3(손)을 바꾸면 원본은 그림을 다시 적재한다 (0x10810 → 0x78ab0):
        타입이 몸통 파일(balancer/sluger)을, 손이 좌우를 고른다. 좌우 반전 자체는 C-5 에서 "유력" 이라
        좌타일 때 발 기준(57,160)을 축으로 뒤집는 것으로 옮겼다.
      */}
      <div className={styles.figure}
        style={{
          transformOrigin: `${FIGURE_FOOT.x}px 0`,
          transform: profile.battingSide === 1 ? 'scaleX(-1)' : undefined,
        }}>
        {batterLayersOf(FIGURE_POSE_FRAME, profile.battingTypeIndex).map((layer, index) => (
          <LayerSprite key={index} layer={layer} />
        ))}
      </div>

      {/* 시작 능력치 (0x16e2c) — 타입·포지션을 바꾸면 그때마다 다시 계산된다 */}
      <RadarChart base={ability} shown={ability} />

      <div className={styles.infoBoard}
        style={{ left: INFO_BOARD.x, top: INFO_BOARD.y, width: INFO_BOARD.width, height: INFO_BOARD.height }} />
      {/* 값 칸 그림 = mode_ui 프레임 2 (타자). 프레임 원점이 (60,184) 이라 (0,0) 으로 넘긴다 */}
      <FrameSprite folder={MODE_UI} frame={INFO_FRAME.batter} origins={uiOrigins} x={0} y={0} />

      {INFO_CELLS.map((cell) => {
        const value = valueOf(cell.id)
        return (
          <div key={cell.id}>
            {/* 이름표는 img_text 그림을 오른쪽 정렬로 (0x7c450) */}
            <img className={styles.layer} alt="" src={frameSrc(IMG_TEXT, cell.labelFrame)}
              style={{ left: cell.label.x + cell.label.width - labelWidthOf(cell.labelFrame), top: cell.value.y + 3 }} />
            {cell.id === '이름' ? (
              <form onSubmit={(event) => { event.preventDefault(); askToCreate() }}>
                <TextField className={styles.nameInput} value={name} autoFocus aria-label="이름"
                  style={{ left: cell.value.x, top: cell.value.y, width: cell.value.width, height: cell.value.height }}
                  onFocus={() => setSelectedRow(ROW_ORDER.indexOf('이름'))}
                  onChange={(event) => {
                    // CP949 8바이트까지 (R11 1b — 한글 2바이트 · 그 밖 1바이트, 섞어 써도 된다)
                    if (nameByteLengthOf(event.target.value) <= MAXIMUM_NAME_BYTES) setName(event.target.value)
                  }} />
              </form>
            ) : (
              <div className={styles.infoValue}
                style={{
                  left: cell.value.x, top: cell.value.y, width: cell.value.width, height: cell.value.height,
                  // 타순만 노란 숫자다 (0x7c450)
                  color: cell.id === '타순' ? CURSOR_COLOR : undefined,
                }}>
                {value}
              </div>
            )}
            {cell.rowIndex !== null && cell.id !== '이름' && (
              <button type="button" className={styles.valueButton} aria-label={`${cell.id} ${value}`}
                style={{ left: cell.value.x, top: cell.value.y, width: cell.value.width, height: cell.value.height }}
                onClick={() => setSelectedRow(cell.rowIndex ?? 0)} />
            )}
          </div>
        )
      })}

      {/* 커서 — 타이머 %10 ≠ 0 일 때만 보인다 (0x16038) */}
      <div className={styles.cursor} data-testid="선수등록-커서"
        style={{
          left: cursor.x, top: cursor.y, width: cursor.width, height: cursor.height,
          border: `1px solid ${CURSOR_COLOR}`,
          visibility: isCursorVisibleAt(tick) ? 'visible' : 'hidden',
        }} />

      {/* 고른 줄 양옆 화살표 (0x160a8) — 이름 줄에는 고를 값이 없다 */}
      {selectedId !== '이름' && (
        <>
          <ArrowButton rowId={selectedId} step={-1} onPress={changeValue} />
          <ArrowButton rowId={selectedId} step={1} onPress={changeValue} />
        </>
      )}

      <div className={styles.hint} style={{ left: HINT_BOX.x, top: HINT_BOX.y, width: HINT_BOX.width }}>
        {ROW_HINTS[selectedId]}
      </div>

      <Button variant="corner" className={styles.actionButton}
        style={{ left: ACTION_ROW.leftX, top: ACTION_ROW.y }} onClick={onCancel}>
        취소
      </Button>
      <Button variant="corner" className={styles.actionButton}
        style={{ left: ACTION_ROW.rightX - 40, top: ACTION_ROW.y, width: 40 }}
        disabled={trimmedName.length === 0} onClick={askToCreate}>
        등록
      </Button>

      {/*
        확인(상태 0x67)은 화면을 갈아 끼우지 않는다 — 지금 화면 위에 StrMODE[2] 메시지 상자(0xbbef8)만 얹는다.
        예전 웹판은 빈 화면으로 바꿔 끼워 화면 대부분이 검게 남았다.
      */}
      {isConfirming && (
        <MessageBox
          text="!C이대로 결정 하시겠습니까?"
          buttons={['예', '아니오']}
          onAnswer={(index) => (index === 0 ? onCreate(trimmedName, profile) : setIsConfirming(false))}
        />
      )}
    </RawScreen>
  )
}

/** 선수 그림 한 겹 — 레이어마다 폴더가 달라 원점 파일도 따로 읽는다 */
function LayerSprite({ layer }: { readonly layer: BatterLayer }) {
  const origins = useFrameOrigins(layer.folder)
  return <FrameSprite folder={layer.folder} frame={layer.frame} origins={origins} x={FIGURE_FOOT.x} y={FIGURE_FOOT.y} />
}

/** 값 칸 양옆 화살표 — 그림은 근사(ARROW 주석) */
function ArrowButton({
  rowId, step, onPress,
}: {
  readonly rowId: CreatePlayerRowId
  readonly step: number
  readonly onPress: (rowId: CreatePlayerRowId, step: number) => void
}) {
  const box = INFO_CELLS.find((cell) => cell.id === rowId)?.value
  if (box === undefined) return null
  const left = step < 0 ? box.x - ARROW.gap - ARROW.width : box.x + box.width + ARROW.gap
  return (
    <button type="button" className={styles.arrowButton} aria-label={`${rowId} ${step < 0 ? '이전' : '다음'}`}
      style={{ left, top: box.y + Math.floor((box.height - ARROW.height) / 2), width: ARROW.width, height: ARROW.height }}
      onClick={() => onPress(rowId, step)}>
      <img alt="" src={ARROW.image} style={{ transform: step < 0 ? undefined : 'scaleX(-1)' }} />
    </button>
  )
}
