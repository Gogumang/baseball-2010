import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { FrameSprite, MessageBox } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { activeSound } from '@/shared/api/audio/soundPort'
import { AutoPlayRelayScreen } from '@/pages/auto-play-relay'
import type { MissionAutoRelayStep } from '@/entities/mission/model/missionAutoRelay'
import type { TeamAutoRelay as TeamAutoRelayState, TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { teamAutoRelayEntryStepOf, teamAutoRelayStepOf } from '@/pages/team-game/lib/teamAutoRelay'
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
 * 그리기 0x4258c 의 모드 ∈ {1,2,8,9} · v ≠ 2 갈래: game_ui 프레임 92 (안내 띠) · 프레임 33 (효과 1, 0xc) · img_text 프레임 386 ·
 * 깜빡이는(장면틱 % 8 ≤ 4) 좌우 화살표 그림 97 · 속도 세모 그림 97 세 개(흐림 효과 1, 6 위에 i ≤ v 만 밝게) · sim+0x9d 를 **그림마다**
 * 1 줄이고(42b30) 아직 > 0 이면 그림 93 "CHANGE" 를 가운데에.
 * 키 0x3e25c (sim[0] ≠ 0 · 모드 ∈ {1,2,8,9}): ←/'4' 속도 −1 · →/'6' 속도 +1 · CLR → StrGAME[6] 질문(코드 0x1e) → 예면 중단.
 * 진입 0x3abf0: 모드 ∈ {1,2,8,9} · v ≠ 2 면 배경음 33.
 *
 * ⚠️ 근사 · 미이식:
 * - 작은 다이아몬드 · 주자 그림(0x79d10, 표 0xd0028) · 투수/타자 그림(0x79b48)과 배경은 안 그린다(그림 짝을 아직 못 맞췄다).
 * - 프레임 33 의 효과 (1, 0xc) · 세모의 흐림 효과 (1, 6)은 불투명도로 근사했다.
 * - 질문 창이 떠 있는 동안은 갱신 · 그리기 셈(sim+0x9d)을 멈춘다(원본 팝업 동안의 장면 갱신은 안 읽었다).
 */
export function TeamAutoRelay({ progress, onStep, onStop, sideTeams, humanSide }: TeamAutoRelayProps) {
  const [shown, setShown] = useState<MissionAutoRelayStep>(() => teamAutoRelayEntryStepOf(progress))
  const [speed, setSpeed] = useState(autoRelaySpeed)
  const speedRef = useRef(speed)
  speedRef.current = speed
  const [isChangeShown, setChangeShown] = useState(false)
  const [isAsking, setAsking] = useState(false)
  const isAskingRef = useRef(false)
  isAskingRef.current = isAsking
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
        setAsking(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const onTick = (tick: number) => {
    if (isDoneRef.current || isAskingRef.current) return
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
        audio.stopBgm()
        return
      }
      const next = relay.ticks[0]
      if (next !== undefined) {
        if (next.halfFlipped && !fast) {
          wait.armed = true
          wait.count = AUTO_RELAY_CHANGE_WAIT
        }
        setShown(teamAutoRelayStepOf(next))
      }
    }
    // 그리기 0x4258c (v ≠ 2 갈래) — sim+0x9d 를 그림마다 1 줄이고 > 0 이면 "CHANGE"
    if (fast) {
      setChangeShown(false)
      return
    }
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
      {!fast && (
        <div data-testid="중계-속도" data-speed={speed}>
          {guide !== undefined && (
            <FrameSprite folder={GAME_UI_FRAMES} frame={GUIDE_FRAME} origins={gameUiOrigins}
              x={SCREEN_WIDTH / 2 - Math.trunc(guide.width / 2)} y={SCREEN_HEIGHT - guide.height - 1} />
          )}
          {plate !== undefined && (
            <FrameSprite folder={GAME_UI_FRAMES} frame={SPEED_PLATE_FRAME} origins={gameUiOrigins}
              x={SCREEN_WIDTH / 2 - Math.trunc(plate.width / 2)} y={SPEED_PLATE_Y} style={{ opacity: 0.75 }} />
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
              style={imageStyle(marksX + index * (ARROW_SIZE.width + 1), SPEED_MARKS_Y, { opacity: index <= speed ? 1 : 0.4 })} />
          ))}
        </div>
      )}
      {isChangeShown && (
        <img alt="CHANGE" data-testid="중계-CHANGE" src={`${GAME_UI}/${String(CHANGE_IMAGE).padStart(3, '0')}.png`}
          style={imageStyle(SCREEN_WIDTH / 2 - CHANGE_SIZE.width / 2, Math.trunc(SCREEN_HEIGHT / 2 - CHANGE_SIZE.height / 2))} />
      )}
      {isAsking && (
        <MessageBox
          text={AUTO_RELAY_STOP_QUESTION}
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
    <AutoPlayRelayScreen step={shown} onTick={onTick} sideTeams={sideTeams} humanSide={humanSide} overlay={overlay} />
  )
}
