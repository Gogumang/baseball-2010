import { useEffect, useRef, useState } from 'react'
import { emitParticles } from '@/entities/particle/model/particleScene'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'
import { useTouchKeyOffer } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import type { TouchKeyOffer } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { sceneParticleScene } from '@/widgets/particles/model/sceneParticles'
import { particleConfigOf } from '@/widgets/particles/lib/particleCatalog'
import { STAGE_HEIGHT, STAGE_WIDTH } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { EmitSceneParticle } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideLoop'
import type { PitcherSideStageProps } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideProps'
import { startPitcherSideLoop } from '@/widgets/batting-stage/model/pitcherSideLoop/startPitcherSideLoop'
import { useBatterEquipmentPreload } from '@/widgets/batting-stage/model/pitcherSideLoop/useBatterEquipmentPreload'
import * as styles from '@/widgets/batting-stage/ui/PitcherSideStage.css'

/** 큰 타구 건너뛰기 상황 버튼 — OK(Enter) */
const HIT_SKIP_OFFER: TouchKeyOffer = { key: 'Enter', label: '넘기기' }

/** 장면 파티클 칸에 쏜다 — 파티클 칸 · 설정 표가 다른 조각(`widgets/particles`)이라 루프에 묶어 넘긴다 */
const emitSceneParticle: EmitSceneParticle = (id, x, y, img) => {
  emitParticles(sceneParticleScene(), particleConfigOf(id), x, y, img)
}

/**
 * **사람이 던지는 타석의 캔버스 장면** — 타자편 `BattingStage` 와 같은 그리기(`renderBattingStage`)로 구장 · 하늘 · 관중 ·
 * 투수 · 타자 · 주자 · HUD · 존 · 소프트키를 그린다 (`lib/pitcherSideStage` 머리말: 0x52c50 의 그리기 표는 모드를 안 가린다).
 * 공 판정 · 스윙 키는 받지 않는다 — 진행기가 이미 정한 공을 그림으로만 다시 날린다(굴림 없음). 루프 한 틀의 차례는
 * `model/pitcherSideLoop/startPitcherSideLoop` 가 든다 — 이 부품은 루프를 세우고 거두는 때만 정한다.
 *
 * 구질 목록 · 조준 · 게이지는 `inputOverlayRef` 로 받아 장면 안에 그린다 · "#TIME" 은 `timeKeyCount` ·
 * 필살 남은 횟수(0x38a30)는 사람 수비면 원본도 안 그린다(38a42).
 * CPU 타자는 `cpuSwing` 의 스윙 프레임에 닿은 틱부터 스윙(번트면 번트) 자세다.
 */
export function PitcherSideStage(props: PitcherSideStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const latestRef = useRef(props)
  useMirrorRef(latestRef, props)
  /**
   * 터치 기기 — 큰 타구 0x13 을 OK 로 건너뛸 수 있는 동안(`hitSkipKey` 와 같은 조건)만 '넘기기' 상황 버튼을 띄운다
   */
  const [offersHitSkip, setOffersHitSkip] = useState(false)
  useTouchKeyOffer(offersHitSkip ? HIT_SKIP_OFFER : null)
  useBatterEquipmentPreload(props)
  useEffect(() => startPitcherSideLoop({ canvasRef, latestRef, offerHitSkip: setOffersHitSkip, emitParticle: emitSceneParticle }), [])

  return (
    <div className={styles.frame}>
      <canvas ref={canvasRef} className={styles.canvas} width={STAGE_WIDTH} height={STAGE_HEIGHT} />
      {props.children}
    </div>
  )
}
