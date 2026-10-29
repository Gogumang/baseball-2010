import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import { useAnimations } from '@/shared/lib/sprite/useFrameOrigins'
import type { HolderMark, HolderPlate } from '@/entities/fielding/model/defenseView/holderMark'
import { HOLDER_PLATE_BOX, HOLDER_PLATE_FRAME, holderPlateLayoutOf, holderRingPointOf } from '@/pages/defense/lib/holderMarkLayout'
import { IMG_TEXT_FRAMES } from '@/widgets/matchup-cards/lib/matchupCardsLayout'
import * as styles from '@/pages/defense/ui/DefenseScreen.css'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const GAME_UI = assetUrl('./sprites/game_ui/frames')
const IMG_TEXT = assetUrl('./sprites/img_text/frames')
const pad = (frame: number) => String(frame).padStart(3, '0')

/**
 * 공 가진 야수 고리 + 오른쪽 아래 이름 판 (0x43cb0) — 그리기 0x46c88 의 0x46cbc.
 * 비거리 판(0x36cd4) 바로 뒤 · 야수 목록(0x43278) 앞에 **곧바로** 그리므로 야수 · 주자 · 공 밑에 깔린다.
 *
 * 애니 칸은 원본이 그릴 때마다 한 칸씩 넘긴다(0x93d91). 웹은 화면 갱신 수로 고른다 — 고리가 처음 뜬 칸에서
 * 시작하지 않을 수 있다(근사).
 * 이름 글자 색은 0xba411 이 지금 글꼴 색을 쓰는데 이 함수가 따로 정하지 않는다 — 흰색으로 둔다(근사).
 */
export function DefenseHolderMark({
  mark,
  plate,
  fielderPoint,
  update,
  screen,
}: {
  readonly mark: HolderMark
  readonly plate: HolderPlate | null
  /** 공 가진 야수의 화면점 — 야수 그림과 같은 투영 */
  readonly fielderPoint: { readonly x: number; readonly y: number } | null
  readonly update: number
  readonly screen: { readonly width: number; readonly height: number }
}) {
  const animations = useAnimations(GAME_UI)
  const step = animationStepAt(animations?.[mark.anim] ?? [], update)
  const ring = fielderPoint === null ? null : holderRingPointOf(fielderPoint)
  const layout = plate === null ? null : holderPlateLayoutOf(mark.slot, plate, screen)
  const labelSize = layout === null ? undefined : IMG_TEXT_FRAMES[layout.label]
  return (
    <>
      {ring !== null && step !== null && (
        <img
          className={styles.paintedSprite}
          style={{ left: ring.x + step.dx, top: ring.y + step.dy }}
          src={`${GAME_UI}/${pad(step.frame)}.png`}
          alt=""
          data-testid="수비-공고리"
          data-anim={mark.anim}
          data-frame={step.frame}
        />
      )}
      {layout !== null && (
        <div data-testid="수비-이름판" data-slot={mark.slot}>
          <img
            className={styles.paintedSprite}
            style={{ left: layout.plate.x, top: layout.plate.y }}
            src={`${GAME_UI}/${pad(HOLDER_PLATE_FRAME)}.png`}
            alt=""
          />
          <span
            className={styles.holderName}
            style={{ left: layout.plate.x, top: layout.plate.y, width: HOLDER_PLATE_BOX.width, height: HOLDER_PLATE_BOX.height }}
            data-testid="수비-이름"
          >
            {layout.name}
          </span>
          <img
            className={styles.paintedSprite}
            style={{ left: layout.chip.x, top: layout.chip.y }}
            src={`${GAME_UI}/${pad(layout.chipFrame)}.png`}
            alt=""
            data-testid="수비-칸아이콘"
            data-frame={layout.chipFrame}
          />
          {layout.labelAt !== null && labelSize !== undefined && (
            <img
              className={styles.paintedSprite}
              style={{ left: layout.labelAt.x + labelSize.x, top: layout.labelAt.y + labelSize.y }}
              src={`${IMG_TEXT}/${pad(layout.label)}.png`}
              alt=""
              data-testid="수비-칸글자"
              data-frame={layout.label}
            />
          )}
        </div>
      )}
    </>
  )
}
