import { useEffect } from 'react'
import { noteSkinShakeKey } from '@/shared/lib/cursorShake/skinShakeDirection'
import type { ReactNode } from 'react'
import { FrameSprite, PressArea, RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { FOOTER_BITS } from '@/widgets/screen-frame/lib/screenFrameLayout'
import { MatchInfoStadiumBackdrop } from '@/widgets/batting-stage/ui/MatchInfoStadiumBackdrop'
import type { MatchInfoStadiumState } from '@/widgets/batting-stage/lib/renderScenery'
import { TEAMS } from '@/shared/config/original/teams'
import { PLAYER_SIDE_FIRST_BAT } from '@/entities/game/model/gameState'
import {
  MATCH_INFO_LAYOUT,
  MATCH_INFO_PLAY_BALL_PRESS_RECT,
  TAG,
  TEAM_LOGO_HALF,
  firstBatTagPlacementOf,
  matchInfoLogoPressRectOf,
  isPrepareBobOn,
  matchInfoRowY,
} from '@/pages/general-mode/lib/prepareLayout'
import { generalModeMatchInfoLines } from '@/pages/general-mode/lib/matchInfoLines'
import type { CpuMatchInfo } from '@/pages/general-mode/lib/matchInfoLines'
import type { GeneralModeSetup } from '@/pages/general-mode/lib/generalModeSetup'
import * as styles from '@/pages/general-mode/ui/prepareScreen.css'
import { matchInfoValueCellDy } from '@/pages/management/lib/matchInfoEntry'
import { useMatchInfoEntry } from '@/pages/management/ui/useMatchInfoEntry'
import { MatchInfoEntryBanners } from '@/pages/management/ui/MatchInfoEntryBanners'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const SLT_IMAGE = assetUrl('./sprites/slt_frame')
const SLT_FRAME = assetUrl('./sprites/slt_frame/frames')
const IMG_TEXT_FRAME = assetUrl('./sprites/img_text/frames')

/**
 * 바닥비트 — 그림 0x2e0c4 의 모드 1(일반모드, [메뉴+0x13c] == 1) 갈래 (0x2e128~0x2e15e, 직접 떴다):
 * 기본 0x44(되돌아가기 + "0경기설정"), 빠른실행([메뉴+0x14c])이고 재굴림이 안 돌 때([skin+0xf4] == 0) +0x20 "#재선택".
 * 설정 창([skin+0x2ba])이 떠 있으면 0x20 을 끄고 0x40 을 뒤집는다 → 4.
 * [skin+0xf4] 는 '*' 재굴림이 도는 20틱 동안 서는 칸이다(0x31424 가 세우고 0x3128c 가 내림) — 그동안은 0x44.
 * 설정 창은 도는 동안 열릴 수 없다(키를 안 받는다). "#재선택" 표시지만 재굴림 키는 '*'(0x312e6 `cmp r4, #0x2a`)다. 원본 그대로 둔다.
 * (모드 8·9 대전 갈래 0x2e162~ 는 4 / 빠른실행 0x24 — 웹에 대전모드가 없다.)
 */
const generalMatchInfoFooterOf = (isQuickStart: boolean, isRespinning: boolean, isSettingsOpen: boolean): number => {
  let footer = isQuickStart && !isRespinning ? 0x64 : 0x44
  if (isSettingsOpen) footer = (footer & ~0x20) ^ 0x40
  return footer
}

/** 누름 칸이 보내는 키 — 키 처리(`useEffect` 안 window 듣개)가 그대로 받는다 */
const pressKey = (key: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key }))

const imageSrc = (folder: string, index: number) => `${folder}/${String(index).padStart(3, '0')}.png`

