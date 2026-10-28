import { EMPTY_BATTER_GAME_RECORD, recordPlateAppearance } from '@/entities/batting/model/pinchHitAi'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { lineupSlotOf } from '@/entities/game/model/quickLineup'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { recordBatterFaced } from '@/entities/pitcher-career/model/pitcherGameRecord'
import { resolveBurstFor } from '@/features/play-pitcher-game/model/pitcherGameFlow/burst/burstResult'
import { withLeaguePlateAppearance } from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/leagueRecords'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'
import { countsMyPitcherRecord } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/recordGates'

/**
 * **삼진 없이 3아웃 · 경기 끝으로 정산되는 폭투·포일 판(종류 9)의 정산 0xa8024** — 판정 B 가 아웃 > 2(ae554) · 경기 끝(ae402)이면
 * 종류를 안 가리고 정산하고, 종류 9 는 state[0x26] ∈ {4, 5} 거르기에 안 걸린다(직접 떴다). 판의 진루 · 실점 · 아웃 콜 칸은
 * `withMyRunnerPlay` 가 먹였고, 여기는 타석 쪽 칸이다:
 * ```
 * a882e/a8852  아웃 > 0 이고 득점이 없으면 상대 타자 타수 +0x20([sp+0x34]) · 타순 칸 +0x11  ; 득점 · 아웃이 함께면 건너뜀
 * a89f4        아웃 > 0 → 결과 링 ← 5 · ctx+0x162 = 0
 * a8ac8        타순 칸 타석 +0x14 (아웃이 없는 끝내기 판도)
 * a8d48        0xa57f8(R, 0x18, 삼진 0) → R+0x134 += 0 · R+0x14c(연속 탈삼진) = 0       ; 내 투수 칸 — 게이트 0x14~0x1f
 * a8daa        0xa57f8(R, 0x19) → R+0x138 타자 수 +1
 * a8fb2        삼진 없음 → 0xb8cec R[1](연속 삼진) = 0
 * 0xa599c      결과비트(종류 9 는 거르지 않는다) → 0x17 끝(52a8e)의 0x8f414 가 그 비트로 돌발을 판정한다
 * ```
 */
export function withMyWildPitchSettlement(next: PitcherGameProgress, before: PitcherGameProgress, result: DefensePlayResult): PitcherGameProgress {
  const outs = result.advance.outsAdded
  const runs = result.advance.runsScored
  const slot = before.opponentOrderIndex
  const index = lineupSlotOf(slot)
  const records = [...next.opponentLineup.records]
  records[index] = recordPlateAppearance(records[index] ?? EMPTY_BATTER_GAME_RECORD, {
    isHit: false,
    isHomeRun: false,
    ...(outs > 0 ? { resultCode: WILD_PITCH_OUT_RESULT_CODE } : {}),
  })
  const counts = countsMyPitcherRecord(before)
  const settled: PitcherGameProgress = {
    ...next,
    opponentLineup: { ...next.opponentLineup, records },
    moundStrikeoutCombo: 0,
    ...(counts
      ? {
          pitcherRecord: recordBatterFaced(next.pitcherRecord, 0),
          record: { ...next.record, strikeoutCombo: 0 },
        }
      : {}),
    ...(outs > 0 && runs === 0 ? withLeaguePlateAppearance(next, false, slot, WILD_PITCH_PLACEHOLDER, 0) : {}),
  }
  const game = before.game
  return resolveBurstFor(
    settled,
    WILD_PITCH_PLACEHOLDER,
    // B4(타점)는 a8946 갈래(희생플라이 · 볼넷 · 사구) 안이라 안 선다
    0,
    game.outs,
    outs,
    result,
    false,
  )
}

/** 종류 9 판 정산의 결과 링 코드 5(그 밖의 아웃, a8a9e) — 판에 공 잡은 뜬공이 없다 */
const WILD_PITCH_OUT_RESULT_CODE = 5

/** 종류 9 판엔 타석 결과가 없다 — 정산 갈래를 고르는 자리 채움(안타 · 볼넷이 아닌 아웃 갈래) */
const WILD_PITCH_PLACEHOLDER: AtBatOutcome = { kind: '아웃', detail: '땅볼아웃' }
