import { useEffect, useMemo, useState } from 'react'
import { OK_KEY_OFFER, useTouchKeyOffer } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { DEFAULT_PITCHER_ROOKIE_PROFILE, type PitcherRookieProfile } from '@/entities/pitcher-career/model/pitcherRegistration'
import { DEFAULT_TEAM_ID, createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { BREAKING_PITCH_OK_CELL, breakingPitchCursorAfter, breakingPitchKeyOf } from '@/pages/pitcher-league/lib/breakingPitchCursor'
import { PitcherBasicInfoCard } from '@/pages/pitcher-league/ui/PitcherBasicInfoCard'
import { PitcherInfoPlate } from '@/pages/pitcher-league/ui/PitcherInfoBoard'
import { BreakingPitchPicker } from './pitcherRegisterScreen/BreakingPitchPicker'
import { nameWithoutLastChar, registerKeyOf, registerKeyOutcomeOf, SkinBackdrop } from './pitcherRegisterScreen/otherSlices'
import type { RegisterKey } from './pitcherRegisterScreen/otherSlices'
import { MODE_UI, SLT_PITCH } from './pitcherRegisterScreen/registerFigure'
import { profileAfterValueStep } from './pitcherRegisterScreen/registerProfile'
import { NAME_ROW, RegisterRows } from './pitcherRegisterScreen/RegisterRows'
import { usePitchTick } from './pitcherRegisterScreen/usePitchTick'
import { type PitchPopup, useBreakingPitchCell } from './pitcherRegisterScreen/useBreakingPitchCell'
import { RegisterPopup } from './pitcherRegisterScreen/RegisterPopup'

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

const isValueArrowKey = (key: string) => key === 'ArrowLeft' || key === 'ArrowRight'

export function PitcherRegisterScreen({ teamId = DEFAULT_TEAM_ID, gamePoint = 0, onCreate, onCancel }: PitcherRegisterScreenProps) {
  const [name, setName] = useState('')
  const [profile, setProfile] = useState<PitcherRookieProfile>({ ...DEFAULT_PITCHER_ROOKIE_PROFILE, teamId })
  const [selectedRow, setSelectedRow] = useState(NAME_ROW)
  const [phase, setPhase] = useState<Phase>('등록')
  const [popup, setPopup] = useState<PitchPopup | null>(null)
  const [pitchCell, setPitchCell, togglePitchCell, pressPitchOk, pressPitchCellOk] = useBreakingPitchCell(profile, setProfile, setPopup)
  /**
   * 설명 띠 [장면+0xd8] 는 0x66 · 0x67 이 같이 쓴다 — 0x67 진입 0x10b18 이 [띠+0x88] = 1 · [+0x8a] = 1 로 다시 펴고(10b1a~10b30),
   * 0x67 은 틱 ≤ 0x31 동안 그 띠를 그린다. CLR 로 0x66 에 돌아오면 진입 0x17360 이 이전 상태 0x67 을 보고 곧장 끝나(1736a → 1764e)
   * 띠를 다시 펴지 않는다 — 0x67 이 편 만큼(보통 다 편 160) 이어서 0x66 글을 쓴다. 0x66 띠가 처음 그릴 때의 펼침 갱신 수다.
   */
  const [registerBandTicks, setRegisterBandTicks] = useState(0)
  const isPitchPhase = phase === '변화구'
  // 0x66 의 상태 틱 [장면+0x2c] — 진입 틀에 0(0xbc9c8 bc9ec), 그 뒤 틀마다 +1. 그리기는 같은 틀 뒤쪽이라 진입 틀의 그림이 0 을 읽는다.
  // 0x67 에서 돌아오면(CLR) 다시 들어온 것이라 0 부터 센다 — 웹도 '등록' 에 들 때마다 앱 틱 셈을 새로 켠다
  const tick = useUpdateCounter(!isPitchPhase)
  const uiOrigins = useFrameOrigins(MODE_UI)
  const pitchOrigins = useFrameOrigins(SLT_PITCH)
  /** 0x67 상태 틱 [this+0x2c] — 들어올 때 0 */
  const pitchTick = usePitchTick(isPitchPhase)
  const isBlinkOn = (isPitchPhase ? pitchTick : tick) % 10 !== 0

  /** 0x67 → 0x66 (CLR) — 0x67 이 그린 띠 갱신 수를 0x66 띠가 이어받는다 */
  const leavePitchPhase = () => {
    setRegisterBandTicks(pitchTick + 1)
    setPhase('등록')
  }

  /** 카드가 읽는 새 선수 레코드 — 등록 진입 0x17360 이 만든 것이라 스킬 · 장비가 없다 */
  const cardCareer = useMemo(
    () => ({ ...createPitcherCareer(name, { ...profile, teamId }), skillIds: [], equippedSkillIds: [] }),
    [name, profile, teamId],
  )

  /** 0x66 → 0x67 — 칸 커서를 0 으로 (0x10b18 의 vtable+0x14(0, 0)) */
  const enterPitchPhase = () => {
    setPitchCell(0)
    setPhase('변화구')
  }

  /** 값 바꾸기 — 원본 목록의 좌우 키 (`profileAfterValueStep`) */
  const changeValue = (row: number, step: number) => setProfile((previous) => profileAfterValueStep(previous, row, step))

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

  /** 0x67 키 0x12410 — OK 는 지금 칸 · 방향은 `breakingPitchCursorAfter` · CLR = 0x66 */
  const onPitchPhaseKey = (event: KeyboardEvent) => {
    const key = breakingPitchKeyOf(event.key)
    if (key === null) return
    event.preventDefault()
    if (key === 'clr') return leavePitchPhase()
    if (key === 'ok') return pressPitchCellOk(pitchCell)
    return setPitchCell(breakingPitchCursorAfter(pitchCell, key))
  }

  /** 0x66 줄 고르기 — 타자편과 같은 갱신 0x16f28, 값 줄의 ← → 는 값 바꾸기 */
  const onRegisterPhaseKey = (event: KeyboardEvent) => {
    const isTyping = event.target instanceof HTMLInputElement
    const key = registerKeyOf(event.key, selectedRow === NAME_ROW)
    if (key !== null) {
      if (pressRowKey(key, isTyping && event.key === 'Backspace')) event.preventDefault()
      return
    }
    if (isValueArrowKey(event.key) && !isTyping && selectedRow !== NAME_ROW) {
      event.preventDefault()
      changeValue(selectedRow, event.key === 'ArrowRight' ? 1 : -1)
    }
  }

  // 터치 기기 — 등록 줄 · 변화구 고르기 모두 OK 그림 자리가 없어 상황 버튼으로 OK 를 띄운다(상자가 떠 있으면 상자가 받는다)
  useTouchKeyOffer(popup === null ? OK_KEY_OFFER : null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (popup !== null) return
      if (isPitchPhase) onPitchPhaseKey(event)
      else onRegisterPhaseKey(event)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

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
      <ScreenFrame
        title="나만의리그투수편"
        gamePoint={gamePoint}
        slides={false}
        onBack={() => (phase === '등록' ? pressRowKey('clr', false) : leavePitchPhase())}
      />

      {/* 카드 0x15e20 — 카드 판 · 레이더(0xb570d 넷째 인자 0) · 투수 그림 */}
      <PitcherBasicInfoCard career={cardCareer} appliesCondition={false} />
      <PitcherInfoPlate />

      {phase === '등록' && (
        <RegisterRows
          teamId={teamId}
          name={name}
          profile={profile}
          selectedRow={selectedRow}
          isBlinkOn={isBlinkOn}
          uiOrigins={uiOrigins}
          bandTicks={registerBandTicks}
          onChangeValue={changeValue}
          onPressValue={(row) => (row === selectedRow ? pressRowKey('ok', false) : selectRow(row))}
          onFocusName={() => setSelectedRow(NAME_ROW)}
          onChangeName={setName}
        />
      )}

      {isPitchPhase && (
        <BreakingPitchPicker
          chosenSlots={profile.breakingPitchSlots}
          pitchCell={pitchCell}
          pitchTick={pitchTick}
          isBlinkOn={isBlinkOn}
          uiOrigins={uiOrigins}
          pitchOrigins={pitchOrigins}
          onToggle={togglePitchCell}
          onPressOk={() => {
            setPitchCell(BREAKING_PITCH_OK_CELL)
            pressPitchOk()
          }}
        />
      )}

      {/* 상자는 지금 화면 위에 얹힌다 */}
      {popup !== null && <RegisterPopup popup={popup} onYes={() => onCreate(name, profile)} onClose={() => setPopup(null)} />}
    </RawScreen>
  )
}
