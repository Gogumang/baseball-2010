import { useEffect, useState } from 'react'
import { RawScreen } from '@/shared/ui'
import { TEAMS } from '@/shared/config/original/teams'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import type { ScreenFrameTitle } from '@/widgets/screen-frame/lib/screenFrameLayout'
import {
  ABILITY_CHART, ANCHOR_A, ANCHOR_B, GRID, LOCKED_CIRCLES, LOCKED_NAME, NAME_BAR, TAG,
  TEAM_COUNT, cellPositionOf, isTeamOpen,
} from '@/pages/create-player/lib/teamSelectLayout'
import * as styles from '@/pages/create-player/ui/TeamSelectScreen.css'

/** 이미지 폴더 (128장) — 노트가 "slt_frame 이미지 N" 이라 부르는 막대들이 여기 있다.
 *  프레임 폴더(`slt_frame/frames`, 62장)와 **번호 체계가 다르다** — 116·117 은 프레임 쪽에 없다 */
const SLT_IMAGE = './sprites/slt_frame'
const imageSrc = (folder: string, image: number) => `${folder}/${String(image).padStart(3, '0')}.png`
const IMG_TEXT = './sprites/img_text/frames'
/** 큰 로고는 A 자리에만 쓴다 (77×76 을 가운데 맞춤) */
const BIG_LOGO_HALF = { width: 38, height: 38 } as const

/**
 * 격자 칸 바탕 — slt_frame **이미지 0** (39×38, 위아래 두 단으로 나뉜 파란 사각).
 * 해독 노트 `P6-screens.md:127` 이 격자 객체 **+0x94 = slt_frame** 이라 적고 있다.
 */
const CELL_FRAME_IMAGE = 0
/**
 * 고른 칸 테두리 — slt_frame **이미지 1** (42×42, 속 빈 노란 사각 테두리).
 * ⚠️ 원본 그림이 칸(40px)보다 2px 커서 사방으로 1px 씩 비어져 나온다 — 원본 그림 크기 그대로 둔다.
 */
const CELL_CURSOR_IMAGE = 1
const CELL_CURSOR_SIZE = 42
/**
 * 칸 안 로고 — 격자 객체 **+0x9c = team_logo** (77×76) 이다 (`P6-screens.md:127`).
 * **칸 안 로고 크기는 근사다** (0x7a571 미해독, team_logo 77×76 을 칸 39×38 에 맞춰 줄였다).
 * 원본 그리기 합성식 0xbb91d 에 "크기 a/10" 배율이 있어 5/10 ≈ 38×38 로 보는 것이 자연스럽다.
 */
const CELL_LOGO_SIZE = 38

const frameSrc = (folder: string, frame: number) => `${folder}/${String(frame).padStart(3, '0')}.png`

interface TeamSelectScreenProps {
  /** 히든 팀(10~14) 해금 기록 — 전역 기록 +0x70+idx 자리다 */
  readonly openedHiddenIds?: readonly number[]
  /** 머리띠 제목 — 같은 화면을 여러 모드가 빌려 쓴다 (나만의리그·시즌모드·일반모드) */
  readonly title?: ScreenFrameTitle
  /** 머리띠 G포인트 — 들고 있는 곳에서만 넘긴다 */
  readonly gamePoint?: number
  readonly onSelect: (teamId: number) => void
  readonly onCancel: () => void
}

/**
 * 팀 고르기 (나만의리그 상태 **0x65** — 진입 0x10790 · 그리기 0x14114 → 공용 목록 0x63b15 의 k=0,
 * 본문 0x63dee. P6 2a-1·2a-2 확정).
 *
 * 고른 팀의 로고가 A 에, 능력치 도형이 B 에 뜨고 아래에 15팀 격자가 깔린다.
 * 히든 다섯 팀(10~14 — 국가대표 넷과 외인구단)은 해금 전까지 파란 원 두 개와 `???` 로 가린다.
 *
 * **근사한 곳** (원본 함수 속이 안 풀렸다):
 *   - 격자 **칸 배치** — 칸 40px·5열·중심 (120,182) 만 확정이고 칸 그리기 0x7a571 은 미해독이다.
 *   - **능력치 도형** — 0x5aefd 는 인자만 읽었다(B 아래 반지름 30). 여기서는 팀 레코드의
 *     u16 네 칸을 네 축 방사형으로 그린다. 원본이 몇 축인지·눈금이 무엇인지는 아직 모른다.
 */
