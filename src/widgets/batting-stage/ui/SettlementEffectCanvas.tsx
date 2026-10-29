import type { RefObject } from 'react'
import { STAGE_HEIGHT, STAGE_WIDTH } from '@/widgets/batting-stage/lib/stageLayout'
import * as styles from '@/widgets/batting-stage/ui/SettlementEffectCanvas.css'

/** 판 안에 까는 효과 층 캔버스 한 장 (240×320 — 판과 같은 원본 좌표) */
export function SettlementEffectCanvas({ canvasRef }: { readonly canvasRef: RefObject<HTMLCanvasElement | null> }) {
  return <canvas ref={canvasRef} className={styles.layer} width={STAGE_WIDTH} height={STAGE_HEIGHT} aria-hidden />
}
