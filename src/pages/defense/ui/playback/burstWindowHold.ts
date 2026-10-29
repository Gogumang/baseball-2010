import type { DefenseViewState } from '@/entities/fielding/model/defenseView/defenseViewState'
import { clearBallParticles, drawBallParticles, type BallParticleRun } from '@/pages/defense/ui/playback/ballParticleRun'
import { MAX_CLOSED_CATCH_UP, type CameraOffset } from '@/pages/defense/ui/playback/playbackClock'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 돌발 창 0x1c 동안 이어 그리는 판 — 어느 판인가 · 마지막으로 그린 갱신 */
export interface BurstWindowHold<K> {
  readonly key: K
  lastUpdate: number
}

/**
 * **0x1c 에 들었나** (`DefensePlaybackProps.burstWindow`) — 판이 끝났고(0x35108) 창을 받았으면 그 판의 첫 0x1c 그림에서 칸을 세운다.
 * 0x35108 이 치운 파티클(`clearBallParticles`)은 그 뒤 그림의 공 그리기 0x36dfc 가 다시 쏘므로 쏘기를 다시 연다. 판이 바뀌거나 창이 없으면 null
 */
export function burstWindowHoldOf<K>(
  ref: { current: BurstWindowHold<K> | null },
  key: K,
  holds: boolean,
  run: BallParticleRun,
  update: number,
): BurstWindowHold<K> | null {
  if (!holds) return null
  if (ref.current === null || ref.current.key !== key) {
    // 0x35108 이 이미 치웠다(판이 끝난 그림) — 그 뒤 0x1c 그림부터 다시 쏜다
    clearBallParticles(run)
    run.cleared = false
    ref.current = { key, lastUpdate: update }
  }
  return ref.current
}

/**
 * 0x1c 그림들 — 갱신(0x3afd4 = 창 0x8e5b8)은 판을 안 건드리고, 그리기 0x46ee0 → 0x46c88 이 마지막 판 그림의 공을 다시 그려(0x36dfc) 파티클을
 * 쏘고 프레임 끝 0x6de85 가 굴린다(경기 난수 — 창이 공용 창이 아니라 53048 이 안 닫힌다). 건너뛴 갱신은 닫힌 갱신과 같은 상한까지 따라잡는다
 */
export function drawBurstWindowFrames(
  hold: BurstWindowHold<unknown>,
  run: BallParticleRun,
  drawn: DefenseViewState | undefined,
  cameraOffset: CameraOffset,
  random: RandomPort,
  update: number,
  updateStartTick: number | null,
): void {
  const frames = Math.min(update - hold.lastUpdate, MAX_CLOSED_CATCH_UP)
  hold.lastUpdate = update
  for (let frame = 0; frame < frames; frame += 1) {
    const sceneTick = updateStartTick === null ? null : updateStartTick + update - (frames - 1 - frame)
    drawBallParticles(run, drawn, cameraOffset, random, sceneTick)
  }
}
