import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Button, FrameSprite, Hint, RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { MatchInfoStadiumBackdrop } from '@/widgets/batting-stage/ui/MatchInfoStadiumBackdrop'
import type { MatchInfoStadiumState } from '@/widgets/batting-stage/lib/renderScenery'
import { TEAMS } from '@/shared/config/original/teams'
import { PLAYER_SIDE_FIRST_BAT } from '@/entities/game/model/gameState'
import {
  MATCH_INFO_LAYOUT, TAG, TEAM_LOGO_HALF, firstBatTagPlacementOf, isPrepareBobOn, matchInfoRowY,
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
  /** 바탕 — 0xdd 진입 0x6548 의 무대를 0x5fd04 가 흐려 떠 둔 그림(공통 앞그림 0xb810 의 `0x581dc(스킨, 0, 0)`). 없으면 바탕 없음 */
  readonly stage?: MatchInfoStadiumState | null
  /** [skin+0x2ba] — 경기진행 설정 창이 열렸나. 바닥띠가 4 / 0x44 로 갈린다 (0xb3cc~0xb3da) */
  readonly isSettingsOpen?: boolean
  /** 경기진행 설정 창 0x6042c — 그림 0xb398 이 공용 목록 다음 **머리띠 0x54d94 앞**에 그린다(화면 판 안에 그려야 해서 이 칸으로 받는다) */
  readonly settingsWindow?: ReactNode
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
  lines, myTeamId, opponentTeamId, playerSide, gamePoint = 0, onStart, onOpenSettings, onCancel, onOpenEntry, stage = null,
  isSettingsOpen = false, settingsWindow = null,
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
  // 공용 목록 깜빡 [sp+0xd4] — 꼬리표 2px · 화살 1px · 노랑 반원 (0x63b4a)
  const isBob = isPrepareBobOn(useUpdateCounter())
  const tagPlace = firstBatTagPlacementOf(isUserFirstBat, tagAnchor, isBob)

  return (
    <RawScreen>
      <MatchInfoStadiumBackdrop stage={stage} />
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
          left: tagPlace.tag.x,
          top: tagPlace.tag.y,
          transform: isUserFirstBat ? 'scaleX(-1)' : undefined,
        }} />
      <FrameSprite folder={IMG_TEXT_FRAME} frame={firstBatTag.textFrame} origins={imgTextOrigins}
        x={tagPlace.text.x} y={tagPlace.text.y} />

      {/* 가운데 PLAY BALL 공 — 노랑 반원 두 쪽은 값 줄 0x5dcc0 뒤에 깜빡일 때만 그린다 (0x65086) */}
      <FrameSprite folder={SLT_FRAME} frame={MATCH_INFO_LAYOUT.playBall.frame} origins={sltOrigins}
        x={120 - 23} y={MATCH_INFO_LAYOUT.playBall.y} />
      {/* 좌우 화살 slt_frame 이미지 20 — d = 깜빡 [sp+0xd4] (0x64eba~0x64f08) */}
      <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, MATCH_INFO_LAYOUT.arrow.image)}
        style={{ left: MATCH_INFO_LAYOUT.arrow.leftX - (isBob ? 1 : 0), top: MATCH_INFO_LAYOUT.arrow.y }} />
      <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, MATCH_INFO_LAYOUT.arrow.image)}
        style={{ left: MATCH_INFO_LAYOUT.arrow.rightX + (isBob ? 1 : 0), top: MATCH_INFO_LAYOUT.arrow.y, transform: 'scaleX(-1)' }} />

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
            {/* 값 칸 slt_frame 이미지 10 — 유저 (16, y + 3) · CPU 뒤집어 (138, y − 3) (0x5dcc0) */}
            <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, MATCH_INFO_LAYOUT.valueCell.image)}
              style={{ left: MATCH_INFO_LAYOUT.valueCell.userX, top: y + MATCH_INFO_LAYOUT.valueCell.userDy }} />
            <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, MATCH_INFO_LAYOUT.valueCell.image)}
              style={{ left: MATCH_INFO_LAYOUT.valueCell.cpuX, top: y + MATCH_INFO_LAYOUT.valueCell.cpuDy, transform: 'scaleX(-1)' }} />
            <span className={styles.centeredText} data-testid={`시즌경기정보-${line.label}-유저`}
              style={{ left: MATCH_INFO_LAYOUT.valueCell.userX, top: y + MATCH_INFO_LAYOUT.valueCell.userDy + MATCH_INFO_LAYOUT.valueCell.textDy, width: MATCH_INFO_LAYOUT.valueCell.width }}>
              {line.user}
            </span>
            <span className={styles.centeredText} data-testid={`시즌경기정보-${line.label}-CPU`}
              style={{ left: MATCH_INFO_LAYOUT.valueCell.cpuX, top: y + MATCH_INFO_LAYOUT.valueCell.cpuDy + MATCH_INFO_LAYOUT.valueCell.textDy, width: MATCH_INFO_LAYOUT.valueCell.width }}>
              {line.cpu}
            </span>
          </span>
        )
      })}

      {/* 노랑 반원 두 쪽 — 값 줄이 다 펼쳐졌고([skin+0xe4]) 깜빡일 때만 (0x65078~0x65108). ⚠️ 값 줄 펼침 연출은 아직 옮기지 않아 늘 펼쳐진 것으로 본다 */}
      {isBob && (
        <>
          <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, MATCH_INFO_LAYOUT.halfCircle.image)}
            style={{ left: MATCH_INFO_LAYOUT.halfCircle.leftX, top: MATCH_INFO_LAYOUT.halfCircle.y }} />
          <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, MATCH_INFO_LAYOUT.halfCircle.image)}
            style={{ left: MATCH_INFO_LAYOUT.halfCircle.rightX, top: MATCH_INFO_LAYOUT.halfCircle.y, transform: 'scaleX(-1)' }} />
        </>
      )}

      {/* 원본에 없는 웹 전용 단추 셋 — 원본은 바닥띠 소프트키가 한다. 바닥띠 왼쪽에 나란히 세운다 */}
      <Button variant="corner" className={styles.softKey} style={{ left: 4 }} onClick={onStart}>
        경기 시작
      </Button>
      {/* 바닥띠 비트 0x40 "0경기설정" 그림(그릴 때마다 [skin+0x410]++ 의 `% 18 ≤ 8` — 18틱 깜빡임)은 ScreenFrame 이 그린다 — 이 단추는 웹 덧붙임 */}
      <Button variant="corner" className={styles.softKey} style={{ left: 62 }} onClick={onOpenSettings}>
        0 경기설정
      </Button>
      <div className={styles.hintLine}>
        <Hint>Enter/5 경기 시작 · 0 경기설정 · ←/→ 엔트리</Hint>
      </div>

      {settingsWindow}

      {/* 머리띠(제목 12 "경기정보")·바닥띠 — 원본 공용 목록 k 4 도 이 둘을 얹는다 (P6 1-1 · 2a-6) */}
      {/* 바닥띠의 "되돌아가기" 가 원본 소프트키다 — 따로 두었던 버튼은 없앴다 (스테이지 (0,0) 에 떨어져 있었다) */}

      {/* 바닥 = [skin+0x2ba](설정 창) ? 4 : 0x44 (0xb3cc~0xb3da) — 0x44 = "0경기설정"(깜박임) + 되돌아가기 · 4 = 되돌아가기만 */}
      <ScreenFrame title="경기정보" gamePoint={gamePoint} onBack={onCancel} footer={isSettingsOpen ? 0x4 : 0x44} />
    </RawScreen>
  )
}
