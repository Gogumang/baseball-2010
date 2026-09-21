import { useEffect, useState } from 'react'
import { Button, RawScreen } from '@/shared/ui'
import { TEAMS } from '@/shared/config/original/teams'
import { ORIGINAL_COLORS } from '@/shared/config/design'
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
/** 격자 칸의 작은 로고 — 큰 team_logo(77×76)는 40px 칸을 넘친다. HUD 와 같은 ui/team_logo_ini(12×12) 를 쓴다 */
const smallLogoUrlOf = (teamId: number) => `./sprites/team_logo_ini/${String(teamId).padStart(3, '0')}.png`
/** 큰 로고는 A 자리에만 쓴다 (77×76 을 가운데 맞춤) */
const BIG_LOGO_HALF = { width: 38, height: 38 } as const
/** 작은 로고를 40px 칸 가운데에 놓는다 (12×12 → (40−12)/2 = 14) */
const SMALL_LOGO_INSET = (GRID.cell - 12) / 2

const frameSrc = (folder: string, frame: number) => `${folder}/${String(frame).padStart(3, '0')}.png`

interface TeamSelectScreenProps {
  /** 히든 팀(10~14) 해금 기록 — 전역 기록 +0x70+idx 자리다 */
  readonly openedHiddenIds?: readonly number[]
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
export function TeamSelectScreen({ openedHiddenIds = [], onSelect, onCancel }: TeamSelectScreenProps) {
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
            style={{ left: anchor.x + TAG.dx, top: anchor.y + textDy, width: TAG.barWidth, objectFit: 'none' }} />
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
            className={`${styles.cell} ${index === cursor ? styles.cellSelected : ''}`}
            style={{ left: x, top: y, width: GRID.cell, height: GRID.cell }}
            onClick={() => (open ? onSelect(index) : setCursor(index))}
            onMouseEnter={() => setCursor(index)}
          >
            {open
              ? <img className={styles.layer} alt="" src={smallLogoUrlOf(entry.id)}
                  style={{ left: SMALL_LOGO_INSET, top: SMALL_LOGO_INSET }} />
              : <span className={styles.centeredText} style={{ left: 0, top: 14, width: GRID.cell }}>?</span>}
          </button>
        )
      })}

      <Button onClick={onCancel}>되돌아가기</Button>
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
