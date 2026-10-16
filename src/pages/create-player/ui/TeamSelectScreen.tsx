import { useEffect, useState } from 'react'
import { useListPageEntry } from '@/widgets/screen-frame/model/useListPageEntry'
import { gridOpenCellDy } from '@/shared/lib/gridOpen/gridOpen'
import type { ReactNode } from 'react'
import { OriginalScaledImage, RawScreen } from '@/shared/ui'
import { TEAMS } from '@/shared/config/original/teams'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { blackStepCoverOpacityOf } from '@/shared/lib/stepCover/stepCover'
import type { ScreenFrameTitle } from '@/widgets/screen-frame/lib/screenFrameLayout'
import {
  ABILITY_CHART, ANCHOR_A, ANCHOR_B, GRID, LOCKED_CIRCLES, LOCKED_NAME, NAME_BAR, TAG,
  TEAM_COUNT, TEAM_GRID_SHAPE, abilityAxisMaximumLengthOf, cellPositionOf, isTeamOpen, teamGridOpenShapeOf,
} from '@/pages/create-player/lib/teamSelectLayout'
import { moveGridCursor } from '@/pages/record/lib/annalsGrid'
import type { AnnalsGridShape } from '@/pages/record/lib/annalsGrid'
import * as styles from '@/pages/create-player/ui/TeamSelectScreen.css'
import { AbilityRadarPanel } from '@/pages/create-player/ui/AbilityRadarPanel'
import { ABILITY_RADAR_LABELS } from '@/pages/create-player/lib/abilityRadarPanel'
import { useGridCursorBounce } from '@/shared/lib/gridCursorBounce/gridCursorBounce'
import { GridCellBack } from '@/pages/create-player/ui/GridCellBack'

/** 이미지 폴더 (128장) — 노트가 "slt_frame 이미지 N" 이라 부르는 막대들이 여기 있다.
 *  프레임 폴더(`slt_frame/frames`, 62장)와 **번호 체계가 다르다** — 116·117 은 프레임 쪽에 없다 */
const SLT_IMAGE = './sprites/slt_frame'
/** team_logo 이미지 묶음 — 15 = 잠긴 칸 "?" (32×48) */
const TEAM_LOGO_IMAGE = './sprites/team_logo'
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
 * 칸 안 로고 — 격자 종류 9 칸 그리기 0x7b2ae (직접 떴다, 0x7b2d4~0x7b33e):
 * 열린 팀은 `0x66431(skin, team_logo, 팀, x + 2, y + 2)` — 스킨 버퍼 +0x4c8 + 팀·16 의 (폭, 높이, 픽셀)을 제 크기로 찍는다.
 * 그 버퍼는 0x663c4 가 팀마다 0x662dc(…, 0x23, 0x22) 로 늘려 둔 **35×34** 다 (P6 4a, r113 직접 뜸).
 * ⚠️ 0x662dc 의 표본 방식(최근접인지)은 안 읽었다 — 웹은 77×76 을 35×34 로 최근접(pixelated) 축소한다.
 */
const CELL_LOGO = { x: 2, y: 2, width: 35, height: 34 } as const
/**
 * 잠긴 히든 칸 — `0xbb91d(team_logo 이미지 15 "?"(32×48), x + 12, y + 7, 종류 2, a 5, b 0)` (0x7b2f6~0x7b30e):
 * 종류 2 · a 5 = 절반 크기(16×24) 최근접 표본 (R6 3c 확정).
 */
const CELL_LOCKED_MARK = { image: 15, x: 12, y: 7, width: 16, height: 24 } as const
/** 덮기 크기 — team_logo 이미지(77×76)의 (폭 >> 1, 높이 >> 1) (0x7b35a~0x7b370) */
const CELL_COVER_SIZE = { width: 38, height: 38 } as const

