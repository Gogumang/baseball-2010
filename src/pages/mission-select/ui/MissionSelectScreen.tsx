import { useEffect, useState } from 'react'
import { setAppTickTimeout } from '@/shared/lib/frameClock/frameClock'
import { CommonPanel, FrameSprite, InsetBox, MarkupText, MessageBox, RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { BATTER_MISSIONS, PITCHER_MISSIONS, missionKeyOf } from '@/entities/mission/model/missionGoal'
import type { OriginalMission } from '@/shared/config/original/missions'
import { missionRewardOf, missionRewardTierOf } from '@/entities/mission/model/missionReward'
import { stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import {
  BOTTOM_FRAME, DESCRIPTION_BOX, DESCRIPTION_TEXT, EVENT_MISSION_CELL, EVENT_MISSION_EMPTY_TEXT, EVENT_MISSION_TITLE, EVENT_TAB_LABEL, GRID, MISSION_GRID_SHAPE,
  GRADE_MARKS, MISSION_GRID_OPEN, NO_MISSION_TEXT, PANEL, REWARD_ROW, SUCCESS_ROW, TAB_LABEL, TITLE, cellPositionOf,
} from '@/pages/mission-select/lib/missionSelectLayout'
import { moveGridCursor } from '@/pages/record/lib/annalsGrid'
import { useGridCursorBounce } from '@/shared/lib/gridCursorBounce/gridCursorBounce'
import { EventMissionWindow } from '@/pages/mission-select/ui/EventMissionWindow'
import type { EventMissionAnswer } from '@/pages/mission-select/ui/EventMissionWindow'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { isFrameSlideClearedAt } from '@/widgets/screen-frame/lib/frameSlide'
import { useListPageEntry } from '@/widgets/screen-frame/model/useListPageEntry'
import { gridOpenCellDy } from '@/shared/lib/gridOpen/gridOpen'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import * as styles from '@/pages/mission-select/ui/MissionSelectScreen.css'

const SLT_FRAME = './sprites/slt_frame'
const IMG_TEXT = './sprites/img_text/frames'

/** StrMAINMENU[60] — 잠긴 칸 OK (0x1db84~0x1dba4: 0x74ef5(…, 종류 1)) */
const LOCKED_MISSION_TEXT = '!C오픈 되지 않은 미션입니다.!N이전 단계를 클리어해주세요'
/** StrMAINMENU[61] — 열린 칸 OK, %s = 미션 레코드 +0x2e 이름 (0x1db34~0x1db7c: 0x74ef5(…, 종류 2)) */
const challengeTextOf = (name: string) => `!C[!cFFFF00${name}!cFFFFFF]!N미션에 도전하시겠습니까?`

const imageSrc = (folder: string, id: number) => `${folder}/${String(id).padStart(3, '0')}.png`

interface MissionSelectScreenProps {
  readonly clearedKeys: readonly string[]
  /** 미션별 클리어 횟수 (0xa51d0) — 보상 G 가 다시 깰수록 줄어서 횟수를 보여 준다 */
  readonly clearCounts?: Readonly<Record<string, number>>
  readonly initialSide: OriginalMission['side']
  readonly onSelect: (mission: OriginalMission) => void
  readonly onBack: () => void
  /** 머리띠 G포인트 — 안 주면 0 */
  readonly gamePoint?: number
  /** 머리띠가 미끄러져 들어오는가(상태 1 진입 0x1d9a4 가 [skin+0x84] = 1). 기본 true — 시험은 false 로 다 내려온 자리에서 본다 */
  readonly slides?: boolean
}

/**
 * 미션 선택 (장면 0x107 상태 1·2 그리기 0x1df08 — P6 2b 확정).
 *
 * 원본은 글자 목록이 아니라 **가운데 192×212 판 + 5×3 미션 격자(28px)** 다.
 * 아래에 slt_frame 프레임 1 틀과 "MISSION" 탭, 설명 상자, 보상 "%dG" · 성공 "%d회" 칸이 붙는다.
 * 편(타자/투수)은 화면 안 탭이 아니라 **머리띠 제목 12/13** 으로 갈린다(`ScreenFrame` 미션모드타자편 · 투수편).
 * 편 바꾸기 모서리 버튼은 웹 추가다(원본은 고른 선수가 편을 정한다).
 *
 * 격자 칸 안쪽 그림은 아직 못 읽어(0x7a571 내부) 번호와 잠김·클리어 상태만 그린다.
 *
 * 키 0x1daa4 하위 0: 격자 `vt+0x18`(0x6c031 — 숫자키 꼴 1) 이 커서를 옮기고 돌려준 키로
 * OK(−5 · '5') → 칸 14 면 이벤트 미션 창(`EventMissionWindow`), 잠긴 칸이면 StrMAINMENU[60] 알림, 열린 칸이면 [61] 도전 확인 —
 * 예면 곧바로 경기(장면 상태 3) · CLR(−16) → 메인 메뉴(장면 상태 4).
 * 격자 꼴은 0x330 이라 15칸을 감으며 넘긴다(`MISSION_GRID_SHAPE`).
 * 이벤트 미션 창의 답: 미션실행 → 받은 미션이 없어(웹은 통신이 없다) 알림 `EVENT_MISSION_EMPTY_TEXT` 뒤 목록 ·
 * 미션다운 → 원본은 장면 상태 2(0x1e798 — 통신으로 미션 받기 🌐) — ⚠️ 웹은 통신이 없어 창만 닫고 목록에 남는다(미해결).
 */
export function MissionSelectScreen({
  clearedKeys,
  clearCounts = {},
  initialSide,
  onSelect,
  onBack,
  gamePoint = 0,
  slides = true,
}: MissionSelectScreenProps) {
  /**
   * 장면 그리기 0x1e9e8 (직접 떴다): 공무늬 0x5fd61(skin, 0, 0, W, H) → [skin+0x84] == 0 일 때만 상태 그리기 0x1e99c(…, 3) →
   * 머리띠 0x54d95(skin, [장면+0x88] == 6 ? 12 : 13, 바닥 5, 0) → 0x72391 → 창 0x746cd.
   * 제목 12/13 은 점프표 0xd19b0 의 5502a · 55058 — game_frame 18 "미션모드" + 부제 타자편/투수편.
   * 상태 1 진입 0x1d9a4(1d9be)가 [skin+0x84] = 1 을 세워 머리띠가 미끄러져 들어오고, 그동안은 판 · 격자 · 설명을 하나도 안 그린다
   * (0x1df08 머리 1df22~1df2a 도 같은 깃발로 끝 0x1e730 에 빠진다). 깃발은 머리띠가 다 내려온 그림에서 지워진다(`isFrameSlideClearedAt`).
   * 미끄러지는 동안에도 키는 그대로 받는다 (직접 뜬 것): 장면 메시지 0x1e76c 가 메시지 2 를 곧장 0x1daa4 로 넘기고(1e786),
   * 0x1daa4 는 머리에서 격자 vt+0x18 · 0x5550c(skin, 키 — 방향키 −1~−4 를 [skin+0x8c] 에 적을 뿐) 뒤 하위 상태 [this+0x18] 로
   * 갈라질 뿐 [skin+0x84] 를 읽지 않는다 — 웹도 키를 그대로 받는다.
   */
  const updates = useUpdateCounter()
  const isBodyShown = !slides || isFrameSlideClearedAt(updates)
  /**
   * 격자 열림 애니 (`MISSION_GRID_OPEN`) — 본문 첫 그림에 격자를 짓고 늘 돈다. 0x1df08 은 0x7a571 이 돌려준 값을 버리고(0x1e1fc)
   * 키 0x1daa4 도 그 값을 안 본다 → 애니 동안에도 키는 그대로다. 커서는 끝난 뒤([격자+9])에만 그린다(0x7b3a2).
   * 시험용 `slides = false` 는 다 내려온 · 다 연 자리에서 본다.
   */
  const gridOpen = useListPageEntry({ slides, grid: { shape: MISSION_GRID_OPEN, isAnimated: slides } }).grid
  const bounce = useGridCursorBounce()
  const side = initialSide
  const [cursor, setCursor] = useState(0)
  /** [this+0xa0] — 이벤트 미션 창의 고름(≠ 0 미션실행). 장면 진입 0x1d9a4 가 1 로 둔다 */
  const [isEventRunSelected, setIsEventRunSelected] = useState(true)
  const [eventWindow, setEventWindow] = useState<'창' | '알림' | null>(null)
  /** OK 팝업 — [60] 잠긴 칸 알림 · [61] 도전 확인 */
  const [popup, setPopup] = useState<{ readonly kind: '잠김' } | { readonly kind: '도전'; readonly mission: OriginalMission } | null>(null)
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

  /**
   * 키 0x1daa4 하위 0 의 OK (0x1db06~0x1dba8): 칸 14 → 이벤트 미션 창 · `0xa520d(미션, 칸)` 이 0(잠김)이면 [60] 확인 팝업(하위 0 그대로),
   * 아니면 [61] 예/아니오 팝업 뒤 하위 1. 하위 1(0x1dbaa~0x1dbf6)은 답 [창+0x21c] 이 0(예)이면 [미션+0xbd] = 칸 · 저장 · 상태 3(경기),
   * 1(아니오)이면 하위 0 으로 돌아온다.
   */
  const openEventWindowOrSelect = (index: number) => {
    if (index === EVENT_MISSION_CELL) return setEventWindow('창')
    const mission = missions[index]
    if (mission === undefined) return undefined
    setPopup(isLockedAt(index) ? { kind: '잠김' } : { kind: '도전', mission })
  }

  /**
   * [this+0x18] — 이벤트 미션 창 키가 그 갱신에 고른 하위 상태. 키 함수 0x1daa4 가 이것을 보는 것은 창이 다 닫힌 다음 갱신이다
   * (틀 0x1ea98 의 1eaac — 창이 떠 있으면 0x754f9 가 1 이라 키 함수를 건너뛴다). 그때까지 목록 키도 안 돈다.
   */
  const [eventKeyAnswer, setEventKeyAnswer] = useState<EventMissionAnswer | null>(null)
  useEffect(() => {
    if (eventKeyAnswer === null || eventWindow !== null) return undefined
    return setAppTickTimeout(() => {
      setEventKeyAnswer(null)
      // 미션실행 · [미션+0xa4] == 0 → 하위 3(0x1dd06~0x1dd18) 의 키 함수 0x1dc00 이 0x74ef5 알림 · 하위 4 — 미션다운(하위 2 → 통신 —
      // 웹에 없다) · 취소(하위 0)는 목록으로
      if (eventKeyAnswer === '미션실행') setEventWindow('알림')
    }, 1)
  }, [eventKeyAnswer, eventWindow])

  useEffect(() => {
    if (eventWindow !== null || popup !== null || eventKeyAnswer !== null) return undefined
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
        const next = moveGridCursor(MISSION_GRID_SHAPE, cursor, direction)
        // 칸이 바뀐 키(커서 +0x25)면 고른 칸을 튕긴다 — 시작 0x7a005(격자, 1, 1, 0) 의 [격자+6] = 1 (0x1e1b0). 키 0x1daa4 가 방향을 적는다
        if (next !== cursor) bounce.start(direction)
        return setCursor(next)
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

  const frame = (
    <ScreenFrame title={side === '타자' ? '미션모드타자편' : '미션모드투수편'} gamePoint={gamePoint} footer={5} onBack={onBack}
      slides={slides} />
  )
  if (!isBodyShown) {
    return (
      <RawScreen>
        <SkinBackdrop kind="공무늬" />
        {frame}
      </RawScreen>
    )
  }

  return (
    <RawScreen>
      <SkinBackdrop kind="공무늬" />
      {/* 1df9a 공용 판 0x55e61(skin, W/2, H/2, 192, 212, 0, 0x22, 위 띠 0x10, 0, 0, 0) — 알파·아래 띠·제목 탭·어둡게 자리의
          r7 = [skin+0x84] 는 0 이 아니면 0x1e730(이 함수의 끝 — 아무것도 안 그리고 돌아간다)로 빠지므로 여기서는 늘 0 이다 */}
      <CommonPanel x={PANEL.x} y={PANEL.y} width={PANEL.width} height={PANEL.height} topBand={0x10} testId="미션-고르기-판" />

      <div className={styles.title}
        style={{ left: TITLE.x, top: TITLE.y, width: TITLE.width, color: TITLE.color }}>
        {cursor === EVENT_MISSION_CELL ? EVENT_MISSION_TITLE : selected?.name ?? ''}
      </div>

      {/*
        격자 칸 — 원본 미션 고르기 키 0x1dcb0 · 격자 [this+0x70](0x1d9f6 vt+0x1c(5, 3, 1, 0x330))는 키패드로만 커서를 옮긴다.
        마우스는 누름(고르기 + OK)만 받는다. 올려 두기만 해도 커서를 옮기던 onMouseEnter 는 걷었다 — 멈춘 포인터가 키 커서를
        빼앗는다(메인 메뉴 r27 과 같은 종류)
      */}
      {Array.from({ length: cellCount }, (_unused, index) => {
        const mission = missions[index]
        const shake = index === cursor ? bounce.offset : null
        const x = cellPositionOf(index).x + (shake?.dx ?? 0)
        const y = cellPositionOf(index).y + (gridOpen === null ? 0 : gridOpenCellDy(MISSION_GRID_OPEN, gridOpen.state, index)) + (shake?.dy ?? 0)
        if (mission === undefined) {
          return (
            <div key={index} className={styles.cell}
              style={{ left: x, top: y, width: GRID.cellWidth, height: GRID.cell, background: '#1D2A55', color: '#4A5C8F' }}
              onClick={() => { setCursor(index); openEventWindowOrSelect(index) }} />
          )
        }
        const isLocked = isLockedAt(index)
        const isCleared = clearedKeys.includes(missionKeyOf(mission))
        return (
          <button key={index} type="button" className={styles.cell} aria-label={mission.name}
            style={{
              left: x, top: y, width: GRID.cellWidth, height: GRID.cell,
              background: isLocked ? '#1D2A55' : isCleared ? '#2E4694' : '#213473',
              color: isLocked ? '#4A5C8F' : '#FFFFFF',
            }}
            onClick={() => { setCursor(index); openEventWindowOrSelect(index) }}>
            {isLocked ? '' : isCleared ? '★' : index + 1}
          </button>
        )
      })}

      {cursor < cellCount && (gridOpen === null || gridOpen.state.isDone) && (
        <div className={styles.cursor}
          style={{ left: cursorCell.x + bounce.offset.dx, top: cursorCell.y + bounce.offset.dy, width: GRID.cellWidth, height: GRID.cell }} />
      )}

      <FrameSprite folder={`${SLT_FRAME}/frames`} frame={BOTTOM_FRAME.frame} origins={frames}
        x={BOTTOM_FRAME.x} y={BOTTOM_FRAME.y} />
      {/* 0x1e018: 고른 칸이 14 면 이미지 52, 아니면 51 */}
      {cursor === EVENT_MISSION_CELL
        ? <img className={styles.sprite} alt="EVENT"
            src={imageSrc(SLT_FRAME, EVENT_TAB_LABEL.image)} style={{ left: EVENT_TAB_LABEL.x, top: EVENT_TAB_LABEL.y }} />
        : <img className={styles.sprite} alt="MISSION"
            src={imageSrc(SLT_FRAME, TAB_LABEL.image)} style={{ left: TAB_LABEL.x, top: TAB_LABEL.y }} />}

      {/* 1dfe0 칸 0xbb28d(W/2, H/2 + 0x21, 173, 65, 정렬 2) — 왼쪽 = 120 − (173 >> 1) = 34 */}
      <InsetBox x={DESCRIPTION_BOX.centerX - (DESCRIPTION_BOX.width >> 1)} y={DESCRIPTION_BOX.y}
        width={DESCRIPTION_BOX.width} height={DESCRIPTION_BOX.height} testId="미션-설명-칸" />
      <div className={styles.descriptionText}
        style={{ left: DESCRIPTION_TEXT.x, top: DESCRIPTION_TEXT.y, width: DESCRIPTION_TEXT.width }}>
        {selected === undefined
          ? <MarkupText raw={NO_MISSION_TEXT} />
          : isLockedAt(cursor)
            ? '오픈 되지 않은 미션입니다 이전 단계를 클리어해주세요'
            : stripGameMarkup(selected.briefing)}
      </div>

      <FrameSprite folder={IMG_TEXT} frame={REWARD_ROW.labelFrame} origins={textFrames}
        x={REWARD_ROW.labelX} y={REWARD_ROW.y} />
      <div className={styles.value}
        style={{ left: REWARD_ROW.valueX, top: REWARD_ROW.y, width: REWARD_ROW.valueWidth }}>
        {reward}G
      </div>
      <FrameSprite folder={IMG_TEXT} frame={SUCCESS_ROW.labelFrame} origins={textFrames}
        x={SUCCESS_ROW.labelX} y={REWARD_ROW.y} />
      <div className={styles.value}
        style={{ left: SUCCESS_ROW.valueX, top: REWARD_ROW.y, width: REWARD_ROW.valueWidth }}>
        {clears}회
      </div>
      {/* 0x1e6ce~0x1e722 — 등급 표시 네모 (byte1 >> 1) & 7 개를 (165 + 8i, 183) */}
      {selected !== undefined && Array.from({ length: missionRewardTierOf(selected.stage) }, (_, index) => (
        <img key={index} className={styles.sprite} alt="" data-testid="미션-등급-네모"
          src={imageSrc(SLT_FRAME, GRADE_MARKS.image)}
          style={{ left: GRADE_MARKS.x + GRADE_MARKS.step * index, top: GRADE_MARKS.y }} />
      ))}

      {/* 웹 [투수편/타자편] 바꾸기 단추는 걷었다 — 원본은 선수 고르기(하위 17)에서 고른 선수가 편을 정해(투수 → 모드 5,
          타자 → 모드 6) 목록 안에서 편을 바꾸는 길이 없다 */}
      {frame}

      {eventWindow === '창' && (
        <EventMissionWindow isRunSelected={isEventRunSelected}
          onToggle={() => setIsEventRunSelected((previous) => !previous)}
          onKey={setEventKeyAnswer} onClosed={() => setEventWindow(null)} />
      )}
      {popup?.kind === '잠김' && (
        <MessageBox text={LOCKED_MISSION_TEXT} buttons={['OK']} onAnswer={() => setPopup(null)} />
      )}
      {popup?.kind === '도전' && (
        <MessageBox text={challengeTextOf(popup.mission.name)} buttons={['예', '아니오']}
          onAnswer={(answer) => {
            setPopup(null)
            if (answer === 0) onSelect(popup.mission)
          }} />
      )}
      {eventWindow === '알림' && (
        <MessageBox text={EVENT_MISSION_EMPTY_TEXT} buttons={['OK']} onAnswer={() => setEventWindow(null)} />
      )}
    </RawScreen>
  )
}
