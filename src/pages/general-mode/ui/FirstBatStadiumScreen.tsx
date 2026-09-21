import { useEffect } from 'react'
import { Button, FrameSprite, Hint, RawScreen, WHITE_BAR_INK } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { TEAMS } from '@/shared/config/original/teams'
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import type { PlayerSide } from '@/entities/game/model/gameState'
import { FIRST_BAT_LAYOUT, TAG, TEAM_LOGO_HALF } from '@/pages/general-mode/lib/prepareLayout'
import { FIRST_BAT_PHASE, STADIUM_COUNT } from '@/pages/general-mode/lib/generalModeSetup'
import type { FirstBatPhase } from '@/pages/general-mode/lib/generalModeSetup'
import * as styles from '@/pages/general-mode/ui/prepareScreen.css'

const SLT_IMAGE = './sprites/slt_frame'
const GAME_UI_FRAME = './sprites/game_ui/frames'
const IMG_TEXT_FRAME = './sprites/img_text/frames'
const STADIUM_SYMBOL = './sprites/stadium_symbol'

const imageSrc = (folder: string, index: number) => `${folder}/${String(index).padStart(3, '0')}.png`

/**
 * 구장 한 줄의 글자 값.
 * ⚠️ **값이 없어 못 채운 자리**: 도시 이름 표 `0xd1df8`("서울"…"독도")과 수용 인원 표 `0xd1e34`
 *    (30000…)는 아직 웹판 데이터로 뽑혀 있지 않다(`shared/config/original` 에 없다). 생성기가
 *    두 표를 뽑아 주면 여기로 넘기면 된다 — 없으면 화면은 빈칸으로 둔다.
 */
export interface StadiumEntry {
  /** 표 0xd1df8 — img_text 190 "연고지" 줄 */
  readonly city: string
  /** 표 0xd1e34 — img_text 191 "좌석" 줄 (`"!C!cffffff%d석"`) */
  readonly capacity: number
}

export interface FirstBatStadiumScreenProps {
  readonly userTeamId: number
  readonly aiTeamId: number
  /** 상태 20 의 하위 단계 `skin+0xcc` — 선공을 먼저 고른다 */
  readonly phase: FirstBatPhase
  readonly playerSide: PlayerSide
  readonly stadiumId: number
  /** 도시·좌석 표 (위 주석 참고). 안 넘기면 두 줄이 비어 있다 */
  readonly stadiums?: readonly StadiumEntry[]
  /** 머리띠 G포인트 — 들고 있는 곳에서만 넘긴다 (팀 고르기 화면과 같은 규칙) */
  readonly gamePoint?: number
  /** 선공 커서 `skin+0x74` 만 뒤집을 때 */
  readonly onMoveFirstBat: (side: PlayerSide) => void
  readonly onChooseFirstBat: (side: PlayerSide) => void
  readonly onChooseStadium: (stadiumId: number) => void
  /** 구장 단계에서 커서만 옮길 때 (원본은 커서가 곧 `rec+0xc` 다) */
  readonly onMoveStadium: (stadiumId: number) => void
  readonly onCancel: () => void
}

/**
 * **선공/구장** — 메인 메뉴 하위 상태 **20**, 공용 목록 `0x63b15` 의 **k = 3**
 * (진입 0x23ed0 · 갱신 0x2896c · 그리기 0x640e2. P6 2a-4 좌표 확정 · R4 3a 키 확정).
 *
 * 한 화면에서 두 단계를 돈다:
 *   - 단계 0 **선공**: 좌·우로 뒤집고 OK 면 `rec+8` 에 적는다 (0 유저 선공 · 1 유저 후공)
 *   - 단계 1 **구장**: 구장 0~9 를 좌·우로 넘기고 OK 면 `rec+0xc` 에 적고 마선수 단계로
 *
 * ⚠️ 구장 목록은 **0~9 열 칸뿐**이다(히든 구장 없음). 빠른실행이 구장을 "유저 팀 번호" 로 넣기
 *    때문에 유저 팀이 히든(10~14)이면 여기 없는 번호가 들어올 수 있다 — 원본이 자르지 않으므로
 *    그림만 빈칸이 된다.
 */
