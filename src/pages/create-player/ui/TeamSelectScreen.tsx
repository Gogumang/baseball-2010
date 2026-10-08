import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { RawScreen } from '@/shared/ui'
import { TEAMS } from '@/shared/config/original/teams'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { blackStepCoverOpacityOf } from '@/shared/lib/stepCover/stepCover'
import type { ScreenFrameTitle } from '@/widgets/screen-frame/lib/screenFrameLayout'
import {
  ABILITY_CHART, ANCHOR_A, ANCHOR_B, GRID, LOCKED_CIRCLES, LOCKED_NAME, NAME_BAR, TAG,
  TEAM_COUNT, TEAM_GRID_SHAPE, abilityChartFrameOf, abilityChartVerticesOf, cellPositionOf, isTeamOpen,
} from '@/pages/create-player/lib/teamSelectLayout'
import { moveGridCursor } from '@/pages/record/lib/annalsGrid'
import type { AnnalsGridShape } from '@/pages/record/lib/annalsGrid'
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
  /**
   * 격자 꼴 — 안 넘기면 `TEAM_GRID_SHAPE`(5×3 · 꼴 0x10: 가로는 같은 줄 안에서 감고 세로는 끝에서 멈춘다).
   * 나만의리그 0x65 · 시즌 0xca · 트레이드 0xe4 · 일반모드 18·19 가 모두 이 꼴이다(셋업 주소는 `TEAM_GRID_SHAPE`).
   */
  readonly gridShape?: AnnalsGridShape
  readonly onSelect: (teamId: number) => void
  /**
   * 잠긴 히든 칸에서 확인했다 — 안 주면 잠긴 칸은 확인을 안 받는다. 시즌 팀 고르기 0xca(0x8da4)처럼
   * 잠긴 칸에서도 확인 키로 힌트 팝업을 띄우는 화면이 넘긴다.
   */
  readonly onSelectLocked?: (teamId: number) => void
  readonly onCancel: () => void
  /** 화면 위에 얹을 팝업 — 같은 무대(RawScreen) 맨 위에 그린다 */
  readonly overlay?: ReactNode
  /**
   * 어둡게 덮는 칸 — 공용 목록 0x63b14 의 마지막 인자(칸 그리기 0x7a570 넷째 인자). 시즌 트레이드 0xe4(그림 0xa14c)만 내 팀
   * (s8)SR[1] 을 넘기고 그 밖(0xca 등)은 −1 이다. `TEAM_COVER_STEP` 참고.
   */
  readonly coveredTeamId?: number
}

/**
 * 칸 그리기 0x7a570 의 덮기 칸 (직접 떴다, 0x7b342~0x7b38c): 칸 번호 == 넷째 인자이면 로고(0x66431 이 칸 + (2, 2) 에 그린 것)
 * 뒤에 그 로고 그림의 (폭 >> 1, 높이 >> 1) 를 **칸 자리 (x, y)** 에 검정 덮기 [0x15605d4](x, y, w, h, **7**) — 화면을 7/16 남긴다.
 * 로고 77×76 → 38×38 이라 웹 로고 칸(CELL_LOGO_SIZE)과 같고, 자리는 로고보다 (−2, −2) 다.
 */
const TEAM_COVER_STEP = 7
const TEAM_COVER_OFFSET = -2

/**
 * 팀 고르기 (나만의리그 상태 **0x65** — 진입 0x10790 · 그리기 0x14114 → 공용 목록 0x63b15 의 k=0,
 * 본문 0x63dee. P6 2a-1·2a-2 확정).
 *
 * 고른 팀의 로고가 A 에, 능력치 도형이 B 에 뜨고 아래에 15팀 격자가 깔린다.
 * 히든 다섯 팀(10~14 — 국가대표 넷과 외인구단)은 해금 전까지 파란 원 두 개와 `???` 로 가린다.
 *
 * **근사한 곳** (원본 함수 속이 안 풀렸다):
 *   - 격자 **칸 배치** — 칸 40px·5열·중심 (120,182) 만 확정이고 칸 그리기 0x7a571 은 미해독이다.
 *   - **능력치 도형의 값 채움** — 축 각도·반지름·값 → 길이 식과 바탕 테두리는 디스어셈으로
 *     확정했지만(아래 `TeamAbilityChart`), 값 도형을 채우는 호출은 못 짚었다.
 */
