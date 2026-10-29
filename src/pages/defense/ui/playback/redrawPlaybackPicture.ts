import type { DefenseViewState } from '@/entities/fielding/model/defenseView/defenseViewState'
import { redrawnFieldingErrorsOf, type DrawnFieldingError } from '@/features/defense-play/model/fieldingErrors'
import { drawBallParticles, type BallParticleRun } from '@/pages/defense/ui/playback/ballParticleRun'
import type { CameraOffset } from '@/pages/defense/ui/playback/playbackClock'
import { redrawRecordedBoard, type RecordedBoardTally } from '@/pages/defense/ui/playback/recordedBoardTally'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 재생 · 주자 판 갈래의 창 첫 그림 — 마지막으로 그린 갱신(`tally.nextIndex − 1`)의 그림을 한 번 더: 공 그리기 0x36dfc 파티클을 다시
 * 쏘고(창이 서 있어 파티클 틱은 없다), 판 틱 그림이면 야수 그리기 0x43278 이 실책 +0x2e 를 한 번 더 올린다(4381a~43904 — 줄이는 야수 틱은
 * 갱신 쪽이라 원본도 두 번 센다), 득점 점수판 타이머를 한 번 더 줄인다.
 * ⚠️ 이 갈래의 판정 글자 · 연출(0x46844 …)은 진행기가 미리 그림에 얹어 둔 것이라 한 칸 더 넘기지 않는다(근사)
 */
export function redrawPlaybackPicture(
  holder: { tally: RecordedBoardTally },
  ticks: readonly DefenseViewState[],
  isHomeRunOf: (view: DefenseViewState) => boolean,
  run: BallParticleRun,
  cameraOffset: CameraOffset,
  random: RandomPort | undefined,
  drawnErrors: DrawnFieldingError[],
): void {
  if (holder.tally.ended || holder.tally.nextIndex === 0 || ticks.length === 0) return
  const lastIndex = ticks.length - 1
  const at = holder.tally.nextIndex - 1
  const view = ticks[Math.min(at, lastIndex)]
  if (view === undefined) return
  if (random !== undefined) drawBallParticles(run, view, cameraOffset, random, null)
  // 고침(B-56): 다시 그린 그림은 실책을 또 세지 않는다 (`redrawnFieldingErrorsOf`)
  if (at <= lastIndex) drawnErrors.push(...redrawnFieldingErrorsOf(view.fielders))
  holder.tally = redrawRecordedBoard(holder.tally, isHomeRunOf(view))
}
