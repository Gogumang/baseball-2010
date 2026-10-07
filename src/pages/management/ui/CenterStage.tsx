import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import { useRecoloredSprite } from '@/shared/lib/sprite/paletteSwap'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { CENTER_STAGE, stageSlideOffsetAt } from '@/pages/management/lib/centerStage'
import type { StageCharacter } from '@/pages/management/lib/centerStage'
import * as styles from '@/pages/management/ui/ManagementScreen.css'

interface CenterStageProps {
  /** 그리는 차례대로 (시즌: 코치 → 감독) */
  readonly characters: readonly StageCharacter[]
  /** 0x8a2d8 을 거쳐 들어왔는가 — 참이면 x + 120 에서 미끄러져 들어온다 */
  readonly slidesIn?: boolean
}

/**
 * 가운데 판 0x7f814 — 경기장 띠 위(발 y 135, 136 줄 아래는 잘린다)에 서서 애니를 도는 인물들 (`lib/centerStage` 머리 주석).
 * 상태판 위 · 커맨드 줄 위에 그린다(공통 틀 0x9f60 · 0x19da4 의 차례).
 */
export function CenterStage({ characters, slidesIn = false }: CenterStageProps) {
  const update = useUpdateCounter()
  const offset = stageSlideOffsetAt(characters, update, slidesIn)
  return (
    <div className={styles.layer} data-testid="가운데판"
      style={{ left: 0, top: 0, width: 240, height: CENTER_STAGE.clipHeight, overflow: 'hidden', pointerEvents: 'none' }}>
      {characters.map((character) => (
        <StageSprite key={`${character.file}-${character.x}`} character={character} x={character.x + offset} update={update} />
      ))}
    </div>
  )
}

function StageSprite({ character, x, update }: { readonly character: StageCharacter; readonly x: number; readonly update: number }) {
  const folder = `./sprites/${character.file}/frames`
  const origins = useFrameOrigins(folder)
  const animations = useAnimations(folder)
  const entries = animations?.[character.animation]
  const step = entries === undefined ? null : animationStepAt(entries, update)
  const key = step === null ? '' : String(step.frame).padStart(3, '0')
  const origin = step === null ? undefined : origins?.[key]
  if (step === null || origin === undefined) return null
  return (
    <PaintedFrame key={key} url={`${folder}/${key}.png`} palette={character.palette}
      left={x + origin.x + step.dx} top={CENTER_STAGE.footY + origin.y + step.dy} />
  )
}

/** 프레임마다 따로 마운트한다 — `useRecoloredSprite` 가 앞 프레임 주소를 한 번 내보내지 않게 (EventPortraits 와 같다) */
function PaintedFrame({ url, palette, left, top }: {
  readonly url: string; readonly palette: number | null; readonly left: number; readonly top: number
}) {
  return <img className={styles.layer} style={{ left, top }} src={useRecoloredSprite(url, palette)} alt="" />
}
