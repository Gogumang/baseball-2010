import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useRecoloredSprite } from '@/shared/lib/sprite/paletteSwap'
import {
  ACE_BATTER_DEFENDER_FRAMES,
  ACE_PITCHER_DEFENDER_FRAMES,
  DEFENDER_FRAMES,
  FIELDER_FRAME_OFFSET,
  defenderPaletteIndexOf,
} from '@/pages/defense/lib/defenseView'
import type { TeamRelayFigures as TeamRelayFiguresValue } from '@/pages/team-game/lib/teamAutoRelay'

/** 화면 240×320 */
const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320

/** 기준점 — 425d8 r6 = W >> 1 · 425f2 r7 = (H >> 1) + 0x1e */
export const RELAY_FIGURES_CENTER = { x: SCREEN_WIDTH >> 1, y: (SCREEN_HEIGHT >> 1) + 0x1e } as const

/** 주자 자리 표 0xd0028 — 1루 (+87, −10) · 2루 (0, −80) · 3루 (−87, −10) */
export const RELAY_BASE_OFFSETS = [
  { x: 87, y: -10 },
  { x: 0, y: -80 },
  { x: -87, y: -10 },
] as const

/** 주자 프레임 — 0x79d10(…, 프레임 0) = defender 000 (앞보고 서기) */
const RUNNER_FRAME = 0
/** 투수 프레임 — 0x79b48(…, 프레임 0): 보통 · 타자 마선수 그림은 +17, 투수 마선수 그림(a ≠ 0)은 날값 */
const PITCHER_FRAME = 0
/** 포수 프레임 — 0x79b48(…, b, 0x49) → +17 = 90 (마스크 쓴 포수) */
const CATCHER_FRAME = 0x49
/** 포수 자리 — (W/2, 기준 y + 0x55) */
const CATCHER_DY = 0x55
/** 타자 — 좌타면 (W/2 + 0x16, 기준 y + 0x47) 에 프레임 7, 우타면 (W/2 − 0x16, …) 에 프레임 10 (0x79d10, 날값) */
const BATTER_DX = 0x16
const BATTER_DY = 0x47
const BATTER_LEFT_FRAME = 7
const BATTER_RIGHT_FRAME = 0xa

/**
 * 그림 한 장 — 기준점(크기 0 칸)에 원점(`origins.json`)만큼 비껴 놓는다. 팔레트 번호가 있으면 `defender.mpl` 그 벌로 칠한다.
 * 기준점 칸은 원점을 아직 못 읽었어도 선다(시험이 무엇을 그리는지 본다).
 */
function RelayFigure({
  folder,
  frame,
  paletteIndex,
  x,
  y,
  testId,
}: {
  readonly folder: string
  readonly frame: number
  readonly paletteIndex: number | null
  readonly x: number
  readonly y: number
  readonly testId: string
}) {
  const origins = useFrameOrigins(folder)
  const key = String(frame).padStart(3, '0')
  const origin = origins?.[key]
  return (
    <div data-testid={testId} data-frame={frame} data-folder={folder}
      style={{ position: 'absolute', left: x, top: y, width: 0, height: 0, pointerEvents: 'none' }}>
      {origin !== undefined && (
        // 칠한 주소는 그림마다 따로 마운트한다 — 바뀐 그 그리기에 앞 그림 주소가 비치지 않게 (`DefenseScreen` 의 PaintedSprite 와 같다)
        <PaintedImage key={`${folder}/${key}`} url={`${folder}/${key}.png`} paletteIndex={paletteIndex}
          left={origin.x} top={origin.y} />
      )}
    </div>
  )
}

function PaintedImage({
  url, paletteIndex, left, top,
}: {
  readonly url: string
  readonly paletteIndex: number | null
  readonly left: number
  readonly top: number
}) {
  return (
    <img alt="" src={useRecoloredSprite(url, paletteIndex)}
      style={{ position: 'absolute', left, top, imageRendering: 'pixelated', pointerEvents: 'none' }} />
  )
}

