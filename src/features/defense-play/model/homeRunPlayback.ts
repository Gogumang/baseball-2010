import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import type { BaseState } from '@/entities/game/model/baseState'
import { aceIndexesWithOriginalBug } from '@/features/defense-play/model/defensePlayView'
import { fixturePatternFor } from '@/features/defense-play/model/representativePattern'
import { runDefensePlay, type DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'

/**
 * **패턴 없이 결과만 들고 온 홈런**(시험·옛 호출 — 원본에 없는 길)의 재생거리.
 *
 * 원본은 홈런도 다른 맞은 공처럼 상태 0x17 수비 판을 돈다 — 판 진행 관문 0xb0d28 · 주자 틱 0xaa0a8 · 판 끝 정산 0xa8024
 * (R10 · I 문서, `runDefensePlay` 머리말). 웹 실제 타석(`resolvePitch` · `simulateBatter`)은 쏜 패턴을 결과 객체에 묶어 보내
 * 홈런도 `pendingDefensePlay` 로 그 판을 돈다(`playOutcome.isBattedBallKind`) — 이 파일을 지나지 않는다.
 *
 * 여기는 패턴이 없어 판을 미리 못 여는 홈런(시험 · 결과를 직접 고르는 옛 화면)만 받는다. 예전에는 판을 안 돌리고 근사 구보 속도
 * (450 — 원본에서 읽은 값이 아니었다)로 주자를 홈까지 끌었다. 이제 **결과에 맞는 원본 패턴**(`fixturePatternFor`)을 골라
 * **같은 판(`runDefensePlay`)을 그대로** 돌린 틱을 재생거리로 준다 — 주자는 원본 구보 속도(0xa0a5c `runnerSpeedOf`)로 달리고
 * 판은 관문이 닫히는 틱(타자주자까지 모두 +0x96 · `0xa990c == 0`, b0e04)에 끝난다.
 *
 * - **난수를 안 쓴다**(`random` 을 안 넘긴다 — 필살수비 · 펌블 · 폴 굴림이 없다). 키도 없다(CPU 수비 · 자동 주루).
 * - ⚠️ **경기 상태는 여전히 타석 쪽 규칙**(`applyAtBatOutcome` — 전원 득점)이 정한다. 이 재생거리는 `lastDefensePlay` 로만
 *   들어가 화면이 재생할 뿐이다. 홈런 판은 늘 타자주자 · 루의 주자 모두 홈인이라(관문 b0e04 가 그때만 닫는다) 점수 · 루 · 아웃이
 *   타석 쪽 규칙과 같다 — 기록(+0x95 · +0x96, `runnerFates`)도 판이 낸 것이 예전 `runnerFatesWithoutPlay` 와 같다(시험으로 묶었다).
 */
export interface HomeRunPlaybackInput {
  /** 타석 결과. 홈런이 아니면 재생할 것이 없다 */
  readonly outcome: AtBatOutcome
  /** 투구 때의 루 상황 — 이 주자들도 함께 홈까지 돈다 */
  readonly bases: BaseState
  /** 투구 때의 아웃 수 — 2아웃 득점 보류(state[0])를 판이 본다. 안 주면 0 */
  readonly outs?: number
  /** 원본 패턴. 안 주면 결과에 맞는 원본 패턴을 고른다 (`fixturePatternFor`) */
  readonly pattern?: BattedBallPattern
  /** 수비 9명의 수비 능력치 (칸 순서). 기본 500 */
  readonly defenseAbilities?: readonly number[]

  // ── 아래 셋은 **그림에만 쓰인다** (`runDefensePlay` 와 같은 칸들) ──

  /**
   * 수비 칸별 **마선수 번호 0~4** (마선수가 아닌 칸은 null·undefined) — R3 7-1 · C-16.
   * ⚠️ 타자 마선수 그림은 원본이 **팀당 첫 한 명만** 적재하므로 둘째부터도 첫째 그림으로 나온다 — 여기서
   * `aceIndexesWithOriginalBug` 를 한 번 통과시켜 판에 넘긴다 (R3 7-3).
   */
  readonly aceIndexes?: readonly (number | null | undefined)[]
  /** 수비 팀 번호 0~14 — 야수 그림 팔레트 `defender.mpl` (C-1, 15색) */
  readonly defenseTeamIndex?: number
  /** 공격 팀 번호 0~14 — 주자 그림 팔레트 */
  readonly offenseTeamIndex?: number
}

/** 홈런이면 판을 돌린 재생거리를, 아니면 null */
export function homeRunPlaybackOf(input: HomeRunPlaybackInput): DefensePlayResult | null {
  if (input.outcome.kind !== '홈런') return null
  return runDefensePlay({
    outcome: input.outcome,
    // 결과를 넘겨받은 호출이다 — 기록은 넘겨받은 결과 그대로다(이 재생거리의 `outcome` 은 아무도 안 읽는다)
    outcomeIsGiven: true,
    trajectory: battedBallTrajectory(input.pattern ?? fixturePatternFor(input.outcome)),
    bases: input.bases,
    outs: input.outs ?? 0,
    defenseAbilities: input.defenseAbilities,
    // `fixturePatternFor` 가 패턴을 고를 때와 같은 판 — 결과만 들고 오는 호출은 대부분 사람 타석(수비 CPU)이다
    defenseIsCpu: true,
    aceIndexes: aceIndexesWithOriginalBug(input.aceIndexes),
    defenseTeamIndex: input.defenseTeamIndex,
    offenseTeamIndex: input.offenseTeamIndex,
  })
}
