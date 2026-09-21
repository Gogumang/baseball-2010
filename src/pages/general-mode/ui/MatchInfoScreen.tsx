import { useEffect } from 'react'
import { Button, FrameSprite, Hint, RawScreen, WHITE_BAR_INK } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { TEAMS } from '@/shared/config/original/teams'
import { PLAYER_SIDE_FIRST_BAT } from '@/entities/game/model/gameState'
import {
  MATCH_INFO_LAYOUT, TAG, TEAM_LOGO_HALF, matchInfoRowY,
} from '@/pages/general-mode/lib/prepareLayout'
import { generalModeMatchInfoLines } from '@/pages/general-mode/lib/matchInfoLines'
import type { GeneralModeSetup } from '@/pages/general-mode/lib/generalModeSetup'
import * as styles from '@/pages/general-mode/ui/prepareScreen.css'

const SLT_IMAGE = './sprites/slt_frame'
const SLT_FRAME = './sprites/slt_frame/frames'
const IMG_TEXT_FRAME = './sprites/img_text/frames'

const imageSrc = (folder: string, index: number) => `${folder}/${String(index).padStart(3, '0')}.png`

export interface MatchInfoScreenProps {
  readonly setup: GeneralModeSetup
  /** 빠른실행으로 들어왔는가 (메뉴+0x14c) — `*` 재선택이 이때만 나온다 */
  readonly isQuickStart?: boolean
  /** 머리띠 G포인트 — 들고 있는 곳에서만 넘긴다 (팀 고르기 화면과 같은 규칙) */
  readonly gamePoint?: number
  /** OK/'5' — 경기 시작 (저장을 쓰고 경기 장면 0x104 로) */
  readonly onStart: () => void
  /** '0' — 경기진행 설정 창. **일반모드에서만** 열린다 (0x31432) */
  readonly onOpenSettings: () => void
  /** '*' — 빠른실행 결정사항 다시 굴리기 */
  readonly onRespin: () => void
  readonly onCancel: () => void
}

/**
 * **경기정보** — 메인 메뉴 하위 상태 **22**, 공용 목록 `0x63b15` 의 **k = 4**
 * (진입 0x314b0 · 갱신 0x311a8 · 본문 0x64d30. P6 2a-6 좌표 확정 · R4 2d 값 확정).
 *
 * 다섯 줄(순위·승패·선발·마투수·마타자)을 유저(왼쪽 x 16)·CPU(오른쪽 x 144)로 두 벌 적는다.
 * **일반모드는 순위·승패가 늘 "-"** 다 — 저장 레코드를 아예 읽지 않는다.
 *
 * 키 (R4 3b):
 *   - OK → 경기 시작   ·   `0` → 경기진행 설정 (일반모드만)   ·   `*` → 빠른실행 재굴림
 *   - CLR → 빠른실행이면 모드 목록으로, 아니면 마선수(상태 21) 의 마타자 단계로
 *
 * ⚠️ 여기 없는 것: 좌·우 키의 **엔트리 편집**(상태 23, 편집기 0x55864). 엔트리 편집기는 일반·시즌·
 *    나만의리그·에디트가 함께 쓰는 큰 화면이고 웹판에 아직 하나도 없다 (R4 5절).
 */
export function MatchInfoScreen({
  setup, isQuickStart = false, gamePoint = 0, onStart, onOpenSettings, onRespin, onCancel,
}: MatchInfoScreenProps) {
  const sltOrigins = useFrameOrigins(SLT_FRAME)
  const imgTextOrigins = useFrameOrigins(IMG_TEXT_FRAME)
  const lines = generalModeMatchInfoLines(setup)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        return onStart()
      }
      if (event.key === '0') {
        event.preventDefault()
        return onOpenSettings()
      }
      if (event.key === '*' && isQuickStart) {
        event.preventDefault()
        return onRespin()
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isQuickStart, onStart, onOpenSettings, onRespin, onCancel])

  const { anchorA, anchorB, firstBatTag } = MATCH_INFO_LAYOUT
  const isUserFirstBat = setup.playerSide === PLAYER_SIDE_FIRST_BAT
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
          <FrameSprite folder={IMG_TEXT_FRAME} frame={frame} origins={imgTextOrigins} style={WHITE_BAR_INK} centerX
            x={anchor.x} y={anchor.y + TAG.bDyMatchScreens + TAG.textDdy} />
        </span>
      ))}

      {/* 두 팀 엠블럼 */}
      <img className={styles.layer} alt={TEAMS[setup.userTeamId]?.name ?? ''} src={TEAMS[setup.userTeamId]?.logoUrl}
        style={{ left: anchorA.x - TEAM_LOGO_HALF.width, top: anchorA.y - TEAM_LOGO_HALF.height }} />
      <img className={styles.layer} alt={TEAMS[setup.aiTeamId]?.name ?? ''} src={TEAMS[setup.aiTeamId]?.logoUrl}
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
            {/* 가운데 딱지 막대(이미지 18)도 116 과 같은 흰 막대(231,227,231)라 같은 보정을 쓴다 */}
            <FrameSprite folder={IMG_TEXT_FRAME} frame={line.labelFrame} origins={imgTextOrigins}
              style={WHITE_BAR_INK}
              x={MATCH_INFO_LAYOUT.labelBar.x} y={y + MATCH_INFO_LAYOUT.labelBar.textDy} />
            <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, MATCH_INFO_LAYOUT.valueCell.image)}
              style={{ left: MATCH_INFO_LAYOUT.valueCell.userX, top: y }} />
            <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, MATCH_INFO_LAYOUT.valueCell.image)}
              style={{ left: MATCH_INFO_LAYOUT.valueCell.cpuX, top: y }} />
            <span className={styles.centeredText} data-testid={`경기정보-${line.label}-유저`}
              style={{ left: MATCH_INFO_LAYOUT.valueCell.userX, top: y + 2, width: MATCH_INFO_LAYOUT.valueCell.textWidth }}>
              {line.user}
            </span>
            <span className={styles.centeredText} data-testid={`경기정보-${line.label}-CPU`}
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
      {isQuickStart && (
        <Button variant="corner" className={styles.softKey} style={{ left: 126 }} onClick={onRespin}>
          * 재선택
        </Button>
      )}
      <div className={styles.hintLine}>
        <Hint>Enter 경기 시작 · 0 경기설정{isQuickStart ? ' · * 재선택' : ''}</Hint>
      </div>

      {/* 머리띠(제목 12 "경기정보")·바닥띠 — 원본 공용 목록 k 4 도 이 둘을 얹는다 (P6 1-1 · 2a-6) */}
      {/* 바닥띠의 "되돌아가기" 가 원본 소프트키다 — 따로 두었던 버튼은 없앴다 (스테이지 (0,0) 에 떨어져 있었다) */}
      <ScreenFrame title="경기정보" gamePoint={gamePoint} onBack={onCancel} />
    </RawScreen>
  )
}
