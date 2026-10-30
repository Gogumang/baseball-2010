import { useState } from 'react'
import { CommonPanel, RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { BATTER_MISSIONS, PITCHER_MISSIONS } from '@/entities/mission/model/missionGoal'
import { EVENT_MISSION_CELL, MISSION_GRID_OPEN, PANEL } from '@/pages/mission-select/lib/missionSelectLayout'
import { useGridCursorBounce } from '@/shared/lib/gridCursorBounce/gridCursorBounce'
import { isFrameSlideClearedAt } from '@/widgets/screen-frame/lib/frameSlide'
import { useListPageEntry } from '@/widgets/screen-frame/model/useListPageEntry'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { isMissionLockedAt } from './missionSelectScreen/missionLock'
import { MissionFrame, MissionTitle } from './missionSelectScreen/MissionFrame'
import { MissionGrid } from './missionSelectScreen/MissionGrid'
import { MissionInfo } from './missionSelectScreen/MissionInfo'
import { MissionPopups, type MissionPopup } from './missionSelectScreen/MissionPopups'
import { IMG_TEXT, SLT_FRAME } from './missionSelectScreen/missionSelectAssets'
import type { MissionSelectScreenProps } from './missionSelectScreen/missionSelectProps'
import { SkinBackdrop } from './missionSelectScreen/otherSlices'
import { useEventMissionAnswer, type EventMissionWindowKind } from './missionSelectScreen/useEventMissionAnswer'
import { isMissionListBlocked, useMissionSelectKeys } from './missionSelectScreen/useMissionSelectKeys'

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
  gamePoint,
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
  const [eventWindow, setEventWindow] = useState<EventMissionWindowKind>(null)
  /** OK 팝업 — [60] 잠긴 칸 알림 · [61] 도전 확인 */
  const [popup, setPopup] = useState<MissionPopup>(null)
  const frames = useFrameOrigins(`${SLT_FRAME}/frames`)
  const textFrames = useFrameOrigins(IMG_TEXT)

  const missions = side === '타자' ? BATTER_MISSIONS : PITCHER_MISSIONS
  /** 칸 14 는 이벤트 미션 칸이라 편의 미션 표에 없다 */
  const selected = cursor === EVENT_MISSION_CELL ? undefined : missions[cursor]
  const isLockedAt = (index: number) => isMissionLockedAt(missions, index, clearedKeys, side)

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
  const [eventKeyAnswer, setEventKeyAnswer] = useEventMissionAnswer(eventWindow, setEventWindow)
  useMissionSelectKeys(isMissionListBlocked(eventWindow, popup, eventKeyAnswer), cursor, setCursor, bounce.start, openEventWindowOrSelect, onBack)

  const frame = <MissionFrame side={side} gamePoint={gamePoint} onBack={onBack} slides={slides} />
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

      <MissionTitle cursor={cursor} selected={selected} />
      <MissionGrid
        missions={missions}
        cursor={cursor}
        bounceOffset={bounce.offset}
        open={gridOpen}
        clearedKeys={clearedKeys}
        isLockedAt={isLockedAt}
        onPressCell={(index) => {
          setCursor(index)
          openEventWindowOrSelect(index)
        }}
      />
      <MissionInfo cursor={cursor} selected={selected} clearCounts={clearCounts} frames={frames} textFrames={textFrames} />
      {/* 웹 [투수편/타자편] 바꾸기 단추는 걷었다 — 원본은 선수 고르기(하위 17)에서 고른 선수가 편을 정해(투수 → 모드 5,
          타자 → 모드 6) 목록 안에서 편을 바꾸는 길이 없다 */}
      {frame}
      <MissionPopups
        eventWindow={eventWindow}
        isEventRunSelected={isEventRunSelected}
        popup={popup}
        onToggleEventRun={() => setIsEventRunSelected((previous) => !previous)}
        onEventKey={setEventKeyAnswer}
        onCloseEventWindow={() => setEventWindow(null)}
        onClosePopup={() => setPopup(null)}
        onSelect={onSelect}
      />
    </RawScreen>
  )
}