/**
 * **팀경기 0x21 운동장 그림** — 그리기 0x4258c 머리(425bc~42812, 2026-10-08 직접 뜸). 모드 ∈ {1, 2, 8, 9} · 속도 v(+0xbc) ≠ 2 일 때만
 * (`[sp+0x5c]`), 배경 위 · 점수판 아래에:
 * ```
 * 42634  주자가 있으면(0xa9598) i = 0..2: 0xa97a0(주자, i + 1) 이 있으면
 *          0x79d10([장면+0xf24], 주자+0x9c ≠ −1, 0, 0, W/2 + 표[i].x, 기준 y + 표[i].y)        ; 주자 프레임 0
 * 426d0  수비 팀 지금 투수 0xae83c(팀[st[10]]) 가 있으면
 *          0x79b48([장면+0xf20], 0xb633c(투수), 0, 0, 0, W/2, 기준 y)                          ; 투수 프레임 0
 *        그리고 [장면+0x1120](포수) 가 있으면
 *          0x79b48([장면+0xf20], 0, 0xb633c(포수+0xec), 0x49, 0, W/2, 기준 y + 0x55)          ; 포수 프레임 0x49
 * 4278a  공격 팀 지금 타자 0xae89c(팀[st[9]]) 가 있으면
 *          0x79d10([장면+0xf24], 0xb633c(타자), 좌타 ? 7 : 10, 0, W/2 ± 0x16, 기준 y + 0x47)      ; 0xb63c0 좌타면 +
 * ```
 * 0x79d10(주자 그리기)은 프레임을 그대로, 0x79b48(야수 그리기)은 +17(투수 마선수 갈래 a ≠ 0 만 날값) — S12 4 · 8절.
 * 마선수 갈래는 그림 객체의 마선수 그림(+0x1c 타자 · +0x28 투수)을 팔레트 없이, 아니면 defender.pzx 를 그 객체 팀 벌로 칠한다.
 *
 * ⚠️ 미이식: 마선수 주자(주자 +0x9c ≠ −1) — 웹 루 칸이 누가 섰는지 안 들어 보통 그림으로 그린다. 그림 객체의 마선수 칸은
 * 하나라(적재 0x47cc8 · 갱신 0x48480 의 sim+0xa4) 원본은 마선수 주자를 그때 걸린 마타자 그림으로 그린다.
 */
export function TeamRelayFigures({ figures }: { readonly figures: TeamRelayFiguresValue }) {
  const center = RELAY_FIGURES_CENTER
  const offensePalette = defenderPaletteIndexOf(figures.offenseTeam)
  const defensePalette = defenderPaletteIndexOf(figures.defenseTeam)
  const batter = figures.batter
  const pitcherAce = figures.pitcherAce
  return (
    <>
      {RELAY_BASE_OFFSETS.map((offset, index) =>
        figures.bases[index] ? (
          <RelayFigure key={`base-${index}`} testId={`중계-주자-${index + 1}`} folder={DEFENDER_FRAMES} frame={RUNNER_FRAME}
            paletteIndex={offensePalette} x={center.x + offset.x} y={center.y + offset.y} />
        ) : null,
      )}
      {pitcherAce !== null && (
        <>
          {pitcherAce >= 0 ? (
            <RelayFigure testId="중계-투수" folder={ACE_PITCHER_DEFENDER_FRAMES[pitcherAce] ?? DEFENDER_FRAMES}
              frame={PITCHER_FRAME} paletteIndex={null} x={center.x} y={center.y} />
          ) : (
            <RelayFigure testId="중계-투수" folder={DEFENDER_FRAMES} frame={PITCHER_FRAME + FIELDER_FRAME_OFFSET}
              paletteIndex={defensePalette} x={center.x} y={center.y} />
          )}
          <RelayFigure testId="중계-포수"
            folder={figures.catcherAce >= 0 ? ACE_BATTER_DEFENDER_FRAMES[figures.catcherAce] ?? DEFENDER_FRAMES : DEFENDER_FRAMES}
            frame={CATCHER_FRAME + FIELDER_FRAME_OFFSET} paletteIndex={figures.catcherAce >= 0 ? null : defensePalette}
            x={center.x} y={center.y + CATCHER_DY} />
        </>
      )}
      {batter !== null && (
        <RelayFigure testId="중계-타자"
          folder={batter.aceIndex >= 0 ? ACE_BATTER_DEFENDER_FRAMES[batter.aceIndex] ?? DEFENDER_FRAMES : DEFENDER_FRAMES}
          frame={batter.isLeft ? BATTER_LEFT_FRAME : BATTER_RIGHT_FRAME}
          paletteIndex={batter.aceIndex >= 0 ? null : offensePalette}
          x={center.x + (batter.isLeft ? BATTER_DX : -BATTER_DX)} y={center.y + BATTER_DY} />
      )}
    </>
  )
}