export function FirstBatStadiumScreen({
  userTeamId, aiTeamId, phase, playerSide, stadiumId, stadiums, gamePoint = 0,
  onMoveFirstBat, onChooseFirstBat, onChooseStadium, onMoveStadium, onCancel,
}: FirstBatStadiumScreenProps) {
  const gameUiOrigins = useFrameOrigins(GAME_UI_FRAME)
  const imgTextOrigins = useFrameOrigins(IMG_TEXT_FRAME)

  const isStadiumPhase = phase === FIRST_BAT_PHASE.구장
  const stadium = stadiums?.[stadiumId]

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (event.key === 'Escape') {
        event.preventDefault()
        return onCancel()
      }
      if (!isStadiumPhase) {
        // 단계 0 — 좌·우가 선공 커서(skin+0x74)를 뒤집고, OK 가 rec+8 에 적으며 단계 1 로 간다
        if (step !== 0) {
          event.preventDefault()
          return onMoveFirstBat(
            playerSide === PLAYER_SIDE_FIRST_BAT ? PLAYER_SIDE_LAST_BAT : PLAYER_SIDE_FIRST_BAT,
          )
        }
        if (event.key === 'Enter') {
          event.preventDefault()
          onChooseFirstBat(playerSide)
        }
        return
      }
      if (step !== 0) {
        event.preventDefault()
        // 원본 목록 커서는 끝에서 멈춘다 (0x7a2xx)
        return onMoveStadium(Math.min(STADIUM_COUNT - 1, Math.max(0, stadiumId + step)))
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        onChooseStadium(stadiumId)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    isStadiumPhase, playerSide, stadiumId,
    onMoveFirstBat, onChooseFirstBat, onChooseStadium, onMoveStadium, onCancel,
  ])

  const { anchorA, anchorB, firstBatTag } = FIRST_BAT_LAYOUT
  const isUserFirstBat = playerSide === PLAYER_SIDE_FIRST_BAT
  const tagAnchor = isUserFirstBat ? anchorA : anchorB
  const tagOffset = isUserFirstBat ? firstBatTag.user : firstBatTag.cpu

  return (
    <RawScreen>
      {/* A·B 딱지 — k 3 은 둘 다 흰 막대(116)에 53 위 */}
      {[
        { anchor: anchorA, frame: 157, dy: TAG.aDy },
        { anchor: anchorB, frame: 158, dy: TAG.bDyMatchScreens },
      ].map(({ anchor, frame, dy }) => (
        <span key={frame}>
          <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, TAG.whiteBar)}
            style={{ left: anchor.x + TAG.dx, top: anchor.y + dy }} />
          {/* 둘 다 흰 막대(116) 위 글자라 공용 보정을 쓴다 — 팔레트를 이식하면 이 style 을 뗀다 */}
          <FrameSprite folder={IMG_TEXT_FRAME} frame={frame} origins={imgTextOrigins} style={WHITE_BAR_INK} centerX
            x={anchor.x} y={anchor.y + dy + TAG.textDdy} />
        </span>
      ))}

      {/* 두 팀 엠블럼 0x5a7b9 — A 유저 · B CPU */}
      <img className={styles.layer} alt={TEAMS[userTeamId]?.name ?? ''} src={TEAMS[userTeamId]?.logoUrl}
        style={{ left: anchorA.x - TEAM_LOGO_HALF.width, top: anchorA.y - TEAM_LOGO_HALF.height }} />
      <img className={styles.layer} alt={TEAMS[aiTeamId]?.name ?? ''} src={TEAMS[aiTeamId]?.logoUrl}
        style={{ left: anchorB.x - TEAM_LOGO_HALF.width, top: anchorB.y - TEAM_LOGO_HALF.height }} />

      {/* VS (slt_frame 이미지 122) */}
      <img className={styles.layer} alt="VS" src={imageSrc(SLT_IMAGE, FIRST_BAT_LAYOUT.vs.image)}
        style={{ left: FIRST_BAT_LAYOUT.vs.x, top: FIRST_BAT_LAYOUT.vs.y }} />

      {/* 선공 꼬리표 — 선공을 잡은 쪽에만 붙는다 */}
      <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, firstBatTag.image)}
        style={{
          left: tagAnchor.x + tagOffset.dx,
          top: tagAnchor.y + tagOffset.dy,
          transform: isUserFirstBat ? 'scaleX(-1)' : undefined,
        }} />
      <FrameSprite folder={IMG_TEXT_FRAME} frame={firstBatTag.textFrame} origins={imgTextOrigins}
        x={tagAnchor.x + tagOffset.textDx} y={tagAnchor.y + tagOffset.textDy} />

      {/* 단계 0 — 선공/후공 고르기. 원본은 좌·우 키로 꼬리표를 옮기고 OK 로 확정한다 */}
      {!isStadiumPhase && (
        <>
          {[
            { side: PLAYER_SIDE_FIRST_BAT, anchor: anchorA, label: '유저 선공' },
            { side: PLAYER_SIDE_LAST_BAT, anchor: anchorB, label: 'CPU 선공' },
          ].map(({ side, anchor, label }) => (
            <button
              key={label}
              type="button"
              aria-pressed={playerSide === side}
              className={`${styles.sideButton} ${playerSide === side ? styles.sideButtonSelected : ''}`}
              style={{ left: anchor.x - 30, top: anchor.y + 26, width: 60, height: 14 }}
              onClick={() => onChooseFirstBat(side)}
            >
              {label}
            </button>
          ))}
          {/* 원본에 없는 웹 전용 안내 — 흐름 배치라 (0,0) 에 떨어져 있던 것을 제자리로 옮겼다 */}
          <div className={styles.hintLine}>
            <Hint>선공을 고르세요 — ←→ 바꾸기 · Enter 결정</Hint>
          </div>
        </>
      )}

      {/* 아래 판 0x5461d */}
      <span className={styles.fillPanel}
        style={{
          left: FIRST_BAT_LAYOUT.panel.x, top: FIRST_BAT_LAYOUT.panel.y,
          width: FIRST_BAT_LAYOUT.panel.width, height: FIRST_BAT_LAYOUT.panel.height,
          background: 'rgba(29, 68, 168, 0.85)',
        }} />

      {/* 구장 줄 — 막대 + 이름 그림 + 좌우 화살 */}
      <FrameSprite folder={GAME_UI_FRAME} frame={FIRST_BAT_LAYOUT.stadiumBar.frame} origins={gameUiOrigins}
        x={FIRST_BAT_LAYOUT.stadiumBar.x} y={FIRST_BAT_LAYOUT.stadiumBar.y} />
      <FrameSprite folder={IMG_TEXT_FRAME} frame={FIRST_BAT_LAYOUT.stadiumNameFrame + stadiumId}
        origins={imgTextOrigins}
        x={FIRST_BAT_LAYOUT.stadiumBar.x + FIRST_BAT_LAYOUT.stadiumBar.width / 2 - 45}
        y={FIRST_BAT_LAYOUT.stadiumNameY} />
      {isStadiumPhase && (
        <>
          <button type="button" aria-label="이전 구장" className={styles.sideButton}
            style={{ left: FIRST_BAT_LAYOUT.arrow.leftX, top: FIRST_BAT_LAYOUT.arrow.y, width: 7, height: 10 }}
            onClick={() => onMoveStadium(Math.max(0, stadiumId - 1))}>
            <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, FIRST_BAT_LAYOUT.arrow.image)}
              style={{ left: 0, top: 0 }} />
          </button>
          <button type="button" aria-label="다음 구장" className={styles.sideButton}
            style={{ left: FIRST_BAT_LAYOUT.arrow.rightX, top: FIRST_BAT_LAYOUT.arrow.y, width: 7, height: 10 }}
            onClick={() => onMoveStadium(Math.min(STADIUM_COUNT - 1, stadiumId + 1))}>
            <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, FIRST_BAT_LAYOUT.arrow.image)}
              style={{ left: 0, top: 0, transform: 'scaleX(-1)' }} />
          </button>
        </>
      )}

      {/* 구장 그림 (stadium_symbol 이미지 = 구장 번호) */}
      <img className={styles.layer} alt={`구장 ${stadiumId}`} src={imageSrc(STADIUM_SYMBOL, stadiumId)}
        style={{ left: FIRST_BAT_LAYOUT.stadiumSymbol.x, top: FIRST_BAT_LAYOUT.stadiumSymbol.y }} />

      {/* 오른쪽 정보 두 줄 — 연고지 · 좌석 */}
      {FIRST_BAT_LAYOUT.infoBars.map((bar) => (
        <FrameSprite key={bar.y} folder={GAME_UI_FRAME} frame={bar.frame} origins={gameUiOrigins}
          x={bar.x} y={bar.y} />
      ))}
      {FIRST_BAT_LAYOUT.infoLabels.map((label) => (
        <FrameSprite key={label.frame} folder={IMG_TEXT_FRAME} frame={label.frame} origins={imgTextOrigins}
          x={label.x} y={label.y} />
      ))}
      <span className={styles.centeredText} data-testid="구장-연고지"
        style={{ left: FIRST_BAT_LAYOUT.infoBars[0].x, top: FIRST_BAT_LAYOUT.infoValueY[0], width: FIRST_BAT_LAYOUT.infoBars[0].width }}>
        {stadium?.city ?? ''}
      </span>
      <span className={styles.centeredText} data-testid="구장-좌석"
        style={{ left: FIRST_BAT_LAYOUT.infoBars[1].x, top: FIRST_BAT_LAYOUT.infoValueY[1], width: FIRST_BAT_LAYOUT.infoBars[1].width }}>
        {stadium === undefined ? '' : `${stadium.capacity}석`}
      </span>

      {isStadiumPhase && (
        <>
          {/* 원본에는 없는 웹 전용 OK 단추 — 원본은 소프트키가 한다. 바닥띠 왼쪽 빈 칸에 세운다 */}
          <Button variant="corner" className={styles.softKey} style={{ left: 4 }}
            onClick={() => onChooseStadium(stadiumId)}>
            이 구장으로
          </Button>
          <div className={styles.hintLine}>
            <Hint>구장을 고르세요 — ←→ 바꾸기 · Enter 결정</Hint>
          </div>
        </>
      )}

      {/* 머리띠(제목 4 "선공/구장")·바닥띠 — 원본 공용 목록 k 3 도 이 둘을 얹는다 (P6 1-1 · 2a-4) */}
      {/* 바닥띠의 "되돌아가기" 가 원본 소프트키다 — 따로 두었던 버튼은 없앴다 (스테이지 (0,0) 에 떨어져 있었다) */}
      <ScreenFrame title="선공/구장" gamePoint={gamePoint} onBack={onCancel} />
    </RawScreen>
  )
}
