import type { StealBase } from '@/entities/fielding/model/stealStart'
import { stealPlayRecordIdsOf } from '@/entities/game/model/gameRecords'
import type { PitchArrivalPlay } from '@/features/defense-play/model/pitchArrival/pitchArrivalTypes'
import type { StealPlayResult } from '@/features/defense-play/model/stealPlay'

/** 도루 판 정산 — 잡힌 도루 주자가 있으면 24 한 번, 아니면 루를 옮긴 도루 주자마다 8 */
export function stealRecordIdsOf(result: Pick<StealPlayResult, 'stolenFrom' | 'caughtFrom'>): number[] {
  const runner = (fromBase: StealBase, safe: boolean) => ({
    stealStarted: true,
    fromBase,
    currentBase: safe ? fromBase + 1 : fromBase,
    targetBase: fromBase + 1,
    finished: true,
    safe,
  })
  return stealPlayRecordIdsOf({
    isRunnerPlay: true,
    runners: [...result.caughtFrom.map((from) => runner(from, false)), ...result.stolenFrom.map((from) => runner(from, true))],
  })
}

/**
 * 판이 끝난 뒤 타석 결과를 어떻게 먹이나 — 부르는 진행기 공용 규칙.
 * - `'runnerOnly'`: 판의 advance 를 주자 판(견제와 같은 꼴, 타순 그대로)으로 먼저 먹이고, 타석이 끝났으면
 *   (삼진) 그 뒤 보통 길로 타석 결과를 먹인다.
 * - `'batterRuns'`: 낫아웃 — 판의 advance 가 곧 이 타석의 진루다(타자주자 포함). 삼진 기록은 그대로.
 * - `'freePass'`: 볼넷 · 사구 밀어내기 판(종류 2) — advance 를 먹이지 않는다. 타석 결과(볼넷 · 사구)를 보통 길로 먹이면
 *   진루가 판과 같다(판정 B → 정산 0xa8024 → 0xd). 판은 재생 칸에만 넣는다.
 *
 * 판에서 3아웃이 나는 것은 볼·스트라이크(카운트만 오른 공)뿐이다 — 판정 B 0xae3e8 이 0x18 로 보내 그 타석은 끊긴다
 * (다음 이닝 같은 타자부터 — 정산 0xa8024 는 0xaf020(다음 타자 예약)을 안 부르고, 판 끝 0x35108 이 35138~3515e 에서
 * 판 종류 [+0x118] ∈ {4, 5, 8} 이면 0xaf020 을 건너뛴다(9 는 [0x1552d0c]+0xc == 5 일 때만 민다)). 삼진은 판 앞에서 아웃이 붙고
 * (위 머리말), 볼넷·사구는 도루 판이 안 열린다.
 */
export function arrivalApplicationOf(play: PitchArrivalPlay): 'runnerOnly' | 'batterRuns' | 'freePass' {
  if (play.kind === 2) return 'freePass'
  return play.kind === 9 && play.strikeout === 'batterRuns' ? 'batterRuns' : 'runnerOnly'
}
