import { FrameSprite, PressArea } from '@/shared/ui'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { TEAMS } from '@/shared/config/original/teams'
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import type { PlayerSide } from '@/entities/game/model/gameState'
import { FIRST_BAT_LAYOUT, TAG, TEAM_LOGO_HALF, firstBatTagPlacementOf } from '@/pages/general-mode/lib/prepareLayout'
import * as styles from '@/pages/general-mode/ui/prepareScreen.css'
import { IMG_TEXT_FRAME, SLT_IMAGE, imageSrc } from './firstBatFigure'

interface FirstBatTeamsProps {
  readonly userTeamId: number
  readonly aiTeamId: number
  readonly playerSide: PlayerSide
  readonly isStadiumPhase: boolean
  /** 공용 목록 깜빡 [sp+0xd4] — 꼬리표 2px · 고른 쪽 원 (0x63b4a) */
  readonly isBob: boolean
  readonly imgTextOrigins: FrameOrigins | null
  readonly onChooseFirstBat: (side: PlayerSide) => void
}

/** 그리기 0x640e2 의 위쪽 — A·B 딱지 · 고른 쪽 원 · 두 팀 엠블럼 · VS, 이어서 선공 꼬리표와 단계 0 의 엠블럼 누름 칸 */
export function FirstBatTeams(teams: FirstBatTeamsProps) {
  const { userTeamId, aiTeamId, playerSide, isStadiumPhase, isBob, imgTextOrigins } = teams
  const { anchorA, anchorB } = FIRST_BAT_LAYOUT
  const tagAnchor = playerSide === PLAYER_SIDE_FIRST_BAT ? anchorA : anchorB
  return (
    <>
      {/* A·B 딱지 — k 3 은 둘 다 흰 막대(116)에 53 위 */}
      {[
        { anchor: anchorA, frame: 157, dy: TAG.aDy },
        { anchor: anchorB, frame: 158, dy: TAG.bDyMatchScreens },
      ].map(({ anchor, frame, dy }) => (
        <span key={frame}>
          <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, TAG.whiteBar)} style={{ left: anchor.x + TAG.dx, top: anchor.y + dy }} />
          {/* 둘 다 흰 막대(116) 위 글자라 공용 보정을 쓴다 — 팔레트를 이식하면 이 style 을 뗀다 */}
          <FrameSprite folder={IMG_TEXT_FRAME} frame={frame} origins={imgTextOrigins} centerX x={anchor.x} y={anchor.y + dy + TAG.textDdy} />
        </span>
      ))}

      {/* 단계 0 · 깜빡일 때 커서 쪽 엠블럼 뒤 반투명 노랑 원 0x6b7b9(기준 − 41, 82×82, 0x80FFFF00) — 엠블럼보다 먼저 (0x6413c) */}
      {!isStadiumPhase && isBob && (
        <span
          className={styles.lockedCircle}
          data-testid="선공-커서-원"
          style={{
            left: tagAnchor.x - FIRST_BAT_LAYOUT.sideCircle.radius,
            top: tagAnchor.y - FIRST_BAT_LAYOUT.sideCircle.radius,
            width: FIRST_BAT_LAYOUT.sideCircle.radius * 2,
            height: FIRST_BAT_LAYOUT.sideCircle.radius * 2,
            background: FIRST_BAT_LAYOUT.sideCircle.color,
          }}
        />
      )}

      <TeamEmblems userTeamId={userTeamId} aiTeamId={aiTeamId} />
      <FirstBatTagAndPress {...teams} />
    </>
  )
}

/** 선공 꼬리표 — 선공을 잡은 쪽에만 붙는다. 단계 0 은 엠블럼 원 자리를 누르면 그 쪽 선공으로 정한다(웹판) */
function FirstBatTagAndPress({ playerSide, isStadiumPhase, isBob, imgTextOrigins, onChooseFirstBat }: FirstBatTeamsProps) {
  const { anchorA, anchorB, firstBatTag } = FIRST_BAT_LAYOUT
  const isUserFirstBat = playerSide === PLAYER_SIDE_FIRST_BAT
  const tagPlace = firstBatTagPlacementOf(isUserFirstBat, isUserFirstBat ? anchorA : anchorB, isBob)
  return (
    <>
      {/* 선공 꼬리표 — 선공을 잡은 쪽에만 붙는다 */}
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

      {/* 단계 0 — 선공/후공 고르기. 원본은 좌·우 키로 꼬리표를 옮기고 OK 로 확정한다 */}
      {!isStadiumPhase && (
        <>
          {[
            { side: PLAYER_SIDE_FIRST_BAT, anchor: anchorA, label: '유저 선공' },
            { side: PLAYER_SIDE_LAST_BAT, anchor: anchorB, label: 'CPU 선공' },
          ].map(({ side, anchor, label }) => (
            // 원본은 좌·우 키로 커서를 옮기고 OK 로 정한다 — 마우스는 엠블럼 원 자리(82×82)를 누른다 (웹판)
            <PressArea
              key={label}
              label={label}
              rect={{ x: anchor.x - 41, y: anchor.y - 41, width: 82, height: 82 }}
              onPress={() => onChooseFirstBat(side)}
            />
          ))}
        </>
      )}
    </>
  )
}

/** 두 팀 엠블럼 0x5a7b9 — A 유저 · B CPU, 그 사이 VS */
function TeamEmblems({ userTeamId, aiTeamId }: { readonly userTeamId: number; readonly aiTeamId: number }) {
  const { anchorA, anchorB } = FIRST_BAT_LAYOUT
  return (
    <>
      {/* 두 팀 엠블럼 0x5a7b9 — A 유저 · B CPU */}
      <img
        className={styles.layer}
        alt={TEAMS[userTeamId]?.name ?? ''}
        src={TEAMS[userTeamId]?.logoUrl}
        style={{ left: anchorA.x - TEAM_LOGO_HALF.width, top: anchorA.y - TEAM_LOGO_HALF.height }}
      />
      <img
        className={styles.layer}
        alt={TEAMS[aiTeamId]?.name ?? ''}
        src={TEAMS[aiTeamId]?.logoUrl}
        style={{ left: anchorB.x - TEAM_LOGO_HALF.width, top: anchorB.y - TEAM_LOGO_HALF.height }}
      />

      {/* VS (slt_frame 이미지 122) */}
      <img
        className={styles.layer}
        alt="VS"
        src={imageSrc(SLT_IMAGE, FIRST_BAT_LAYOUT.vs.image)}
        style={{ left: FIRST_BAT_LAYOUT.vs.x, top: FIRST_BAT_LAYOUT.vs.y }}
      />
    </>
  )
}
