import { useId } from 'react'
import { FrameSprite, RoundBox } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { RECORD_ALERT_ROW_FRAME, RECORD_ALERT_TITLE_FRAME } from '@/widgets/game-scene/lib/recordAlert'
import type { RecordAlertFrame } from '@/widgets/game-scene/lib/recordAlert'
import * as styles from '@/widgets/game-scene/ui/RecordAlertPanel.css'
import { GamePointBadge } from '@/widgets/screen-frame/ui/GamePointBadge'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const GAME_UI_FRAMES = assetUrl('./sprites/game_ui/frames')
const IMG_TEXT_FRAMES = assetUrl('./sprites/img_text/frames')

/** "!cffff00%s"(0xd09b4) · "!cffffff%s"(0xd09a8) */
const HIGHLIGHT_COLOR = '#FFFF00'
const TEXT_COLOR = '#FFFFFF'

/**
 * **경기 중 기록 달성 알림 0x4e35c** — 오른쪽 위에서 밀려 드는 판(머리 "기록달성" · G 누계)과 칸 다섯.
 * 값과 자리는 `lib/recordAlert`, 상태는 `model/useRecordAlert`. 부르는 화면의 240×320 판 위에 겹친다.
 * 칸은 둥근 칸 0x5eec5(skin, x, 5, 100, h, 둥글기 4, 정렬 1, 반사 1, 반사 길이 0x41, 걸음 2, 0xc8(안 읽음), 칠 #335FCD, 테두리 0, 0)
 * — `RoundBox` 가 원본 선 목록대로 긋는다 (4e47a 직접 뜸, 0x5eec4 는 `roundBoxPaintsOf`).
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
      <RoundBox x={panel.x} y={panel.y} width={panel.width} height={panel.height} round={4} shine shineLength={0x41} shineStep={2}
        fill="#335FCD" edge="#000000" testId="기록달성-칸" />
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
 * 부르는 쪽은 `position: relative` 판(화면과 형제 자리)에 넣는다 — 240×320 판(RawScreen) **안**이면 `RecordAlertStageOverlay`.
 *
 * **겹 차례 (Q-04 ⑥, r297)** — 경기 프레임 0x52c50 은 상태 그리기 표 0xd05a0 → 53066 알림 0x4e35c → 0x746cd 팝업 차례로 그린다.
 * 그래서 알림은 장면 창(돌발 0x1b~0x1d · 교체 0xb · 감독 강판 0x23 — 상태 그리기) **위**, 팝업(일시정지 창 0x741a0 · 0x74ef5 상자 ·
 * 공용 창) **아래**다 — 겹 `SCREEN_LAYERS.RECORD_ALERT`(장면 창 8 < 9 < 팝업 상자 10). 경기 중 메뉴 층은 누름 칸 때문에 그보다 낮아
 * 메뉴가 떠 있는 동안은 `isUnderMenu` 로 알림을 그 아래로 내린다. 이 기둥을 쓰는 화면(중계 0x21 · 공수 교대 판 · 경기 끝 판 · 정산 ·
 * 벤치 클리어링)에는 경기 중 메뉴가 없다.
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

/**
 * 240×320 판(RawScreen) **안**에 얹는 알림 — 판이 이미 화면 배율을 먹었으므로 기둥(zoom)을 다시 씌우지 않는다.
 * 예전에는 판 안에서도 `RecordAlertScreenOverlay` 를 써서 배율 2 · 3 창에서 알림이 두 번 커졌다(배율 1 에서만 맞았다).
 */
export function RecordAlertStageOverlay({ frame, isUnderMenu = false }: {
  readonly frame: RecordAlertFrame
  /** 경기 중 메뉴(0x741a0)가 떠 있다 — 알림을 메뉴 층 아래로 (`styles.stageLayerUnderMenu`) */
  readonly isUnderMenu?: boolean
}) {
  if (frame.panel === null) return null
  return (
    <div className={isUnderMenu ? styles.stageLayerUnderMenu : styles.stageLayer} data-testid="기록달성-겹">
      <RecordAlertPanel frame={frame} />
    </div>
  )
}
