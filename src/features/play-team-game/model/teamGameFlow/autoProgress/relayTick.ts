import type { GameState } from '@/entities/game/model/gameState'
import { withoutPendingBurst } from '@/features/play-team-game/model/teamGameFlow/burst/burst'
import type { TeamAutoRelayTick, TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * **상태 0x21 에 들어선다** — 진입 0x3abf0 이 남은 돌발을 판정 없이 내린다(0x8f628, 굴림 없음). 배경음 33(모드 ∈ {1, 2, 8, 9} ·
 * 속도 ≠ 2)은 화면이 낸다. 타석은 아직 안 굴린다.
 */
export function enterAutoRelay(progress: TeamGameProgress): TeamGameProgress {
  return {
    ...withoutPendingBurst(progress),
    autoRelay: { serial: (progress.autoRelay?.serial ?? 0) + 1, ticks: [], flipPending: false },
  }
}

/** 그 틱 뒤 진행을 중계 칸에 싣는다 — 사본에는 중계 칸을 안 남긴다 */
export function relayTickOf(after: TeamGameProgress, before: GameState, atBat: TeamAutoRelayTick['atBat']): TeamAutoRelayTick {
  return { progress: { ...after, autoRelay: null }, before, halfFlipped: false, atBat }
}

/**
 * **CLR 중단 — 질문 StrGAME[6] "자동진행을 중단하시겠습니까?"(코드 0x1e)에 예** — sim+0xa0 = 0 · 0xc0ea8(sim, 1) → sim+0x9f = 1
 * (전역기록 +0x14d + m 에도 쓴다 — 부르는 쪽(`pages/team-game` 의 `useTeamGame`)이 `entities/mode-save` 의 `autoRelayRecord` 에).
 * 다음 0xc2198 의 0xc1e04 가 사람이라 하여 0x18 로 넘어간다. 0x9f 는 이 경기 동안 남는다 — 일반·시즌은 경기진행 설정과 상관없이
 * 남은 경기를 사람이 잡는다(c1f20 이 설정보다 먼저 본다). 이어하기는 장면 초기화 0xc0e60 이 전역기록 칸에서 되살린다(`resumeTeamGame`).
 */
export function stopAutoRelay(progress: TeamGameProgress): TeamGameProgress {
  if (progress.autoRelay == null || progress.autoProgressFlag === 'stopped') return progress
  return { ...progress, autoProgressFlag: 'stopped' }
}
