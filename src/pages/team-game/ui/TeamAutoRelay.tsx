import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { FrameSprite, MessageBox } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { activeSound } from '@/shared/api/audio/soundPort'
import { AutoPlayRelayScreen } from '@/pages/auto-play-relay'
import type { MissionAutoRelayStep } from '@/entities/mission/model/missionAutoRelay'
import type { TeamAutoRelay as TeamAutoRelayState, TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { teamAutoRelayEntryStepOf, teamAutoRelayStepOf, teamRelayFiguresOf } from '@/pages/team-game/lib/teamAutoRelay'
import type { TeamRelayFigures as TeamRelayFiguresValue } from '@/pages/team-game/lib/teamAutoRelay'
import { TeamRelayFigures } from '@/pages/team-game/ui/TeamRelayFigures'
import { effectOpacityOf } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import { AUTO_RELAY_SPEED_MAX, autoRelaySpeed, setAutoRelaySpeed } from '@/pages/team-game/model/autoRelaySpeed'

/** 화면 240×320 */
const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320
/** 상태 0x21 진입 0x3abf0 의 배경음 (모드 ∈ {1, 2, 8, 9} · 속도 ≠ 2) */
export const AUTO_RELAY_BGM = 33
/** 0xc2198 이 반 이닝을 넘기면 거는 연출 대기 sim+0x9d */
export const AUTO_RELAY_CHANGE_WAIT = 10
/** StrGAME[6] — CLR 중단 질문 (`base/extracted/StrGAME.json` [6] 원문 그대로) */
export const AUTO_RELAY_STOP_QUESTION = '!C!cFFFFFF자동진행을 중단하시겠습니까?'

const GAME_UI = './sprites/game_ui'
const GAME_UI_FRAMES = './sprites/game_ui/frames'
const IMG_TEXT_FRAMES = './sprites/img_text/frames'
/** game_ui 프레임 92 — 아래 안내 띠 (W/2 − w/2, H − h − 1) */
const GUIDE_FRAME = 92
/** game_ui 프레임 33 — 속도 칸 바탕 (W/2 − w/2, 216), 효과 (1, 0xc) */
const SPEED_PLATE_FRAME = 33
/** 0xba759 효과 1 · 인자 L = 반투명 겹치기, 그림 몫 L/16 (R6 3a) — 속도 칸 바탕 (1, 0xc) · 꺼진 세모 (1, 6) */
const SPEED_PLATE_EFFECT_LEVEL = 0xc
const SPEED_MARK_DIM_EFFECT_LEVEL = 6
const SPEED_PLATE_Y = 216
/** img_text 프레임 386 — 속도 글 (W/2 − w/2, 218) */
const SPEED_LABEL_FRAME = 386
const SPEED_LABEL_Y = 218
/** game_ui 그림 97 (5×8) — 깜빡이는 좌우 화살표(y 219) · 속도 세모 세 개 */
const ARROW_IMAGE = 97
const ARROW_SIZE = { width: 5, height: 8 } as const
const ARROW_Y = 219
/** 세모 줄 y = 196 + 18 + 프레임 33 높이 + 4 */
const SPEED_PLATE_HEIGHT = 15
const SPEED_MARKS_Y = 196 + 18 + SPEED_PLATE_HEIGHT + 4
/** game_ui 그림 93 (98×19) "CHANGE" — 화면 가운데 */
const CHANGE_IMAGE = 93
const CHANGE_SIZE = { width: 98, height: 19 } as const

/**
 * 질문 창 뒤 어둡게 — 경기 장면은 [창+0x24f] = 1(0x3301c)이라 창을 연 그림에 한 번만 0x746cc 가 검정 단계 5 = (5 + 1)/16 로 덮는다
 * (+0x24d 를 지움). 그 뒤로는 장면을 안 그려(0x52efe — [+0x250] 도 그 그림에 지워진다) 멈춘 장면 + 어둡게 위에 창만 그린다.
 * ⚠️ 단계 5 의 칠하기([0x15605d0]) 본문은 미해독 — 이벤트 장면 창과 같은 6/16 으로 둔다.
 */
const GAME_POPUP_DIM_OPACITY = 6 / 16

/** 부호 있는 바이트로 줄인다 — sim+0x9d 는 `strb` · `lsls #0x18` 로 비교하는 바이트다 */
function signedByte(value: number): number {
  return ((((value + 128) % 256) + 256) % 256) - 128
}

/** 그림(종류 0) 한 장 — 원점 없이 왼쪽 위 */
function imageStyle(x: number, y: number, extra?: CSSProperties): CSSProperties {
  return { position: 'absolute', left: x, top: y, imageRendering: 'pixelated', ...extra }
}

interface TeamAutoRelayProps {
  readonly progress: TeamGameProgress
  /** 0xc2198 → 0xc262c 한 번 (`useTeamGame.actions.stepAutoRelay`) — null 이면 중계 끝 */
  readonly onStep: () => TeamAutoRelayState | null
  /** CLR 중단 질문에 예 (`stopAutoRelay`) */
  readonly onStop: () => void
  readonly sideTeams: readonly [number, number]
  readonly humanSide: 0 | 1
  /** 시즌 홈 경기 잔디 팔레트 — 배경(수비 운동장)을 그 벌로 칠한다 */
  readonly grassPalette?: number | null
}

/**
 * **팀경기(모드 1 · 2 · 8 · 9) 자동진행 중계 — 경기 상태 0x21 을 틱마다 한 칸씩 굴린다** (2026-10-08 직접 뜸).
 *
 * 갱신 0x48480 (매 그림):
 * ```
 * 484a4  v = 전역 +0xbc; v ≠ 2 && 장면틱 % ((2 − v) × 4) ≠ 0 → 끝          ; 0 은 8틱 · 1 은 4틱마다
 * 484ea  sim+0x9c ≠ 0 → sim+0x9d −= 1; > 0 → 끝                            ; "CHANGE" 연출 대기
 * 4850c  r = 0xc2198(sim, 1) → 참이면 0xc262c, 거짓이면 +0x1784 = 0 · 상태 0x18 · 0x6e418 배경음 끔
 * ```
 그리기 0x4258c (2026-10-08 직접 다시 뜸):
 * - 모드 ∈ {1,2,8,9} **· v ≠ 2** (`[sp+0x5c]`, 42608~42620) 일 때만: 운동장 그림(주자 · 투수 · 포수 · 타자 — `TeamRelayFigures`).
 * - 모드 ∈ {1,2,8,9} 면 **v 를 안 보고**(42ab2 · 42bbe 는 모드만 본다): game_ui 프레임 92 (안내 띠) · 프레임 33 (효과 1, 0xc) ·
 *   img_text 프레임 386 · 깜빡이는(장면틱 % 8 ≤ 4) 좌우 화살표 그림 97(왼쪽은 효과 0x11 좌우 뒤집기) · 속도 세모 그림 97 세 개
 *   (효과 1, 6 으로 깐 위에 i ≤ v 만 효과 0 으로 한 번 더, 42e7c~42efa). 그래서 v = 2 에서도 속도 칸이 보여 ←/'4' 로 내릴 수 있다.
 * - 모드를 안 보고: sim+0x9d 를 **그림마다** 1 줄이고(42b30) 아직 > 0 이면 그림 93 "CHANGE" 를 가운데에.
 * - 배경은 그 앞 0x41230 이 깐다(`AutoPlayRelayScreen` — 투수판에 맞춘 수비 운동장).
 * 키 0x3e25c (sim[0] ≠ 0 · 모드 ∈ {1,2,8,9}): ←/'4' 속도 −1 · →/'6' 속도 +1 · CLR → StrGAME[6] 질문(코드 0x1e) → 예면 중단.
 * 진입 0x3abf0: 모드 ∈ {1,2,8,9} · v ≠ 2 면 배경음 33.
 *
 * **질문 창이 떠 있는 동안** (프레임 0x52c50, 2026-10-08 직접 뜸): 52cc6 `0x754f9(창, 키)` 가 [창+9] ≠ 0 이면 늘 1 이라 52ef2 로
 * 건너뛴다 — 장면 틱 0xbc9c8(52cd4) · 진입 · 키 0x498d4 · 갱신 0x48480 · 0xaada4 가 모두 안 돈다(펼침 · 닫힘 동안도). 그리기는
 * 52efe 가 `[+0x24f](경기 장면 1) && [창+9] && [+0x250] == 0` 이면 건너뛰는데, 창을 연 0x74ef4 가 +0x250 = 1 을 걸고 같은 그림 끝의
 * 창 그리기 0x746cc(53078)가 지운다 — 곧 CLR 을 받은 그림은 키(창 열기) → 갱신 → 그리기를 평소대로 마치고, 그 뒤 그림부터
 * 장면이 멈춘다(틱 · sim+0x9d · 깜빡임 그대로). 예/아니오가 다 닫힌 뒤 다음 그림부터 다시 돈다 — 예면 프레임 머리 52c9e 가
 * 닫히는 동안 sim+0xa0 = 0 · 0xc0ea8(sim, 1) 을 걸어 다음 갱신(속도 칸 · CHANGE 대기를 지나는)의 0xc2198 이 거짓이다.
 * ⚠️ CLR 그림의 갱신이 마침 중계를 끝내면(0x18) 원본은 창이 다음 장면 위에 남아 예 → sim+0x9f = 1 이 되지만, 웹은 중계 화면과
 * 함께 창이 내려간다(미이식).
 *
 */
export function TeamAutoRelay({ progress, onStep, onStop, sideTeams, humanSide, grassPalette = null }: TeamAutoRelayProps) {
  const [shown, setShown] = useState<MissionAutoRelayStep>(() => teamAutoRelayEntryStepOf(progress))
  const [figures, setFigures] = useState<TeamRelayFiguresValue>(
    () => teamRelayFiguresOf({ progress, before: progress.game, atBat: null }))
  const [speed, setSpeed] = useState(autoRelaySpeed)
  const speedRef = useRef(speed)
  speedRef.current = speed
  const [isChangeShown, setChangeShown] = useState(false)
  const [isAsking, setAsking] = useState(false)
  const isAskingRef = useRef(false)
  isAskingRef.current = isAsking
  /** CLR 을 받았다 — 다음 그림(그 키의 그림)이 갱신 · 그리기를 다 한 뒤 질문 창을 띄운다 */
  const clrPendingRef = useRef(false)
  const [sceneTick, setSceneTick] = useState(0)
  /** sim+0x9c · sim+0x9d */
  const waitRef = useRef({ armed: false, count: 0 })
  const isDoneRef = useRef(false)
  const audio = activeSound()
  const gameUiOrigins = useFrameOrigins(GAME_UI_FRAMES)
  const textOrigins = useFrameOrigins(IMG_TEXT_FRAMES)

  // 진입 0x3abf0 — v ≠ 2 면 배경음 33
  useEffect(() => {
    if (autoRelaySpeed() !== AUTO_RELAY_SPEED_MAX) audio.playBgm(AUTO_RELAY_BGM)
  }, [audio])

  // 키 0x3e25c
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isAskingRef.current || isDoneRef.current) return
      const change = (delta: number) => {
        event.preventDefault()
        setAutoRelaySpeed(speedRef.current + delta)
        setSpeed(autoRelaySpeed())
      }
      if (event.key === 'ArrowLeft' || event.key === '4') return change(-1)
      if (event.key === 'ArrowRight' || event.key === '6') return change(1)
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault()
        // 원본은 키 단계(0x3e25c → 0xbbef8)에서 창을 열고 **같은 그림의** 갱신 0x48480 · 그리기 0x4258c 를 그대로 마친다
        clrPendingRef.current = true
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const onTick = (tick: number) => {
    if (isDoneRef.current || isAskingRef.current) return
    update(tick)
    if (clrPendingRef.current) {
      clrPendingRef.current = false
      if (isDoneRef.current) return
      // 창이 떠 있는 동안은 장면 틱(0xbc9c8) · 키 · 갱신이 안 돌고 장면도 다시 안 그린다 — 화면이 `isPaused` 로 멈춘다
      isAskingRef.current = true
      setAsking(true)
    }
  }

  /** 한 그림 — 갱신 0x48480 뒤 그리기 0x4258c 의 sim+0x9d 셈 */
  const update = (tick: number) => {
    setSceneTick(tick)
    const v = speedRef.current
    const fast = v === AUTO_RELAY_SPEED_MAX
    const wait = waitRef.current
    // 갱신 0x48480
    let runs = fast || tick % ((AUTO_RELAY_SPEED_MAX - v) * 4) === 0
    if (runs && wait.armed) {
      wait.count = signedByte(wait.count - 1)
      if (wait.count > 0) runs = false
    }
    if (runs) {
      // 0xc2198 머리 — sim+0x9c · +0x9d 를 지운다
      wait.armed = false
      wait.count = 0
      // 걸음 하나 = 0xc262c 한 번(교체 틱 또는 타석 틱)
      const relay = onStep()
      if (relay === null) {
        // 0xc2198 거짓 — +0x1784 = 0 · 상태 0x18 · 0x6e418 배경음 끔
        isDoneRef.current = true
        audio.stop()
        return
      }
      const next = relay.ticks[0]
      if (next !== undefined) {
        if (next.halfFlipped && !fast) {
          wait.armed = true
          wait.count = AUTO_RELAY_CHANGE_WAIT
        }
        setShown(teamAutoRelayStepOf(next))
        setFigures(teamRelayFiguresOf(next))
      }
    }
    // 그리기 0x4258c 42b30 — 모드 · 속도를 안 보고 sim+0x9d 를 그림마다 1 줄이고 > 0 이면 "CHANGE"
    wait.count = signedByte(wait.count - 1)
    setChangeShown(wait.count > 0)
  }

  const fast = speed === AUTO_RELAY_SPEED_MAX
  const guide = gameUiOrigins?.[String(GUIDE_FRAME).padStart(3, '0')]
  const plate = gameUiOrigins?.[String(SPEED_PLATE_FRAME).padStart(3, '0')]
  const label = textOrigins?.[String(SPEED_LABEL_FRAME).padStart(3, '0')]
  const labelWidth = label?.width ?? 0
  const marksX = SCREEN_WIDTH / 2 - Math.trunc((3 * ARROW_SIZE.width + 3) / 2)
  const overlay = (
    <>
      {/* 모드 ∈ {1,2,8,9} 면 속도와 상관없이 (42ab2 · 42bbe) */}
      <div data-testid="중계-속도" data-speed={speed}>
        {guide !== undefined && (
          <FrameSprite folder={GAME_UI_FRAMES} frame={GUIDE_FRAME} origins={gameUiOrigins}
            x={SCREEN_WIDTH / 2 - Math.trunc(guide.width / 2)} y={SCREEN_HEIGHT - guide.height - 1} />
        )}
        {plate !== undefined && (
          <FrameSprite folder={GAME_UI_FRAMES} frame={SPEED_PLATE_FRAME} origins={gameUiOrigins}
            x={SCREEN_WIDTH / 2 - Math.trunc(plate.width / 2)} y={SPEED_PLATE_Y} style={{ opacity: effectOpacityOf(SPEED_PLATE_EFFECT_LEVEL) }} />
        )}
        {label !== undefined && (
          <FrameSprite folder={IMG_TEXT_FRAMES} frame={SPEED_LABEL_FRAME} origins={textOrigins}
            x={SCREEN_WIDTH / 2 - Math.trunc(labelWidth / 2)} y={SPEED_LABEL_Y} />
        )}
        {sceneTick % 8 <= 4 && (
          <>
            <img alt="" src={`${GAME_UI}/${String(ARROW_IMAGE).padStart(3, '0')}.png`}
              style={imageStyle(SCREEN_WIDTH / 2 - Math.trunc(labelWidth / 2) - 8, ARROW_Y, { transform: 'scaleX(-1)' })} />
            <img alt="" src={`${GAME_UI}/${String(ARROW_IMAGE).padStart(3, '0')}.png`}
              style={imageStyle(SCREEN_WIDTH / 2 + Math.trunc(labelWidth / 2) + 3, ARROW_Y)} />
          </>
        )}
        {[0, 1, 2].map((index) => (
          <img key={index} alt="" data-lit={index <= speed}
            src={`${GAME_UI}/${String(ARROW_IMAGE).padStart(3, '0')}.png`}
            style={imageStyle(marksX + index * (ARROW_SIZE.width + 1), SPEED_MARKS_Y, { opacity: index <= speed ? 1 : effectOpacityOf(SPEED_MARK_DIM_EFFECT_LEVEL) })} />
        ))}
      </div>
      {isChangeShown && (
        <img alt="CHANGE" data-testid="중계-CHANGE" src={`${GAME_UI}/${String(CHANGE_IMAGE).padStart(3, '0')}.png`}
          style={imageStyle(SCREEN_WIDTH / 2 - CHANGE_SIZE.width / 2, Math.trunc(SCREEN_HEIGHT / 2 - CHANGE_SIZE.height / 2))} />
      )}
      {isAsking && (
        <MessageBox
          text={AUTO_RELAY_STOP_QUESTION}
          dimOpacity={GAME_POPUP_DIM_OPACITY}
          buttons={['예', '아니오']}
          onAnswer={(index) => {
            setAsking(false)
            if (index === 0) onStop()
          }}
        />
      )}
    </>
  )

  return (
    <AutoPlayRelayScreen step={shown} onTick={onTick} isPaused={isAsking} sideTeams={sideTeams} humanSide={humanSide}
      overlay={overlay} grassPalette={grassPalette}
      // 운동장 그림은 v ≠ 2 일 때만 (`[sp+0x5c]`)
      field={fast ? null : <TeamRelayFigures figures={figures} />} />
  )
}
