import { useEffect, useMemo, useState } from 'react'
import { setAppTickInterval } from '@/shared/lib/frameClock/frameClock'
import { OK_KEY_OFFER, useTouchKeyOffer } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { FrameSprite, PaintedRects, RawScreen } from '@/shared/ui'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { DescriptionBand } from '@/shared/ui/DescriptionBand/DescriptionBand'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { DEFAULT_ROOKIE_PROFILE, DEFAULT_TEAM_ID, rookieAbilityOf } from '@/entities/career/model/playerCareer'
import type { RookieProfile } from '@/entities/career/model/playerCareer'
import {
  CURSOR_COLOR,
  INFO_FRAME,
  ROW_HINTS,
  ROW_ORDER,
  choiceStepped,
  cursorRectOf,
  isCursorVisibleAt,
} from '@/pages/create-player/lib/createPlayerLayout'
import type { CreatePlayerRowId } from '@/pages/create-player/lib/createPlayerLayout'
import { nameWithoutLastChar, registerKeyOutcomeOf } from '@/pages/create-player/lib/registerKeys'
import type { RegisterKey } from '@/pages/create-player/lib/registerKeys'
import * as styles from '@/pages/create-player/ui/CreatePlayerScreen.css'
import { IMG_TEXT, MODE_UI, pressKey } from './createPlayerScreen/createPlayerAssets'
import { boardRectsOf, CardPlate, INFO_BOARD, RadarChart, SkinBackdrop } from './createPlayerScreen/otherSlices'
import { RegisterConfirm } from './createPlayerScreen/RegisterConfirm'
import { RegisterRowMarks } from './createPlayerScreen/RegisterRowMarks'
import { RookieFigure } from './createPlayerScreen/RookieFigure'
import { focusNameInputFor, rookieInfoValueOf } from './createPlayerScreen/rookieInfo'
import { RookieInfoCells } from './createPlayerScreen/RookieInfoCells'
import { useRegisterKeys } from './createPlayerScreen/useRegisterKeys'
import { useWarmRookieFigures } from './createPlayerScreen/useWarmRookieFigures'

interface CreatePlayerScreenProps {
  /** 앞 화면에서 고른 팀 (0~14). 안 넘기면 기본 팀이다 */
  readonly teamId?: number
  /** 머리띠 G포인트 — 전역 G(+0x64). 안 넘기면 0 */
  readonly gamePoint?: number
  readonly onCreate: (name: string, profile: RookieProfile) => void
  readonly onCancel: () => void
}

/**
 * 선수 등록 (나만의리그 상태 0x66 — 갱신 0x16f28 · 그리기 0x15f34, C-4 · C-6 확정).
 *
 * 원본은 **관리 화면 기본정보 카드(0x15e20)** 를 그대로 그리고, 고른 줄의 값 칸에 노란 깜빡이 커서만
 * 얹는다. 고르는 줄은 다섯 — **이름 · 타입 · 포지션 · 손 · 피부** 순서다(줄 목록 [this+0x74], 0x17360).
 * 등록 화면에 **타순 선택은 없다**(C-4 확정) — 타순 칸은 보여 주기만 한다(생성 0x17360 이 +0xa = 0xa7 → 8번).
 *
 * 팀은 앞 화면(팀 고르기 0x65, `TeamSelectScreen`)이 고른 것을 받아 **보여 주기만** 한다 —
 * 등록 화면에서 고르는 줄은 다섯뿐이라 팀명 칸은 여기서 바뀌지 않는다.
 *
 * 피부·팀을 바꾸면 그림 색도 따라 바뀐다 (C-1 확정, 원본 0x171a0 이 피부 줄을 바꾼 뒤 0x10810 을
 * 다시 불러 팔레트만 갈아 끼우는 것과 같다). 웹 스프라이트는 "팀 2 · 황인" 한 벌로 구워져 있으므로
 * `useRecoloredSprite` 가 팔레트 번호 지도(`<폴더>/frames/index/NNN.png`)와 `palette.json` 으로
 * **몸통 = 피부×15 + 팀 · 헬멧 = 팀** 벌을 그때그때 칠한다 (`batterLayerPaletteIndex`).
 */
