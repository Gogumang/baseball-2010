import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { recordBatterAtBat } from '@/entities/game/model/batterGameLog'
import { backToBackRecordOf } from '@/entities/game/model/gameRecords'
import type { GameProgress } from '@/features/play-game/model/gameFlow'

/**
 * 상태 0x12(맞히지 못한 공 결과) 갱신 0x4e6d4 의 대기 틱 — 판정 st[0xb] 가 3(볼넷) · 4(사구) · 5(삼진)면 0x1f,
 * 아니면 0xf (0x4e6de~0x4e6f0). 상태 틱 [+0x2c] 가 이 값에 닿은 갱신에서 판정 A 0xae24c 와 칸 채우기 0x4e600(0x4e796)이 돈다.
 * `outcomeAfter` 는 이 공으로 끝난 타석 결과(안 끝났으면 null)다. 4 = 사구는 0x9d57c 머리(0x9d582)로 확정, 3 = 볼넷 · 5 = 삼진은
 * 판정 A 가 3·4 를 밀어내기 0x17 로, 5·0xd 를 다음 타자 0xd 로 보내는 갈래로 읽은 것이다(R10 6절 — 0x9d57c 본문은 안 읽음).
 */
export const RESULT_WAIT_TICKS = 0xf
export const RESULT_WAIT_TICKS_AT_BAT_END = 0x1f

export function resultWaitTicksOf(outcomeAfter: AtBatOutcome | null): number {
  const kind = outcomeAfter?.kind
  return kind === '볼넷' || kind === '사구' || kind === '삼진' ? RESULT_WAIT_TICKS_AT_BAT_END : RESULT_WAIT_TICKS
}

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
