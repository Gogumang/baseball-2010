import { useId } from 'react'
import { FrameSprite } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { RECORD_ALERT_ROW_FRAME, RECORD_ALERT_TITLE_FRAME } from '@/widgets/game-scene/lib/recordAlert'
import type { RecordAlertFrame } from '@/widgets/game-scene/lib/recordAlert'
import * as styles from '@/widgets/game-scene/ui/RecordAlertPanel.css'
import { GamePointBadge } from '@/widgets/screen-frame/ui/GamePointBadge'

const GAME_UI_FRAMES = './sprites/game_ui/frames'
const IMG_TEXT_FRAMES = './sprites/img_text/frames'

/** "!cffff00%s"(0xd09b4) · "!cffffff%s"(0xd09a8) */
const HIGHLIGHT_COLOR = '#FFFF00'
const TEXT_COLOR = '#FFFFFF'

/**
 * **경기 중 기록 달성 알림 0x4e35c** — 오른쪽 위에서 밀려 드는 판(머리 "기록달성" · G 누계)과 칸 다섯.
 * 값과 자리는 `lib/recordAlert`, 상태는 `model/useRecordAlert`. 부르는 화면의 240×320 판 위에 겹친다.
 * ⚠️ 근사: 칸 0x5eec5(…, 4, 1, 1, 0x41, 2, 0xc8, 0x335fcd, …) 의 그림은 안 읽어 홈런더비 칸과 같은 CSS 로 둔다.
 */
export function RecordAlertPanel({ frame }: { readonly frame: RecordAlertFrame }) {
  const gameUiOrigins = useFrameOrigins(GAME_UI_FRAMES)
  const textOrigins = useFrameOrigins(IMG_TEXT_FRAMES)
  const navyFilterId = `palette3-${useId().replace(/:/g, '')}`
  const { panel } = frame
  if (panel === null) return null
  return (
    <div className={styles.layer} data-testid="기록달성-알림">
      <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden>
        <filter id={navyFilterId} colorInterpolationFilters="sRGB">
          {/* 흰 글자(R=G=B) → img_text 팔레트 3 두 색. 255 → 41·73·165, 239 → 16·36·107 이 되는 1차식 */}
          <feColorMatrix type="matrix"
            values={'1.5625 0 0 0 -1.40172  0 2.3125 0 0 -2.02623  0 0 3.625 0 -2.97794  0 0 0 1 0'} />
        </filter>
      </svg>
      <div className={styles.box} style={{ left: panel.x, top: panel.y, width: panel.width, height: panel.height }} />
      <FrameSprite folder={IMG_TEXT_FRAMES} frame={RECORD_ALERT_TITLE_FRAME} origins={textOrigins}
        x={panel.title.x} y={panel.title.y} style={{ filter: `url(#${navyFilterId})` }} />
      {frame.rows.map((row) => (
        <span key={row.slot} data-testid={`기록달성-줄-${row.slot}`} data-highlighted={row.isHighlighted}>
          <FrameSprite folder={GAME_UI_FRAMES} frame={RECORD_ALERT_ROW_FRAME} origins={gameUiOrigins} x={row.x} y={row.y} />
          <span className={styles.text}
            style={{ left: row.x + 4, top: row.y + 2, color: row.isHighlighted ? HIGHLIGHT_COLOR : TEXT_COLOR }}>
            {row.text}
          </span>
        </span>
      ))}
      {panel.gamePoint !== null && (
        <GamePointBadge testId="기록달성-G" value={panel.gamePoint.value} x={panel.gamePoint.x} y={panel.gamePoint.y}
          width={0x2c} align={1} plus={false} plate />
      )}
    </div>
  )
}

/**
 * 화면 기둥 위에 얹는 알림 — 웹 투구 화면(팀경기 우리 수비 · 투수편)처럼 240×320 장면 캔버스가 없는 화면에서 쓴다.
 * 원본은 같은 프레임 0x52c50 이 타석·투구 구분 없이 화면 좌표 (0, 0) 기준으로 그리므로 화면 기둥 왼쪽 위가 기준이다.
 * 부르는 쪽은 `position: relative` 판(화면과 형제 자리)에 넣는다.
 * ⚠️ 근사: 원본은 팝업(경기 중 메뉴 등)을 알림 **위에** 그린다(0x53066 다음 0x746cd) — 웹 메뉴는 화면 본문 안이라 알림이 위에 온다.
 */
export function RecordAlertScreenOverlay({ frame }: { readonly frame: RecordAlertFrame }) {
  if (frame.panel === null) return null
  return (
    <div className={styles.screenLayer}>
      <div className={styles.screenColumn}>
        <RecordAlertPanel frame={frame} />
      </div>
    </div>
  )
}
