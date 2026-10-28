import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { homeRunPlaybackOf } from '@/features/defense-play/model/homeRunPlayback'
import { arrivalApplicationOf, type PitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { advance } from '@/features/play-pitcher-game/model/pitcherGameFlow/auto/advance'
import { applyDefensivePlay } from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/defensivePlay'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/** 인플레이가 아닌 타석 끝(삼진·볼넷·사구·홈런) — 0xae24c 의 보통 길 뒤 0x17(밀어내기)·정산 0xa8024 */
export function finishNonPlayOutcome(
  progress: PitcherGameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
  /** 이 공이 연 판 — 볼넷 · 사구 밀어내기 판(종류 2)이면 재생 칸에 넣는다(진루는 아래 보통 길과 같다) */
  arrival: PitchArrivalPlay | null = null,
): PitcherGameProgress {
  // 내가 던진 타석이면 홈런도 날아가는 그림을 보여 준다 — 득점·주자는 아래 길이 그대로 정한다
  const playback =
    homeRunPlaybackOf({ outcome, bases: progress.game.bases, outs: progress.game.outs }) ??
    (arrival !== null && arrivalApplicationOf(arrival) === 'freePass' ? arrival.result : null)
  // 삼진 + 도루 판(종류 5) — 판정 B 가 정산 0xa8024 를 종류 5 로 한 번 부른다(`stealPlaySettlement`)
  const stealPlaySettlement = arrival !== null && arrival.kind === 5 && outcome.kind === '삼진'
  // 삼진과 한 정산인 주자 판 — 도루(종류 5) · 삼진 그대로인 폭투·포일(종류 9, ae596 → ae5a6). 그 판의 아웃 사건 · 필살송구 표시도
  // 이 정산이 센다
  const settledRunnerPlay =
    arrival !== null && outcome.kind === '삼진' && (arrival.kind === 5 || (arrival.kind === 9 && arrival.strikeout === 'strikeoutStands'))
      ? arrival.result
      : undefined
  return advance(
    applyDefensivePlay(progress, outcome, true, progress.atBat.balls, null, playback, undefined, undefined, stealPlaySettlement, settledRunnerPlay),
    random,
  )
}