export function TeamSelectScreen({
  openedHiddenIds = [], title = '팀선택', gamePoint = 0, onSelect, onCancel,
}: TeamSelectScreenProps) {
  const [cursor, setCursor] = useState(0)

  const team = TEAMS[cursor] ?? TEAMS[0]
  const isOpen = isTeamOpen(cursor, openedHiddenIds)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const step =
        event.key === 'ArrowRight' ? 1
        : event.key === 'ArrowLeft' ? -1
        : event.key === 'ArrowDown' ? GRID.columns
        : event.key === 'ArrowUp' ? -GRID.columns
        : 0
      if (step !== 0) {
        event.preventDefault()
        // 원본 격자는 끝에서 멈춘다 — 감싸지 않는다 (0x7a2xx 커서 이동)
        return setCursor((previous) => Math.min(TEAM_COUNT - 1, Math.max(0, previous + step)))
      }
      if (event.key === 'Enter' && isTeamOpen(cursor, openedHiddenIds)) {
        event.preventDefault()
        onSelect(cursor)
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [cursor, openedHiddenIds, onSelect, onCancel])

  return (
    <RawScreen>
      {/* A·B 딱지 — A 는 흰 막대(이미지 116), B 는 파란 막대(이미지 117)로 서로 다르다 */}
      {[
        { anchor: ANCHOR_A, bar: TAG.aBarImage, barDy: TAG.aDy, textDy: TAG.aTextDy, frame: TAG.aTextFrame },
        { anchor: ANCHOR_B, bar: TAG.bBarImage, barDy: TAG.bDy, textDy: TAG.bTextDy, frame: TAG.bTextFrame },
      ].map(({ anchor, bar, barDy, textDy, frame }) => (
        <span key={frame}>
          <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, bar)}
            style={{ left: anchor.x + TAG.dx, top: anchor.y + barDy }} />
          <img className={styles.layer} alt="" src={frameSrc(IMG_TEXT, frame)}
            style={{
              left: anchor.x + TAG.dx, top: anchor.y + textDy, width: TAG.barWidth, objectFit: 'none',
            }} />
        </span>
      ))}

      {/* A — 열린 팀은 로고, 잠긴 히든 팀은 파란 원 두 개 */}
      {isOpen ? (
        <img className={styles.layer} alt={team.name} src={team.logoUrl}
          style={{ left: ANCHOR_A.x - BIG_LOGO_HALF.width, top: ANCHOR_A.y - BIG_LOGO_HALF.height }} />
      ) : (
        LOCKED_CIRCLES.map((circle) => (
          <span key={circle.diameter} className={styles.lockedCircle}
            style={{
              left: ANCHOR_A.x - circle.diameter / 2,
              top: ANCHOR_A.y - circle.diameter / 2,
              width: circle.diameter,
              height: circle.diameter,
              background: circle.color,
            }} />
        ))
      )}

      {/* 이름 막대 (slt_frame **이미지** 9, 82×15) + 이름. 잠긴 팀은 ??? 다 */}
      <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, NAME_BAR.image)}
        style={{ left: ANCHOR_A.x + NAME_BAR.dx, top: ANCHOR_A.y + NAME_BAR.dy }} />
      <span className={styles.centeredText}
        style={{ left: ANCHOR_A.x + NAME_BAR.dx, top: ANCHOR_A.y + 42, width: NAME_BAR.width }}>
        {isOpen ? team.name : LOCKED_NAME}
      </span>

      {/* B — 능력치 도형 (근사). 잠긴 팀은 원본도 −1 을 넘겨 값을 안 그린다 */}
      <TeamAbilityChart values={isOpen ? team.values.slice(2) : []} />

      {/* 15팀 격자 */}
      {TEAMS.slice(0, TEAM_COUNT).map((entry, index) => {
        const { x, y } = cellPositionOf(index)
        const open = isTeamOpen(index, openedHiddenIds)
        return (
          <button
            key={entry.id}
            type="button"
            aria-label={open ? entry.name : LOCKED_NAME}
            aria-pressed={index === cursor}
            className={styles.cell}
            style={{ left: x, top: y, width: GRID.cell, height: GRID.cell }}
            onClick={() => (open ? onSelect(index) : setCursor(index))}
            onMouseEnter={() => setCursor(index)}
          >
            {/* 칸 바탕(slt_frame 0) 먼저 깔고 그 위에 로고·물음표를 얹는다 */}
            <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, CELL_FRAME_IMAGE)}
              style={{ left: 0, top: 0 }} />
            {open
              ? <img className={styles.layer} alt="" src={entry.logoUrl}
                  style={{
                    left: (GRID.cell - CELL_LOGO_SIZE) / 2,
                    top: (GRID.cell - CELL_LOGO_SIZE) / 2,
                    width: CELL_LOGO_SIZE,
                    height: CELL_LOGO_SIZE,
                  }} />
              : <span className={styles.centeredText} style={{ left: 0, top: 14, width: GRID.cell }}>?</span>}
            {index === cursor && (
              <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, CELL_CURSOR_IMAGE)}
                style={{ left: (GRID.cell - CELL_CURSOR_SIZE) / 2, top: (GRID.cell - CELL_CURSOR_SIZE) / 2 }} />
            )}
          </button>
        )
      })}

      {/* 머리띠(제목)·바닥띠 — 원본 상태 101 그리기 0x15de4 도 이 둘을 얹는다 (P6 1-1 · R9 206 · F 489) */}
      {/* 바닥띠의 "되돌아가기" 가 원본의 되돌아가기 소프트키다 (P6 1-1) — 따로 둔 버튼은 없앴다:
          흐름 배치라 스테이지 왼쪽 위 (0,0) 에 그려져 머리띠 제목을 가리고 있었다 */}
      <ScreenFrame title={title} gamePoint={gamePoint} onBack={onCancel} />
    </RawScreen>
  )
}

