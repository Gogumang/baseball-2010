import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { OriginalMission } from '@/shared/config/original/missions'
import type { MissionProgress } from '@/entities/mission/model/missionGoal'
import { goalTickerFrameAt } from '@/entities/mission/model/goalTicker'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import {
  COUNTER_BASE, COUNTER_CLIP, GOAL_TEXT_WIDTH, MISSION_HUD_BASE, TEXT_CLIP, TIMER_ICON, TIMER_STRIP,
  goalCountOf, goalLineDrawsOf, limitStripsOf, slashCounterGlyphsOf, timerGlyphsOf,
} from '@/pages/mission-play/lib/missionHudLayout'
import type { ClipRect, HudGlyph, HudSprite, MissionLimitState } from '@/pages/mission-play/lib/missionHudLayout'
import * as styles from '@/pages/mission-play/ui/MissionHud.css'

interface MissionHudProps {
  readonly mission: OriginalMission
  readonly progress: MissionProgress
  readonly limits: MissionLimitState
  /** 남은 초 [0x1552af0] — 시간 제한이 없으면 null. 0 이면 시계를 안 그린다 (0x36c42) */
  readonly remainingSeconds: number | null
}

function Sprite({ sprite }: { readonly sprite: HudSprite }) {
  return (
    <img
      className={styles.sprite}
      style={{ left: sprite.left, top: sprite.top, ...(sprite.opacity === undefined ? {} : { opacity: sprite.opacity }) }}
      src={sprite.src}
      alt=""
      {...(sprite.testId === undefined ? {} : { 'data-testid': sprite.testId })}
    />
  )
}

function Glyphs({ glyphs, testId }: { readonly glyphs: readonly HudGlyph[]; readonly testId: string }) {
  return (
    <>
      {glyphs.map((glyph, index) => (
        <img
          key={index}
          className={styles.sprite}
          style={{ left: glyph.left, top: glyph.top }}
          src={glyph.src}
          alt=""
          data-testid={testId}
          data-src={glyph.src}
        />
      ))}
    </>
  )
}

/** 자르기 창 — 안쪽은 다시 240×320 원본 좌표로 되돌려 놓는다 */
function Clip({ rect, children }: { readonly rect: ClipRect | null; readonly children: ReactNode }) {
  if (rect === null) return <>{children}</>
  const style: CSSProperties = { left: rect.x, top: rect.y, width: rect.width, height: rect.height }
  return (
    <div className={styles.clip} style={style}>
      <div className={styles.unclip} style={{ left: -rect.x, top: -rect.y }}>
        {children}
      </div>
    </div>
  )
}

/**
 * **타자 미션 HUD (0x36714)** — 오른쪽 위 trainning.pzx 판에 목표 글 한 줄과 "지금/목표"(노랑), 그 아래 타석 · 스윙 한도 띠,
 * 시간 제한이면 왼쪽에 시계. 목표 글은 줄이 둘 이상이면 21 그림 머물고 17 그림 동안 왼쪽으로 넘긴다(`goalTicker`).
 * 좌표 · 그림 · 색은 모두 원본 값이다(`missionHudLayout`).
 */
export function MissionHud({ mission, progress, limits, remainingSeconds }: MissionHudProps) {
  const lines = mission.goals
  const lineCount = lines.length
  // 줄 넘김 칸은 0x36714 가 그릴 때마다 스스로 올린다 — 그림 한 장 = 갱신 한 틱
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (lineCount <= 1) return
    const timer = window.setInterval(() => setTick((value) => value + 1), millisecondsPerFrame())
    return () => window.clearInterval(timer)
  }, [lineCount])

  const frame = goalTickerFrameAt(tick, lineCount)
  const isSliding = frame.nextIndex !== null
  const draws = lineCount === 0 ? [] : goalLineDrawsOf(frame)
  const timer = remainingSeconds === null || remainingSeconds <= 0 ? null : timerGlyphsOf(Math.ceil(remainingSeconds))

  return (
    <div className={styles.hud} data-testid="미션-HUD">
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
          const count = goalCountOf(mission, progress, lines[draw.index])
          return (
            <Glyphs
              key={`수-${draw.index}`}
              glyphs={slashCounterGlyphsOf(count.current, count.target, draw.counterX, draw.counterY, COUNTER_BASE.yellow)}
              testId="미션-목표-수"
            />
          )
        })}
      </Clip>
      {/* 방망이 (모드 6 — 이미지 8) */}
      <Sprite sprite={MISSION_HUD_BASE[2]} />
      {limitStripsOf(limits).map((strip, index) => (
        <div key={index} data-testid="미션-한도-띠">
          <Sprite sprite={strip.strip} />
          <Sprite sprite={strip.label} />
          <Glyphs glyphs={strip.glyphs} testId="미션-한도-수" />
        </div>
      ))}
      {timer !== null && (
        <div data-testid="미션-시계">
          <Sprite sprite={TIMER_STRIP} />
          <Sprite sprite={TIMER_ICON} />
          {timer.glyphs.map((glyph, index) => {
            const mask = `url(${glyph.src})`
            return (
              <span
                key={index}
                className={styles.stamp}
                style={{ left: glyph.left, top: glyph.top, background: glyph.color, maskImage: mask, WebkitMaskImage: mask }}
              />
            )
          })}
          {timer.dots.map((dot, index) => (
            <span
              key={index}
              className={styles.dot}
              style={{ left: dot.left, top: dot.top, width: dot.size, height: dot.size, background: dot.color }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