/** 팀 15칸 격자의 열림 애니 꼴 (k 0·1 — `teamGridOpenShapeOf`) */
const TEAM_GRID_OPEN = teamGridOpenShapeOf(TEAM_COUNT)

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
 * 덮기는 로고(35×34, 칸 + (2, 2))보다 크고 칸 왼쪽 위에서 시작한다.
 */
const TEAM_COVER_STEP = 7

/**
 * 팀 고르기 (나만의리그 상태 **0x65** — 진입 0x10790 · 그리기 0x14114 → 공용 목록 0x63b15 의 k=0,
 * 본문 0x63dee. P6 2a-1·2a-2 확정).
 *
 * 고른 팀의 로고가 A 에, 능력치 도형이 B 에 뜨고 아래에 15팀 격자가 깔린다.
 * 히든 다섯 팀(10~14 — 국가대표 넷과 외인구단)은 해금 전까지 파란 원 두 개와 `???` 로 가린다.
 *
 * 격자 칸 배치(0x79ed5 · 0x7a571)와 칸 그림(종류 9 — 0x7b2ae)은 확정이다 (`lib/teamSelectLayout` · 위 CELL_* 머리말).
 * 능력치 도형은 0x5aefc 종류 0 의 ABILITY 판 전체다 (아래 `TeamAbilityChart` — 값 도형 채우기 0x75c70 · 테두리 0x75dc4 까지 풀렸다).
 */
