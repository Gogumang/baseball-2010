import { useEffect } from 'react'
import { Button, FrameSprite, Hint, RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { TEAMS } from '@/shared/config/original/teams'
import { PLAYER_SIDE_FIRST_BAT } from '@/entities/game/model/gameState'
import type { PlayerSide } from '@/entities/game/model/gameState'
import {
  MATCH_INFO_LAYOUT, TAG, TEAM_LOGO_HALF, matchInfoRowY,
} from '@/pages/general-mode/lib/prepareLayout'
import type { MatchInfoLine } from '@/pages/general-mode/lib/matchInfoLines'
import * as styles from '@/pages/general-mode/ui/prepareScreen.css'

const SLT_IMAGE = './sprites/slt_frame'
const SLT_FRAME = './sprites/slt_frame/frames'
const IMG_TEXT_FRAME = './sprites/img_text/frames'

const imageSrc = (folder: string, index: number) => `${folder}/${String(index).padStart(3, '0')}.png`

export interface NariMatchInfoScreenProps {
  /** 다섯 줄 값 — 0x5dcc0 의 모드 2~4 갈래 (`seasonMatchInfoLines` 와 같은 함수) */
  readonly lines: readonly MatchInfoLine[]
  /** rec+0 = 장면+0x150 — 왼쪽(PLAYER) 엠블럼 */
  readonly myTeamId: number
  /** rec+4 = 장면+0x154 — 오른쪽(COM) 엠블럼 */
  readonly opponentTeamId: number
  /** rec+8 = 장면+0x158 (`0xb7844(L, 내 팀)`) — 선공 꼬리표 자리 */
  readonly playerSide: PlayerSide
  /** 머리띠 제목 `[장면+0xcc] == 4 ? 8 : 9` (틀 0x16928 의 142 갈래) */
  readonly edition: '타자편' | '투수편'
  readonly gamePoint: number
  /** −5 · '5' → 144 → 경기 장면 (0x13cb6) */
  readonly onStart: () => void
  /** −16 → 135 / 128 / 109 (0x13c72) */
  readonly onCancel: () => void
}

/**
 * **나만의리그 142 경기 준비(매치업)** — 그림 `0x15d98` = 공용 목록 `0x63b15(…, 4, …)`(k 4 경기정보, 일반모드 상태 22 ·
 * 시즌 0xdd 와 같은 배치라 `prepareLayout` 좌표를 그대로 쓴다) + 머리띠 `0x7f4ed`(제목 8/9 · 바닥 5 = 되돌아가기).
 * 시즌 0xdd 와 달리 경기진행 설정 창('0')이 없다 — 키 0x13c30 에 '0' 갈래가 없다.
 *
 * ⚠️ 미해결(안 옮김): '4'/왼 · '6'/오른 → 143 경기 전 엔트리 편집(장면+0x164 = 1/0)은 키를 받지 않는다.
 *    143 은 확정했다(직접 떴다): 진입 0x16af8 — 명부 = `0x1f9a9(저장, 모드, 내 팀)`(국가대항전이면 0xb7615 의 팀) =
 *    **저장의 나리 팀 레코드를 그대로** `0x5561c(편집기, &명부, 0(고칠 수 있음), [장면+0x164](탭), 1)` · 0x5570d ·
 *    0x55799(편집기, 3, 10) · 0x557c1 두 열 · 편집기+0x333 = 1 · +0x334 = 모드. 키 0x1457c — 0x55864(편집기, 키) 뒤
 *    +0x338 이 1(CLR) → 밀기(8, 0, 탭 ? 3 : 4, 1000) → 142 · 2(왼 끝) 이고 탭 0 → 밀기 4 → 142 · 3(오른 끝) 이고 탭 ≠ 0 →
 *    밀기 3 → 142. 그림 0x16738(0x5cfec 기본 엔트리 목록). 저장은 따로 안 한다 — 고친 명부는 142 확인의 저장이 적는다.
 *    옮기지 못한 까닭: 웹에는 저장에 남는 나리 팀 명부가 없다(팀은 붙박이 표, 내 선수 자리는 `battingOrder` 근사, 투수 차례는
 *    리그 로테이션 표). 고친 엔트리를 담을 칸과 경기 진행기가 그 명단으로 타순·선발을 세우는 길이 먼저 있어야 한다.
 *    0x63b15 넷째 인자(이전 ≠ 143)의 줄 나타남 애니도 안 옮겼다.
 */
export function NariMatchInfoScreen({
  lines, myTeamId, opponentTeamId, playerSide, edition, gamePoint, onStart, onCancel,
}: NariMatchInfoScreenProps) {
  const sltOrigins = useFrameOrigins(SLT_FRAME)
  const imgTextOrigins = useFrameOrigins(IMG_TEXT_FRAME)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 0x13c30: −5(OK) · 0x35('5') → 144
      if (event.key === 'Enter' || event.key === '5') {
        event.preventDefault()
        return onStart()
      }
      // −16(CLR) → 135 / 128 / 109
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onStart, onCancel])

  const { anchorA, anchorB, firstBatTag } = MATCH_INFO_LAYOUT
  const isUserFirstBat = playerSide === PLAYER_SIDE_FIRST_BAT
  const tagAnchor = isUserFirstBat ? anchorA : anchorB
  const tagOffset = isUserFirstBat ? firstBatTag.user : firstBatTag.cpu

  return (
    <RawScreen>
      {/* A·B 딱지 — k 4 는 둘 다 흰 막대(116) 에 53 위, PLAYER · COM */}
      {[
        { anchor: anchorA, frame: 157 },
        { anchor: anchorB, frame: 158 },
      ].map(({ anchor, frame }) => (
        <span key={frame}>
          <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, TAG.whiteBar)}
            style={{ left: anchor.x + TAG.dx, top: anchor.y + TAG.bDyMatchScreens }} />
          <FrameSprite folder={IMG_TEXT_FRAME} frame={frame} origins={imgTextOrigins} centerX
            x={anchor.x} y={anchor.y + TAG.bDyMatchScreens + TAG.textDdy} />
        </span>
      ))}

      {/* 두 팀 엠블럼 */}
      <img className={styles.layer} alt={TEAMS[myTeamId]?.name ?? ''} src={TEAMS[myTeamId]?.logoUrl}
        style={{ left: anchorA.x - TEAM_LOGO_HALF.width, top: anchorA.y - TEAM_LOGO_HALF.height }} />
      <img className={styles.layer} alt={TEAMS[opponentTeamId]?.name ?? ''} src={TEAMS[opponentTeamId]?.logoUrl}
        style={{ left: anchorB.x - TEAM_LOGO_HALF.width, top: anchorB.y - TEAM_LOGO_HALF.height }} />

      {/* 선공 꼬리표 */}
      <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, firstBatTag.image)}
        style={{
          left: tagAnchor.x + tagOffset.dx,
          top: tagAnchor.y + tagOffset.dy,
          transform: isUserFirstBat ? 'scaleX(-1)' : undefined,
        }} />
      <FrameSprite folder={IMG_TEXT_FRAME} frame={firstBatTag.textFrame} origins={imgTextOrigins}
        x={tagAnchor.x + tagOffset.textDx} y={tagAnchor.y + tagOffset.textDy} />

      {/* 가운데 PLAY BALL 공 + 노랑 반원 두 쪽 */}
      <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, MATCH_INFO_LAYOUT.halfCircle.image)}
        style={{ left: MATCH_INFO_LAYOUT.halfCircle.leftX, top: MATCH_INFO_LAYOUT.halfCircle.y }} />
      <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, MATCH_INFO_LAYOUT.halfCircle.image)}
        style={{ left: MATCH_INFO_LAYOUT.halfCircle.rightX, top: MATCH_INFO_LAYOUT.halfCircle.y, transform: 'scaleX(-1)' }} />
      <FrameSprite folder={SLT_FRAME} frame={MATCH_INFO_LAYOUT.playBall.frame} origins={sltOrigins}
        x={120 - 23} y={MATCH_INFO_LAYOUT.playBall.y} />

      {/* 줄 다섯 — 가운데 딱지 + 좌우 값 */}
      {lines.map((line, index) => {
        const y = matchInfoRowY(index)
        return (
          <span key={line.label}>
            <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, MATCH_INFO_LAYOUT.labelBar.image)}
              style={{ left: MATCH_INFO_LAYOUT.labelBar.x, top: y }} />
            <FrameSprite folder={IMG_TEXT_FRAME} frame={line.labelFrame} origins={imgTextOrigins}
              x={MATCH_INFO_LAYOUT.labelBar.x} y={y + MATCH_INFO_LAYOUT.labelBar.textDy} />
            <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, MATCH_INFO_LAYOUT.valueCell.image)}
              style={{ left: MATCH_INFO_LAYOUT.valueCell.userX, top: y }} />
            <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, MATCH_INFO_LAYOUT.valueCell.image)}
              style={{ left: MATCH_INFO_LAYOUT.valueCell.cpuX, top: y }} />
            <span className={styles.centeredText} data-testid={`나리경기정보-${line.label}-유저`}
              style={{ left: MATCH_INFO_LAYOUT.valueCell.userX, top: y + 2, width: MATCH_INFO_LAYOUT.valueCell.textWidth }}>
              {line.user}
            </span>
            <span className={styles.centeredText} data-testid={`나리경기정보-${line.label}-CPU`}
              style={{ left: MATCH_INFO_LAYOUT.valueCell.cpuX, top: y + 2, width: MATCH_INFO_LAYOUT.valueCell.textWidth }}>
              {line.cpu}
            </span>
          </span>
        )
      })}

      {/* 원본에 없는 웹 전용 단추 — 원본은 OK 키다. 바닥띠 왼쪽에 세운다 */}
      <Button variant="corner" className={styles.softKey} style={{ left: 4 }} onClick={onStart}>
        경기 시작
      </Button>
      <div className={styles.hintLine}>
        <Hint>Enter 경기 시작 · Esc 되돌아가기</Hint>
      </div>

      {/* 머리띠 0x7f4ed — 틀 0x16928 의 142 갈래: 제목 8/9 · 바닥 5(되돌아가기) */}
      <ScreenFrame title={edition === '타자편' ? '나만의리그타자편' : '나만의리그투수편'} gamePoint={gamePoint} onBack={onCancel} />
    </RawScreen>
  )
}
