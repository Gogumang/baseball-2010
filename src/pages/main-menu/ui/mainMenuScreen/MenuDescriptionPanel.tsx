import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import type { MainMenuEntry } from '@/shared/config/original/mainMenu'
import { DescriptionBand } from '@/shared/ui/DescriptionBand/DescriptionBand'
import {
  MENU_DESCRIPTION_PANEL,
  MENU_DESCRIPTION_TEXT_BOX,
  MENU_PANEL_HEADING_COLOR,
  menuPanelHeadingFrameOf,
  menuPanelHeadingTopLeftOf,
  menuPanelLabelTopLeftOf,
} from '@/pages/main-menu/lib/mainMenuLayout'
import { DescriptionPanel } from '@/pages/main-menu/ui/DescriptionPanel'
import { IMG_TEXT, MAIN_UI, frameSrc, imageSrc, pad } from '@/pages/main-menu/ui/mainMenuScreen/menuAssets'
import { MenuTintedLabel } from '@/pages/main-menu/ui/mainMenuScreen/MenuTintedLabel'
import * as styles from '@/pages/main-menu/ui/MainMenuScreen.css'

interface MenuDescriptionPanelProps {
  readonly isWheel: boolean
  readonly reelState: number
  readonly selected: MainMenuEntry | undefined
  readonly cursor: number
  readonly isBandGrowing: boolean
  readonly origins: FrameOrigins | null
  readonly textOrigins: FrameOrigins | null
}

/** 설명 판 (두 단 공통) — 판 · 판 안 큰 글자 · 회색 제목(하위 목록만) · 설명 띠(하위 목록) · 판 글칸(처음 메뉴) */
export function MenuDescriptionPanel({ isWheel, reelState, selected, cursor, isBandGrowing, origins, textOrigins }: MenuDescriptionPanelProps) {
  const description = selected?.description ?? ''
  return (
    <>
      <img
        className={styles.layer}
        style={{ left: MENU_DESCRIPTION_PANEL.x, top: MENU_DESCRIPTION_PANEL.y }}
        src={imageSrc(MENU_DESCRIPTION_PANEL.frame)}
        alt=""
      />
      {/* 판 안 큰 글자 = main_ui 프레임, 첨자는 커서다 (0x25774 · 상태 4 는 0x25084) */}
      {selected !== undefined && <PanelLabel frame={selected.labelFrame} origins={origins} />}
      {!isWheel && <PanelHeading reelState={reelState} textOrigins={textOrigins} />}
      {/*
        하위 목록 설명 띠 0x55544 는 0x2524c 의 **맨 끝**(0x25860)에 그린다 — 판 0x25770 · 판 안 큰 글자 0x257c8 · 회색 제목 0x257ee 뒤라
        띠(왼쪽 아래 (0, 275)~, 폭 160)가 판 왼쪽의 회색 제목을 덮는다. r77 점검의 "설명 판이 왼쪽 아래를 가린다"는 이 원본 차례 그대로다
        (2026-10-15 r79 다시 떴다).
        하위 목록 설명 띠 — 0x2524c 끝 0x257f2~0x25860: 바탕 띠가 자라는 중(`[this+0xe2]`)이 아니고 상태가 4 가 아니면
        `0x55545([this+0x120], StrMAINMENU[기준 + 커서])` — 기준은 하위 5 → 6 · 9 → 0x18 (6 → 0x10, 나머지는 글 없음).
        다시 펴는 계기는 커서를 옮기는 0x25366~0x25370 의 `[skin+0x88] = 1 · [+0x8a] = 1` 이라 커서를 씨앗으로 쓴다
      */}
      {!isWheel && !isBandGrowing && <DescriptionBand text={description} seed={cursor} />}
      <div
        className={styles.description}
        style={{
          left: MENU_DESCRIPTION_TEXT_BOX.x,
          top: MENU_DESCRIPTION_TEXT_BOX.y,
          width: MENU_DESCRIPTION_TEXT_BOX.width,
          height: MENU_DESCRIPTION_TEXT_BOX.height,
        }}
      >
        {/* 판 안 글칸은 처음 메뉴(하위 4) 0x24ff0 만 쓴다 — 하위 5·9 는 판(0x256fc)에 글을 안 쓰고 설명 띠 0x55544 로 쓴다.
            잠긴 칸 안내(`lockedNotice`)는 판이 아니라 확인 상자(0x74ef5)로 뜬다 */}
        <DescriptionPanel raw={isWheel ? description : ''} />
      </div>
    </>
  )
}

/** 판 안 큰 글자 — 크기를 모르면 그리지 않는다 */
function PanelLabel({ frame, origins }: { readonly frame: number; readonly origins: FrameOrigins | null }) {
  const size = origins?.[pad(frame)] ?? null
  if (size === null) return null
  const at = menuPanelLabelTopLeftOf(size.width, size.height)
  return <img className={styles.layer} style={{ left: at.x, top: at.y }} src={frameSrc(MAIN_UI, frame)} alt="" />
}

/** 판 왼쪽 위 회색 제목 — 하위 목록(0x257cc)에만 있다 */
function PanelHeading({ reelState, textOrigins }: { readonly reelState: number; readonly textOrigins: FrameOrigins | null }) {
  const headingFrame = menuPanelHeadingFrameOf(reelState)
  const headingSize = headingFrame === null ? null : (textOrigins?.[pad(headingFrame)] ?? null)
  if (headingFrame === null || headingSize === null) return null
  return (
    <MenuTintedLabel
      src={frameSrc(IMG_TEXT, headingFrame)}
      left={menuPanelHeadingTopLeftOf().x}
      top={menuPanelHeadingTopLeftOf().y}
      width={headingSize.width}
      height={headingSize.height}
      color={MENU_PANEL_HEADING_COLOR}
    />
  )
}
