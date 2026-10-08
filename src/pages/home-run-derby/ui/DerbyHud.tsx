import { useState } from 'react'
import { derbyBallCountOf, derbyBallNumberOf } from '@/entities/home-run-derby/model/derbyRun'
import type { DerbyRun } from '@/entities/home-run-derby/model/derbyRun'
import { isEventZoneVisibleAt } from '@/entities/home-run-derby/model/eventZone'
import {
  COMBO_DISPLAY, DISTANCE_BOARD, EVENT_ZONE_SPOT, HUD_PANEL,
  ballCounterGlyphsOf, bestDistanceGlyphsOf, comboDisplayPlacementOf, distanceBoardGlyphsOf, totalDistanceGlyphsOf,
} from '@/pages/home-run-derby/lib/derbyHudLayout'
import type { HudGlyph } from '@/pages/home-run-derby/lib/derbyHudLayout'
import * as styles from '@/pages/home-run-derby/ui/DerbyHud.css'

interface DerbyHudProps {
  readonly run: DerbyRun
  /** 저장된 최고 비거리 (저장 +0x5c) */
  readonly bestDistance: number
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
  /**
   * 더비 판(0x17)이 도는 동안 비거리 판 0x36cd4 가 보이는 표시 비거리 +0x36 — 판이 없으면 null.
   * 부르는 쪽이 판의 공 틱에 맞춰 `derbyDisplayDistanceAt` 으로 넘긴다.
   */
  readonly distanceBoardValue?: number | null
  /**
   * 더비 판(0x17)이 도는 중인가 — 0x17 그리기 0x46c88 은 타석 화면 그리기 0x4c4bc(HUD 0x45a54 · 콤보 0x4585c 를 부르는 곳)를
   * 안 부르고 비거리 판 0x36cd4 만 얹는다. 그래서 판 동안은 판 · 공 번호 · 최고 · 현재 칸과 콤보를 안 그린다.
   */
  readonly isPlayShown?: boolean
}

const spriteSrcOf = (folder: string, frame: number) => `${folder}/${String(frame).padStart(3, '0')}.png`

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
        />
      ))}
    </>
  )
}

/**
 * 홈런더비 HUD (0x45a54) — 오른쪽 위에 trainning.pzx 판 "최고 ___M / 현재 ___M" 을 놓고
 * 판 머리에 "공 번호 / 공 수", 두 칸에 최고 기록과 누적 비거리를 쓴다. 좌표·글꼴·색은 전부 원본 값이다(`derbyHudLayout`).
 * 공 번호 = `(보너스 중 ? 최대 콤보 : 10) − 남은 기회 + 1`, 최고 칸은 누적이 넘으면 노란 글자로 바뀐다.
 */
export function DerbyHud({
  run, bestDistance, isEventZoneShown, tick, shownCombo = null, batterSide = 0, distanceBoardValue = null, isPlayShown = false,
}: DerbyHudProps) {
  // 콤보 표시를 켠 갱신 — 상태 0xf 가 +0x19ec = 0 · 두 애니를 첫 칸으로 돌린다(0x3db92~0x3dc14)
  const [comboShownAt, setComboShownAt] = useState<{ value: number | null; tick: number }>({ value: shownCombo, tick })
  if (comboShownAt.value !== shownCombo) setComboShownAt({ value: shownCombo, tick })
  const comboPlacement = shownCombo !== null && shownCombo > 0
    ? comboDisplayPlacementOf(shownCombo, batterSide, tick - comboShownAt.tick)
    : null

  return (
    <div className={styles.hud}>
      {!isPlayShown && (
        <>
          {/* 판 — trainning 합성 프레임 2 (0x45abc) */}
          <img
            className={styles.sprite}
            style={{ left: HUD_PANEL.x, top: HUD_PANEL.y }}
            src={spriteSrcOf(HUD_PANEL.folder, HUD_PANEL.frame)}
            alt="홈런더비 판"
          />
          {/* 공 번호 / 공 수 (0x3608c) */}
          <Glyphs glyphs={ballCounterGlyphsOf(derbyBallNumberOf(run), derbyBallCountOf(run))} testId="공번호" />
          {/* 최고 칸 — 누적이 넘으면 노랑 (0x45b3a) */}
          <Glyphs glyphs={bestDistanceGlyphsOf(bestDistance, run.totalDistance)} testId="최고기록" />
          {/* 현재 칸 — 누적 비거리 (0x45bd8) */}
          <Glyphs glyphs={totalDistanceGlyphsOf(run.totalDistance)} testId="현재비거리" />
        </>
      )}

      {/* 콤보 표시 (0x4585c) — trainning.pzx "Combo" 글자가 미끄러져 오고, 끝 칸에 닿으면 큰 숫자(num 70~)가 붙는다 */}
      {!isPlayShown && comboPlacement !== null && (
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

      {/* 비거리 판 (0x36cd4) — 더비 판(0x17) 동안 화면 위 가운데 "___M", 숫자는 표시 비거리 +0x36 */}
      {distanceBoardValue !== null && (
        <>
          <img
            className={styles.sprite}
            style={{ left: DISTANCE_BOARD.x, top: DISTANCE_BOARD.y }}
            src={spriteSrcOf(DISTANCE_BOARD.folder, DISTANCE_BOARD.frame)}
            alt="비거리 판"
          />
          <Glyphs glyphs={distanceBoardGlyphsOf(distanceBoardValue)} testId="비거리판" />
        </>
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
