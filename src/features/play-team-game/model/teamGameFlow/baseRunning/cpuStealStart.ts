import type { RandomPort } from '@/shared/api/random/randomPort'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import type { DefenseScene } from '@/features/defense-play/model/defenseScene'
import { rollCpuStealStart, stealStartSceneOf } from '@/features/defense-play/model/pitchArrivalPlay'
import { offenseRunnerTeamGradeOf, runAbilitiesOnBaseOf } from '@/features/play-team-game/model/teamGameFlow/baseRunning/runners'
import { defenseAbilitiesFor } from '@/features/play-team-game/model/teamGameFlow/defense/fielders'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/** CPU 도루 출발 — 출발한 주자들과 송구 결정이 바꾼 수비 장면 */
export interface CpuStealStart {
  readonly stealingFrom: readonly StealBase[]
  readonly stealScene: DefenseScene | undefined
}

/**
 * **우리 수비 공의 CPU 도루 출발 · 그 송구 결정을 굴린다** — 상태 0x11 의 10번째 틱(메시지 0x583). 사람 투수의 공 하나(`pitchOnce`)가
 * 실투 판정 뒤 · CPU 타자 결정 앞에 부른다. 굴림 차례: 도루 출발(후보가 있을 때만) → 송구 결정
 */
export function rollCpuStealStartOnOurDefense(
  progress: TeamGameProgress,
  random: RandomPort,
): CpuStealStart {
  const { options } = progress
  // CPU 도루 0x520de — 상태 0x11 의 10번째 틱(0x537dc → 메시지 0x583)이라 CPU 타자 결정(11번째 틱 0x34334)
  // **바로 앞**이다. 후보가 있을 때만 rand(0,1000) 한 번 → 0xa9bd4 출발 (`rollCpuStealStart`)
  const stealingFrom = rollCpuStealStart(
    {
      bases: progress.game.bases,
      offenseIsCpu: true,
      runAbilityOf: (base) => runAbilitiesOnBaseOf(progress, '수비')[base] ?? 0,
      // 루 위 주자 +0xa4 에 든 공격(상대) 팀 근성 등급 (0xa93ac a9488) — 300~383 이라 표 칸(÷250)은 그대로 1 이다
      runnerTeamGrade: offenseRunnerTeamGradeOf(progress, false),
    },
    random,
  )
  // 같은 메시지 0x583 의 52222 — CPU 송구 결정 0xafa60 한 번(앞 판이 끝난 그대로의 우리 수비). 11번째 틱 CPU 타자 결정보다 먼저다
  // (`stealStartSceneOf`, r214 — 예전 웹은 공 도착 판 맨 앞에서 굴렸다). 수비 · 주자 칸은 공 도착 판(`arriveTeamPitch`)과 같다
  const stealScene = stealStartSceneOf(
    {
      scene: progress.defenseScene,
      bases: progress.game.bases,
      outs: progress.game.outs,
      defenseAbilities: defenseAbilitiesFor(progress, options.ourTeamId),
      runAbilities: runAbilitiesOnBaseOf(progress, '수비'),
      runnerTeamGrade: offenseRunnerTeamGradeOf(progress, false),
    },
    stealingFrom,
    random,
  )
  return { stealingFrom, stealScene }
}
