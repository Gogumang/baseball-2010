import { FrameSprite } from '@/shared/ui'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { TEAMS } from '@/shared/config/original/teams'
import { PLAYER_SIDE_FIRST_BAT, type PlayerSide } from '@/entities/game/model/gameState'
import {
  MATCH_INFO_LAYOUT,
  TAG,
  TEAM_LOGO_HALF,
  firstBatTagPlacementOf,
  matchInfoRowY,
  prepareStyles as styles,
  type MatchInfoLine,
} from './otherSlices'
import { IMG_TEXT_FRAME, SLT_FRAME, SLT_IMAGE, imageSrc } from './matchInfoAssets'
import { MatchInfoValueCells, type MatchInfoValueCellsProps } from './MatchInfoValueCells'
import { MatchInfoEntryBanners } from '@/pages/management/ui/MatchInfoEntryBanners'
import type { MatchInfoEntryPhase } from '@/pages/management/lib/matchInfoEntry'

export interface MatchInfoBodyProps extends MatchInfoValueCellsProps {
  /** rec+0 — 왼쪽(PLAYER) 엠블럼 */
  readonly myTeamId: number
  /** rec+4 — 오른쪽(COM) 엠블럼 */
  readonly opponentTeamId: number
  /** 사람이 맡는 측 — 선공 꼬리표 자리 */
  readonly playerSide: PlayerSide
  readonly sltOrigins: FrameOrigins | null
}

const TEAM_TAGS = [
  { anchor: MATCH_INFO_LAYOUT.anchorA, frame: 157 },
  { anchor: MATCH_INFO_LAYOUT.anchorB, frame: 158 },
]

/** 두 팀 엠블럼 — 앵커 가운데 */
function TeamLogo({ teamId, anchor }: { readonly teamId: number; readonly anchor: { readonly x: number; readonly y: number } }) {
  const team = TEAMS[teamId]
  return (
    <img
      className={styles.layer}
      alt={team?.name ?? ''}
      src={team?.logoUrl}
      style={{ left: anchor.x - TEAM_LOGO_HALF.width, top: anchor.y - TEAM_LOGO_HALF.height }}
    />
  )
}

/** 줄 다섯 — 가운데 딱지 (0x64d30 본문). 딱지 막대(이미지 18)도 116 과 같은 흰 막대다 — 글자는 팔레트 3(짙은 파랑)으로 구웠다 */
function LabelRows({ lines, imgTextOrigins }: Pick<MatchInfoValueCellsProps, 'lines' | 'imgTextOrigins'>) {
  const bar = MATCH_INFO_LAYOUT.labelBar
  return lines.map((line: MatchInfoLine, index) => {
    const y = matchInfoRowY(index)
    return (
      <span key={line.label}>
        <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, bar.image)} style={{ left: bar.x, top: y }} />
        <FrameSprite folder={IMG_TEXT_FRAME} frame={line.labelFrame} origins={imgTextOrigins} x={bar.x} y={y + bar.textDy} />
      </span>
    )
  })
}

/**
 * **경기정보 본문** — 공용 목록 0x63b15 k 4(일반모드 상태 22 · 시즌 0xdd · 나리 142 같은 배치, `prepareLayout`): A·B 딱지 ·
 * 엠블럼 · 선공 꼬리표 · PLAY BALL 공 · 좌우 화살 · 딱지 다섯 줄 · 값 칸 0x5dcc0 · 노랑 반원.
 * 깜빡 [sp+0xd4](`isBob`)는 꼬리표 2px · 화살 1px · 노랑 반원 (0x63b4a).
 */
function MatchInfoBody(props: MatchInfoBodyProps) {
  const { myTeamId, opponentTeamId, playerSide, sltOrigins, imgTextOrigins, isBob } = props
  const { anchorA, anchorB, firstBatTag, arrow } = MATCH_INFO_LAYOUT
  const isUserFirstBat = playerSide === PLAYER_SIDE_FIRST_BAT
  const tagPlace = firstBatTagPlacementOf(isUserFirstBat, isUserFirstBat ? anchorA : anchorB, isBob)
  const bob = isBob ? 1 : 0
  return (
    <>
      {/* A·B 딱지 — k 4 는 둘 다 흰 막대(116) 에 53 위, PLAYER · COM. 흰 막대 위 글자라 공용 보정을 쓴다 */}
      {TEAM_TAGS.map(({ anchor, frame }) => (
        <span key={frame}>
          <img
            className={styles.layer}
            alt=""
            src={imageSrc(SLT_IMAGE, TAG.whiteBar)}
            style={{ left: anchor.x + TAG.dx, top: anchor.y + TAG.bDyMatchScreens }}
          />
          <FrameSprite
            folder={IMG_TEXT_FRAME}
            frame={frame}
            origins={imgTextOrigins}
            centerX
            x={anchor.x}
            y={anchor.y + TAG.bDyMatchScreens + TAG.textDdy}
          />
        </span>
      ))}
      <TeamLogo teamId={myTeamId} anchor={anchorA} />
      <TeamLogo teamId={opponentTeamId} anchor={anchorB} />
      {/* 선공 꼬리표 */}
      <img
        className={styles.layer}
        alt=""
        src={imageSrc(SLT_IMAGE, firstBatTag.image)}
        style={{ left: tagPlace.tag.x, top: tagPlace.tag.y, transform: isUserFirstBat ? 'scaleX(-1)' : undefined }}
      />
      <FrameSprite folder={IMG_TEXT_FRAME} frame={firstBatTag.textFrame} origins={imgTextOrigins} x={tagPlace.text.x} y={tagPlace.text.y} />
      {/* 가운데 PLAY BALL 공 — 노랑 반원 두 쪽은 값 줄 0x5dcc0 뒤에 깜빡일 때만 그린다 (0x65086) */}
      <FrameSprite folder={SLT_FRAME} frame={MATCH_INFO_LAYOUT.playBall.frame} origins={sltOrigins} x={120 - 23} y={MATCH_INFO_LAYOUT.playBall.y} />
      {/* 좌우 화살 slt_frame 이미지 20 — d = 깜빡 [sp+0xd4] (0x64eba~0x64f08) */}
      <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, arrow.image)} style={{ left: arrow.leftX - bob, top: arrow.y }} />
      <img
        className={styles.layer}
        alt=""
        src={imageSrc(SLT_IMAGE, arrow.image)}
        style={{ left: arrow.rightX + bob, top: arrow.y, transform: 'scaleX(-1)' }}
      />
      <LabelRows lines={props.lines} imgTextOrigins={imgTextOrigins} />
      <MatchInfoValueCells {...props} />
    </>
  )
}

interface MatchInfoPhaseProps extends MatchInfoBodyProps {
  /** 들어올 때 연출 단계 — 머리띠가 내려오는 동안 숨김 · 파랑 배너 둘 · 본문 */
  readonly phase: MatchInfoEntryPhase
}

/** 연출 단계대로 — 배너 단계는 파랑 배너 둘(testid `<머리>-배너`), 본문 단계는 본문, 숨김 단계는 아무것도 */
export function MatchInfoPhase({ phase, ...body }: MatchInfoPhaseProps) {
  if (phase.kind === '배너') return <MatchInfoEntryBanners offset={phase.offset} testId={`${body.testIdPrefix}-배너`} />
  if (phase.kind === '본문') return <MatchInfoBody {...body} />
  return null
}
