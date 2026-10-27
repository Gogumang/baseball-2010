import { useEffect, useMemo, useState } from 'react'
import { setAppTickInterval } from '@/shared/lib/frameClock/frameClock'
import { FrameSprite, InputMethodText, MessageBox, PaintedRects, PressArea, RawScreen } from '@/shared/ui'
import { InputModeBox, inputModeLayoutOf } from '@/shared/ui/InputMethodText/InputModeBox'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { DescriptionBand } from '@/shared/ui/DescriptionBand/DescriptionBand'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import {
  DEFAULT_ROOKIE_PROFILE, DEFAULT_TEAM_ID, MAXIMUM_NAME_BYTES, nameByteLengthOf, rookieAbilityOf,
} from '@/entities/career/model/playerCareer'
import type { RookieProfile } from '@/entities/career/model/playerCareer'
import { TEAMS } from '@/shared/config/original/teams'
import { batterLayerPaletteIndex, batterLayersOf, layerRecolorRequestsOf, NO_EQUIPMENT } from '@/widgets/batting-stage/lib/batterLayers'
import type { BatterLayer } from '@/widgets/batting-stage/lib/batterLayers'
import { useRecoloredSprite, useWarmRecoloredSprites } from '@/shared/lib/sprite/paletteSwap'
// 원본은 등록 화면을 관리 화면 기본정보 카드(0x15e20)로 그린다 — 카드 좌표·레이더를 그대로 가져다 쓴다
import { FIGURE_FOOT, INFO_BOARD } from '@/pages/management/lib/basicInfoLayout'
import { RadarChart } from '@/pages/management/ui/RadarChart'
import { CardPlate } from '@/pages/management/ui/CardPlate'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { boardRectsOf } from '@/pages/shop/lib/equipmentWindowLayout'
import {
  ARROW, arrowTopLeftOf, CHOICES, CURSOR_COLOR, FIGURE_POSE_FRAME, INFO_CELLS,
  INFO_FRAME, ROOKIE_BATTING_ORDER, ROW_HINTS, ROW_ORDER, choiceStepped, cursorRectOf, isCursorVisibleAt,
} from '@/pages/create-player/lib/createPlayerLayout'
import type { CreatePlayerRowId, InfoCellId } from '@/pages/create-player/lib/createPlayerLayout'
import { nameWithoutLastChar, registerKeyOf, registerKeyOutcomeOf } from '@/pages/create-player/lib/registerKeys'
import type { RegisterKey } from '@/pages/create-player/lib/registerKeys'
import * as styles from '@/pages/create-player/ui/CreatePlayerScreen.css'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const MODE_UI = assetUrl('./sprites/mode_ui/frames')
const IMG_TEXT = assetUrl('./sprites/img_text/frames')

/** 누름 칸이 보내는 키 — 키 처리(window 듣개, 0x16f28 꼴)가 그대로 받는다 */
const pressKey = (key: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key }))
/** ⚠️ 웹 자리: OK — 바닥띠 왼쪽 표시 자리 (x 2, 47×12, 다 내려온 바닥띠 B = 320 의 B − 18) */
const OK_PRESS_RECT = { x: 2, y: 320 - 18, width: 47, height: 12 } as const

