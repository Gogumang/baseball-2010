import { useEffect } from 'react'
import { Button, FrameSprite, Hint, RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { MatchInfoStadiumBackdrop } from '@/widgets/batting-stage/ui/MatchInfoStadiumBackdrop'
import type { MatchInfoStadiumState } from '@/widgets/batting-stage/lib/renderScenery'
import { TEAMS } from '@/shared/config/original/teams'
import { PLAYER_SIDE_FIRST_BAT } from '@/entities/game/model/gameState'
import type { PlayerSide } from '@/entities/game/model/gameState'
import {
  MATCH_INFO_LAYOUT, TAG, TEAM_LOGO_HALF, firstBatTagPlacementOf, isPrepareBobOn, matchInfoRowY,
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
  /** '4'/왼 → 143 내 팀(장면+0x164 = 1) · '6'/오른 → 143 상대 팀(0). 안 넘기면 키를 안 받는다 */
  readonly onEntry?: (isMyTeam: boolean) => void
  /** 바탕 — 142 진입 0x1c46c 의 무대를 0x5fd04 가 흐려 떠 둔 그림(나리 틀 0x16928 의 `0x581dc(스킨, 0, 0)`). 없으면 바탕 없음 */
  readonly stage?: MatchInfoStadiumState | null
}

/**
 * **나만의리그 142 경기 준비(매치업)** — 그림 `0x15d98` = 공용 목록 `0x63b15(…, 4, …)`(k 4 경기정보, 일반모드 상태 22 ·
 * 시즌 0xdd 와 같은 배치라 `prepareLayout` 좌표를 그대로 쓴다) + 머리띠 `0x7f4ed`(제목 8/9 · 바닥 5 = 되돌아가기).
 * 시즌 0xdd 와 달리 경기진행 설정 창('0')이 없다 — 키 0x13c30 에 '0' 갈래가 없다.
 *
 * '4'/왼(−3) · '6'/오른(−4) → 장면+0x164 = 1/0 · 밀기 → **143 경기 전 엔트리 보기**(`onEntry`, 0x16af8 — 내 팀 · 상대 팀,
 * 둘 다 보기 전용: `pages/management/lib/nariEntryView`). 143 의 끝 코드가 142 로 돌려보낸다.
 *
 * ⚠️ 미해결: 0x63b15 넷째 인자(이전 ≠ 143)의 줄 나타남 애니는 안 옮겼다. 화면 밀기(0xbdae9 종류 8)는 라우트가 `NariScreenPush` 로 건다.
 */
export function NariMatchInfoScreen({
  lines, myTeamId, opponentTeamId, playerSide, edition, gamePoint, onStart, onCancel, onEntry, stage = null,
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
        return onCancel()
      }
      // −3 · '4' → 143 내 팀 · −4 · '6' → 143 상대 팀
      if (onEntry !== undefined && (event.key === 'ArrowLeft' || event.key === '4')) {
        event.preventDefault()
        return onEntry(true)
      }
      if (onEntry !== undefined && (event.key === 'ArrowRight' || event.key === '6')) {
        event.preventDefault()
        onEntry(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onStart, onCancel, onEntry])

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
            <FrameSprite folder={IMG_TEXT_FRAME} frame={line.labelFrame} origins={imgTextOrigins}
              x={MATCH_INFO_LAYOUT.labelBar.x} y={y + MATCH_INFO_LAYOUT.labelBar.textDy} />
            {/* 값 칸 slt_frame 이미지 10 — 유저 (16, y + 3) · CPU 뒤집어 (138, y − 3) (0x5dcc0) */}
            <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, MATCH_INFO_LAYOUT.valueCell.image)}
              style={{ left: MATCH_INFO_LAYOUT.valueCell.userX, top: y + MATCH_INFO_LAYOUT.valueCell.userDy }} />
            <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, MATCH_INFO_LAYOUT.valueCell.image)}
              style={{ left: MATCH_INFO_LAYOUT.valueCell.cpuX, top: y + MATCH_INFO_LAYOUT.valueCell.cpuDy, transform: 'scaleX(-1)' }} />
            <span className={styles.centeredText} data-testid={`나리경기정보-${line.label}-유저`}
              style={{ left: MATCH_INFO_LAYOUT.valueCell.userX, top: y + MATCH_INFO_LAYOUT.valueCell.userDy + MATCH_INFO_LAYOUT.valueCell.textDy, width: MATCH_INFO_LAYOUT.valueCell.width }}>
              {line.user}
            </span>
            <span className={styles.centeredText} data-testid={`나리경기정보-${line.label}-CPU`}
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

      {/* 원본에 없는 웹 전용 단추 — 원본은 OK 키다. 바닥띠 왼쪽에 세운다 */}
      <Button variant="corner" className={styles.softKey} style={{ left: 4 }} onClick={onStart}>
        경기 시작
      </Button>
      <div className={styles.hintLine}>
        <Hint>{onEntry === undefined ? 'Enter 경기 시작 · Esc 되돌아가기' : 'Enter 경기 시작 · ←/→ 엔트리 · Esc 되돌아가기'}</Hint>
      </div>

      {/* 머리띠 0x7f4ed — 틀 0x16928 의 142 갈래: 제목 8/9 · 바닥 5(되돌아가기) */}
      <ScreenFrame title={edition === '타자편' ? '나만의리그타자편' : '나만의리그투수편'} gamePoint={gamePoint} onBack={onCancel} />
    </RawScreen>
  )
}
