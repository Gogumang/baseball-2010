import { useEffect, useRef } from 'react'
import { useAnimations, useFrameOrigins, type FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import { aceCutInDraws, aceCutInPortraitOf } from '@/features/play-game/model/aceCutIn'
import * as styles from '@/features/play-game/ui/SubstitutionSceneOverlay.css'
import { effectContextOf } from '@/shared/lib/pixelEffect/pixelEffect'
import { drawCutIn, GAME_UI_FRAMES, SCREEN_HEIGHT, SCREEN_WIDTH, type Portrait } from '@/features/play-game/ui/aceCutInCanvas/drawCutIn'

const DRAWS = aceCutInDraws()

/** 초상 그림 칸 — 애니가 아직이면 프레임 없음 */
function cutInPortraitOf(folder: string, origins: FrameOrigins | null, step: ReturnType<typeof animationStepAt> | null): Portrait {
  if (step === null) return { folder, origins, frame: null, dx: 0, dy: 0 }
  return { folder, origins, frame: step.frame, dx: step.dx, dy: step.dy }
}

interface AceCutInCanvasProps {
  /** 0x16 의 몇 번째 그림인가 (0 부터) */
  readonly draw: number
  /** 컷인 번호 — 투수 0~4 · 타자 5~9 (표 0xd0108) */
  readonly aceSlot: number
}

/**
 * **마선수 등장 컷인 `0x473f0`** (`features/play-game/model/aceCutIn`) — "CHANGE" 애니 위에 띠 · 배너 · 사선 · 초상을 그린다.
 * 원본처럼 픽셀 단위 채우기(스캔라인) · 선 · 더하기 그림을 캔버스에 찍는다.
 */
export function AceCutInCanvas({ draw, aceSlot }: AceCutInCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const uiOrigins = useFrameOrigins(GAME_UI_FRAMES)
  const portraitSource = aceCutInPortraitOf(aceSlot)
  const portraitFolder = portraitSource?.folder ?? `${GAME_UI_FRAMES}`
  const portraitOrigins = useFrameOrigins(portraitFolder)
  const portraitAnimations = useAnimations(portraitFolder)
  const entries = portraitSource === null ? undefined : portraitAnimations?.[portraitSource.animation]
  // 0x93cfd(초상, 1) 로 처음부터 건 뒤 0x93c45(그리기)만 — 칸을 넘기지 않아 첫 칸에 선다
  const step = entries === undefined ? null : animationStepAt(entries, 0)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = effectContextOf(canvas)
    const current = DRAWS[Math.min(Math.max(0, draw), DRAWS.length - 1)]
    if (context === null || current === undefined) return
    drawCutIn(context, current, uiOrigins, cutInPortraitOf(portraitFolder, portraitOrigins, step))
  })

  return <canvas ref={canvasRef} className={styles.stage} width={SCREEN_WIDTH} height={SCREEN_HEIGHT} data-testid="마선수컷인" data-draw={draw} />
}
