import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { recordBatterAtBat } from '@/entities/game/model/batterGameLog'
import { backToBackRecordOf } from '@/entities/game/model/gameRecords'
import type { GameProgress } from '@/features/play-game/model/gameFlow'

/** 사람 장면의 공 하나에 붙는 플레이 기록 — 8 도루 성공(주자 판) · 32·33 연속 파울. 자동 타석(0x21)에서는 안 나온다 */
const HUMAN_PLAY_RECORD_IDS: ReadonlySet<number> = new Set([8, 32, 33])

/**
 * 내 타석 하나가 쌓은 기록 수 — 진행기 `finishPlayerOutcome` 이 `recordBatterAtBat` + 백투백(0xa794c) 으로 낸 몫.
 * 웹 진행기가 그 수를 따로 안 들고 있어 **내 성적 칸의 증분**에서 결과를 되짚어 같은 함수로 다시 센다(굴림 없음).
 * 기록이 갈리는 것은 안타 루타 · 홈런 · 볼넷 · 타점뿐이라 그 밖 결과(아웃 · 삼진 · 사구)는 0 이다.
 */
export function myAtBatRecordCountOf(before: GameProgress, after: GameProgress): number {
  const was = before.myStats
  const now = after.myStats
  if (now.plateAppearances === was.plateAppearances) return 0
  const outcome: AtBatOutcome | null =
    now.homeRuns > was.homeRuns
      ? { kind: '홈런' }
      : now.hits > was.hits
        ? { kind: '안타', bases: now.triples > was.triples ? 3 : now.doubles > was.doubles ? 2 : 1 }
        : now.walks > was.walks
          ? { kind: '볼넷' }
          : null
  if (outcome === null) return 0
  const recorded = recordBatterAtBat(
    { stats: was, consecutiveHits: before.consecutiveHits },
    outcome,
    now.runsBattedIn - was.runsBattedIn,
  )
  const backToBack = backToBackRecordOf({
    streak: before.homeRunStreak,
    humanOffense: true,
    isHomeRun: outcome.kind === '홈런',
  })
  return recorded.recordIds.length + backToBack.recordIds.length
}

/**
 * **타자편 공 끝에 칸으로 옮길 몫** — `useRecordAlert` 의 `pitchEnd.humanCountOf`.
 *
 * 웹 진행기는 내 공 하나(주자 판 · 연속 파울 · 내 타석 정산)와 그 뒤 자동진행(0x21 — 동료 타석 · 상대 공격)을 한 걸음에
 * 몰아 돌려 `recordIds` 에 [주자 판 8 · 파울 32/33][내 타석 몫][자동 타석 몫] 차례로 붙인다. 원본은 자동 타석 몫이 0x12 · 0x17
 * 을 안 지나 줄에 남았다가 다음 사람 공 끝에 뜬다 — 그래서 앞의 두 몫만 이번 공 끝 몫이다.
 * `before` 는 알림이 지난번에 본 진행, `after` 는 이번에 넘기는 진행이다.
 */
export function batterHumanRecordCountOf(
  before: GameProgress,
  after: GameProgress,
  added: readonly number[],
): number {
  let leading = 0
  while (leading < added.length && HUMAN_PLAY_RECORD_IDS.has(added[leading]!)) leading += 1
  return Math.min(added.length, leading + myAtBatRecordCountOf(before, after))
}
