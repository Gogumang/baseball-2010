import type { CSSProperties } from 'react'
import { CommonPanel } from '@/shared/ui'
import { SUBSTITUTION_WINDOW, isBlinkOut } from '@/pages/team-game/lib/substitutionWindow'
import { GAME_UI, IMG_TEXT_FRAMES, TEAM_LOGO, pad, pixel } from './substitutionAssets'

const W = SUBSTITUTION_WINDOW

/** 0x384b8 머리 — 공용 판 · ▲▼ 화살(깜빡임) · 사람 팀 큰 로고 · 제목 "투수/타자" + "교체" */
export function WindowHeader({
  isPitcher,
  ourTeamId,
  tick,
  paletteStyle,
}: {
  readonly isPitcher: boolean
  readonly ourTeamId: number
  readonly tick: number
  /** img_text 팔레트 3 (제목 앞 글자) */
  readonly paletteStyle: CSSProperties
}) {
  const blinkOut = isBlinkOut(tick)
  return (
    <>
      <CommonPanel
        x={W.panel.x}
        y={W.panel.y}
        width={W.panel.width}
        height={W.panel.height}
        topBand={W.panel.topBand}
        bottomBand={W.panel.bottomBand}
        titleTab
        dim
        testId="교체 창 판"
      />
      <img alt="" src={`${GAME_UI}/${pad(W.arrows.upImage)}.png`} style={{ ...pixel, left: W.arrows.x, top: W.arrows.upY[blinkOut ? 0 : 1] }} />
      <img alt="" src={`${GAME_UI}/${pad(W.arrows.downImage)}.png`} style={{ ...pixel, left: W.arrows.x, top: W.arrows.downY[blinkOut ? 0 : 1] }} />
      {/* 사람 팀 큰 로고 — 1.5 배 · 섞기 7/32 (0xbb91d 종류 0x12) */}
      <img
        alt=""
        src={`${TEAM_LOGO}/${pad(ourTeamId)}.png`}
        data-testid="교체 창 로고"
        style={{
          ...pixel,
          left: W.logo.centerX,
          top: W.logo.centerY,
          opacity: W.logo.opacity,
          transform: `translate(-50%, -50%) scale(${W.logo.scale})`,
        }}
      />
      <img
        alt={isPitcher ? '투수' : '타자'}
        src={`${IMG_TEXT_FRAMES}/${pad(isPitcher ? W.title.pitcherFrame : W.title.batterFrame)}.png`}
        style={{ ...pixel, ...paletteStyle, left: W.title.firstX, top: W.title.y }}
      />
      <img alt="교체" src={`${IMG_TEXT_FRAMES}/${pad(W.title.changeFrame)}.png`} style={{ ...pixel, left: W.title.secondX, top: W.title.y }} />
    </>
  )
}