export function CreatePlayerScreen({ teamId = DEFAULT_TEAM_ID, gamePoint = 0, onCreate, onCancel }: CreatePlayerScreenProps) {
  const [name, setName] = useState('')
  const [profile, setProfile] = useState<RookieProfile>({ ...DEFAULT_ROOKIE_PROFILE, teamId })
  useWarmRookieFigures(teamId)
  const [selectedRow, setSelectedRow] = useState(0)
  const [isConfirming, setIsConfirming] = useState(false)
  const [tick, setTick] = useState(1)
  /** 타입 · 포지션 줄의 좌우를 누른 횟수 — 레이더를 0 에서 다시 거는 때 (아래 `RadarChart`) */
  const [radarRearms, setRadarRearms] = useState(0)
  const labelOrigins = useFrameOrigins(IMG_TEXT)
  const uiOrigins = useFrameOrigins(MODE_UI)
  const infoBoard = useMemo(() => boardRectsOf(INFO_BOARD, false), [])

  const ability = rookieAbilityOf(profile.battingTypeIndex, profile.positionIndex)
  const selectedId = ROW_ORDER[selectedRow]

  /** 값 바꾸기 — 원본 목록의 좌우 키 ([0x7c] 타입 · [0x78] 포지션 · [0x80] 손 · [0x84] 피부) */
  const changeValue = (id: CreatePlayerRowId, step: number) => {
    setProfile((previous) => choiceStepped(previous, id, step))
    // 0x16f28: 타입 줄([0x7c], 0x16f60~0x16fe0) · 포지션 줄([0x78], 0x17046~0x170cc)은 목록 키를 넘긴 뒤 값이 바뀌었든 아니든
    // 레이더 [skin+0xd4] 에 +0xac = 1 · +0xad = 0 · +0x1e3 = 0 · +0x1e0 = 0 을 쓴다 — 손 · 피부 줄은 안 쓴다
    if (id === '타입' || id === '포지션') setRadarRearms((count) => count + 1)
  }

  /** 줄 고르기 키 (0x16f28, `registerKeyOutcomeOf`). 이름 칸을 떠나면 입력 초점을 놓아 좌우가 값 바꾸기로 간다 */
  const pressRowKey = (key: RegisterKey, isNativeDelete: boolean): boolean => {
    const outcome = registerKeyOutcomeOf(selectedRow, key, name.length)
    if (outcome.kind === 'cancel') onCancel()
    else if (outcome.kind === 'deleteChar') {
      // 입력칸 안의 Backspace 는 브라우저가 한 글자를 지운다 — 두 번 지우지 않는다
      if (isNativeDelete) return false
      setName(nameWithoutLastChar(name))
    } else if (outcome.kind === 'finish') setIsConfirming(true)
    else if (outcome.kind === 'move') {
      focusNameInputFor(outcome.row)
      setSelectedRow(outcome.row)
    }
    return true
  }

  // 커서 깜빡임용 틱. 원본은 게임 루프의 갱신 횟수([this+0x2c])를 그대로 쓴다
  useEffect(() => {
    const timer = setAppTickInterval(() => setTick((previous) => previous + 1))
    return () => timer()
  }, [])

  // 터치 기기 — 바닥띠 OK 누름 칸은 투명해 안 보인다. 상황 버튼으로 OK 를 띄운다(확인 상자가 떠 있으면 상자가 받는다)
  useTouchKeyOffer(isConfirming ? null : OK_KEY_OFFER)
  useRegisterKeys(isConfirming, selectedId, pressRowKey, changeValue)

  const cursor = cursorRectOf(selectedRow)

  return (
    <RawScreen>
      {/* 장면 틀 0x16928 — 상태 0x66 은 0x8e~0x90 밖이라 공 무늬 0x5fd61(skin, 0, 0, W, H) 를 먼저 깐다(0x1694c~0x16976).
          투수 등록(`PitcherRegisterScreen`)과 같은 장면 0x106 틀이다 */}
      <SkinBackdrop kind="공무늬" />

      {/* 기본정보 카드 0x15e20 — 카드 0x7ba44(계단형 판 · 팀 로고 · ABILITY 레이더) · 선수 그림 · 정보 칸 */}
      <CardPlate teamId={teamId} />
      {/* 시작 능력치 (0x16e2c) — 타입·포지션을 바꾸면 그때마다 다시 계산되고, 레이더는 0 에서 다시 자란다 (0x16f28) */}
      <RadarChart base={ability} shown={ability} growth={{ restartKey: radarRearms, restartFromZero: true }} />
      <RookieFigure profile={profile} teamId={teamId} />

      {/* 정보 칸 0x7c450 판 0x7c110(gfx, 박스 0, 0) */}
      <PaintedRects x={0} y={0} width={240} height={320} paints={infoBoard} testId="정보칸-판" />
      {/* 값 칸 그림 = mode_ui 프레임 2 (타자). 프레임 원점이 (60,184) 이라 (0,0) 으로 넘긴다 */}
      <FrameSprite folder={MODE_UI} frame={INFO_FRAME.batter} origins={uiOrigins} x={0} y={0} />

      <RookieInfoCells
        name={name}
        valueOf={(id) => rookieInfoValueOf(id, teamId, name, profile)}
        selectedId={selectedId}
        labelOrigins={labelOrigins}
        onName={setName}
        onSelectRow={setSelectedRow}
      />

      {/* 커서 — 타이머 %10 ≠ 0 일 때만 보인다 (0x16038) */}
      <div
        className={styles.cursor}
        data-testid="선수등록-커서"
        style={{
          left: cursor.x,
          top: cursor.y,
          width: cursor.width,
          height: cursor.height,
          border: `1px solid ${CURSOR_COLOR}`,
          visibility: isCursorVisibleAt(tick) ? 'visible' : 'hidden',
        }}
      />

      <RegisterRowMarks selectedId={selectedId} onChangeValue={changeValue} />

      {/* 안내 띠 — 그리기 0x15f34 161f4~162a6: 점프표 0xcc6d8(고른 줄) 로 StrMODE 번호를 골라 0x55544(띠 [장면+0xd8], 글) 를 부른다.
          투수 등록과 같은 흐르는 설명 띠다. 줄이 바뀌면 다시 편다 */}
      <DescriptionBand text={ROW_HINTS[selectedId] ?? ''} seed={selectedRow} />

      {/*
        머리띠 · 바닥 — 그리기 0x15f34 머리(15f40)의 0x7f4ed. 칸은 나리 틀 0x16928 기본 갈래(0x169ea): 0x66 은 제목 [장면+0xcc] == 4 ? 8 : 9
        (타자편 8) · 바닥 5(되돌아가기 = CLR). 0x66 그림은 공용 목록 0x63b14 를 안 불러 미끄러지지 않는다.
        웹 [취소]·[등록] 회색 단추를 걷었다 — 취소는 바닥띠 되돌아가기(CLR: 이름 칸이면 한 글자씩 지우고 비면 물러난다, 0x16f28)
      */}
      <ScreenFrame title="나만의리그타자편" gamePoint={gamePoint} onBack={() => pressKey('Escape')} slides={false} />
      <RegisterConfirm isConfirming={isConfirming} onAnswer={(isYes) => (isYes ? onCreate(name, profile) : setIsConfirming(false))} />
    </RawScreen>
  )
}
