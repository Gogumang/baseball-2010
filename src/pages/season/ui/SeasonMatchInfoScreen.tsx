import { useEffect } from 'react'
import { Button, FrameSprite, Hint, RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { TEAMS } from '@/shared/config/original/teams'
import { PLAYER_SIDE_FIRST_BAT } from '@/entities/game/model/gameState'
import {
  MATCH_INFO_LAYOUT, TAG, TEAM_LOGO_HALF, matchInfoRowY,
} from '@/pages/general-mode/lib/prepareLayout'
import type { MatchInfoLine } from '@/pages/general-mode/lib/matchInfoLines'
import type { PlayerSide } from '@/entities/game/model/gameState'
import * as styles from '@/pages/general-mode/ui/prepareScreen.css'

const SLT_IMAGE = './sprites/slt_frame'
const SLT_FRAME = './sprites/slt_frame/frames'
const IMG_TEXT_FRAME = './sprites/img_text/frames'

const imageSrc = (folder: string, index: number) => `${folder}/${String(index).padStart(3, '0')}.png`

export interface SeasonMatchInfoScreenProps {
  /** 다섯 줄 값 — `seasonMatchInfoLines` (0x5dcc0 시즌 갈래) */
  readonly lines: readonly MatchInfoLine[]
  /** rec+0 — 왼쪽(PLAYER) 엠블럼. 국가대항전이면 대한민국(10) */
  readonly myTeamId: number
  /** rec+4 — 오른쪽(COM) 엠블럼 */
  readonly opponentTeamId: number
  /** 사람이 맡는 측 — 선공 꼬리표 자리 */
  readonly playerSide: PlayerSide
  /** 머리띠 G포인트 (전역 +0x64) */
  readonly gamePoint?: number
  /** OK/'5' — 경기 시작 (0x847e → 0xe1) */
  readonly onStart: () => void
  /** '0' — 경기진행 설정 창 열고 닫기 (0x857a) */
  readonly onOpenSettings: () => void
  /** CLR — 국가대항전이면 0xf4, 아니면 0xd7 (0x844e) */
  readonly onCancel: () => void
  /** '4'/왼 → 유저 팀(true) · '6'/오른 → CPU 팀(false) 엔트리 편집 0xe0 (this+0x120) */
  readonly onOpenEntry?: (isUserTeam: boolean) => void
}

/**
 * **시즌 경기정보 0xdd** — 그림 `0xb398` = 공용 목록 `0x63b15(skin, 0, **4**, …)` + 경기진행 설정 창
 * `0x6042c` + 머리띠 `0x54d95(skin, 5 "경기정보", 설정 창이 열렸으면 4 아니면 0x44)`.
 * 목록 k 4 는 일반모드 경기정보(메인 메뉴 상태 22)와 **같은 배치**라 그 좌표(`prepareLayout`)를 그대로 쓰고,
 * 값 줄만 시즌 갈래(`seasonMatchInfoLines`)다. 키는 `0x83cc` (`entities/season-mode/model/preGameFlow.ts`).
 *
 * 좌·우('4'/'6') 키는 **엔트리 편집 0xe0**(편집기 0x55864)으로 간다 — '4' 는 this+0x120 = 1 유저 팀,
 * '6' 은 0 CPU 팀(보기 전용).
 */
export function SeasonMatchInfoScreen({
  lines, myTeamId, opponentTeamId, playerSide, gamePoint = 0, onStart, onOpenSettings, onCancel, onOpenEntry,
}: SeasonMatchInfoScreenProps) {
  const sltOrigins = useFrameOrigins(SLT_FRAME)
  const imgTextOrigins = useFrameOrigins(IMG_TEXT_FRAME)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 0x83cc: −5(OK)·'5'(0x35, 0x8442) → 0x847e 경기 시작
      if (event.key === 'Enter' || event.key === '5') {
        event.preventDefault()
        return onStart()
      }
      if (event.key === '0') {
        event.preventDefault()
        return onOpenSettings()
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        return onCancel()
      }
      // 0x83cc: −3·'4' → this+0x120 = 1 (유저 팀) · −4·'6' → 0 (CPU 팀) → 0xe0
      if (onOpenEntry !== undefined && (event.key === 'ArrowLeft' || event.key === '4')) {
        event.preventDefault()
        return onOpenEntry(true)
      }
      if (onOpenEntry !== undefined && (event.key === 'ArrowRight' || event.key === '6')) {
        event.preventDefault()
        onOpenEntry(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onStart, onOpenSettings, onCancel, onOpenEntry])

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
          {/* 둘 다 흰 막대(116) 위 글자라 공용 보정을 쓴다 — 팔레트를 이식하면 이 style 을 뗀다 */}
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
            {/* 가운데 딱지 막대(이미지 18)도 116 과 같은 흰 막대다 — 글자는 팔레트 3(짙은 파랑)으로 구웠다 */}
            <FrameSprite folder={IMG_TEXT_FRAME} frame={line.labelFrame} origins={imgTextOrigins}
              x={MATCH_INFO_LAYOUT.labelBar.x} y={y + MATCH_INFO_LAYOUT.labelBar.textDy} />
            <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, MATCH_INFO_LAYOUT.valueCell.image)}
              style={{ left: MATCH_INFO_LAYOUT.valueCell.userX, top: y }} />
            <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, MATCH_INFO_LAYOUT.valueCell.image)}
              style={{ left: MATCH_INFO_LAYOUT.valueCell.cpuX, top: y }} />
            <span className={styles.centeredText} data-testid={`시즌경기정보-${line.label}-유저`}
              style={{ left: MATCH_INFO_LAYOUT.valueCell.userX, top: y + 2, width: MATCH_INFO_LAYOUT.valueCell.textWidth }}>
              {line.user}
            </span>
            <span className={styles.centeredText} data-testid={`시즌경기정보-${line.label}-CPU`}
              style={{ left: MATCH_INFO_LAYOUT.valueCell.cpuX, top: y + 2, width: MATCH_INFO_LAYOUT.valueCell.textWidth }}>
              {line.cpu}
            </span>
          </span>
        )
      })}

      {/* 원본에 없는 웹 전용 단추 셋 — 원본은 바닥띠 소프트키가 한다. 바닥띠 왼쪽에 나란히 세운다 */}
      <Button variant="corner" className={styles.softKey} style={{ left: 4 }} onClick={onStart}>
        경기 시작
      </Button>
      {/* 바닥띠 비트 0x40 "0경기설정" — 18틱 주기로 깜빡인다(깜빡임은 아직 안 옮겼다) */}
      <Button variant="corner" className={styles.softKey} style={{ left: 62 }} onClick={onOpenSettings}>
        0 경기설정
      </Button>
      <div className={styles.hintLine}>
        <Hint>Enter/5 경기 시작 · 0 경기설정 · ←/→ 엔트리</Hint>
      </div>

      {/* 머리띠(제목 12 "경기정보")·바닥띠 — 원본 공용 목록 k 4 도 이 둘을 얹는다 (P6 1-1 · 2a-6) */}
      {/* 바닥띠의 "되돌아가기" 가 원본 소프트키다 — 따로 두었던 버튼은 없앴다 (스테이지 (0,0) 에 떨어져 있었다) */}
      {/* 바닥 = [skin+0x2ba](설정 창) ? 4 : 0x44 (0xb3cc~0xb3da) — 이 화면이 떠 있는 동안 설정 창은 닫혀 있어 0x44 = "0경기설정"(깜박임) + 되돌아가기 */}
      <ScreenFrame title="경기정보" gamePoint={gamePoint} onBack={onCancel} footer={0x44} />
    </RawScreen>
  )
}
