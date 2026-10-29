import { FrameSprite, InputMethodText, PressArea } from '@/shared/ui'
import { DescriptionBand } from '@/shared/ui/DescriptionBand/DescriptionBand'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { InputModeBox } from '@/shared/ui/InputMethodText/InputModeBox'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { MAXIMUM_NAME_BYTES, nameByteLengthOf } from '@/entities/career/model/playerCareer'
import type { PitcherRookieProfile } from '@/entities/pitcher-career/model/pitcherRegistration'
import {
  ARROW_FRAME,
  ARROW_SIZE,
  INPUT_MODE_BOX,
  NAME_TEXT_AT,
  REGISTER_ROW_HINTS,
  REGISTER_YELLOW,
  cursorBoxOf,
  registerValueBoxOf,
  valueArrowsOf,
} from '@/pages/pitcher-league/lib/pitcherRegisterLayout'
import { PitcherInfoBoard } from '@/pages/pitcher-league/ui/PitcherInfoBoard'
import { MODE_UI } from './registerFigure'
import { RoundEdge } from './RoundEdge'

export const NAME_ROW = 0
/** 값 줄 — 타입 · 보직 · 손 · 피부 */
const VALUE_ROWS = [1, 2, 3, 4] as const

interface RegisterRowsProps {
  readonly teamId: number
  readonly name: string
  readonly profile: PitcherRookieProfile
  readonly selectedRow: number
  readonly isBlinkOn: boolean
  readonly uiOrigins: FrameOrigins | null
  /** 0x66 띠가 처음 그릴 때의 펼침 갱신 수 — 0x67 에서 돌아오면 이어받는다 */
  readonly bandTicks: number
  readonly onChangeValue: (row: number, step: number) => void
  /** 값 칸 누름 — 고른 줄이면 OK(↓ · 마지막 줄이면 0x67), 아니면 그 줄을 고른다 */
  readonly onPressValue: (row: number) => void
  readonly onFocusName: () => void
  readonly onChangeName: (name: string) => void
}

/** 0x66 그리기 0x15f34 의 정보 칸 — 정보 칸 0x7c450 · 커서 · 값 화살 · 이름 입력기 · 입력 방식 칸 · 설명 띠 */
export function RegisterRows(rows: RegisterRowsProps) {
  const { selectedRow, uiOrigins, onChangeValue } = rows
  const rowArrows = valueArrowsOf(selectedRow)
  return (
    <div data-testid="등록-정보칸">
      {/* 정보 칸 0x7c450 (모드 3 · [gfx+0x28] = 1 — 이름 줄은 입력기 몫, 새 레코드 +0x18 = 0 이라 필살 줄도 빈다) */}
      <PitcherInfoBoard
        values={{
          teamId: rows.teamId,
          name: null,
          typeIndex: rows.profile.typeIndex,
          magicNumber: 0,
          role: rows.profile.role,
          handIndex: rows.profile.handIndex,
          skinIndex: rows.profile.skinIndex,
        }}
      />

      {/* 커서 0xba015 — 틱 % 10 ≠ 0 일 때만 */}
      {rows.isBlinkOn && <RoundEdge box={cursorBoxOf(registerValueBoxOf(selectedRow))} color={REGISTER_YELLOW} testId="선수등록-커서" />}
      {selectedRow !== NAME_ROW && (
        <>
          <FrameSprite folder={MODE_UI} frame={ARROW_FRAME} origins={uiOrigins} x={rowArrows.left.x} y={rowArrows.left.y} />
          <FrameSprite
            folder={MODE_UI}
            frame={ARROW_FRAME}
            origins={uiOrigins}
            x={rowArrows.right.x}
            y={rowArrows.right.y}
            style={{ transform: 'scaleX(-1)' }}
          />
          <PressArea label={`${selectedRow}줄 이전`} rect={{ ...rowArrows.left, ...ARROW_SIZE }} onPress={() => onChangeValue(selectedRow, -1)} />
          <PressArea label={`${selectedRow}줄 다음`} rect={{ ...rowArrows.right, ...ARROW_SIZE }} onPress={() => onChangeValue(selectedRow, 1)} />
        </>
      )}

      {/* 이름 글 0x677d5 — 노랑. 원본 입력기는 웹 글 칸으로 대신하고 CP949 8바이트로 자른다 */}
      <form onSubmit={(event) => event.preventDefault()}>
        {/* 0x67 에서 CLR 로 돌아오면 0x17360 이 이전 상태 0x67 을 보고 곧장 끝난다(1736a → 1764e) — 줄 커서 · 값이 그대로라 초점을 뺏지 않는다 */}
        {/* 0x677d5(입력기, 62, 204, 앱 글꼴, RGB(255,255,0), 줄 == 0, 정렬 0x11, 0) — 0x16128~0x16152. 줄 0 이면 '|' 커서 */}
        <InputMethodText
          value={rows.name}
          autoFocus={selectedRow === NAME_ROW}
          aria-label="이름"
          x={NAME_TEXT_AT.x}
          y={NAME_TEXT_AT.y}
          color={REGISTER_YELLOW}
          isCursorOn={selectedRow === NAME_ROW}
          inputRect={{ x: NAME_TEXT_AT.x, y: NAME_TEXT_AT.y - 2, width: INPUT_MODE_BOX.x - NAME_TEXT_AT.x - 1, height: 13 }}
          onFocus={rows.onFocusName}
          onChange={(event) => {
            // CP949 8바이트까지 — 타자편과 같은 입력기다 (R11 1b)
            if (nameByteLengthOf(event.target.value) <= MAXIMUM_NAME_BYTES) rows.onChangeName(event.target.value)
          }}
        />
      </form>
      {/* 입력 방식 칸 0xba0bd · 화살 (0x1615c~0x161f4) — 타자 등록과 같은 0x15f34 갈래 */}
      {selectedRow === NAME_ROW && <InputModeBox nameBox={registerValueBoxOf(NAME_ROW)} />}
      {/* 값 칸 누름 — 고르기 · 고른 줄이면 OK(↓ · 마지막 줄이면 0x67) */}
      {VALUE_ROWS.map((row) => (
        <PressArea
          key={row}
          label={`${row}줄 값`}
          rect={registerValueBoxOf(row)}
          option={{ isSelected: row === selectedRow }}
          onPress={() => rows.onPressValue(row)}
        />
      ))}
      {/* 0x67 에서 돌아오면 원본은 띠를 다시 펴지 않는다(0x17360 이 [띠+0x88] · [+0x8a] 를 안 세운다) — 0x67 이 편 만큼 이어받는다 */}
      <DescriptionBand text={ORIGINAL_MODE_TEXT[REGISTER_ROW_HINTS[selectedRow] ?? 3] ?? ''} seed={selectedRow} initialTicks={rows.bandTicks} />
    </div>
  )
}