export function TeamSelectScreen({
  openedHiddenIds = [], title = '팀선택', gamePoint = 0, gridShape = TEAM_GRID_SHAPE, onSelect, onSelectLocked, onCancel, overlay,
  coveredTeamId = -1,
}: TeamSelectScreenProps) {
  const [cursor, setCursor] = useState(0)

  const team = TEAMS[cursor] ?? TEAMS[0]
  const isOpen = isTeamOpen(cursor, openedHiddenIds)

  // 머리띠가 미끄러지는 동안은 본문이 없고, 본문 첫 그림에 지은 격자가 열림 애니(0x79fa8)를 다 돌 때까지 키 함수가
  // [skin+0xe4] == 0 을 보고 아무것도 안 한다 (`useListPageEntry`). 격자 시작 애니 = [skin+0xe8] — 이 화면들은 모두 넷째 인자 1 이다
  const entry = useListPageEntry({ grid: { shape: TEAM_GRID_OPEN, isAnimated: true } })
  const { keyLock } = entry
  const gridOpen = entry.grid
  // 격자 시작 0x7a005(격자, [skin+0xe8], 1, 1) — 셋째 인자 [격자+6] = 1 이라 커서 튕김이 있다 (0x6409c)
  const bounce = useGridCursorBounce()
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (keyLock.current) return
      // 장면 키(나만의리그 0x14114 · 시즌 0xca 0x8da4 · 트레이드 0xe4 0x8250 · 일반모드 18 0x29b38 · 19 0x29c98)는
      // 모두 키 [this+0x40] 을 걸러 내지 않고 격자 vt+0x18(0x6c299 → 0x6c521 → 0x6c031)에 그대로 넘긴다 —
      // 숫자키 꼴 1 이라 '2' '4' '6' '8' 은 ↑ ← → ↓, '5' 는 OK(−5) 로 돌아온다 (표 0xd2e7c).
      const direction = event.key === 'ArrowRight' || event.key === '6' ? 'right'
        : event.key === 'ArrowLeft' || event.key === '4' ? 'left'
        : event.key === 'ArrowDown' || event.key === '8' ? 'down'
        : event.key === 'ArrowUp' || event.key === '2' ? 'up' : null
      if (direction !== null) {
        event.preventDefault()
        const next = moveGridCursor(gridShape, cursor, direction)
        // 칸이 바뀐 키(커서 +0x25)면 0x7a571 이 고른 칸을 그 방향으로 튕긴다 (`useGridCursorBounce`)
        if (next !== cursor) bounce.start(direction)
        return setCursor(next)
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
  }, [cursor, openedHiddenIds, gridShape, onSelect, onSelectLocked, onCancel, bounce.start])

  return (
    <RawScreen>
      {gridOpen !== null && (<>
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
      <TeamAbilityChart values={isOpen ? team.values.slice(2) : []} cursor={cursor} isOpen={isOpen} />

      {/* 15팀 격자 — 시작 0x7a005(격자, [skin+0xe8], 1, 1) 의 넷째 인자 [격자+8] = 1 이라 칸 바탕(남색 둥근 네모)을 모든 칸에 먼저 깐다 */}
      {TEAMS.slice(0, TEAM_COUNT).map((entry, index) => {
        const shake = index === cursor ? bounce.offset : null
        return (
          <GridCellBack key={`back-${entry.id}`} className={styles.layer}
            x={cellPositionOf(index).x + (shake?.dx ?? 0)}
            y={cellPositionOf(index).y + gridOpenCellDy(TEAM_GRID_OPEN, gridOpen.state, index) + (shake?.dy ?? 0)}
            width={GRID.cell} height={GRID.cell} />
        )
      })}
      {TEAMS.slice(0, TEAM_COUNT).map((entry, index) => {
        const shake = index === cursor ? bounce.offset : null
        const x = cellPositionOf(index).x + (shake?.dx ?? 0)
        const y = cellPositionOf(index).y + gridOpenCellDy(TEAM_GRID_OPEN, gridOpen.state, index) + (shake?.dy ?? 0)
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
          >
            {/* 칸 바탕(slt_frame 0) 먼저 깔고 그 위에 로고·물음표를 얹는다 */}
            <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, CELL_FRAME_IMAGE)}
              style={{ left: 0, top: 0 }} />
            {open
              // 0x66431 — 0x663c4 가 원본 식(0x662dc → 0x65f64)으로 미리 줄인 35×34 버퍼를 칸 + (2, 2) 에 제 크기로
              ? <OriginalScaledImage className={styles.layer} alt="" src={entry.logoUrl}
                  boxWidth={CELL_LOGO.width} boxHeight={CELL_LOGO.height}
                  style={{ left: CELL_LOGO.x, top: CELL_LOGO.y }} />
              : <img className={styles.layer} alt="?" data-testid="팀칸-물음표" src={imageSrc(TEAM_LOGO_IMAGE, CELL_LOCKED_MARK.image)}
                  style={{
                    left: CELL_LOCKED_MARK.x, top: CELL_LOCKED_MARK.y,
                    width: CELL_LOCKED_MARK.width, height: CELL_LOCKED_MARK.height,
                  }} />}
            {open && index === coveredTeamId && (
              <span className={styles.layer} data-testid="팀칸-덮기" style={{
                left: 0,
                top: 0,
                width: CELL_COVER_SIZE.width,
                height: CELL_COVER_SIZE.height,
                background: ORIGINAL_COLORS.black,
                opacity: blackStepCoverOpacityOf(TEAM_COVER_STEP),
              }} />
            )}
            {/* 커서는 열림 애니가 끝난 뒤([격자+9])에만 0x7b3a0 이 그린다 */}
            {index === cursor && gridOpen.state.isDone && (
              <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, CELL_CURSOR_IMAGE)}
                style={{ left: (GRID.cell - CELL_CURSOR_SIZE) / 2, top: (GRID.cell - CELL_CURSOR_SIZE) / 2 }} />
            )}
          </button>
        )
      })}
      </>)}

      {/* 머리띠(제목)·바닥띠 — 원본 상태 101 그리기 0x15de4 도 이 둘을 얹는다 (P6 1-1 · R9 206 · F 489) */}
      {/* 바닥띠의 "되돌아가기" 가 원본의 되돌아가기 소프트키다 (P6 1-1) — 따로 둔 버튼은 없앴다:
          흐름 배치라 스테이지 왼쪽 위 (0,0) 에 그려져 머리띠 제목을 가리고 있었다 */}
      <ScreenFrame title={title} gamePoint={gamePoint} onBack={onCancel} />
      {overlay}
    </RawScreen>
  )
}

