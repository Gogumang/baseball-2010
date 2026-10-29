import { useEffect, useRef } from 'react'
import { warmStageCast } from '@/widgets/batting-stage/lib/renderBattingStage'
import { warmFieldBackground } from '@/widgets/batting-stage/lib/spriteLoader'
import type { StageWarmCast } from '@/widgets/batting-stage/lib/renderBattingStage'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'

/** 원점 · 팔레트를 기다리는 동안 다시 걸어 보는 간격 (ms) — 그리기 · 경기 틱과는 상관없다 */
const WARM_RETRY_MS = 100

/**
 * 타석 그림이 **아직 서지 않은 동안**(경기 화면 · 반 이닝 판 · 수비 화면 · 결과 판) 곧 설 선수들의 칠하기를 미리 건다.
 * 원본은 타석 교대 0x47cc8 이 적재(타자 0x78ab0 · 투수 0x793b0) 때 팔레트를 갈아 끼워 교대 직후 첫 그림부터 제 색이다 —
 * 웹 타석 캔버스는 새로 설 때 첫 그림에서야 칠하기를 걸어 한 박자 구운 벌이 비쳤다. 경기 화면처럼 경기 내내 붙어 있는 자리에서
 * 부른다. 원점 · 팔레트가 아직 안 왔으면 올 때까지 다시 건다(다 걸면 멈춘다). 그림 · 차례 · 난수는 안 건드린다
 */
export function useWarmStageCast(cast: StageWarmCast | null): void {
  const castRef = useRef(cast)
  useMirrorRef(castRef, cast)
  const key = cast === null ? '' : JSON.stringify(cast)
  useEffect(() => {
    if (key === '' || warmStageCast(castRef.current)) return undefined
    const timer = setInterval(() => {
      if (warmStageCast(castRef.current)) clearInterval(timer)
    }, WARM_RETRY_MS)
    return () => clearInterval(timer)
  }, [key])
}

/**
 * 바닥 잔디(attack/000 · `stadium/attack.mpl` 줄)를 타석이 서기 전에 미리 칠한다 (`warmFieldBackground`). 원본은 구장 객체 적재 때
 * 팔레트를 갈아 끼워 첫 그림부터 제 색이다. `palette.json` 이 올 때까지 다시 건다
 */
export function useWarmFieldBackground(paletteIndex: number | null): void {
  useEffect(() => {
    if (warmFieldBackground(paletteIndex)) return undefined
    const timer = setInterval(() => {
      if (warmFieldBackground(paletteIndex)) clearInterval(timer)
    }, WARM_RETRY_MS)
    return () => clearInterval(timer)
  }, [paletteIndex])
}