const frameSrc = (folder: string, frame: number) => `${folder}/${String(frame).padStart(3, '0')}.png`

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
  // 타입 · 피부 줄을 바꾸면 원본은 그림을 다시 적재해 곧바로 제 색이다 — 고를 수 있는 타입 × 피부 그림을 미리 칠해
  // 바꾼 그 그림에 구운 벌이 한 박자 비치지 않게
  useWarmRecoloredSprites(CHOICES.타입.options.flatMap((_, battingTypeIndex) =>
    CHOICES.피부.options.flatMap((__, skinIndex) => layerRecolorRequestsOf(
      batterLayersOf(FIGURE_POSE_FRAME, battingTypeIndex, NO_EQUIPMENT, false),
      (layer) => batterLayerPaletteIndex(layer.folder, skinIndex, teamId),
    ))))
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

  const valueOf = (id: InfoCellId): string => {
    if (id === '팀명') return (TEAMS[teamId] ?? TEAMS[0]).name
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
      const nameInput = document.querySelector<HTMLInputElement>('input[aria-label="이름"]')
      if (outcome.row === ROW_ORDER.indexOf('이름')) nameInput?.focus()
      else nameInput?.blur()
      setSelectedRow(outcome.row)
    }
    return true
  }

  // 커서 깜빡임용 틱. 원본은 게임 루프의 갱신 횟수([this+0x2c])를 그대로 쓴다
  useEffect(() => {
    const timer = setAppTickInterval(() => setTick((previous) => previous + 1))
    return () => timer()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isConfirming) return
      const isTyping = event.target instanceof HTMLInputElement
      const rowKey = registerKeyOf(event.key, selectedId === '이름')
      if (rowKey !== null) {
        if (pressRowKey(rowKey, isTyping && event.key === 'Backspace')) event.preventDefault()
        return
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
  const nameCell = INFO_CELLS.find((cell) => cell.id === '이름')
  const labelWidthOf = (frame: number) => labelOrigins?.[String(frame).padStart(3, '0')]?.width ?? 0

  return (
    <RawScreen>
      {/* 장면 틀 0x16928 — 상태 0x66 은 0x8e~0x90 밖이라 공 무늬 0x5fd61(skin, 0, 0, W, H) 를 먼저 깐다(0x1694c~0x16976).
          투수 등록(`PitcherRegisterScreen`)과 같은 장면 0x106 틀이다 */}
      <SkinBackdrop kind="공무늬" />

      {/* 기본정보 카드 0x15e20 — 카드 0x7ba44(계단형 판 · 팀 로고 · ABILITY 레이더) · 선수 그림 · 정보 칸 */}
      <CardPlate teamId={teamId} />
      {/* 시작 능력치 (0x16e2c) — 타입·포지션을 바꾸면 그때마다 다시 계산되고, 레이더는 0 에서 다시 자란다 (0x16f28) */}
      <RadarChart base={ability} shown={ability} growth={{ restartKey: radarRearms, restartFromZero: true }} />

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
        {/* 열쇠가 폴더·프레임인 이유: 타입을 바꾸면 몸통 파일이 갈리는데, 그대로 두면 `useRecoloredSprite`
            가 앞 그림 주소를 한 번 더 내보내 엉뚱한 겹이 비친다 (상태가 한 박자 늦는다) */}
        {/*
          장비를 안 넘긴다 — 원본 등록 화면도 같은 그림 객체(0x10810)라 장비 니블 루프(0x10866)를
          똑같이 돌지만, **아직 만들지 않은 선수**라 레코드 `rec[0x19]`·`rec[0x1a]` 니블이 모두 0 이고
          `subs r2,니블,#1 ; bmi` 에서 네 부위가 다 걸러진다. 곧 원본도 여기서는 맨몸이다.
          그림자는 끈다 — 상태 102 등록 0x5f3c 의 0x613a 가 `fig+0x48 = 0` 으로 둔다 (0x78dc6).
        */}
        {batterLayersOf(FIGURE_POSE_FRAME, profile.battingTypeIndex, NO_EQUIPMENT, false).map((layer) => (
          <LayerSprite key={`${layer.folder}#${layer.frame}`} layer={layer}
            skinIndex={profile.skinIndex} teamIndex={teamId} />
        ))}
      </div>

      {/* 정보 칸 0x7c450 판 0x7c110(gfx, 박스 0, 0) */}
      <PaintedRects x={0} y={0} width={240} height={320} paints={infoBoard} testId="정보칸-판" />
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
              <form onSubmit={(event) => event.preventDefault()}>
                {/* 이름 글 0x677d5(입력기, 값 칸 x + 2, y + 3, 앱 글꼴, RGB(255,255,0), 줄 == 0, 정렬 0x11, 0) — 0x16128~0x16152.
                    노랑 · 왼쪽 맞춤 · 이름 줄일 때 '|' 커서. 예전 웹은 흰 글 가운데 맞춤이었다 */}
                <InputMethodText value={name} autoFocus aria-label="이름"
                  x={cell.value.x + 2} y={cell.value.y + 3} color={CURSOR_COLOR}
                  isCursorOn={selectedId === '이름'}
                  // 투명 입력 칸은 입력 방식 칸 M(0x1615c) 앞에서 끊는다 — 투수 등록과 같다
                  inputRect={{ ...cell.value, width: inputModeLayoutOf(cell.value).box.x - cell.value.x - 1 }}
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

      {/* 입력 방식 칸 0xba0bd · 화살 — 이름 줄(줄 0)일 때만 (0x160e8~0x161f4). 투수 등록과 같은 그리기 0x15f34 갈래다 */}
      {selectedId === '이름' && nameCell !== undefined && <InputModeBox nameBox={nameCell.value} />}

      {/* 고른 줄 양옆 화살표 (0x160a8) — 이름 줄에는 고를 값이 없다 */}
      {selectedId !== '이름' && (
        <>
          <ArrowButton rowId={selectedId} step={-1} onPress={changeValue} />
          <ArrowButton rowId={selectedId} step={1} onPress={changeValue} />
        </>
      )}

      {/* 안내 띠 — 그리기 0x15f34 161f4~162a6: 점프표 0xcc6d8(고른 줄) 로 StrMODE 번호를 골라 0x55544(띠 [장면+0xd8], 글) 를 부른다.
          투수 등록과 같은 흐르는 설명 띠다. 줄이 바뀌면 다시 편다 */}
      <DescriptionBand text={ROW_HINTS[selectedId] ?? ''} seed={selectedRow} />

      {/*
        머리띠 · 바닥 — 그리기 0x15f34 머리(15f40)의 0x7f4ed. 칸은 나리 틀 0x16928 기본 갈래(0x169ea): 0x66 은 제목 [장면+0xcc] == 4 ? 8 : 9
        (타자편 8) · 바닥 5(되돌아가기 = CLR). 0x66 그림은 공용 목록 0x63b14 를 안 불러 미끄러지지 않는다.
        웹 [취소]·[등록] 회색 단추를 걷었다 — 취소는 바닥띠 되돌아가기(CLR: 이름 칸이면 한 글자씩 지우고 비면 물러난다, 0x16f28)
      */}
      <ScreenFrame title="나만의리그타자편" gamePoint={gamePoint} onBack={() => pressKey('Escape')} slides={false} />
      {/*
        ⚠️ 웹 자리: OK — 원본 등록 화면에는 OK 그림 자리가 없다(OK 키는 줄을 하나 내리고 피부 줄에서 확인 0x67, 0x16f28).
        바닥띠 왼쪽 표시 자리(왼쪽 소프트키 자리, 이 화면 바닥 5 는 비워 둔다)를 투명 누름 칸으로 빌려 OK 키를 보낸다
      */}
      {!isConfirming && <PressArea label="OK" rect={OK_PRESS_RECT} onPress={() => pressKey('Enter')} />}

      {/*
        확인(상태 0x67)은 화면을 갈아 끼우지 않는다 — 지금 화면 위에 StrMODE[2] 메시지 상자(0xbbef8)만 얹는다.
        예전 웹판은 빈 화면으로 바꿔 끼워 화면 대부분이 검게 남았다.
      */}
      {isConfirming && (
        <MessageBox
          text="!C이대로 결정 하시겠습니까?"
          buttons={['예', '아니오']}
          onAnswer={(index) => (index === 0 ? onCreate(name, profile) : setIsConfirming(false))}
        />
      )}
    </RawScreen>
  )
}

/**
 * 선수 그림 한 겹 — 레이어마다 폴더가 달라 원점 파일도 따로 읽는다.
 *
 * `FrameSprite` 를 못 쓰고 `<img>` 를 직접 놓는 이유: 칠한 그림은 데이터 URL 이라 `src` 를 갈아야 하는데
 * `FrameSprite` 는 폴더·프레임으로 `src` 를 스스로 만든다. 자리 계산은 `FrameSprite` 와 같다.
 * ⚠️ 캔버스가 없으면(테스트의 jsdom) `useRecoloredSprite` 가 조용히 구운 그림을 그대로 내보낸다.
 */
function LayerSprite({
  layer, skinIndex, teamIndex,
}: {
  readonly layer: BatterLayer
  readonly skinIndex: number
  readonly teamIndex: number
}) {
  const origins = useFrameOrigins(layer.folder)
  const key = String(layer.frame).padStart(3, '0')
  const src = useRecoloredSprite(`${layer.folder}/${key}.png`, batterLayerPaletteIndex(layer.folder, skinIndex, teamIndex))
  const origin = origins?.[key]
  if (origin === undefined) return null
  return (
    <img className={styles.layer} alt="" src={src}
      style={{ left: FIGURE_FOOT.x + origin.x, top: FIGURE_FOOT.y + origin.y }} />
  )
}

/** 값 칸 화살표 — mode_ui 프레임 24 (ARROW 주석) */
function ArrowButton({
  rowId, step, onPress,
}: {
  readonly rowId: CreatePlayerRowId
  readonly step: number
  readonly onPress: (rowId: CreatePlayerRowId, step: number) => void
}) {
  const box = INFO_CELLS.find((cell) => cell.id === rowId)?.value
  if (box === undefined) return null
  const at = arrowTopLeftOf(box, step)
  return (
    <button type="button" className={styles.arrowButton} aria-label={`${rowId} ${step < 0 ? '이전' : '다음'}`}
      style={{ left: at.x, top: at.y, width: ARROW.width, height: ARROW.height }}
      onClick={() => onPress(rowId, step)}>
      {/* 글줄 기준선에 얹히지 않게 블록으로 — 그림 윗변이 단추 윗변(= 화살 자리)에 붙는다 */}
      <img alt="" src={ARROW.image} style={{ display: 'block', transform: step < 0 ? undefined : 'scaleX(-1)' }} />
    </button>
  )
}
