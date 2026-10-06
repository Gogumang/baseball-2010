import { useEffect } from 'react'
import { Button, FrameSprite, Hint, RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { TEAMS } from '@/shared/config/original/teams'
import { PLAYER_SIDE_FIRST_BAT } from '@/entities/game/model/gameState'
import {
  MATCH_INFO_LAYOUT, TAG, TEAM_LOGO_HALF, matchInfoRowY,
} from '@/pages/general-mode/lib/prepareLayout'
import { generalModeMatchInfoLines } from '@/pages/general-mode/lib/matchInfoLines'
import type { CpuMatchInfo } from '@/pages/general-mode/lib/matchInfoLines'
import type { GeneralModeSetup } from '@/pages/general-mode/lib/generalModeSetup'
import * as styles from '@/pages/general-mode/ui/prepareScreen.css'

const SLT_IMAGE = './sprites/slt_frame'
const SLT_FRAME = './sprites/slt_frame/frames'
const IMG_TEXT_FRAME = './sprites/img_text/frames'

/**
 * 바닥비트 — 그림 0x2e0c4 의 모드 1(일반모드, [메뉴+0x13c] == 1) 갈래 (0x2e128~0x2e15e, 직접 떴다):
 * 기본 0x44(되돌아가기 + "0경기설정"), 빠른실행([메뉴+0x14c])이고 재굴림이 안 돌 때([skin+0xf4] == 0) +0x20 "#재선택".
 * 설정 창([skin+0x2ba])이 떠 있으면 0x20 을 끄고 0x40 을 뒤집는다 → 4.
 * [skin+0xf4] 는 '*' 재굴림이 도는 20틱 동안 서는 칸이다(0x311f8 · 0x31424 가 세우고 0x3128c 가 내림) — 웹 재굴림은
 * 한 번에 끝나 늘 0 이다. "#재선택" 표시지만 재굴림 키는 '*'(0x312e6 `cmp r4, #0x2a`)다. 원본 그대로 둔다.
 * (모드 8·9 대전 갈래 0x2e162~ 는 4 / 빠른실행 0x24 — 웹에 대전모드가 없다.)
 */
const generalMatchInfoFooterOf = (isQuickStart: boolean, isSettingsOpen: boolean): number => {
  let footer = isQuickStart ? 0x64 : 0x44
  if (isSettingsOpen) footer = (footer & ~0x20) ^ 0x40
  return footer
}

const imageSrc = (folder: string, index: number) => `${folder}/${String(index).padStart(3, '0')}.png`

export interface MatchInfoScreenProps {
  readonly setup: GeneralModeSetup
  /** 빠른실행으로 들어왔는가 (메뉴+0x14c) — `*` 재선택이 이때만 나온다 */
  readonly isQuickStart?: boolean
  /** 경기진행 설정 창이 떠 있는가 (skin+0x2ba) — 바닥이 되돌아가기(4)만 남는다 */
  readonly isSettingsOpen?: boolean
  /** 머리띠 G포인트 — 들고 있는 곳에서만 넘긴다 (팀 고르기 화면과 같은 규칙) */
  readonly gamePoint?: number
  /** OK/'5' — 경기 시작 (저장을 쓰고 경기 장면 0x104 로) */
  readonly onStart: () => void
  /** '0' — 경기진행 설정 창. **일반모드에서만** 열린다 (0x31432) */
  readonly onOpenSettings: () => void
  /** '*' — 빠른실행 결정사항 다시 굴리기 */
  readonly onRespin: () => void
  readonly onCancel: () => void
  /** '4'/왼 → 유저 팀(메뉴+0xec = 1) · '6'/오른 → CPU 팀(0) 엔트리 편집 상태 23 */
  readonly onOpenEntry?: (isUserTeam: boolean) => void
  /** 유저 팀 "선발" — 0x30f20 의 0↔k 뒤(엔트리 편집이 고쳤으면 그것)의 투수 0번 */
  readonly userStarterName?: string | null
  /** CPU 칸 — 0x30f20 이 세운 AI 팀의 선발·마선수 */
  readonly cpuMatchInfo?: CpuMatchInfo | null
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
 *   - '4'/왼 → 유저 팀 · '6'/오른 → CPU 팀(보기 전용) **엔트리 편집**(상태 23, 편집기 0x55864)
 */
export function MatchInfoScreen({
  setup, isQuickStart = false, isSettingsOpen = false, gamePoint = 0, onStart, onOpenSettings, onRespin, onCancel, onOpenEntry,
  userStarterName = null, cpuMatchInfo = null,
}: MatchInfoScreenProps) {
  const sltOrigins = useFrameOrigins(SLT_FRAME)
  const imgTextOrigins = useFrameOrigins(IMG_TEXT_FRAME)
  const lines = generalModeMatchInfoLines(setup, userStarterName, cpuMatchInfo)

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
        return onCancel()
      }
      // 0x311a8: '4'/왼 → 메뉴+0xec = 1 (유저 팀) · '6'/오른 → 0 (CPU 팀) → 상태 23
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
  }, [isQuickStart, onStart, onOpenSettings, onRespin, onCancel, onOpenEntry])

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
          <FrameSprite folder={IMG_TEXT_FRAME} frame={frame} origins={imgTextOrigins} centerX
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
            {/* 가운데 딱지 막대(이미지 18)도 116 과 같은 흰 막대다 — 글자는 팔레트 3(짙은 파랑)으로 구웠다 */}
            <FrameSprite folder={IMG_TEXT_FRAME} frame={line.labelFrame} origins={imgTextOrigins}
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
      {/* 바닥띠 비트 0x40 "0경기설정" 그림(18틱 깜빡임)은 ScreenFrame 이 그린다 — 이 단추는 웹 덧붙임 */}
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
      <ScreenFrame title="경기정보" gamePoint={gamePoint} onBack={onCancel}
        footer={generalMatchInfoFooterOf(isQuickStart, isSettingsOpen)} />
    </RawScreen>
  )
}
