import { useEffect } from 'react'
import { useFrameSlideKeyLock } from '@/widgets/screen-frame/model/useFrameSlideKeyLock'
import { noteSkinShakeDirection, noteSkinShakeKey } from '@/shared/lib/cursorShake/skinShakeDirection'
import { FrameSprite, PressArea, RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { TEAMS } from '@/shared/config/original/teams'
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import type { PlayerSide } from '@/entities/game/model/gameState'
import {
  FIRST_BAT_LAYOUT,
  TAG,
  TEAM_LOGO_HALF,
  firstBatTagPlacementOf,
  isPrepareBobOn,
  stadiumArrowsOf,
  stadiumInfoValuesOf,
} from '@/pages/general-mode/lib/prepareLayout'
import { FIRST_BAT_PHASE, STADIUM_COUNT, stadiumCursorAfter, stadiumInfoOf } from '@/pages/general-mode/lib/generalModeSetup'
import type { FirstBatPhase } from '@/pages/general-mode/lib/generalModeSetup'
import * as styles from '@/pages/general-mode/ui/prepareScreen.css'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import { firstBatStadiumKeyActionOf } from '@/pages/general-mode/lib/firstBatStadiumKeys'

const SLT_IMAGE = assetUrl('./sprites/slt_frame')
const GAME_UI_FRAME = assetUrl('./sprites/game_ui/frames')
const IMG_TEXT_FRAME = assetUrl('./sprites/img_text/frames')
const STADIUM_SYMBOL = assetUrl('./sprites/stadium_symbol')

/** 화면 폭의 반 — 가운데 맞춤 글을 (가운데 − 120, 폭 240) 상자에 둔다 */
const SCREEN_HALF_WIDTH = 120

const imageSrc = (folder: string, index: number) => `${folder}/${String(index).padStart(3, '0')}.png`

export interface FirstBatStadiumScreenProps {
  readonly userTeamId: number
  readonly aiTeamId: number
  /** 상태 20 의 하위 단계 `skin+0xcc` — 선공을 먼저 고른다 */
  readonly phase: FirstBatPhase
  readonly playerSide: PlayerSide
  readonly stadiumId: number
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
 *    그림은 빈칸, 좌석 줄은 스택 옆 칸(연고지 포인터 값)을 숫자로 찍는다 (`stadiumInfoOf`).
 */
/** 숫자키 꼴 1 격자가 방향으로 바꾸는 키 (표 0xd2e7c) */
const GRID_NUMERIC_DIRECTIONS: Readonly<Record<string, 'left' | 'right' | 'up' | 'down'>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  4: 'left',
  6: 'right',
  2: 'up',
  8: 'down',
}

export function FirstBatStadiumScreen({
  userTeamId,
  aiTeamId,
  phase,
  playerSide,
  stadiumId,
  gamePoint = 0,
  onMoveFirstBat,
  onChooseFirstBat,
  onChooseStadium,
  onMoveStadium,
  onCancel,
}: FirstBatStadiumScreenProps) {
  const gameUiOrigins = useFrameOrigins(GAME_UI_FRAME)
  const imgTextOrigins = useFrameOrigins(IMG_TEXT_FRAME)

  const isStadiumPhase = phase === FIRST_BAT_PHASE.구장
  // 연고지 · 좌석 — 표 0xd1e0c · 0xd1e34 (히든 번호 10~14 는 스택 옆 칸, `stadiumInfoOf`)
  const stadium = stadiumInfoOf(stadiumId)

  // 머리띠가 미끄러지는 동안 키 함수가 [skin+0xe4] == 0 을 보고 아무것도 안 한다 (`useFrameSlideKeyLock`)
  const keyLock = useFrameSlideKeyLock()
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (keyLock.current) return
      // 0x5550d — 까딱임 방향 [skin+0x8c] (Q-10). 단계 0([skin+0xcc] == 0)은 **날 키**(0x289ba~0x289c6), 단계 1 은 구장 격자
      // [this+0x74](진입 0x23f18 `vt+0x1c(10, 1, 숫자키 꼴 1, 0x10)`)의 vt+0x18 이 바꾼 키(0x28a36~0x28a4a) — '2' '4' '6' '8' 도 방향
      if (isStadiumPhase) {
        const direction = GRID_NUMERIC_DIRECTIONS[event.key]
        if (direction !== undefined) noteSkinShakeDirection(direction)
      } else {
        noteSkinShakeKey(event.key)
      }
      // 숫자키도 원본 키 함수 0x2896c 대로 (`firstBatStadiumKeyActionOf` — Q-14)
      const action = firstBatStadiumKeyActionOf(isStadiumPhase, event.key)
      if (action === 'none') return
      event.preventDefault()
      switch (action) {
        // 단계 0 CLR → 19 · 단계 1 CLR · ↑ · '2' → 단계 0 (구장 커서는 rec+0xc 에 남는다 — 커서가 곧 rec+0xc 다)
        case 'back':
          return onCancel()
        // 단계 0 — 좌·우가 선공 커서(skin+0x74)를 뒤집는다
        case 'flip':
          return onMoveFirstBat(playerSide === PLAYER_SIDE_FIRST_BAT ? PLAYER_SIDE_LAST_BAT : PLAYER_SIDE_FIRST_BAT)
        // 구장 목록은 꼴 0x10 — 끝에서 감는다 (0x6bead)
        case 'previous':
          return onMoveStadium(stadiumCursorAfter(stadiumId, -1))
        case 'next':
          return onMoveStadium(stadiumCursorAfter(stadiumId, 1))
        // 단계 0 OK 는 rec+8 에 적으며 단계 1 로, 단계 1 OK 는 rec+0xc 에 적고 21 로
        case 'ok':
          return isStadiumPhase ? onChooseStadium(stadiumId) : onChooseFirstBat(playerSide)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isStadiumPhase, playerSide, stadiumId, onMoveFirstBat, onChooseFirstBat, onChooseStadium, onMoveStadium, onCancel, keyLock])

  const { anchorA, anchorB, firstBatTag } = FIRST_BAT_LAYOUT
  const isUserFirstBat = playerSide === PLAYER_SIDE_FIRST_BAT
  const tagAnchor = isUserFirstBat ? anchorA : anchorB
  // 공용 목록 깜빡 [sp+0xd4] — 꼬리표 2px · 고른 쪽 원 · 구장 막대 칠 · 화살 (0x63b4a)
  const isBob = isPrepareBobOn(useUpdateCounter())
  const tagPlace = firstBatTagPlacementOf(isUserFirstBat, tagAnchor, isBob)
  const arrows = stadiumArrowsOf(isStadiumPhase, isBob, stadiumId, STADIUM_COUNT)
  const nameWidth = imgTextOrigins?.[String(FIRST_BAT_LAYOUT.stadiumNameFrame + stadiumId).padStart(3, '0')]?.width ?? 0

  return (
    <RawScreen>
      {/* 그림 0x2dd30 은 맨 앞에서 공 무늬 바탕 0x5fd61(skin, 0, 0, W, H) 을 깐다 (0x2dd62) */}
      <SkinBackdrop kind="공무늬" />
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

      {/* 아래 판 0x5461d */}
      <span
        className={styles.fillPanel}
        style={{
          left: FIRST_BAT_LAYOUT.panel.x,
          top: FIRST_BAT_LAYOUT.panel.y,
          width: FIRST_BAT_LAYOUT.panel.width,
          height: FIRST_BAT_LAYOUT.panel.height,
          background: 'rgba(29, 68, 168, 0.85)',
        }}
      />

      {/* 단계 1 · 깜빡일 때 구장 막대 자리 반투명 노랑 둥근 칠 0x6b7d5(26, 197, 188, 16, 둥글기 1) (0x6432e) */}
      {isStadiumPhase && isBob && (
        <span
          className={styles.fillPanel}
          data-testid="구장-커서-칠"
          style={{
            left: FIRST_BAT_LAYOUT.stadiumHighlight.x,
            top: FIRST_BAT_LAYOUT.stadiumHighlight.y,
            width: FIRST_BAT_LAYOUT.stadiumHighlight.width + 1,
            height: FIRST_BAT_LAYOUT.stadiumHighlight.height + 1,
            background: FIRST_BAT_LAYOUT.stadiumHighlight.color,
            borderRadius: 1,
          }}
        />
      )}

      {/* 구장 줄 — 막대 + 이름 그림 + 좌우 화살 */}
      <FrameSprite
        folder={GAME_UI_FRAME}
        frame={FIRST_BAT_LAYOUT.stadiumBar.frame}
        origins={gameUiOrigins}
        x={FIRST_BAT_LAYOUT.stadiumBar.x}
        y={FIRST_BAT_LAYOUT.stadiumBar.y}
      />
      <FrameSprite
        folder={IMG_TEXT_FRAME}
        frame={FIRST_BAT_LAYOUT.stadiumNameFrame + stadiumId}
        origins={imgTextOrigins}
        x={FIRST_BAT_LAYOUT.stadiumNameCenterX - (nameWidth >> 1)}
        y={FIRST_BAT_LAYOUT.stadiumNameY}
      />
      {/* 좌우 화살 — 단계와 상관없이 늘 그린다 (0x644ac~0x64576). 누르는 칸은 구장 단계에서만 (웹판) */}
      <img
        className={styles.layer}
        alt=""
        src={imageSrc(SLT_IMAGE, FIRST_BAT_LAYOUT.arrow.image)}
        style={{ left: arrows.leftX, top: FIRST_BAT_LAYOUT.arrow.y }}
      />
      <img
        className={styles.layer}
        alt=""
        src={imageSrc(SLT_IMAGE, FIRST_BAT_LAYOUT.arrow.image)}
        style={{ left: arrows.rightX, top: FIRST_BAT_LAYOUT.arrow.y, transform: 'scaleX(-1)' }}
      />
      {isStadiumPhase && (
        <>
          <PressArea
            label="이전 구장"
            onPress={() => onMoveStadium(stadiumCursorAfter(stadiumId, -1))}
            rect={{ x: FIRST_BAT_LAYOUT.arrow.leftX - 2, y: FIRST_BAT_LAYOUT.arrow.y - 1, width: 9, height: 10 }}
          />
          <PressArea
            label="다음 구장"
            onPress={() => onMoveStadium(stadiumCursorAfter(stadiumId, 1))}
            rect={{ x: FIRST_BAT_LAYOUT.arrow.rightX - 2, y: FIRST_BAT_LAYOUT.arrow.y - 1, width: 9, height: 10 }}
          />
        </>
      )}

      {/* 구장 그림 (stadium_symbol 이미지 = 구장 번호) */}
      <img
        className={styles.layer}
        alt={`구장 ${stadiumId}`}
        src={imageSrc(STADIUM_SYMBOL, stadiumId)}
        style={{ left: FIRST_BAT_LAYOUT.stadiumSymbol.x, top: FIRST_BAT_LAYOUT.stadiumSymbol.y }}
      />

      {/* 오른쪽 정보 두 줄 — 연고지 · 좌석 */}
      {FIRST_BAT_LAYOUT.infoBars.map((bar) => (
        <FrameSprite key={bar.y} folder={GAME_UI_FRAME} frame={bar.frame} origins={gameUiOrigins} x={bar.x} y={bar.y} />
      ))}
      {FIRST_BAT_LAYOUT.infoLabels.map((label) => (
        <FrameSprite key={label.frame} folder={IMG_TEXT_FRAME} frame={label.frame} origins={imgTextOrigins} x={label.x} y={label.y} />
      ))}
      {/* 값 두 줄 — 0xba269 폭 −1: 가운데 = x + (날 글 폭 >> 1) (`FIRST_BAT_LAYOUT.infoValues`, 0x646ca · 0x6472c) */}
      {stadiumInfoValuesOf(stadium).map((value, index) => (
        <span
          key={index}
          className={styles.centeredText}
          data-testid={index === 0 ? '구장-연고지' : '구장-좌석'}
          style={{ left: value.centerX - SCREEN_HALF_WIDTH, top: FIRST_BAT_LAYOUT.infoValues[index].y, width: SCREEN_HALF_WIDTH * 2 }}
        >
          {value.text}
        </span>
      ))}

      {/*
        원본에 없던 웹 [이 구장으로] 단추와 키 안내 글을 걷고 투명 누름 칸으로 — 고른 구장 그림(stadium_symbol 91×40)과
        깜빡이는 구장 막대 칠(26, 197, 188×16) 자리 = OK. 화살 칸과 겹치지 않게 막대는 화살 사이만 잡는다
      */}
      {isStadiumPhase && (
        <>
          <PressArea
            label="구장 그림 — 이 구장으로"
            onPress={() => onChooseStadium(stadiumId)}
            rect={{
              x: FIRST_BAT_LAYOUT.stadiumSymbol.x,
              y: FIRST_BAT_LAYOUT.stadiumSymbol.y,
              width: FIRST_BAT_LAYOUT.stadiumSymbol.width,
              height: FIRST_BAT_LAYOUT.stadiumSymbol.height,
            }}
          />
          <PressArea
            label="이 구장으로"
            onPress={() => onChooseStadium(stadiumId)}
            rect={{
              x: FIRST_BAT_LAYOUT.arrow.leftX + 7,
              y: FIRST_BAT_LAYOUT.stadiumHighlight.y,
              width: FIRST_BAT_LAYOUT.arrow.rightX - FIRST_BAT_LAYOUT.arrow.leftX - 9,
              height: FIRST_BAT_LAYOUT.stadiumHighlight.height,
            }}
          />
        </>
      )}

      {/* 머리띠(제목 4 "선공/구장")·바닥띠 — 원본 공용 목록 k 3 도 이 둘을 얹는다 (P6 1-1 · 2a-4) */}
      {/* 바닥띠의 "되돌아가기" 가 원본 소프트키다 — 따로 두었던 버튼은 없앴다 (스테이지 (0,0) 에 떨어져 있었다) */}
      <ScreenFrame title="선공/구장" gamePoint={gamePoint} onBack={onCancel} />
    </RawScreen>
  )
}