/**
 * 팀 능력치 도형 — **근사**. 원본 0x5aefd 는 B 아래 반지름 30 에 그린다는 것만 확정이고
 * 속은 미해독이라, 팀 레코드 u16 네 칸을 네 축(위·오른쪽·아래·왼쪽)으로 펼쳐 그린다.
 */
function TeamAbilityChart({ values }: { readonly values: readonly number[] }) {
  const center = { x: ANCHOR_B.x + ABILITY_CHART.dx, y: ANCHOR_B.y + ABILITY_CHART.dy }
  const size = ABILITY_CHART.radius * 2
  if (values.length === 0) {
    return (
      <span className={styles.lockedCircle}
        style={{ left: center.x - ABILITY_CHART.radius, top: center.y - ABILITY_CHART.radius,
          width: size, height: size, background: ORIGINAL_COLORS.panelDeep }} />
    )
  }
  // 팀 능력치는 원본 0~999 눈금이다 (teams.ts 주석)
  const points = values.slice(0, 4).map((value, axis) => {
    const ratio = Math.min(1, value / 999)
    const length = ABILITY_CHART.radius * ratio
    const angle = (Math.PI / 2) * axis - Math.PI / 2
    return `${(center.x + Math.cos(angle) * length).toFixed(1)},${(center.y + Math.sin(angle) * length).toFixed(1)}`
  })
  return (
    <svg className={styles.layer} width={size} height={size}
      viewBox={`${center.x - ABILITY_CHART.radius} ${center.y - ABILITY_CHART.radius} ${size} ${size}`}
      style={{ left: center.x - ABILITY_CHART.radius, top: center.y - ABILITY_CHART.radius }}>
      <polygon points={points.join(' ')} fill={ORIGINAL_COLORS.radarFill} stroke={ORIGINAL_COLORS.radarEdge} />
    </svg>
  )
}
