import { useMemo } from 'react'
import { FrameSprite, PaintedRects } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { PITCHER_BURSTS } from '@/shared/config/original/bursts'
import type { PitcherRole } from '@/entities/pitcher-career/model/pitcherRole'
import {
  PITCHER_HAND_LABELS,
  PITCHER_ROLE_LABELS,
  PITCHER_SKIN_LABELS,
  PITCHER_TYPE_LABELS,
} from '@/entities/pitcher-career/model/pitcherRegistration'
import { boardRectsOf } from '@/pages/shop/lib/equipmentWindowLayout'
import {
  REGISTER_INFO_BOARD,
  REGISTER_INFO_FRAME,
  REGISTER_LABELS,
  REGISTER_TEXT_BOXES,
  TEAM_NAME_BOX,
  teamNameFrameOf,
} from '@/pages/pitcher-league/lib/pitcherRegisterLayout'
import type { RegisterBox } from '@/pages/pitcher-league/lib/pitcherRegisterLayout'
import * as managementStyles from '@/pages/management/ui/ManagementScreen.css'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const MODE_UI = assetUrl('./sprites/mode_ui/frames')
const IMG_TEXT = assetUrl('./sprites/img_text/frames')
const pad3 = (frame: number) => String(frame).padStart(3, '0')

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

/**
 * 필살 줄 (0x7cb5c~0x7cbc0) — n = 레코드 +0x18 > 0 이면 StrCOMMON[0x18 + n + 6 + (n == 4 ? 타입 : 0)]. 0 이면 안 쓴다.
 * StrCOMMON 31~36 은 마구 여섯(`PITCHER_BURSTS`). ⚠️ n 5~9(마투수)는 나리 투수에 오지 않아 확인하지 않았다(StrCOMMON 36 + … 이 된다).
 */
export function pitcherInfoSpecialNameOf(magicNumber: number, typeIndex: number): string {
  if (magicNumber <= 0) return ''
  const index = 0x18 + magicNumber + 6 + (magicNumber === 4 ? typeIndex : 0)
  return PITCHER_BURSTS[index - 0x1f] ?? ''
}

export interface PitcherInfoBoardValues {
  readonly teamId: number
  /** 이름 — null 이면 이름 줄을 안 쓴다(등록 0x66 은 [gfx+0x28] = 1 이라 입력기가 그 자리를 그린다) */
  readonly name: string | null
  /** 레코드 +0xb 위 3비트 — 등록 타입 0~2 */
  readonly typeIndex: number
  /** 레코드 +0x18 — 고른 마구 번호 (0 이면 필살 줄이 빈다) */
  readonly magicNumber: number
  readonly role: PitcherRole
  readonly handIndex: number
  readonly skinIndex: number
}

/**
 * **정보 칸 0x7c450 — 모드 3 (투수)**. 판 0x7c110(mode_ui 1 박스 0) · mode_ui 1 · 이름표 img_text · 팀 이름 img_text(0x41 + 팀) ·
 * 흰 글(0x9c735(글꼴, RGB(255,255,255)) 뒤 0xba411 정렬 0x22). 배치 · 표는 `lib/pitcherRegisterLayout` 머리글(직접 떴다).
 * 등록 0x66(0x15f34)과 기본정보 119(0x166cc)가 같은 카드 0x15e20 을 거쳐 이 칸을 그린다 — [gfx+0x28] = (상태 == 0x66).
 */
export function PitcherInfoBoard({ values }: { readonly values: PitcherInfoBoardValues }) {
  const uiOrigins = useFrameOrigins(MODE_UI)
  const textOrigins = useFrameOrigins(IMG_TEXT)
  const teamNameAt = frameAt(textOrigins, teamNameFrameOf(values.teamId), TEAM_NAME_BOX, 0x22)
  const texts: Readonly<Record<keyof typeof REGISTER_TEXT_BOXES, string>> = {
    이름: values.name ?? '',
    타입: PITCHER_TYPE_LABELS[values.typeIndex] ?? '',
    필살: pitcherInfoSpecialNameOf(values.magicNumber, values.typeIndex),
    // 0x1400248[min(보직, 1) + 2] — 보직 1 · 2 는 둘 다 "구원"
    보직: PITCHER_ROLE_LABELS[Math.min(values.role, 1)] ?? '',
    손: PITCHER_HAND_LABELS[values.handIndex] ?? '',
    피부: PITCHER_SKIN_LABELS[values.skinIndex] ?? '',
  }
  return (
    <>
      <FrameSprite folder={MODE_UI} frame={REGISTER_INFO_FRAME} origins={uiOrigins} x={0} y={0} />
      {REGISTER_LABELS.map((label) => {
        const at = frameAt(textOrigins, label.frame, label.box, label.align | 0x20, label.ox)
        return at === null ? null : <FrameSprite key={label.frame} folder={IMG_TEXT} frame={label.frame} origins={textOrigins} x={at.x} y={at.y} />
      })}
      {teamNameAt !== null && (
        <FrameSprite folder={IMG_TEXT} frame={teamNameFrameOf(values.teamId)} origins={textOrigins} x={teamNameAt.x} y={teamNameAt.y} />
      )}
      {(Object.keys(REGISTER_TEXT_BOXES) as (keyof typeof REGISTER_TEXT_BOXES)[]).map((id) => {
        const box = REGISTER_TEXT_BOXES[id]
        if (texts[id] === '') return null
        return (
          <div
            key={id}
            className={managementStyles.infoValue}
            data-testid={`정보칸-${id}`}
            style={{ left: box.x, top: box.y, width: box.width, height: box.height, color: ORIGINAL_COLORS.text }}
          >
            {texts[id]}
          </div>
        )
      })}
    </>
  )
}

/** 판 0x7c110(mode_ui 1 박스 0, 0) — `boardRectsOf` 는 화면 좌표 칠 목록이다. 0x67 은 정보 칸 없이 이 판만 깐다(0x162bc) */
export function PitcherInfoPlate() {
  const board = useMemo(() => boardRectsOf(REGISTER_INFO_BOARD, false), [])
  return <PaintedRects x={0} y={0} width={240} height={320} paints={board} testId="등록-정보판" />
}