export function TeamSelectScreen({
  openedHiddenIds = [], title = '팀선택', gamePoint = 0, gridShape = TEAM_GRID_SHAPE, onSelect, onSelectLocked, onCancel, overlay,
  coveredTeamId = -1,
}: TeamSelectScreenProps) {
  const [cursor, setCursor] = useState(0)

  const team = TEAMS[cursor] ?? TEAMS[0]
  const isOpen = isTeamOpen(cursor, openedHiddenIds)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 장면 키(나만의리그 0x14114 · 시즌 0xca 0x8da4 · 트레이드 0xe4 0x8250 · 일반모드 18 0x29b38 · 19 0x29c98)는
      // 모두 키 [this+0x40] 을 걸러 내지 않고 격자 vt+0x18(0x6c299 → 0x6c521 → 0x6c031)에 그대로 넘긴다 —
      // 숫자키 꼴 1 이라 '2' '4' '6' '8' 은 ↑ ← → ↓, '5' 는 OK(−5) 로 돌아온다 (표 0xd2e7c).
      const direction = event.key === 'ArrowRight' || event.key === '6' ? 'right'
        : event.key === 'ArrowLeft' || event.key === '4' ? 'left'
        : event.key === 'ArrowDown' || event.key === '8' ? 'down'
        : event.key === 'ArrowUp' || event.key === '2' ? 'up' : null
      if (direction !== null) {
        event.preventDefault()
        return setCursor((previous) => moveGridCursor(gridShape, previous, direction))
      }
      const isOk = event.key === 'Enter' || event.key === '5'
      if (isOk && isTeamOpen(cursor, openedHiddenIds)) {
        event.preventDefault()
        onSelect(cursor)
      } else if (isOk && onSelectLocked !== undefined) {
        event.preventDefault()
        onSelectLocked(cursor)
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [cursor, openedHiddenIds, gridShape, onSelect, onSelectLocked, onCancel])

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

      {/* B — 능력치 도형. 잠긴 팀은 원본도 idx −1 을 넘겨 네 값을 0 으로 채운다 */}
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
            onClick={() => {
              if (open) return onSelect(index)
              setCursor(index)
              onSelectLocked?.(index)
            }}
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
            {open && index === coveredTeamId && (
              <span className={styles.layer} data-testid="팀칸-덮기" style={{
                left: (GRID.cell - CELL_LOGO_SIZE) / 2 + TEAM_COVER_OFFSET,
                top: (GRID.cell - CELL_LOGO_SIZE) / 2 + TEAM_COVER_OFFSET,
                width: CELL_LOGO_SIZE,
                height: CELL_LOGO_SIZE,
                background: ORIGINAL_COLORS.black,
                opacity: blackStepCoverOpacityOf(TEAM_COVER_STEP),
              }} />
            )}
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
      {overlay}
    </RawScreen>
  )
}

/**
 * 값 도형 채움 알파 — `anim+0x80 = 0xb4ffff00`(0x5b386) 의 위 바이트 0xb4.
 * 아래 세 바이트 ffff00 이 `radarFill`(#FFFF00) 과 같고 `anim+0x7c = makeColor(255,255,255)`(0x5b380)
 * 가 `radarEdge`(#FFFFFF) 다. ⚠️ 값 도형을 이 두 색으로 칠하는 것은 **유력** — 채우는 호출은 못 짚었다.
 */
const CHART_FILL_ALPHA = 0xb4 / 0xff

/**
 * 팀 능력치 도형 — `0x5aefd` 종류 0, 반지름 30. S9 5절이 "미해결" 로 남긴 **값 → 꼭짓점 길이**를
 * 이번에 디스어셈으로 풀었다 (`0x75ebc` 만들기 · `0x7633c` 그리기).
 *
 *   - 축 각도는 표 `0xd1b0c`·`0xd36fc` 의 **225·315·45·135°** 네 대각선이다 (화면 y 가 아래).
 *   - **현재길이 = 반지름 × 축 최대치(999) / 999 × 값 / 999**, 정수 나눗셈 두 번.
 *   - 바탕 테두리는 **고정 반지름 29**에 **#6B92F4**(`radarAxis`) 선 네 줄이다 (확정).
 *
 * ⚠️ 안 그린 것: 축별 최대 꼭짓점을 잇는 **빨간 테두리**(`anim+0x1dc`)는 `anim+0x1e0` 이 설 때만
 * 그리는데 그 칸을 세우는 곳을 못 찾았다. 꼭짓점 그림(프레임 8·9·10·11)과 축 딱지(반지름 +18,
 * 0x5b412 루프)는 웹에 그림 근거가 없다.
 * 원본은 **숫자를 쓰지 않고 도형만** 그린다 — 여기도 숫자를 넣지 않는다.
 */
function TeamAbilityChart({ values }: { readonly values: readonly number[] }) {
  const center = { x: ANCHOR_B.x + ABILITY_CHART.dx, y: ANCHOR_B.y + ABILITY_CHART.dy }
  const radius = ABILITY_CHART.radius
  const size = radius * 2
  const pointsOf = (points: readonly { readonly x: number; readonly y: number }[]) =>
    points.map((point) => `${point.x},${point.y}`).join(' ')
  // 잠긴 팀은 원본도 idx −1 로 네 값을 0 으로 채운다 (0x5b008) — 바탕 테두리만 남는다
  const hasValues = values.length > 0

  return (
    <svg className={styles.layer} width={size} height={size} shapeRendering="crispEdges"
      viewBox={`${center.x - radius} ${center.y - radius} ${size} ${size}`}
      style={{ left: center.x - radius, top: center.y - radius }}>
      <polygon points={pointsOf(abilityChartFrameOf(center))}
        fill="none" stroke={ORIGINAL_COLORS.radarAxis} strokeWidth={1} />
      {hasValues && (
        <polygon points={pointsOf(abilityChartVerticesOf(center, values, radius))}
          fill={ORIGINAL_COLORS.radarFill} fillOpacity={CHART_FILL_ALPHA}
          stroke={ORIGINAL_COLORS.radarEdge} strokeWidth={1} />
      )}
    </svg>
  )
}
