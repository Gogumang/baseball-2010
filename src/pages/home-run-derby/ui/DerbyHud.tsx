import { useState } from 'react'
import { SpriteNumber } from '@/shared/ui'
import { numberGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'
import { DERBY_PITCH_COUNT } from '@/entities/home-run-derby/model/derbyRules'
import { derbyBallCountOf, derbyBallNumberOf } from '@/entities/home-run-derby/model/derbyRun'
import type { DerbyRun } from '@/entities/home-run-derby/model/derbyRun'
import { isEventZoneVisibleAt } from '@/entities/home-run-derby/model/eventZone'
import {
  ACE_NAME_ROW, BALL_ICON, BALL_ROW, COMBO_DISPLAY, DISTANCE_ROWS, EVENT_ZONE_SPOT,
  ballIconLeftOf, comboDisplayPlacementOf, distanceRowTopOf,
} from '@/pages/home-run-derby/lib/derbyHudLayout'
import * as styles from '@/pages/home-run-derby/ui/DerbyHud.css'

interface DerbyHudProps {
  readonly run: DerbyRun
  /** 저장된 최고 비거리 (저장 +0x5c) */
  readonly bestDistance: number
  /** 등판한 마투수 이름. 단계 0 이면 null */
  readonly aceName: string | null
  /** 이번 공이 이벤트 존을 얻었나 */
  readonly isEventZoneShown: boolean
  /** 깜빡임용 갱신 횟수 */
  readonly tick: number
  /**
   * 콤보 표시(장면 +0x1b60)가 켜져 있으면 그 값(+0x84), 아니면 null — `useHomeRunDerby` 의 `shownCombo`.
   * 원본 `0x4585c` 는 +0x1b60 이 켜졌을 때만 그리고, 숫자는 늘 +0x84 를 읽는다. 지금 콤보(+0x39)는 안 본다.
   */
  readonly shownCombo?: number | null
  /** 치는 타자의 손 (0xb63c0 — 0 우타 · 1 좌타). 콤보 표시를 왼쪽(좌타)·오른쪽(우타) 어디에 그릴지 가른다 */
  readonly batterSide?: number
}

const spriteSrcOf = (folder: string, frame: number) => `${folder}/${String(frame).padStart(3, '0')}.png`

/**
 * 홈런더비 HUD (0x45a54) — 일반 점수판 대신 **공 아이콘 10칸**과 비거리를 보여 준다.
 * 공 번호는 `(보너스 중 ? 최대 콤보 : 10) − 남은 기회 + 1` 이고(확정),
 * 지금 누적 비거리가 최고 기록을 넘으면 강조한다(확정).
 *
 * 좌표는 콤보 표시(0x4585c)만 원본 값이고, 나머지는 원본에서 못 읽어 `derbyHudLayout` 에 내가 정한 값으로 적어 두었다.
 */
export function DerbyHud({
  run, bestDistance, aceName, isEventZoneShown, tick, shownCombo = null, batterSide = 0,
}: DerbyHudProps) {
  const ballNumber = derbyBallNumberOf(run)
  const ballCount = derbyBallCountOf(run)
  const isOverBest = run.totalDistance > bestDistance
  const totalGlyphs = numberGlyphsOf(run.totalDistance)
  const bestGlyphs = numberGlyphsOf(bestDistance)

  // 콤보 표시를 켠 갱신 — 상태 0xf 가 +0x19ec = 0 · 두 애니를 첫 칸으로 돌린다(0x3db92~0x3dc14)
  const [comboShownAt, setComboShownAt] = useState<{ value: number | null; tick: number }>({ value: shownCombo, tick })
  if (comboShownAt.value !== shownCombo) setComboShownAt({ value: shownCombo, tick })
  const comboPlacement = shownCombo !== null && shownCombo > 0
    ? comboDisplayPlacementOf(shownCombo, batterSide, tick - comboShownAt.tick)
    : null

  return (
    <div className={styles.hud}>
      {/* 공 아이콘 10칸 (0x3608c). 보너스 게임은 최대 콤보 수만큼만 산다 */}
      {Array.from({ length: DERBY_PITCH_COUNT }, (_unused, index) => {
        const state = index >= ballCount ? 'off' : index < ballNumber - 1 ? 'used' : index === ballNumber - 1 ? 'now' : 'left'
        return (
          <img
            key={index}
            className={styles.ball}
            data-state={state}
            style={{ left: ballIconLeftOf(index), top: BALL_ROW.y, width: BALL_ICON.size, height: BALL_ICON.size }}
            src={BALL_ICON.url}
            alt=""
          />
        )
      })}

      {/* 지금 누적 비거리 — 최고 기록을 넘으면 강조 */}
      <span className={styles.label} style={{ left: DISTANCE_ROWS.x, top: distanceRowTopOf(0) }}>
        NOW
      </span>
      {isOverBest && (
        <div
          className={styles.overBest}
          data-testid="최고기록강조"
          style={{
            left: DISTANCE_ROWS.x - 2,
            top: distanceRowTopOf(0) - 1,
            width: DISTANCE_ROWS.right - DISTANCE_ROWS.x + 4,
            height: DISTANCE_ROWS.glyphHeight + 2,
          }}
        />
      )}
      <SpriteNumber
        glyphs={totalGlyphs}
        right={DISTANCE_ROWS.right}
        boxTop={distanceRowTopOf(0)}
        boxHeight={DISTANCE_ROWS.glyphHeight}
      />

      <span className={styles.label} style={{ left: DISTANCE_ROWS.x, top: distanceRowTopOf(1) }}>
        BEST
      </span>
      <SpriteNumber
        glyphs={bestGlyphs}
        right={DISTANCE_ROWS.right}
        boxTop={distanceRowTopOf(1)}
        boxHeight={DISTANCE_ROWS.glyphHeight}
      />

      {/* 콤보 표시 (0x4585c) — trainning.pzx "Combo" 글자가 미끄러져 오고, 끝 칸에 닿으면 큰 숫자(num 70~)가 붙는다 */}
      {comboPlacement !== null && (
        <>
          <img
            className={styles.sprite}
            style={{ left: comboPlacement.left, top: comboPlacement.top }}
            src={spriteSrcOf(COMBO_DISPLAY.folder, comboPlacement.frame)}
            alt="Combo"
          />
          {comboPlacement.digits.map((digit, index) => (
            <img
              key={index}
              className={styles.sprite}
              style={{ left: digit.left, top: digit.top }}
              src={spriteSrcOf('./sprites/num', digit.frame)}
              alt=""
              data-testid="콤보숫자"
            />
          ))}
        </>
      )}

      {aceName !== null && (
        <span className={styles.aceName} style={{ left: ACE_NAME_ROW.x, top: ACE_NAME_ROW.y, width: ACE_NAME_ROW.width }}>
          마투수 {aceName}
        </span>
      )}

      {/* 이벤트 존 — 부품 두 장을 8프레임 주기로 번갈아 그린다 (0x41098) */}
      {isEventZoneShown && (
        <img
          className={styles.sprite}
          style={{ left: EVENT_ZONE_SPOT.x, top: EVENT_ZONE_SPOT.y }}
          src={EVENT_ZONE_SPOT.parts[isEventZoneVisibleAt(tick) ? 0 : 1]}
          alt="이벤트 존"
        />
      )}
    </div>
  )
}