export interface MatchInfoScreenProps {
  readonly setup: GeneralModeSetup
  /** 빠른실행으로 들어왔는가 (메뉴+0x14c) — `*` 재선택이 이때만 나온다 */
  readonly isQuickStart?: boolean
  /** 경기진행 설정 창이 떠 있는가 (skin+0x2ba) — 바닥이 되돌아가기(4)만 남는다 */
  readonly isSettingsOpen?: boolean
  /**
   * 경기진행 설정 창 0x6042c — 그림 0x2e0c4 가 목록(4/5) 다음 **머리띠 0x54d95 앞**(2e124 → 2e1be)에 그린다.
   * 화면 판(240×320) 안에 그려야 해서 부르는 쪽이 창을 이 칸으로 넘긴다
   */
  readonly settingsWindow?: ReactNode
  /** `*` 재굴림이 도는 중인가 (skin+0xf4) — 그동안 키를 전부 버린다(0x312b6) */
  readonly isRespinning?: boolean
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
  /**
   * 바탕 — 22 진입 0x314b0 의 무대를 0x5fd04 가 흐려 떠 둔 그림(그리기 0x2e0c4 의 `0x581dc(스킨, 0, 0)`). 없으면 바탕 없음
   */
  readonly stage?: MatchInfoStadiumState | null
  /**
   * 0x63b15 넷째 인자 — `[메뉴+0x28] ≠ 0x17`(이전 상태가 23 엔트리 편집이 아님, 0x2e0fa). 참이면 머리띠가 미끄러져 내려오는
   * 다섯 그림 동안 본문을 비우고, 파랑 배너 둘이 네 그림 동안 들어온 뒤 본문이 선다 (`pages/management/lib/matchInfoEntry`).
   * 23 에서 돌아오면 거짓 — 머리띠도 안 미끄러지고 본문이 곧바로 선다. 안 주면 거짓.
   * 갱신 0x311a8 은 맨 앞에서 [[0x1552cfc]+0xe4] == 0 이면 아무것도 안 한다(0x311b2) — 머리띠 · 배너 · 값 줄 펼침이 끝날 때까지 키를 안 받는다.
   */
  readonly isEntryAnimated?: boolean
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
  setup,
  isQuickStart = false,
  isSettingsOpen = false,
  settingsWindow = null,
  isRespinning = false,
  gamePoint = 0,
  onStart,
  onOpenSettings,
  onRespin,
  onCancel,
  onOpenEntry,
  userStarterName = null,
  cpuMatchInfo = null,
  stage = null,
  isEntryAnimated = false,
}: MatchInfoScreenProps) {
  const { phase, valueRows, areValueCellsHidden, isKeyReady } = useMatchInfoEntry(isEntryAnimated, isRespinning)
  const sltOrigins = useFrameOrigins(SLT_FRAME)
  const imgTextOrigins = useFrameOrigins(IMG_TEXT_FRAME)
  const lines = generalModeMatchInfoLines(setup, userStarterName, cpuMatchInfo)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 키 함수 맨 앞 — [[0x1552cfc]+0xe4](값 줄 펼침 끝) == 0 이면 아무것도 안 한다 (`isMatchInfoKeyReadyAt`)
      if (!isKeyReady.current) return
      // 0x311a8: 빠른실행이고 [메뉴+0x154] ≤ 0x13(재굴림이 도는 중)이면 312ba 에서 끝 — 키를 안 본다
      if (isRespinning) return
      // 설정 창이 열렸으면([skin+0x2ba]) 키는 창 0x5ffcd 로만 간다(312bc~312ce). 아니면 **날 키**를 0x5550d 에 넘긴다(312dc~312e2) —
      // 화살표면 까딱임 방향 [skin+0x8c] 에 남는다(Q-10)
      if (!isSettingsOpen) noteSkinShakeKey(event.key)
      // OK −5 와 '5' 는 같은 0x31322 경기 시작이다 (312f0 · 31318 `cmp r4,#0x35`, r333 — 예전 웹은 '5' 를 버렸다)
      if (event.key === 'Enter' || event.key === '5') {
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
  }, [isQuickStart, isRespinning, isSettingsOpen, onStart, onOpenSettings, onRespin, onCancel, onOpenEntry])

  const { anchorA, anchorB, firstBatTag } = MATCH_INFO_LAYOUT
  const isUserFirstBat = setup.playerSide === PLAYER_SIDE_FIRST_BAT
  const tagAnchor = isUserFirstBat ? anchorA : anchorB
  // 공용 목록 깜빡 [sp+0xd4] — 꼬리표 2px · 화살 1px · 노랑 반원 (0x63b4a)
  const isBob = isPrepareBobOn(useUpdateCounter())
  const tagPlace = firstBatTagPlacementOf(isUserFirstBat, tagAnchor, isBob)

  return (
    <RawScreen>
      <MatchInfoStadiumBackdrop stage={stage} />
      {phase.kind === '배너' && <MatchInfoEntryBanners offset={phase.offset} testId="경기정보-배너" />}
      {phase.kind === '본문' && (
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
          <FrameSprite
            folder={SLT_FRAME}
            frame={MATCH_INFO_LAYOUT.playBall.frame}
            origins={sltOrigins}
            x={120 - 23}
            y={MATCH_INFO_LAYOUT.playBall.y}
          />
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

          {/* 줄 다섯 — 가운데 딱지 (0x64d30 본문) */}
          {lines.map((line, index) => {
            const y = matchInfoRowY(index)
            return (
              <span key={line.label}>
                <img
                  className={styles.layer}
                  alt=""
                  src={imageSrc(SLT_IMAGE, MATCH_INFO_LAYOUT.labelBar.image)}
                  style={{ left: MATCH_INFO_LAYOUT.labelBar.x, top: y }}
                />
                {/* 가운데 딱지 막대(이미지 18)도 116 과 같은 흰 막대다 — 글자는 팔레트 3(짙은 파랑)으로 구웠다 */}
                <FrameSprite
                  folder={IMG_TEXT_FRAME}
                  frame={line.labelFrame}
                  origins={imgTextOrigins}
                  x={MATCH_INFO_LAYOUT.labelBar.x}
                  y={y + MATCH_INFO_LAYOUT.labelBar.textDy}
                />
              </span>
            )
          })}

          {/*
        값 칸 0x5dcc0 — 딱지 뒤에 칸 i = 0 … 9 (짝 유저 · 홀 CPU) 차례로. 유저 slt_frame 이미지 10 (16, y + 3) · CPU 뒤집어 (138, y − 3),
        펼치는 동안은 아랫줄 칸이 첫 줄 자리에서 떨어져 내려온다(`matchInfoValueCellDy`). 재굴림 중에는 안 그린다.
      */}
          {!areValueCellsHidden &&
            lines.map((line, index) => {
              const y = matchInfoRowY(index)
              const userY = y + MATCH_INFO_LAYOUT.valueCell.userDy + matchInfoValueCellDy(valueRows.unfold, 2 * index)
              const cpuY = y + MATCH_INFO_LAYOUT.valueCell.cpuDy + matchInfoValueCellDy(valueRows.unfold, 2 * index + 1)
              return (
                <span key={line.label}>
                  <img
                    className={styles.layer}
                    alt=""
                    src={imageSrc(SLT_IMAGE, MATCH_INFO_LAYOUT.valueCell.image)}
                    style={{ left: MATCH_INFO_LAYOUT.valueCell.userX, top: userY }}
                  />
                  <span
                    className={styles.centeredText}
                    data-testid={`경기정보-${line.label}-유저`}
                    style={{
                      left: MATCH_INFO_LAYOUT.valueCell.userX,
                      top: userY + MATCH_INFO_LAYOUT.valueCell.textDy,
                      width: MATCH_INFO_LAYOUT.valueCell.width,
                    }}
                  >
                    {line.user}
                  </span>
                  <img
                    className={styles.layer}
                    alt=""
                    src={imageSrc(SLT_IMAGE, MATCH_INFO_LAYOUT.valueCell.image)}
                    style={{ left: MATCH_INFO_LAYOUT.valueCell.cpuX, top: cpuY, transform: 'scaleX(-1)' }}
                  />
                  <span
                    className={styles.centeredText}
                    data-testid={`경기정보-${line.label}-CPU`}
                    style={{
                      left: MATCH_INFO_LAYOUT.valueCell.cpuX,
                      top: cpuY + MATCH_INFO_LAYOUT.valueCell.textDy,
                      width: MATCH_INFO_LAYOUT.valueCell.width,
                    }}
                  >
                    {line.cpu}
                  </span>
                </span>
              )
            })}

          {/* 노랑 반원 두 쪽 — 값 줄 0x5dcc0 이 다 펼쳤다고 돌려줬고([skin+0xe4]) 깜빡일 때만 (0x65078~0x65108) */}
          {valueRows.isReady && isBob && (
            <>
              <img
                className={styles.layer}
                alt=""
                src={imageSrc(SLT_IMAGE, MATCH_INFO_LAYOUT.halfCircle.image)}
                style={{ left: MATCH_INFO_LAYOUT.halfCircle.leftX, top: MATCH_INFO_LAYOUT.halfCircle.y }}
              />
              <img
                className={styles.layer}
                alt=""
                src={imageSrc(SLT_IMAGE, MATCH_INFO_LAYOUT.halfCircle.image)}
                style={{ left: MATCH_INFO_LAYOUT.halfCircle.rightX, top: MATCH_INFO_LAYOUT.halfCircle.y, transform: 'scaleX(-1)' }}
              />
            </>
          )}
        </>
      )}

      {/*
        원본에 없던 웹 단추 셋([경기 시작] · [0 경기설정] · [* 재선택])과 키 안내 글을 걷고 **투명 누름 칸**으로 —
        누르면 그 키를 보낸다(펼침 · 재굴림 중 막기도 키 처리 그대로). 가운데 PLAY BALL 공 = OK, 두 엠블럼 = ←/→ 엔트리,
        바닥띠 "0경기설정" · "#재선택" 표시 = 그 키. 설정 창이 떠 있으면 키가 모두 창으로 가므로 칸을 안 세운다
      */}
      {!isSettingsOpen && (
        <>
          <PressArea label="경기 시작" rect={MATCH_INFO_PLAY_BALL_PRESS_RECT} onPress={() => pressKey('Enter')} />
          {onOpenEntry !== undefined && (
            <>
              <PressArea label="PLAYER 엔트리" rect={matchInfoLogoPressRectOf(anchorA)} onPress={() => pressKey('ArrowLeft')} />
              <PressArea label="COM 엔트리" rect={matchInfoLogoPressRectOf(anchorB)} onPress={() => pressKey('ArrowRight')} />
            </>
          )}
        </>
      )}

      {settingsWindow}

      {/* 머리띠(제목 12 "경기정보")·바닥띠 — 원본 공용 목록 k 4 도 이 둘을 얹는다 (P6 1-1 · 2a-6) */}
      {/* 바닥띠의 "되돌아가기" 가 원본 소프트키다 — 따로 두었던 버튼은 없앴다 (스테이지 (0,0) 에 떨어져 있었다) */}
      <ScreenFrame
        title="경기정보"
        gamePoint={gamePoint}
        onBack={onCancel}
        footer={generalMatchInfoFooterOf(isQuickStart, isRespinning, isSettingsOpen)}
        slides={isEntryAnimated}
        footerPresses={{
          [FOOTER_BITS.gameSettings]: { label: '0 경기설정', onPress: () => pressKey('0') },
          [FOOTER_BITS.reselect]: { label: '* 재선택', onPress: () => pressKey('*') },
        }}
      />
    </RawScreen>
  )
}
