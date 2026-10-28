import { ACE_BATTER_ROSTER_SLOT, aceBatterPlayerOf } from '@/features/play-game/model/gameAces'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { cancelBurst, tryTriggerBurst } from '@/entities/burst-mission/model/burstMissionSession'
import { opponentRosterSlotOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/opponentBatters'
import { teamAcesOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/pitcherOrder'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/**
 * 상태 0xf(타석 준비)의 **돌발 발동 판정** (0x8f158).
 *
 * ## 굴리는 타석은 **내가 던지는 타석뿐** (2026-10-05 디스어셈 전수)
 * 0x8f158 을 부르는 곳은 메시지 1 "확인" 의 인자 0xe 갈래 한 곳(리터럴 0x50d8c ← 0x50c42)뿐이다 — 상태 0xe → 0xf.
 * 판정 0x8f414 도 사람 장면의 두 자리(0x12 갱신 0x4e6d4 · 0x17 끝 0x528b0)뿐이고, 간이 엔진 0xc262c · 0x21 갱신
 * 0x48480 의 호출 그래프에는 둘 다 없다. 모드 3 의 사람 장면 판정 0xc1e04 → 점프표 0xd90c0 칸 2 = 0xc1eac:
 * ```
 * 공격 팀이 사람 팀(st[0x31+st[9]] == 0) → 1 (자동)          ; 동료 타석은 늘 0x21
 * 아니면 0xc1d38 — 수비 팀 지금 투수가 0xb6389 내 선수인가 → 참 0 (사람) · 거짓 1 (자동)
 * ```
 * 그래서 동료 타석·내가 마운드에 없는 수비 타석(구원 대기·선발 아닌 날·강판 뒤)은 모두 0x21 이라 굴리지 않는다.
 * 타석 끝(0x4e7ae · 0x528b0 → 0x35108 → 0x350d4)도 다음이 자동이면 다음 상태를 0x21 로 덮는다.
 * ⚠️ 예전 웹은 K 4절 1-6 "매 타석 시작 때" 를 동료·수비 자동 타석까지로 읽어 거기서도 굴렸다 — 원본에 없는 굴림이었다.
 * 남은 돌발은 자동 타석 앞(0x21 진입 0x3abf0 · 0x18 진입 0x3ac90 의 0x8f628)에서 내린다 (`withoutPendingBurst`).
 */
export function rollBurstAtPrep(progress: PitcherGameProgress, random: RandomPort): PitcherGameProgress {
  const session = progress.burst
  if (session === null || progress.simpleEngineRunning) return progress
  const log = progress.opponentBatterLogs[progress.opponentOrderIndex] ?? { hits: 0, homeRuns: 0 }
  const next = tryTriggerBurst(
    session,
    {
      // 투수편 XlsPITCHER_BURST 44행의 목표는 전부 아웃 계열이라 사람 팀 공격 갈래가 따로 없다
      // (표를 가르는 것은 시즌 모드뿐 — 0x8f000). 내가 던지는 타석은 늘 상대 공격이다
      isHumanTeamBatting: false,
      bases: progress.game.bases,
      outs: progress.game.outs,
      // 원본 이닝은 0-기준이다 (game+0x6b)
      inning: progress.game.inning - 1,
      ourScore: progress.game.ourScore,
      opponentScore: progress.game.opponentScore,
      opponentBattingSlot: progress.opponentOrderIndex,
      // b0 마타자 행(0xae89d → 0xb633d) — 142 가 상대 명단에 넣은 마타자가 대타로 지금 타석에 섰으면 그 선수.
      // 마투수 행(0xae83d)은 마운드 투수를 보는데, 내가 던지는 타석의 마운드는 나라 걸리지 않는다
      opponentAceBatterId: opponentAceBatterIdOf(progress),
      opponentAcePitcherId: null,
      hitsInGame: log.hits,
      homeRunsInGame: log.homeRuns,
      strikeoutsInGame: progress.record.strikeouts,
    },
    random,
  )
  return next === session ? progress : { ...progress, burst: next }
}

/** 지금 타석에 선 상대 마타자 번호 — 142 가 넣은 마타자가 대타로 섰을 때만 */
function opponentAceBatterIdOf(progress: PitcherGameProgress): string | null {
  if (opponentRosterSlotOf(progress) !== ACE_BATTER_ROSTER_SLOT) return null
  return aceBatterPlayerOf(teamAcesOf(progress.options, false).batter)?.id ?? null
}

/** 돌발 결과 창을 닫는다 (보상은 판정 때 `burstRewardDeltas` 에 쌓였고 앱이 경기 끝에 커리어에 얹는다) */
export function closeBurstWindow(progress: PitcherGameProgress): PitcherGameProgress {
  return progress.lastBurstResolution === null ? progress : { ...progress, lastBurstResolution: null }
}

/**
 * 자동진행(0x21) 진입 0x3abf0 · 공수 교대(0x18) 진입 0x3ac90 의 `0x8f628` — 판정 못 받고 남은 돌발을 내린다. 굴림 없음.
 * 모드 3 에서 사람 장면(내가 던지는 수비 반 이닝) 뒤에는 늘 자동 타석(우리 공격·강판 뒤)이 오므로
 * 자동 타석 앞에서 한 번 내리면 두 자리를 다 덮는다 (`cancelBurst` 머리말).
 */
export function withoutPendingBurst(progress: PitcherGameProgress): PitcherGameProgress {
  if (progress.burst === null) return progress
  const burst = cancelBurst(progress.burst)
  return burst === progress.burst ? progress : { ...progress, burst }
}
