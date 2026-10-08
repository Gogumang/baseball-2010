import { useEffect, useState } from 'react'
import { Button, DialogueBox, FrameSprite, MarkupText, MessageBox, Notice, Panel, PixelScreen, RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { BATTER_MISSIONS, PITCHER_MISSIONS, missionKeyOf } from '@/entities/mission/model/missionGoal'
import type { OriginalMission } from '@/shared/config/original/missions'
import { missionRewardOf } from '@/entities/mission/model/missionReward'
import { stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import {
  BOTTOM_FRAME, DESCRIPTION_BOX, DESCRIPTION_TEXT, EVENT_MISSION_CELL, EVENT_MISSION_EMPTY_TEXT, GRID, MISSION_GRID_SHAPE,
  NO_MISSION_TEXT, PANEL, REWARD_ROW, SUCCESS_ROW, TAB_LABEL, TITLE, cellPositionOf,
} from '@/pages/mission-select/lib/missionSelectLayout'
import { moveGridCursor } from '@/pages/record/lib/annalsGrid'
import { EventMissionWindow } from '@/pages/mission-select/ui/EventMissionWindow'
import type { EventMissionAnswer } from '@/pages/mission-select/ui/EventMissionWindow'
import * as styles from '@/pages/mission-select/ui/MissionSelectScreen.css'

const SLT_FRAME = './sprites/slt_frame'
const IMG_TEXT = './sprites/img_text/frames'

const imageSrc = (folder: string, id: number) => `${folder}/${String(id).padStart(3, '0')}.png`

interface MissionSelectScreenProps {
  readonly clearedKeys: readonly string[]
  /** 미션별 클리어 횟수 (0xa51d0) — 보상 G 가 다시 깰수록 줄어서 횟수를 보여 준다 */
  readonly clearCounts?: Readonly<Record<string, number>>
  readonly initialSide: OriginalMission['side']
  /**
   * 편 바꾸기 버튼을 보이는가 (기본 보임). 원본은 선수 고르기(하위 17)에서 고른 선수가 편을 정해(투수 → 모드 5,
   * 타자 → 모드 6) 목록 안에서 편을 바꾸는 길이 없다 — 선수를 고르고 들어오면 끈다.
   */
  readonly canSwitchSide?: boolean
  readonly onSelect: (mission: OriginalMission) => void
  readonly onBack: () => void
}

/**
 * 미션 선택 (장면 0x107 상태 1·2 그리기 0x1df08 — P6 2b 확정).
 *
 * 원본은 글자 목록이 아니라 **가운데 192×212 판 + 5×3 미션 격자(28px)** 다.
 * 아래에 slt_frame 프레임 1 틀과 "MISSION" 탭, 설명 상자, 보상 "%dG" · 성공 "%d회" 칸이 붙는다.
 * 편(타자/투수)은 화면 안 탭이 아니라 **머리띠 제목 12/13** 으로 갈린다 — 웹에는 머리띠가 없어
 * 모서리 버튼으로 둔다.
 *
 * 격자 칸 안쪽 그림은 아직 못 읽어(0x7a571 내부) 번호와 잠김·클리어 상태만 그린다.
 *
 * 키 0x1daa4 하위 0: 격자 `vt+0x18`(0x6c031 — 숫자키 꼴 1) 이 커서를 옮기고 돌려준 키로
 * OK(−5 · '5') → 칸 14 면 이벤트 미션 창(`EventMissionWindow`), 아니면 미션 · CLR(−16) → 메인 메뉴(장면 상태 4).
 * 격자 꼴은 0x330 이라 15칸을 감으며 넘긴다(`MISSION_GRID_SHAPE`).
 * 이벤트 미션 창의 답: 미션실행 → 받은 미션이 없어(웹은 통신이 없다) 알림 `EVENT_MISSION_EMPTY_TEXT` 뒤 목록 ·
 * 미션다운 → 원본은 장면 상태 2(0x1e798 — 통신으로 미션 받기 🌐) — ⚠️ 웹은 통신이 없어 창만 닫고 목록에 남는다(미해결).
 */
export function MissionSelectScreen({
  clearedKeys,
  clearCounts = {},
  initialSide,
  canSwitchSide = true,
  onSelect,
  onBack,
}: MissionSelectScreenProps) {
  const [side, setSide] = useState<OriginalMission['side']>(initialSide)
  const [cursor, setCursor] = useState(0)
  /** [this+0xa0] — 이벤트 미션 창의 고름(≠ 0 미션실행). 장면 진입 0x1d9a4 가 1 로 둔다 */
  const [isEventRunSelected, setIsEventRunSelected] = useState(true)
  const [eventWindow, setEventWindow] = useState<'창' | '알림' | null>(null)
  const frames = useFrameOrigins(`${SLT_FRAME}/frames`)
  const textFrames = useFrameOrigins(IMG_TEXT)

  const missions = side === '타자' ? BATTER_MISSIONS : PITCHER_MISSIONS
  const cellCount = GRID.columns * GRID.rows
  /** 칸 14 는 이벤트 미션 칸이라 편의 미션 표에 없다 */
  const selected = cursor === EVENT_MISSION_CELL ? undefined : missions[cursor]

  // 원작: "오픈 되지 않은 미션입니다. 이전 단계를 클리어해주세요"
  const isLockedAt = (index: number) => {
    const previous = missions[index - 1]
    return previous !== undefined && !clearedKeys.includes(missionKeyOf(previous))
  }

  const openEventWindowOrSelect = (index: number) => {
    if (index === EVENT_MISSION_CELL) return setEventWindow('창')
    const mission = missions[index]
    if (mission !== undefined && !isLockedAt(index)) onSelect(mission)
  }

  const onEventAnswer = (answer: EventMissionAnswer) => {
    // 미션실행 · [미션+0xa4] == 0 → 하위 3 알림 (0x1dd06~0x1dd18 · 0x1dc00) — 미션다운 · 취소는 목록으로
    setEventWindow(answer === '미션실행' ? '알림' : null)
  }

  useEffect(() => {
    if (eventWindow !== null) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      // 숫자키 꼴 1 (표 0xd2e7c): '2' ↑ · '4' ← · '6' → · '8' ↓ · '5' OK
      const direction =
        event.key === 'ArrowRight' || event.key === '6' ? 'right'
        : event.key === 'ArrowLeft' || event.key === '4' ? 'left'
        : event.key === 'ArrowDown' || event.key === '8' ? 'down'
        : event.key === 'ArrowUp' || event.key === '2' ? 'up'
        : null
      if (direction !== null) {
        event.preventDefault()
        return setCursor((previous) => moveGridCursor(MISSION_GRID_SHAPE, previous, direction))
      }
      if (event.key === 'Enter' || event.key === ' ' || event.key === '5') {
        event.preventDefault()
        openEventWindowOrSelect(cursor)
        return
      }
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault()
        onBack()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const clears = selected === undefined ? 0 : clearCounts[missionKeyOf(selected)] ?? 0
  const reward = selected === undefined ? 0 : missionRewardOf(selected.stage, clears)
  const cursorCell = cellPositionOf(cursor)

  return (
    <RawScreen>
      <div className={styles.panel}
        style={{ left: PANEL.x, top: PANEL.y, width: PANEL.width, height: PANEL.height }} />

      <div className={styles.title}
        style={{ left: TITLE.x, top: TITLE.y, width: TITLE.width, color: TITLE.color }}>
        {selected?.name ?? ''}
      </div>

      {Array.from({ length: cellCount }, (_unused, index) => {
        const mission = missions[index]
        const { x, y } = cellPositionOf(index)
        if (mission === undefined) {
          return (
            <div key={index} className={styles.cell}
              style={{ left: x, top: y, width: GRID.cell, height: GRID.cell, background: '#1D2A55', color: '#4A5C8F' }}
              onMouseEnter={() => setCursor(index)}
              onClick={() => { setCursor(index); openEventWindowOrSelect(index) }} />
          )
        }
        const isLocked = isLockedAt(index)
        const isCleared = clearedKeys.includes(missionKeyOf(mission))
        return (
          <button key={index} type="button" className={styles.cell} aria-label={mission.name}
            style={{
              left: x, top: y, width: GRID.cell, height: GRID.cell,
              background: isLocked ? '#1D2A55' : isCleared ? '#2E4694' : '#213473',
              color: isLocked ? '#4A5C8F' : '#FFFFFF',
            }}
            onMouseEnter={() => setCursor(index)}
            onClick={() => { setCursor(index); if (!isLocked) onSelect(mission) }}>
            {isLocked ? '' : isCleared ? '★' : index + 1}
          </button>
        )
      })}

      {cursor < cellCount && (
        <div className={styles.cursor}
          style={{ left: cursorCell.x, top: cursorCell.y, width: GRID.cell, height: GRID.cell }} />
      )}

      <FrameSprite folder={`${SLT_FRAME}/frames`} frame={BOTTOM_FRAME.frame} origins={frames}
        x={BOTTOM_FRAME.x} y={BOTTOM_FRAME.y} />
      <img className={styles.sprite} alt="MISSION"
        src={imageSrc(SLT_FRAME, TAB_LABEL.image)} style={{ left: TAB_LABEL.x, top: TAB_LABEL.y }} />

      <div className={styles.descriptionBox}
        style={{
          left: DESCRIPTION_BOX.centerX - DESCRIPTION_BOX.width / 2,
          top: DESCRIPTION_BOX.y,
          width: DESCRIPTION_BOX.width,
          height: DESCRIPTION_BOX.height,
        }} />
      <div className={styles.descriptionText}
        style={{ left: DESCRIPTION_TEXT.x, top: DESCRIPTION_TEXT.y, width: DESCRIPTION_TEXT.width }}>
        {selected === undefined
          ? NO_MISSION_TEXT
          : isLockedAt(cursor)
            ? '오픈 되지 않은 미션입니다 이전 단계를 클리어해주세요'
            : stripGameMarkup(selected.briefing)}
      </div>

      <FrameSprite folder={IMG_TEXT} frame={REWARD_ROW.labelFrame} origins={textFrames}
        x={REWARD_ROW.labelX} y={REWARD_ROW.y} />
      <div className={styles.value}
        style={{ left: REWARD_ROW.labelX + 36, top: REWARD_ROW.y, width: REWARD_ROW.valueWidth }}>
        {reward}G
      </div>
      <FrameSprite folder={IMG_TEXT} frame={SUCCESS_ROW.labelFrame} origins={textFrames}
        x={REWARD_ROW.labelX + 88} y={REWARD_ROW.y} />
      <div className={styles.value}
        style={{ left: REWARD_ROW.labelX + 114, top: REWARD_ROW.y, width: REWARD_ROW.valueWidth }}>
        {clears}회
      </div>

      {canSwitchSide && (
        <Button variant="corner" className={styles.sideButton}
          onClick={() => { setSide(side === '타자' ? '투수' : '타자'); setCursor(0) }}>
          {side === '타자' ? '투수편' : '타자편'}
        </Button>
      )}
      <Button variant="corner" className={styles.backButton} onClick={onBack}>
        ‹ 돌아가기
      </Button>

      {eventWindow === '창' && (
        <EventMissionWindow isRunSelected={isEventRunSelected}
          onToggle={() => setIsEventRunSelected((previous) => !previous)} onAnswer={onEventAnswer} />
      )}
      {eventWindow === '알림' && (
        <MessageBox text={EVENT_MISSION_EMPTY_TEXT} buttons={['OK']} onAnswer={() => setEventWindow(null)} />
      )}
    </RawScreen>
  )
}

/**
 * 미션 설명 화면 — 격자에서 미션을 고른 뒤 도전 여부를 묻는 자리.
 * 원본은 선택 화면 안 설명 상자에서 바로 시작하지만, 웹은 한 단계를 더 둔다 (원본에 없는 화면).
 */
export function MissionBriefing({
  mission,
  onStart,
  onBack,
}: {
  readonly mission: OriginalMission
  readonly onStart: () => void
  readonly onBack: () => void
}) {
  return (
    <PixelScreen
      title={mission.name}
      leftKey={{ label: '도전', onPress: onStart }}
      rightKey={{ label: '취소', onPress: onBack }}
    >
      <DialogueBox>
        <MarkupText raw={mission.briefing} />
      </DialogueBox>
      <Panel heading="목표">
        {mission.goals.map((goal) => (
          <Notice key={goal}>
            · {goal}
          </Notice>
        ))}
        {mission.timeLimitSeconds > 0 && (
          <Notice>· 제한 시간 {mission.timeLimitSeconds}초</Notice>
        )}
      </Panel>
    </PixelScreen>
  )
}
