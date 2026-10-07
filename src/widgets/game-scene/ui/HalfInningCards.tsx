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
 * **공수 교대 판의 두 팀 판 0x420dc("PITCHER") · 0x42364("DUE UP")** — 머리말은 `lib/halfInningCardsLayout`.
 * 점수판 틀 0x41440 뒤에 그린다(0x4ff16).
 */
export function HalfInningCards({ data }: { readonly data: HalfInningCardsData }) {
  const gameUiOrigins = useFrameOrigins(GAME_UI_FRAMES)
  const textOrigins = useFrameOrigins(IMG_TEXT_FRAMES)
  const at = halfInningCardsAt(data.battingSide)
  const pitcher = pitcherCardPlacementOf(at.pitcherX, HALF_INNING_CARDS_Y, data.count)
  const dueUp = dueUpCardPlacementOf(at.dueUpX, HALF_INNING_CARDS_Y, data.currentOrder)
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
      {dueUp.rows.map((row, index) => (
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
      {data.battingSide === 0 ? [dueUpCard, pitcherCard] : [pitcherCard, dueUpCard]}
    </div>
  )
}
