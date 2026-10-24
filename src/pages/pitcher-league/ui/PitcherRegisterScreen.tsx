import { useEffect, useMemo, useRef, useState } from 'react'
import { setAppTickInterval } from '@/shared/lib/frameClock/frameClock'
import { FrameSprite, InputMethodText, MessageBox, PaintedRects, PressArea, RawScreen, SolidStamp } from '@/shared/ui'
import { DescriptionBand } from '@/shared/ui/DescriptionBand/DescriptionBand'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { roundEdgePaintsOf } from '@/shared/lib/commonPanel/commonPanel'
import { InputModeBox } from '@/shared/ui/InputMethodText/InputModeBox'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { MAXIMUM_NAME_BYTES, nameByteLengthOf } from '@/entities/career/model/playerCareer'
import {
  DEFAULT_PITCHER_ROOKIE_PROFILE,
  PITCHER_SKIN_LABELS,
  PITCHER_TYPE_COUNT,
  ROOKIE_BREAKING_PITCH_TYPES,
  canRegisterPitcher,
  pitcherRoleChoiceOf,
  pitcherRoleOfChoice,
  toggleBreakingPitchSlot,
} from '@/entities/pitcher-career/model/pitcherRegistration'
import type { PitcherRookieProfile } from '@/entities/pitcher-career/model/pitcherRegistration'
import { DEFAULT_TEAM_ID, createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { pitchTypeNameOf } from '@/entities/pitcher-career/model/pitchTraining'
import { nameWithoutLastChar, registerKeyOf, registerKeyOutcomeOf } from '@/pages/create-player/lib/registerKeys'
import type { RegisterKey } from '@/pages/create-player/lib/registerKeys'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import {
  BREAKING_PITCH_OK_CELL,
  breakingPitchCursorAfter,
  breakingPitchCursorAfterToggle,
  breakingPitchKeyOf,
} from '@/pages/pitcher-league/lib/breakingPitchCursor'
import {
  ARROW_FRAME, ARROW_SIZE, BREAKING_CHOSEN_PLATE, BREAKING_HINT, BREAKING_NAME_OUTLINE, BREAKING_OK, BREAKING_PITCH_FRAME,
  BREAKING_ROW_NUMBERS, BREAKING_ROW_NUMBER_BASE, INPUT_MODE_BOX, NAME_TEXT_AT,
  REGISTER_ROW_HINTS, REGISTER_YELLOW,
  breakingPitchBoxOf, breakingRowNumberBoxOf, cursorBoxOf, registerValueBoxOf,
  valueArrowsOf,
} from '@/pages/pitcher-league/lib/pitcherRegisterLayout'
import type { RegisterBox } from '@/pages/pitcher-league/lib/pitcherRegisterLayout'
import { PitcherBasicInfoCard } from '@/pages/pitcher-league/ui/PitcherBasicInfoCard'
import { PitcherInfoBoard, PitcherInfoPlate } from '@/pages/pitcher-league/ui/PitcherInfoBoard'
import * as managementStyles from '@/pages/management/ui/ManagementScreen.css'

/**
 * 투수 선수 등록 (나만의리그 상태 **0x66** — 갱신 0x16f28 · 그리기 0x15f34) 과 **기본 변화구 2개 고르기 0x67**
 * (진입 0x10b18 · 키 0x12410 · 그리기 0x162bc). 원본 화면 한 장(`RawScreen`)이다 — 배치는 `lib/pitcherRegisterLayout` 머리글(직접 떴다).
 *
 * 고르는 줄은 타자편과 **같은 다섯**이고 뜻만 다르다 — 이름 · 타입(3가지) · **보직**(선발/구원) · 손(우완/좌완) · 피부.
 * 0x66 마지막 줄에서 OK 를 누르면 타자편은 StrMODE[2] 확인 상자를, 투수편은 `0xbcb49(0x67)` 로 간다(0x172a2 → 0x17308).
 * - 처음엔 아무것도 안 골라져 있다(+0x13c..+0x143 = 0). 칸 규칙은 `toggleBreakingPitchSlot`(0x123ac).
 * - OK 칸(8)에서 고른 수가 1 이하면 StrMODE[13] 알림, 2 면 StrMODE[2] 확인 → 예면 104(등록 확정).
 * - CLR 은 0x66 으로 — 0x66 진입 0x17360 은 변화구 바이트를 건드리지 않아 **고른 값이 남는다**.
 * - 칸 커서 [this+0x88] 은 들어올 때마다 칸 0 이고, 옮기기는 `breakingPitchCursor`(0x12410 · 꼴 0x330)다.
 *
 * 카드(0x15e20)는 r55 의 투수 기본정보 카드를 쓴다 — 레이더 실효값은 0xb570d 넷째 인자 0(상태 0x66 · 0x67)이라
 * 질병 · 부상 · 사기 감소를 건너뛴다. 새 선수 레코드에는 아직 스킬이 없다(신인 스킬은 104 의 0x11230 이 준다).
 *
 * 마우스 길(원본에는 없다): 값 칸 · 화살 · 구질 칸 · OK 칸 자리에 투명 누름 칸, 되돌아가기(CLR)는 머리띠 바닥 표시.
 * 고른 줄의 값 칸을 한 번 더 누르면 OK 키다.
 */

interface PitcherRegisterScreenProps {
  /** 앞 화면(팀 고르기 0x65)에서 고른 팀 0~14 */
  readonly teamId?: number
  /** 머리띠 G — 팀 고르기 화면과 같은 값 */
  readonly gamePoint?: number
  readonly onCreate: (name: string, profile: PitcherRookieProfile) => void
  readonly onCancel: () => void
}

/** 0x66 등록 줄 · 0x67 변화구 고르기 */
type Phase = '등록' | '변화구'

/** 0x67 의 상자 — StrMODE[13] 알림(1 이하) · StrMODE[2] 확인(2개) */
type PitchPopup = '부족' | '확인'

/** StrMODE[12] 안내는 상태 틱 [this+0x2c] ≤ 0x31 일 때만 (0x16690~0x166b0) — 들어올 때마다 0 부터 센다 */
const PITCH_HINT_LAST_TICK = 0x31
const PITCH_SHORTAGE_TEXT = ORIGINAL_MODE_TEXT[13] ?? ''
const CONFIRM_TEXT = ORIGINAL_MODE_TEXT[2] ?? ''
const NAME_ROW = 0

const MODE_UI = './sprites/mode_ui/frames'
const SLT_PITCH = './sprites/slt_pitch/frames'
const pad3 = (frame: number) => String(frame).padStart(3, '0')
/** num 50+숫자 — 8×10 */
const ROW_DIGIT = { width: 8, height: 10 } as const

/** 0xb9d74 프레임 맞춤 — 0x2 가로 가운데(내림) · 0x4 오른쪽 · 0x20 세로 가운데(올림), 그 뒤 ox */
function frameAt(origins: FrameOrigins | null, frame: number, box: RegisterBox, align: number, ox = 0): { x: number; y: number } | null {
  const origin = origins?.[pad3(frame)]
  if (origin === undefined) return null
  let x = box.x + ox
  let y = box.y
  if ((align & 0x2) !== 0) x += (box.width - origin.width) >> 1
  if ((align & 0x4) !== 0) x += box.width - origin.width
  if ((align & 0x20) !== 0) {
    const d = box.height - origin.height
    y += Math.trunc(d / 2) + (d % 2)
  }
  return { x, y }
}

/** 둥근 테두리 0xba015 — (w + 1) × (h + 1) */
function RoundEdge({ box, color, testId }: { readonly box: RegisterBox; readonly color: string; readonly testId?: string }) {
  const paints = useMemo(() => roundEdgePaintsOf(box.width, box.height, color), [box.width, box.height, color])
  return <PaintedRects x={box.x} y={box.y} width={box.width + 1} height={box.height + 1} paints={paints} testId={testId} />
}

export function PitcherRegisterScreen({
  teamId = DEFAULT_TEAM_ID,
  gamePoint = 0,
  onCreate,
  onCancel,
}: PitcherRegisterScreenProps) {
  const [name, setName] = useState('')
  const [profile, setProfile] = useState<PitcherRookieProfile>({ ...DEFAULT_PITCHER_ROOKIE_PROFILE, teamId })
  const [selectedRow, setSelectedRow] = useState(NAME_ROW)
  const [phase, setPhase] = useState<Phase>('등록')
  const [popup, setPopup] = useState<PitchPopup | null>(null)
  /** 0x67 격자 [this+0x88] 칸 — 0~7 구질 · 8 OK. 0x10b18 이 들어올 때마다 0 에 둔다 */
  const [pitchCell, setPitchCell] = useState(0)
  /** 0x67 상태 틱 [this+0x2c] — 들어올 때 0 */
  const [pitchTick, setPitchTick] = useState(0)
  /**
   * 설명 띠 [장면+0xd8] 는 0x66 · 0x67 이 같이 쓴다 — 0x67 진입 0x10b18 이 [띠+0x88] = 1 · [+0x8a] = 1 로 다시 펴고(10b1a~10b30),
   * 0x67 은 틱 ≤ 0x31 동안 그 띠를 그린다. CLR 로 0x66 에 돌아오면 진입 0x17360 이 이전 상태 0x67 을 보고 곧장 끝나(1736a → 1764e)
   * 띠를 다시 펴지 않는다 — 0x67 이 편 만큼(보통 다 편 160) 이어서 0x66 글을 쓴다. 0x66 띠가 처음 그릴 때의 펼침 갱신 수다.
   */
  const [registerBandTicks, setRegisterBandTicks] = useState(0)
  const pitchTickRef = useRef(pitchTick)
  pitchTickRef.current = pitchTick
  /** 0x67 → 0x66 (CLR) — 0x67 이 그린 띠 갱신 수를 0x66 띠가 이어받는다 */
  const leavePitchPhase = () => {
    setRegisterBandTicks(pitchTickRef.current + 1)
    setPhase('등록')
  }
  // 0x66 의 상태 틱 [장면+0x2c] — 진입 틀에 0(0xbc9c8 bc9ec), 그 뒤 틀마다 +1. 그리기는 같은 틀 뒤쪽이라 진입 틀의 그림이 0 을 읽는다.
  // 0x67 에서 돌아오면(CLR) 다시 들어온 것이라 0 부터 센다 — 웹도 '등록' 에 들 때마다 앱 틱 셈을 새로 켠다
  const tick = useUpdateCounter(phase !== '변화구')
  const isBlinkOn = (phase === '변화구' ? pitchTick : tick) % 10 !== 0
  const uiOrigins = useFrameOrigins(MODE_UI)
  const pitchOrigins = useFrameOrigins(SLT_PITCH)

  useEffect(() => {
    if (phase !== '변화구') return undefined
    setPitchTick(0)
    const timer = setAppTickInterval(() => setPitchTick((previous) => previous + 1))
    return () => timer()
  }, [phase])

  /** 카드가 읽는 새 선수 레코드 — 등록 진입 0x17360 이 만든 것이라 스킬 · 장비가 없다 */
  const cardCareer = useMemo(
    () => ({ ...createPitcherCareer(name, { ...profile, teamId }), skillIds: [], equippedSkillIds: [] }),
    [name, profile, teamId],
  )

  /** 0x67 OK 칸(8) — 0x12410: 고른 수 ≤ 1 이면 StrMODE[13], 아니면 StrMODE[2] */
  const pressPitchOk = () => setPopup(canRegisterPitcher(profile) ? '확인' : '부족')

  /** 0x66 → 0x67 — 칸 커서를 0 으로 (0x10b18 의 vtable+0x14(0, 0)) */
  const enterPitchPhase = () => {
    setPitchCell(0)
    setPhase('변화구')
  }

  /** 구질 칸에서 OK — 0x123ac 로 켜고/끄고, 개수가 2 면 OK 칸 · 아니면 칸 + 2 (0x124fe~0x12560) */
  const togglePitchCell = (cell: number) => {
    const slots = toggleBreakingPitchSlot(profile.breakingPitchSlots, cell)
    setProfile({ ...profile, breakingPitchSlots: slots })
    setPitchCell(breakingPitchCursorAfterToggle(cell, slots.length))
  }

  /** 0x67 OK — 칸 8 이면 상자, 아니면 그 칸 켜고/끄기 (0x12426) */
  const pressPitchCellOk = (cell: number) => (cell === BREAKING_PITCH_OK_CELL ? pressPitchOk() : togglePitchCell(cell))

  /** 값 바꾸기 — 원본 목록의 좌우 키 ([0x7c] 타입 · [0x78] 보직 · [0x80] 손 · [0x84] 피부) */
  const changeValue = (row: number, step: number) => {
    setProfile((previous) => {
      if (row === 1) return { ...previous, typeIndex: wrap(previous.typeIndex + step, PITCHER_TYPE_COUNT) }
      if (row === 2) return { ...previous, role: pitcherRoleOfChoice(wrap(pitcherRoleChoiceOf(previous.role) + step, 2)) }
      if (row === 3) return { ...previous, handIndex: wrap(previous.handIndex + step, 2) }
      if (row === 4) return { ...previous, skinIndex: wrap(previous.skinIndex + step, PITCHER_SKIN_LABELS.length) }
      return previous
    })
  }

  const selectRow = (row: number) => {
    const nameInput = document.querySelector<HTMLInputElement>('input[aria-label="이름"]')
    if (row === NAME_ROW) nameInput?.focus()
    else nameInput?.blur()
    setSelectedRow(row)
  }

  /** 줄 고르기 키 0x16f28 (`registerKeyOutcomeOf`, 마지막 줄 OK 만 0x67 로) — 입력칸 안의 Backspace 가 브라우저 몫이면 false */
  const pressRowKey = (key: RegisterKey, isNativeDelete: boolean): boolean => {
    const outcome = registerKeyOutcomeOf(selectedRow, key, name.length)
    if (outcome.kind === 'deleteChar' && isNativeDelete) return false
    if (outcome.kind === 'cancel') onCancel()
    else if (outcome.kind === 'deleteChar') setName(nameWithoutLastChar(name))
    else if (outcome.kind === 'finish') enterPitchPhase()
    else if (outcome.kind === 'move') selectRow(outcome.row)
    return true
  }

  /**
   * 키 — 0x66 줄 고르기는 타자편과 같은 갱신 0x16f28 이다. 0x67 은 키 0x12410 — OK 는 지금 칸 · 방향은
   * `breakingPitchCursorAfter` · CLR = 0x66.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (popup !== null) return
      const isTyping = event.target instanceof HTMLInputElement
      if (phase === '변화구') {
        const key = breakingPitchKeyOf(event.key)
        if (key === null) return
        event.preventDefault()
        if (key === 'clr') return leavePitchPhase()
        if (key === 'ok') return pressPitchCellOk(pitchCell)
        return setPitchCell(breakingPitchCursorAfter(pitchCell, key))
      }
      const key = registerKeyOf(event.key, selectedRow === NAME_ROW)
      if (key !== null) {
        if (pressRowKey(key, isTyping && event.key === 'Backspace')) event.preventDefault()
        return
      }
      if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && !isTyping && selectedRow !== NAME_ROW) {
        event.preventDefault()
        changeValue(selectedRow, event.key === 'ArrowRight' ? 1 : -1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const rowArrows = valueArrowsOf(selectedRow)

  return (
    <RawScreen>
      {/* 장면 틀 0x16928 — 0x66 · 0x67 은 "그 밖" 갈래: 공 무늬 바탕 0x5fd61 */}
      <SkinBackdrop kind="공무늬" />
      {/*
        0x7f4ed 머리띠 — 0x15f34 는 맨 앞, 0x162bc 는 칸 뒤에 그린다(겹치지 않는다). 되돌아가기 = CLR.
        안 미끄러진다(확정): [skin+0x84] = 1 을 쓰는 0x63b14 를 나리 장면에서 부르는 그림은 0x15d54 · 0x15d98 · 0x15de4 셋뿐이고
        (0x63b15 xref 전수) 0x15f34 · 0x162bc · 0x15e20 은 안 부른다. 진입 0x17360 · 0x10b18 도 +0x84 를 안 쓴다. 앞 101(0x15de4)이
        세운 +0x84 는 머리띠가 다 내려와 0x54e16 이 지운 뒤에야 101 키 0x14114 가 받으므로([skin+0xe4], R9 12-2) 0x66 에 남지 않는다
      */}
      <ScreenFrame title="나만의리그투수편" gamePoint={gamePoint} slides={false}
        onBack={() => (phase === '등록' ? pressRowKey('clr', false) : leavePitchPhase())} />

      {/* 카드 0x15e20 — 카드 판 · 레이더(0xb570d 넷째 인자 0) · 투수 그림 */}
      <PitcherBasicInfoCard career={cardCareer} appliesCondition={false} />
      <PitcherInfoPlate />

      {phase === '등록' && (
        <div data-testid="등록-정보칸">
          {/* 정보 칸 0x7c450 (모드 3 · [gfx+0x28] = 1 — 이름 줄은 입력기 몫, 새 레코드 +0x18 = 0 이라 필살 줄도 빈다) */}
          <PitcherInfoBoard values={{
            teamId, name: null, typeIndex: profile.typeIndex, magicNumber: 0, role: profile.role,
            handIndex: profile.handIndex, skinIndex: profile.skinIndex,
          }} />

          {/* 커서 0xba015 — 틱 % 10 ≠ 0 일 때만 */}
          {isBlinkOn && <RoundEdge box={cursorBoxOf(registerValueBoxOf(selectedRow))} color={REGISTER_YELLOW} testId="선수등록-커서" />}
          {selectedRow !== NAME_ROW && (
            <>
              <FrameSprite folder={MODE_UI} frame={ARROW_FRAME} origins={uiOrigins} x={rowArrows.left.x} y={rowArrows.left.y} />
              <FrameSprite folder={MODE_UI} frame={ARROW_FRAME} origins={uiOrigins} x={rowArrows.right.x} y={rowArrows.right.y}
                style={{ transform: 'scaleX(-1)' }} />
              <PressArea label={`${selectedRow}줄 이전`} rect={{ ...rowArrows.left, ...ARROW_SIZE }}
                onPress={() => changeValue(selectedRow, -1)} />
              <PressArea label={`${selectedRow}줄 다음`} rect={{ ...rowArrows.right, ...ARROW_SIZE }}
                onPress={() => changeValue(selectedRow, 1)} />
            </>
          )}

          {/* 이름 글 0x677d5 — 노랑. 원본 입력기는 웹 글 칸으로 대신하고 CP949 8바이트로 자른다 */}
          <form onSubmit={(event) => event.preventDefault()}>
            {/* 0x67 에서 CLR 로 돌아오면 0x17360 이 이전 상태 0x67 을 보고 곧장 끝난다(1736a → 1764e) — 줄 커서 · 값이 그대로라 초점을 뺏지 않는다 */}
            {/* 0x677d5(입력기, 62, 204, 앱 글꼴, RGB(255,255,0), 줄 == 0, 정렬 0x11, 0) — 0x16128~0x16152. 줄 0 이면 '|' 커서 */}
            <InputMethodText value={name} autoFocus={selectedRow === NAME_ROW} aria-label="이름"
              x={NAME_TEXT_AT.x} y={NAME_TEXT_AT.y} color={REGISTER_YELLOW} isCursorOn={selectedRow === NAME_ROW}
              inputRect={{ x: NAME_TEXT_AT.x, y: NAME_TEXT_AT.y - 2, width: INPUT_MODE_BOX.x - NAME_TEXT_AT.x - 1, height: 13 }}
              onFocus={() => setSelectedRow(NAME_ROW)}
              onChange={(event) => {
                // CP949 8바이트까지 — 타자편과 같은 입력기다 (R11 1b)
                if (nameByteLengthOf(event.target.value) <= MAXIMUM_NAME_BYTES) setName(event.target.value)
              }} />
          </form>
          {selectedRow === NAME_ROW && (
            <>
              {/* 입력 방식 칸 0xba0bd · 화살 (0x1615c~0x161f4) — 타자 등록과 같은 0x15f34 갈래 */}
              <InputModeBox nameBox={registerValueBoxOf(NAME_ROW)} />
            </>
          )}
          {/* 값 칸 누름 — 고르기 · 고른 줄이면 OK(↓ · 마지막 줄이면 0x67) */}
          {[1, 2, 3, 4].map((row) => (
            <PressArea key={row} label={`${row}줄 값`} rect={registerValueBoxOf(row)}
              option={{ isSelected: row === selectedRow }}
              onPress={() => (row === selectedRow ? pressRowKey('ok', false) : selectRow(row))} />
          ))}
          {/* 0x67 에서 돌아오면 원본은 띠를 다시 펴지 않는다(0x17360 이 [띠+0x88] · [+0x8a] 를 안 세운다) — 0x67 이 편 만큼 이어받는다 */}
          <DescriptionBand text={ORIGINAL_MODE_TEXT[REGISTER_ROW_HINTS[selectedRow] ?? 3] ?? ''} seed={selectedRow}
            initialTicks={registerBandTicks} />
        </div>
      )}

      {phase === '변화구' && (
        <div data-testid="변화구-고르기">
          <FrameSprite folder={MODE_UI} frame={BREAKING_PITCH_FRAME} origins={uiOrigins} x={0} y={0} />
          {BREAKING_ROW_NUMBERS.map((number, row) => {
            const box = breakingRowNumberBoxOf(row)
            // 0xba51c 정렬 0x22 · oy 1 — x += (w − 8) >> 1 · y += 올림((h − 10)/2) + 1
            const d = box.height - ROW_DIGIT.height
            return (
              <img key={number} alt="" className={managementStyles.layer}
                src={`./sprites/num/${pad3(BREAKING_ROW_NUMBER_BASE + number)}.png`}
                style={{ left: box.x + ((box.width - ROW_DIGIT.width) >> 1), top: box.y + Math.trunc(d / 2) + (d % 2) + 1 }} />
            )
          })}
          {ROOKIE_BREAKING_PITCH_TYPES.map((typeNumber, cell) => {
            const box = breakingPitchBoxOf(cell)
            const frame = typeNumber - 1
            const at = frameAt(pitchOrigins, frame, box, 0x22)
            const isChosen = profile.breakingPitchSlots.includes(cell)
            return (
              <div key={typeNumber} data-testid={`변화구칸-${cell}`} data-chosen={isChosen}>
                {at !== null && !isChosen && <FrameSprite folder={SLT_PITCH} frame={frame} origins={pitchOrigins} x={at.x} y={at.y} />}
                {isChosen && <FrameSprite folder={MODE_UI} frame={BREAKING_CHOSEN_PLATE} origins={uiOrigins} x={box.x} y={box.y} />}
                {isChosen && at !== null && (
                  <>
                    {BREAKING_NAME_OUTLINE.map(([dx, dy]) => (
                      <SolidStamp key={`${dx},${dy}`} folder={SLT_PITCH} frame={frame} origins={pitchOrigins} x={at.x + dx} y={at.y + dy} color="#000000" />
                    ))}
                    <SolidStamp folder={SLT_PITCH} frame={frame} origins={pitchOrigins} x={at.x} y={at.y} color={REGISTER_YELLOW} />
                  </>
                )}
                {cell === pitchCell && isBlinkOn && <RoundEdge box={cursorBoxOf(box)} color={REGISTER_YELLOW} />}
                <PressArea label={pitchTypeNameOf(typeNumber)} rect={box} option={{ isSelected: cell === pitchCell }}
                  onPress={() => togglePitchCell(cell)} />
              </div>
            )
          })}
          <FrameSprite folder={MODE_UI} frame={pitchCell === BREAKING_PITCH_OK_CELL ? BREAKING_OK.orange : BREAKING_OK.blue}
            origins={uiOrigins} x={BREAKING_OK.x} y={BREAKING_OK.y} />
          <PressArea label="OK" rect={BREAKING_OK} option={{ isSelected: pitchCell === BREAKING_PITCH_OK_CELL }}
            onPress={() => { setPitchCell(BREAKING_PITCH_OK_CELL); pressPitchOk() }} />
          {/* StrMODE[12] — 상태 틱 ≤ 0x31 동안만 */}
          {pitchTick <= PITCH_HINT_LAST_TICK && <DescriptionBand text={ORIGINAL_MODE_TEXT[BREAKING_HINT] ?? ''} seed={BREAKING_HINT} />}
        </div>
      )}

      {/* 상자는 지금 화면 위에 얹힌다 */}
      {popup === '부족' && (
        <MessageBox text={PITCH_SHORTAGE_TEXT} buttons={['확인']} onAnswer={() => setPopup(null)} />
      )}
      {popup === '확인' && (
        <MessageBox
          text={CONFIRM_TEXT}
          buttons={['예', '아니오']}
          onAnswer={(index) => (index === 0 ? onCreate(name, profile) : setPopup(null))}
        />
      )}
    </RawScreen>
  )
}

function wrap(value: number, count: number): number {
  return ((value % count) + count) % count
}
