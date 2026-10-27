import { useEffect, useLayoutEffect, useRef } from 'react'
import { drawScenery } from '@/widgets/batting-stage/lib/renderScenery'
import { createDrawMemo } from '@/shared/lib/canvas/drawMemo'
import { effectContextOf } from '@/shared/lib/pixelEffect/pixelEffect'
import type { SceneryState } from '@/widgets/batting-stage/lib/renderScenery'
import { STAGE_HEIGHT, STAGE_WIDTH } from '@/widgets/batting-stage/lib/stageLayout'
import { gameSceneTickOf, gameSceneTimeOf } from '@/shared/lib/commonWindow/commonWindow'
import {
  createCloudFrameCursor, observeSceneCloudFrame, sceneCloudFrameOf, sceneScoreboardTickOf,
} from '@/widgets/batting-stage/model/sceneCloudClock'

/** 배경 고르기 `0x40ff0` 이 쓰는 구장 값 — 틱(구름 · 전광판 흐름)과 세로 밀기는 부르는 쪽이 따로 준다 */
export type SceneryBackdropStage = Omit<SceneryState, 'tick' | 'offsetY' | 'cloudCalls'>

/**
 * 배경 뒤에 같은 캔버스에 이어 그리는 장면 겹 — 인트로 0x417ac 의 띠 · 막대 · 글씨 · 점수판(효과 1 반투명이 이 배경 화면을 읽는다).
 * `key` 가 같으면 같은 그림이다(다시 그리기 건너뛰기 · 바뀐 커밋에서 곧바로 다시 칠하기에 쓴다)
 */
export interface SceneryOverlay {
  readonly key: string
  readonly draw: (context: CanvasRenderingContext2D) => void
}

interface SceneryBackdropProps {
  readonly stage: SceneryBackdropStage
  /** `0x78578(구장, y, …)` 의 y — 구장 · 바닥만 내린다(하늘 · 구름은 그대로) */
  readonly offsetY: number
  /** 배경 위에 같은 화면으로 이어 그리는 겹 (Q-03 r301 — 인트로 `GameIntro`). 없으면 배경만 */
  readonly overlay?: SceneryOverlay
}

/**
 * **배경 고르기 `0x40ff0(장면, y)` 한 장** — 타석 캔버스(`BattingStage`) 없이 하늘 · 구름 · 구장 · 바닥만 그린다.
 * 선수 · 공 · HUD · 파티클이 없는 장면(경기 시작 인트로 0x417ac)이 바탕으로 쓴다.
 *
 * - **구름**(r120): 인트로 그리기 0x417ac 는 구름을 안 흘리지만 **장면 공용 갱신 0x3f060**(52e16)이 3f2f6 에서 구름 흐르기
 *   0x78448 을 상태 0xc 갱신마다 부른다. 로딩 판(상태 9 갱신 0x3f584 가 3f594 에서 구름을 0 으로 둔 뒤 상태 8 두 그림)에서 이미 두 번
 *   셌으므로 인트로 첫 그림이 세 번째 부름이다 — 경기 장면 구름 셈(`sceneCloudClock`)을 이 판의 그림마다 센다.
 * - **전광판 글자**(0x77fb4)도 상태 7 · 8 · 9 를 뺀 그림마다 부르는 0x41230(413e6)이 흘린다 — 타석 화면과 같은 경기 장면 틱
 *   (`gameSceneTickOf`)으로 흘려 인트로에서 타석으로 넘어가도 이어진다(구장 +0x8c 는 장면 동안 남는 칸이다). 위상: 원본 +0x8c 는
 *   상태 7 의 구장 생성에서 0x77edc 가 시작값으로 두고 로딩(7 · 8 · 9) 뒤 첫 배경 그림부터 준다 — 웹도 이 장면에서 배경을 처음 그린
 *   장면 틱을 0 으로 센다(`sceneScoreboardTickOf`, 인트로가 있으면 인트로 첫 그림).
 * - 그림이 늦게 실리므로 그림이 실릴 때마다(`assetLoadVersion`) · 값이 바뀔 때마다 다시 칠한다.
 * - **좌우(`stage.side`)** — 구장 +0x60 은 인트로 진입 0x3b084 가 3b0f2~3b108 에서 공격 팀 지금 타자(0xae89d)의 손(0xb63c1)으로
 *   쓴다(직접 떴다). 0(우타)이면 펜스 · 바닥이 거울 길이다(`RIGHT_HANDED_MIRROR_X`). 부르는 쪽이 1회초 첫 타자(측 0 의 1번 —
 *   st[9] = 0 은 0xb6814, 팀[+0x32] = 0 은 상태 7 의 0 채운 새 팀 객체) 손을 넘긴다 — 팀 경기 `teamIntroBatterHandOf`(이어하기면
 *   되복사한 블록의 지금 공격 팀 다음 타자) · 투수편 `pitcherIntroBatterHandOf` · 타자편 `gameIntroBatterHandOf`.
 */
