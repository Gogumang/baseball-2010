import { FrameSprite } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { roundPlateRectsOf } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import {
  CARD_PLATE_COLOR, HALF_INNING_CARDS_Y, dueUpCardPlacementOf, halfInningCardsAt, pitcherCardPlacementOf,
} from '@/widgets/game-scene/lib/halfInningCardsLayout'
import type { CardBox, PitcherCount } from '@/widgets/game-scene/lib/halfInningCardsLayout'
import * as styles from '@/widgets/game-scene/ui/GameScene.css'

const GAME_UI = './sprites/game_ui'
const GAME_UI_FRAMES = './sprites/game_ui/frames'
const IMG_TEXT_FRAMES = './sprites/img_text/frames'
const NUM = './sprites/num'

const pad = (index: number) => String(index).padStart(3, '0')

export interface HalfInningCardsData {
  /** st[9] — 지금(새로) 공격하는 측. 0(초)이면 왼쪽이 DUE UP */
  readonly battingSide: number
  /** st[4] · st[5] · st[6] — 보통의 교대 판은 0x3ac90 이 지워 모두 0 */
  readonly count: PitcherCount
  /** 수비 팀 지금 투수 이름 0xb62c0(0xae83c(팀[st[0xa]])). 모르면 null — 글을 안 쓴다 */
  readonly pitcherName: string | null
  /** 공격 팀 지금 타순 칸 팀[+0x32] (0~8) */
  readonly currentOrder: number
  /** 줄 0~2 의 이름 0xb62c0(0xae914(팀, i)) — 타순 칸 `dueUpLineupSlotOf(currentOrder, i)` 의 선수. 모르면 null */
  readonly dueUpNames: readonly (string | null)[]
}

function Plate({ box }: { readonly box: CardBox }) {
  return (
    <>
      {roundPlateRectsOf(box).map((rect, part) => (
        <span key={part} className={styles.block} style={{
          left: rect.x, top: rect.y, width: rect.width, height: rect.height, background: CARD_PLATE_COLOR,
        }} />
      ))}
    </>
  )
}

function NameText({ box, name, testId }: { readonly box: CardBox; readonly name: string | null; readonly testId: string }) {
  if (name === null) return null
  return (
    <span className={styles.cardName} data-testid={testId} style={{ left: box.x, top: box.y, width: box.width }}>
      {name}
    </span>
  )
}

/**
 * 두 판의 자리를 따로 줄 때 — 자동진행 중계 0x21 그리기 0x4258c 는 0x420dc 를 (W/2 − 상자폭/2 − 6, H − 70), 0x42364 를
 * (W/2 + 0x24, H − 70) 에 **이 차례로** 그린다(공격 측을 안 본다, 42864 · 42896).
 */
export interface HalfInningCardsAt {
  readonly pitcherX: number
  readonly dueUpX: number
  readonly y: number
}

/**
 * **공수 교대 판의 두 팀 판 0x420dc("PITCHER") · 0x42364("DUE UP")** — 머리말은 `lib/halfInningCardsLayout`.
 * 점수판 틀 0x41440 뒤에 그린다(0x4ff16). `at` 을 주면 그 자리에 PITCHER → DUE UP 차례로 그린다(0x21 중계).
 * `isGameOver`(0xb68fc) 면 0x420dc 는 점을(42252), 0x42364 는 세 줄을(42450) 안 그린다.
 */
export function HalfInningCards({ data, at: fixedAt, isGameOver = false }: {
  readonly data: HalfInningCardsData
  readonly at?: HalfInningCardsAt
  readonly isGameOver?: boolean
}) {
  const gameUiOrigins = useFrameOrigins(GAME_UI_FRAMES)
  const textOrigins = useFrameOrigins(IMG_TEXT_FRAMES)
  const at = fixedAt ?? { ...halfInningCardsAt(data.battingSide), y: HALF_INNING_CARDS_Y }
  const pitcher = pitcherCardPlacementOf(at.pitcherX, at.y, isGameOver ? { strikes: 0, balls: 0, outs: 0 } : data.count)
  const dueUp = dueUpCardPlacementOf(at.dueUpX, at.y, data.currentOrder)
  const dueUpRows = isGameOver ? [] : dueUp.rows
  // 그리는 차례: 초면 0x42364 → 0x420dc, 말이면 0x420dc → 0x42364 (왼쪽 먼저)
  const pitcherCard = (
    <div key="pitcher" data-testid="교대판-투수" data-x={at.pitcherX}>
      {pitcher.plates.map((box, index) => <Plate key={index} box={box} />)}
      <FrameSprite folder={IMG_TEXT_FRAMES} frame={pitcher.title.frame} origins={textOrigins}
        x={pitcher.title.x} y={pitcher.title.y} />
      {pitcher.frames.map((frame) => (
        <FrameSprite key={frame.frame} folder={GAME_UI_FRAMES} frame={frame.frame} origins={gameUiOrigins}
          x={frame.x} y={frame.y} />
      ))}
      {pitcher.images.map((image, index) => (
        <img key={index} className={styles.sprite} alt="" data-image={image.image}
          src={`${GAME_UI}/${pad(image.image)}.png`} style={{ left: image.x, top: image.y }} />
      ))}
      <NameText box={pitcher.name} name={data.pitcherName} testId="교대판-투수이름" />
    </div>
  )
  const dueUpCard = (
    <div key="dueUp" data-testid="교대판-타자" data-x={at.dueUpX}>
      {dueUp.plates.map((box, index) => <Plate key={index} box={box} />)}
      <FrameSprite folder={IMG_TEXT_FRAMES} frame={dueUp.title.frame} origins={textOrigins}
        x={dueUp.title.x} y={dueUp.title.y} />
      <FrameSprite folder={GAME_UI_FRAMES} frame={dueUp.frame.frame} origins={gameUiOrigins}
        x={dueUp.frame.x} y={dueUp.frame.y} />
      {dueUpRows.map((row, index) => (
        <span key={index} data-testid={`교대판-타순-${index}`} data-order={row.order}>
          {row.digits.map((digit, part) => (
            <img key={part} className={styles.sprite} alt="" src={`${NUM}/${pad(digit.image)}.png`}
              style={{ left: digit.x, top: digit.y }} />
          ))}
          <NameText box={row.name} name={data.dueUpNames[index] ?? null} testId={`교대판-타자이름-${index}`} />
        </span>
      ))}
    </div>
  )
  return (
    <div className={styles.cardLayer}>
      {fixedAt === undefined && data.battingSide === 0 ? [dueUpCard, pitcherCard] : [pitcherCard, dueUpCard]}
    </div>
  )
}
