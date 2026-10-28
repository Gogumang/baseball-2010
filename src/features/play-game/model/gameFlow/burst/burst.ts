import type { BaseState } from '@/entities/game/model/baseState'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { tryTriggerBurst, cancelBurst } from '@/entities/burst-mission/model/burstMissionSession'
import { moundAcePitcherOf } from '@/features/play-game/model/gameFlow/roster/teamPlayers'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/**
 * 타석 준비에서 돌발미션 발동을 굴린다 (장면 상태 0xf → 0x8f158).
 *
 * ## 굴리는 타석은 **사람 장면(0xd → 0xe → 0xf)을 지나는 타석뿐** — 타자편은 내 타석뿐이다 (2026-10-05 디스어셈 전수)
 * ```
 * 0x8f158(발동)  부르는 곳 1곳 — 리터럴 0x50d8c ← 0x50c42: 메시지 1 "확인" 의 인자 0xe 갈래(0x50c26~0x50c56).
 *               상태 0xe(등판·확인) → 0xf 로 넘기며 굴리고, 뜨면 0x1b. 0xe 는 0xd 에서만 오고 0xd 는 A·B·C
 *               (0xae24c·0xae3e8·0xae3a0)의 "다음 타자" 로만 온다 — 모두 사람 장면이다.
 * 0x8f414(판정)  부르는 곳 2곳 — 0x4e7ca(상태 0x12 갱신 0x4e6d4 끝) · 0x52a8e(상태 0x17 인플레이 끝 0x528b0).
 * 0x8f628(내림)  부르는 곳 2곳 — 0x21 진입 0x3abf0 · 0x18 진입 0x3ac90(반 이닝 뒤집힐 때) (`cancelBurst`).
 * 간이 엔진 0xc262c · 0x21 갱신 0x48480 의 호출 그래프(8단, 풀의 함수 포인터 포함)에는 셋 다 없다.
 * ```
 * 모드 4 에서 어느 타석이 사람 장면인가 — 0xc1e04 점프표 0xd90c0 칸 3 = 0xc1ed6:
 * 0xc1d38(공격 팀 지금 타자가 0xb6389 내 선수인가) 거짓 → 1(자동). 그래서 **동료 타석·상대 반 이닝은 늘 0x21** 이다.
 * 내 타석이 끝나는 자리(0x4e7ae · 0x528b0 → 0x35108 → 0x350d4)도 `0xc1e04` 가 참(다음이 자동)이면 다음 상태
 * +0x1b6c 를 **0x21** 로 덮는다 — 다음 타자는 늘 동료나 상대라 내 타석 뒤에는 늘 0x21 진입(0x8f628)이 온다.
 *
 * 정정: K 4절 1-6 의 "매 타석 시작 때" 는 **0xf 를 지나는 타석마다** 라는 뜻이다. 예전 웹은 이것을 동료·상대 타석까지로
 * 읽어 세 자리(내 타석·동료 `playTeammateAtBat`·상대 `onAtBatStart`)에서 굴리고 판정했다 — 원본에 없는 굴림이었다.
 *
 * 상대 마선수(b0=10~22): 마투수 행(0xae83d)은 142 가 상대 명부 8번에 넣은 마투수가 마운드에 섰을 때 걸린다. 마타자 행(0xae89d)은
 * 지금 타자를 보는데 내 타석의 타자는 나라 걸리지 않는다.
 */
function burstContextOf(
  progress: GameProgress,
  situation: {
    readonly isHumanTeamBatting: boolean
    readonly bases: BaseState
    readonly outs: number
    readonly opponentBattingSlot: number
    readonly hitsInGame: number
    readonly homeRunsInGame: number
    readonly strikeoutsInGame: number
  },
) {
  const ace = progress.aceOpponent
  // 142 가 상대 명부에 넣은 마투수가 지금 마운드면 그 레코드가 마선수다 (b0 = 마투수 행)
  const moundAce = moundAcePitcherOf(progress, false)
  return {
    ...situation,
    // 원본 이닝은 0-기준이다 (game+0x6b) — 웹 `inning` 은 1-기준이라 하나 뺀다
    inning: progress.game.inning - 1,
    ourScore: progress.game.ourScore,
    opponentScore: progress.game.opponentScore,
    opponentAceBatterId: ace !== null && ace.role === '타자' ? ace.id : null,
    opponentAcePitcherId: ace !== null && ace.role === '투수' ? ace.id : (moundAce?.player.id ?? null),
  }
}

export function triggerBurstForMyAtBat(progress: GameProgress, random: RandomPort): GameProgress {
  const session = progress.burst
  if (session === null) return progress

  const next = tryTriggerBurst(
    session,
    burstContextOf(progress, {
      isHumanTeamBatting: true,
      bases: progress.game.bases,
      outs: progress.game.outs,
      // 상대 타순 슬롯(team+0x32)은 우리 공격 중에도 상대 팀 칸을 가리킨다 — 다음 상대 타자 자리다
      opponentBattingSlot: progress.opponentOrderIndex,
      hitsInGame: progress.myStats.hits,
      homeRunsInGame: progress.myStats.homeRuns,
      strikeoutsInGame: progress.pitching.strikeouts,
    }),
    random,
  )
  return next === session ? progress : { ...progress, burst: next }
}

/**
 * 자동진행(0x21) 진입 0x3abf0 의 `0x8f628` — 판정 못 받고 남은 돌발을 내린다. 굴림 없음.
 * 내 타석에서 뜬 돌발이 결과비트 0 으로 살아남았을 때만 일이 있다 (`cancelBurst` 머리말).
 */
export function withoutPendingBurst(progress: GameProgress): GameProgress {
  if (progress.burst === null) return progress
  const burst = cancelBurst(progress.burst)
  return burst === progress.burst ? progress : { ...progress, burst }
}
