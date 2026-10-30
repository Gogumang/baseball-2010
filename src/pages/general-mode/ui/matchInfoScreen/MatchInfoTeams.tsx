import { FrameSprite } from '@/shared/ui'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { TEAMS } from '@/shared/config/original/teams'
import { PLAYER_SIDE_FIRST_BAT } from '@/entities/game/model/gameState'
import { MATCH_INFO_LAYOUT, TAG, TEAM_LOGO_HALF, firstBatTagPlacementOf } from '@/pages/general-mode/lib/prepareLayout'
import type { GeneralModeSetup } from '@/pages/general-mode/lib/generalModeSetup'
import * as styles from '@/pages/general-mode/ui/prepareScreen.css'
import { IMG_TEXT_FRAME, SLT_FRAME, SLT_IMAGE, imageSrc } from './matchInfoFigure'

interface MatchInfoTeamsProps {
  readonly setup: GeneralModeSetup
  /** 공용 목록 깜빡 [sp+0xd4] — 꼬리표 2px · 화살 1px (0x63b4a) */
  readonly isBob: boolean
  readonly sltOrigins: FrameOrigins | null
  readonly imgTextOrigins: FrameOrigins | null
}

/** 본문 0x64d30 의 앞쪽 — A·B 딱지 · 두 팀 엠블럼, 이어서 선공 꼬리표 · 가운데 PLAY BALL 공 · 좌우 화살(`MatchInfoFirstBat`) */
export function MatchInfoTeams({ setup, isBob, sltOrigins, imgTextOrigins }: MatchInfoTeamsProps) {
  const { anchorA, anchorB } = MATCH_INFO_LAYOUT
  return (
    <>
      {/* A·B 딱지 — k 4 는 둘 다 흰 막대(116) 에 53 위, PLAYER · COM */}
      {[
        { anchor: anchorA, frame: 157 },
        { anchor: anchorB, frame: 158 },
      ].map(({ anchor, frame }) => (
        <span key={frame}>
          <img
            className={styles.layer}
            alt=""
            src={imageSrc(SLT_IMAGE, TAG.whiteBar)}
            style={{ left: anchor.x + TAG.dx, top: anchor.y + TAG.bDyMatchScreens }}
          />
          {/* 둘 다 흰 막대(116) 위 글자라 공용 보정을 쓴다 — 팔레트를 이식하면 이 style 을 뗀다 */}
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

      {/* 두 팀 엠블럼 */}
      <img
        className={styles.layer}
        alt={TEAMS[setup.userTeamId]?.name ?? ''}
        src={TEAMS[setup.userTeamId]?.logoUrl}
        style={{ left: anchorA.x - TEAM_LOGO_HALF.width, top: anchorA.y - TEAM_LOGO_HALF.height }}
      />
      <img
        className={styles.layer}
        alt={TEAMS[setup.aiTeamId]?.name ?? ''}
        src={TEAMS[setup.aiTeamId]?.logoUrl}
        style={{ left: anchorB.x - TEAM_LOGO_HALF.width, top: anchorB.y - TEAM_LOGO_HALF.height }}
      />

      <MatchInfoFirstBat setup={setup} isBob={isBob} sltOrigins={sltOrigins} imgTextOrigins={imgTextOrigins} />
    </>
  )
}

/** 선공 꼬리표 · 가운데 PLAY BALL 공 · 좌우 화살 — 깜빡 [sp+0xd4] 에 꼬리표 2px · 화살 1px 나간다 */
function MatchInfoFirstBat({ setup, isBob, sltOrigins, imgTextOrigins }: MatchInfoTeamsProps) {
  const { anchorA, anchorB, firstBatTag } = MATCH_INFO_LAYOUT
  const isUserFirstBat = setup.playerSide === PLAYER_SIDE_FIRST_BAT
  const tagPlace = firstBatTagPlacementOf(isUserFirstBat, isUserFirstBat ? anchorA : anchorB, isBob)
  return (
    <>
      {/* 선공 꼬리표 */}
      <img
        className={styles.layer}
        alt=""
        src={imageSrc(SLT_IMAGE, firstBatTag.image)}
        style={{
          left: tagPlace.tag.x,
          top: tagPlace.tag.y,
          transform: isUserFirstBat ? 'scaleX(-1)' : undefined,
        }}
      />
      <FrameSprite folder={IMG_TEXT_FRAME} frame={firstBatTag.textFrame} origins={imgTextOrigins} x={tagPlace.text.x} y={tagPlace.text.y} />

      {/* 가운데 PLAY BALL 공 — 노랑 반원 두 쪽은 값 줄 0x5dcc0 뒤에 깜빡일 때만 그린다 (0x65086) */}
      <FrameSprite folder={SLT_FRAME} frame={MATCH_INFO_LAYOUT.playBall.frame} origins={sltOrigins} x={120 - 23} y={MATCH_INFO_LAYOUT.playBall.y} />
      {/* 좌우 화살 slt_frame 이미지 20 — d = 깜빡 [sp+0xd4] (0x64eba~0x64f08) */}
      <img
        className={styles.layer}
        alt=""
        src={imageSrc(SLT_IMAGE, MATCH_INFO_LAYOUT.arrow.image)}
        style={{ left: MATCH_INFO_LAYOUT.arrow.leftX - (isBob ? 1 : 0), top: MATCH_INFO_LAYOUT.arrow.y }}
      />
      <img
        className={styles.layer}
        alt=""
        src={imageSrc(SLT_IMAGE, MATCH_INFO_LAYOUT.arrow.image)}
        style={{ left: MATCH_INFO_LAYOUT.arrow.rightX + (isBob ? 1 : 0), top: MATCH_INFO_LAYOUT.arrow.y, transform: 'scaleX(-1)' }}
      />
    </>
  )
}
