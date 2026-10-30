import { useEffect, useState } from 'react'
import type { OriginalMission } from '@/shared/config/original/missions'
import type { MissionProgress } from '@/entities/mission/model/missionGoal'
import { goalTickerFrameAt } from '@/entities/mission/model/goalTicker'
import {
  COUNTER_BASE,
  COUNTER_CLIP,
  GOAL_TEXT_WIDTH,
  MISSION_HUD_BASE,
  TEXT_CLIP,
  goalCountOf,
  goalLineDrawsOf,
  limitStripsOf,
  missionHudIconOf,
  pitcherGoalCountOf,
  slashCounterGlyphsOf,
} from '@/pages/mission-play/lib/missionHudLayout'
import type { MissionHudMode, MissionLimitState } from '@/pages/mission-play/lib/missionHudLayout'
import * as styles from '@/pages/mission-play/ui/MissionHud.css'
import { createGameSceneDrawGate, setGameSceneTickInterval } from '@/shared/lib/commonWindow/commonWindow'
import { Clip, Glyphs, Sprite } from '@/pages/mission-play/ui/missionHud/hudSprites'
import { HudTimer } from '@/pages/mission-play/ui/missionHud/HudTimer'

interface MissionHudProps {
  readonly mission: OriginalMission
  readonly progress: MissionProgress
  readonly limits: MissionLimitState
  /** 남은 초 [0x1552af0] — 시간 제한이 없으면 null. 0 이면 시계를 안 그린다 (0x36c42) */
  readonly remainingSeconds: number | null
  /** 미션 모드 — 6 타자(기본) · 5 투수. 머리 아이콘 · 줄 맞대기 표 · 두째 띠가 갈린다 */
  readonly mode?: MissionHudMode
  /** 모드 5 의 '실점' 줄 지금 값 — 허용 실점 (P+4) */
  readonly allowedRuns?: number
  /** 일시정지 팝업 동안 — 장면 그리기가 멈춰 줄 넘김도 멈춘다 */
  readonly isFrozen?: boolean
  /**
   * 0xf 구질 목록이 실린 동안 — 빛 지도(4c5a6 · 0x9ce71)가 그 앞까지 그린 화면(점수판 꼬리인 이 판 포함)을 RGB 각 × 15/32 로
   * 어둡게 한다. 판은 투수 둘레 원(지름 60) 밖이라 늘 15/32 다
   */
  readonly isDimmed?: boolean
  /**
   * 반투명 띠(타석 · 스윙/투구 · 시계)를 타석 캔버스가 그린다 — 참이면 이 판은 띠 그림을 빼고 글 · 숫자 · 시계 그림만 얹는다
   * (`missionStageStripsOf`, Q-03 r301). 거짓이면 띠도 CSS 불투명도 근사로 그린다
   */
  readonly stripsOnStage?: boolean
}

/** 목표 줄 그리기 — 줄이 없으면 아무것도 */
function goalDrawsOf(frame: ReturnType<typeof goalTickerFrameAt>, lineCount: number) {
  return lineCount === 0 ? [] : goalLineDrawsOf(frame)
}

/** 어둡게(15/32) 그릴 때의 style */
function dimmedPropsOf(isDimmed: boolean) {
  return isDimmed ? { style: { filter: `brightness(${15 / 32})` } } : {}
}

/** 시간 제한이 남았으면 왼쪽 시계 */
function hudTimerOf(remainingSeconds: number | null, stripsOnStage: boolean) {
  if (remainingSeconds === null || !(remainingSeconds > 0)) return null
  return <HudTimer seconds={Math.ceil(remainingSeconds)} stripsOnStage={stripsOnStage} />
}

/**
 * **타자 미션 HUD (0x36714)** — 오른쪽 위 trainning.pzx 판에 목표 글 한 줄과 "지금/목표"(노랑), 그 아래 타석 · 스윙 한도 띠,
 * 시간 제한이면 왼쪽에 시계. 목표 글은 줄이 둘 이상이면 21 그림 머물고 17 그림 동안 왼쪽으로 넘긴다(`goalTicker`).
 * 좌표 · 그림 · 색은 모두 원본 값이다(`missionHudLayout`).
 */
export function MissionHud({
  mission,
  progress,
  limits,
  remainingSeconds,
  mode = 6,
  allowedRuns = 0,
  isFrozen = false,
  isDimmed = false,
  stripsOnStage = false,
}: MissionHudProps) {
  const lines = mission.goals
  const lineCount = lines.length
  // 줄 넘김 칸은 0x36714 가 그릴 때마다 스스로 올린다 — 그림 한 장 = 갱신 한 틱
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (lineCount <= 1 || isFrozen) return
    // 0x36714 는 그리기 쪽이라 공용 창이 서 있으면 52efe 가 건너뛴다 — 창이 선 첫 그림([창+0x250])만 한 번 더 오르고 닫히면 이어 오른다
    const drawGate = createGameSceneDrawGate()
    const timer = setGameSceneTickInterval(() => {
      if (drawGate.allowsDraw()) setTick((value) => value + 1)
    })
    return () => timer()
  }, [lineCount, isFrozen])

  const frame = goalTickerFrameAt(tick, lineCount)
  const isSliding = frame.nextIndex !== null
  const draws = goalDrawsOf(frame, lineCount)

  return (
    <div className={styles.hud} data-testid="미션-HUD" {...dimmedPropsOf(isDimmed)}>
      {MISSION_HUD_BASE.slice(0, 2).map((sprite, index) => (
        <Sprite key={index} sprite={sprite} />
      ))}
      {/* 목표 줄 0x36358 — 넘기는 동안만 글 창 A · 숫자 창 B 로 자른다 */}
      <Clip rect={isSliding ? TEXT_CLIP : null}>
        {draws.map((draw) => (
          <span
            key={`글-${draw.index}`}
            className={styles.goalText}
            style={{ left: draw.textX, top: draw.textY, width: GOAL_TEXT_WIDTH }}
            data-testid="미션-목표-글"
          >
            {lines[draw.index]}
          </span>
        ))}
      </Clip>
      <Clip rect={isSliding ? COUNTER_CLIP : null}>
        {draws.map((draw) => {
          const count =
            mode === 5 ? pitcherGoalCountOf(mission, progress, lines[draw.index], allowedRuns) : goalCountOf(mission, progress, lines[draw.index])
          return (
            <Glyphs
              key={`수-${draw.index}`}
              glyphs={slashCounterGlyphsOf(count.current, count.target, draw.counterX, draw.counterY, COUNTER_BASE.yellow)}
              testId="미션-목표-수"
            />
          )
        })}
      </Clip>
      {/* 머리 아이콘 — 모드 6 방망이(이미지 8) · 모드 5 공(이미지 7) */}
      <Sprite sprite={missionHudIconOf(mode)} />
      {limitStripsOf(limits).map((strip, index) => (
        <div key={index} data-testid="미션-한도-띠">
          {!stripsOnStage && <Sprite sprite={strip.strip} />}
          <Sprite sprite={strip.label} />
          <Glyphs glyphs={strip.glyphs} testId="미션-한도-수" />
        </div>
      ))}
      {hudTimerOf(remainingSeconds, stripsOnStage)}
    </div>
  )
}
