import { useEffect, useRef } from 'react'
import { drawScenery } from '@/widgets/batting-stage/lib/renderScenery'
import type { SceneryState } from '@/widgets/batting-stage/lib/renderScenery'
import { STAGE_HEIGHT, STAGE_WIDTH } from '@/widgets/batting-stage/lib/stageLayout'

/** 배경 고르기 `0x40ff0` 이 쓰는 구장 값 — 틱(구름 · 전광판 흐름)과 세로 밀기는 부르는 쪽이 따로 준다 */
export type SceneryBackdropStage = Omit<SceneryState, 'tick' | 'offsetY'>

interface SceneryBackdropProps {
  readonly stage: SceneryBackdropStage
  /** `0x78578(구장, y, …)` 의 y — 구장 · 바닥만 내린다(하늘 · 구름은 그대로) */
  readonly offsetY: number
}

/**
 * **배경 고르기 `0x40ff0(장면, y)` 한 장** — 타석 캔버스(`BattingStage`) 없이 하늘 · 구름 · 구장 · 바닥만 그린다.
 * 선수 · 공 · HUD · 파티클이 없는 장면(경기 시작 인트로 0x417ac)이 바탕으로 쓴다.
 *
 * - 구름 흐르기 `0x78448` 은 부르는 장면이 따로 부를 때만 돈다 — 인트로 그리기 0x417ac 는 안 부르므로 구름은 제자리(틱 0)다.
 *   ⚠️ 미확인: 구름 자리(구장 +0x1c)는 구장 객체가 들고 있는 값이라 그 앞 장면의 흐름을 이어받는다 — 웹은 첫 자리(틱 0)로 둔다.
 * - 그림이 늦게 실리므로 그림마다 다시 칠한다(`MatchInfoStadiumBackdrop` 과 같은 방법).
 * - **좌우(`stage.side`)** — 구장 +0x60 은 인트로 진입 0x3b084 가 3b0f2~3b108 에서 공격 팀 지금 타자(0xae89d)의 손(0xb63c1)으로
 *   쓴다(직접 떴다). 0(우타)이면 펜스 · 바닥이 거울 길이다(`RIGHT_HANDED_MIRROR_X`). 부르는 쪽이 1회초 첫 타자 손을 넘긴다 —
 *   팀 경기(`teamIntroBatterHandOf`)만 넘기고, ⚠️ 투수편(모드 3) · 타자편(모드 4) 인트로는 아직 안 넘겨 좌타 배치로 그린다.
 */
export function SceneryBackdrop({ stage, offsetY }: SceneryBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const latestRef = useRef({ stage, offsetY })
  latestRef.current = { stage, offsetY }

  useEffect(() => {
    let frame = 0
    const draw = () => {
      let context: CanvasRenderingContext2D | null = null
      try {
        context = canvasRef.current?.getContext('2d') ?? null
      } catch {
        context = null
      }
      if (context !== null) {
        const { stage: current, offsetY: y } = latestRef.current
        drawScenery(context, { ...current, tick: 0, offsetY: y })
      }
      frame = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <canvas ref={canvasRef} width={STAGE_WIDTH} height={STAGE_HEIGHT} aria-hidden data-testid="구장-배경"
      data-stadium={stage.stadium} data-offset-y={offsetY} style={{ position: 'absolute', left: 0, top: 0 }} />
  )
}