/**
 * 팀 능력치 도형 — 공용 목록 0x63dee 의 `0x5aefd(skin, [skin+0xd4], B.x, B.y + 8, 종류 0, 0, 팀 idx(잠김이면 −1), 반지름 30, 0, 0, 0)`
 * (열린 팀 0x63e5c~0x63e74 · 잠긴 팀 0x63f14~0x63f38 → BL 0x63f38). 0x5aefc 는 종류와 상관없이 **ABILITY 판 전체**를 그린다 —
 * 둥근 바탕 slt_frame 3 · 바탕 테두리(고정 29, #6B92F4) · 값 도형 · 축 선 · 이름 상자 slt_frame 17 · 이름 img_text 46 · 45 · 204 · 205
 * (서술자 +6 = 8~11, 0x5b042~0x5b060) · 숫자 또는 "???" (`AbilityRadarPanel`, `lib/abilityRadarPanel` 머리말).
 * 값 = 팀 레코드 0x1f8c1(전역, idx) 의 +4 · +6 · +8 · +0xa (0x5b02a~0x5b08c), 축 최대 999(서술자 표 0xd1b2c 그대로) → 최대길이 = 반지름.
 * 잠긴 팀은 idx −1 이라 값 네 개 0 이고 [anim+0x1e4] = 0 (0x5afe8~0x5b026) 이라 줄어드는 동안에도 숫자 대신 "???" 다.
 *
 * 축별 최대 꼭짓점을 잇는 **빨간 테두리**(`anim+0x1dc` = 0x5b36c 의 RGB(255,0,0))는 그리기 0x7633c 가 `anim+0x1e0` 이 설 때만
 * 긋는다(0x76424). 그런데 바이너리 전체에서 그 칸을 쓰는 곳은 `[skin+0xd4]+0x1e0 = 0` 셋뿐이다(0x5376 · 0xb93e · 0x173b0 —
 * `#0xf0 << 1` 꼴 전수와 리터럴 풀 0x1e0 훑기, 셋 다 같은 자리에서 만들기 깃발 +0x1e3 도 0 으로 지운다). 만들기 0x5aefc(0x5b344~0x5b3b8)는
 * +0x1d0 · +0x1d4 · +0x1d8 · +0x1dc · +0x1e1 = 1 · +0x1e2 · +0x1e3 = 1 만 쓰고 +0x1e0 은 안 쓴다 → **원본에서 빨간 테두리는 안 나온다**.
 * 웹도 안 그린다(원본 그대로). ⚠️ 꼭짓점 그림(프레임 8·9·10·11)은 웹에 그림 근거가 없다.
 *
 * 값 도형은 레이더 [skin+0xd4] 의 자라는 애니로 그린다: 들어옴(나리 101 0x10790 · 메인 메뉴 18 0x23e08 ·
 * 19 0x23e70 · 시즌 0xca · 0xe4 …)이 +0xac = 1 · +0xad = 0 으로 두어 본문 첫 그림에 0 에서 자라고, 커서가 움직인 그림
 * (격자 키 0x6c030 이 칸이 바뀌면 커서 +0x25 = 1 — 0x6c17c~0x6c192)에 0x63b14 가 [anim+0x1e3] = 0 으로 두어(0x63c36~0x63c56)
 * 지난 목표값에서 새 팀 값으로 오르내린다.
 */
function TeamAbilityChart({ values, cursor, isOpen }: {
  readonly values: readonly number[]; readonly cursor: number; readonly isOpen: boolean
}) {
  const center = { x: ANCHOR_B.x + ABILITY_CHART.dx, y: ANCHOR_B.y + ABILITY_CHART.dy }
  return (
    <AbilityRadarPanel center={center} radius={ABILITY_CHART.radius} maximumLength={abilityAxisMaximumLengthOf(ABILITY_CHART.radius)}
      labelFrames={ABILITY_RADAR_LABELS.team} targets={values} restartKey={cursor} showsNumbers={isOpen} />
  )
}