export function SceneryBackdrop({ stage, offsetY, overlay }: SceneryBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const latestRef = useRef({ stage, offsetY, overlay })
  latestRef.current = { stage, offsetY, overlay }
  /** 지금 곧바로 한 번 칠한다 — 겹이 바뀐 커밋에서 DOM 과 한 틀도 어긋나지 않게(아래 레이아웃 효과) */
  const drawNowRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    let frame = 0
    /** 구장 값 · 밀기 · 실린 그림이 바뀐 틀에서만 다시 칠한다(`createDrawMemo`) */
    const drawMemo = createDrawMemo()
    /** 구름 셈(`sceneCloudClock`)에서 이 판이 마지막으로 본 그림 — 인트로 0xc 는 갱신마다 센다 */
    const cloudCursor = createCloudFrameCursor()
    const paint = (rawNow: number) => {
      // 그림 번호는 경기 장면 시계라 공용 창이 서 있는 동안(52cc6 — 0x3f060 도 안 돈다)은 안 올라 세지 않는다
      const cloudCalls = observeSceneCloudFrame(sceneCloudFrameOf(rawNow), true, cloudCursor)
      let context: CanvasRenderingContext2D | null = null
      try {
        // 하늘 조명(0x67 더하기 겹)이 화면 칸을 읽는다 — 읽기 잦은 캔버스로 연다(`effectContextOf`)
        context = effectContextOf(canvasRef.current)
      } catch {
        context = null
      }
      if (context !== null) {
        const { stage: current, offsetY: y, overlay: over } = latestRef.current
        const sceneTick = gameSceneTickOf(gameSceneTimeOf(rawNow))
        const scenery = { ...current, tick: sceneTick, scoreboardTick: sceneScoreboardTickOf(sceneTick), cloudCalls, offsetY: y }
        if (drawMemo.needsDraw(canvasRef.current, { scenery, overlay: over?.key ?? null })) {
          drawScenery(context, scenery)
          over?.draw(context)
        }
      }
    }
    const draw = (rawNow: number) => {
      paint(rawNow)
      frame = requestAnimationFrame(draw)
    }
    drawNowRef.current = () => paint(performance.now())
    draw(performance.now())
    return () => {
      drawNowRef.current = null
      cancelAnimationFrame(frame)
    }
  }, [])

  // 겹이 바뀐 커밋 — 다음 틀을 기다리지 않고 칠한다(겹을 DOM 에서 캔버스로 옮기는 커밋에 빈 틀이 끼지 않게)
  const overlayKey = overlay?.key ?? null
  useLayoutEffect(() => {
    drawNowRef.current?.()
  }, [overlayKey])

  return (
    <canvas ref={canvasRef} width={STAGE_WIDTH} height={STAGE_HEIGHT} aria-hidden data-testid="구장-배경"
      data-stadium={stage.stadium} data-offset-y={offsetY} style={{ position: 'absolute', left: 0, top: 0 }} />
  )
}
