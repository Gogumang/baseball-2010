import { startHumanSteal, stealStartSceneOf } from '@/features/defense-play/model/pitchArrivalPlay'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { offenseRunnerTeamGradeOf, runAbilitiesOnBaseOf } from '@/features/play-team-game/model/teamGameFlow/baseRunning/runners'
import { defenseAbilitiesFor } from '@/features/play-team-game/model/teamGameFlow/defense/fielders'
import { isBatterTurn } from '@/features/play-team-game/model/teamGameFlow/turn/turns'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/* ── 도루 출발 (상태 0x11 공격, 0x53610 → 메시지 0x583 → 0xa9bd4) ─────────────────── */

/**
 * 지금 출발시킬 수 있는 루 — 원본 키는 '3' → 1루 주자 · '2' → 2루 주자 · '1' → 3루 주자다
 * (`0x53610`, 인자 = 대상 주자 1·2·3). 사람이 칠 차례에만 받는다. 문턱은 `canStartSteal`(0xa97a0 · 0xa9924 앞길 검사) —
 * 이번 공에 이미 출발한 주자는 빠지고, 앞 주자가 이미 출발했으면 겹도루가 된다. 3루 주자도 홈으로 뛴다(0xb6228).
 */
export function stealableBases(progress: TeamGameProgress): readonly StealBase[] {
  if (!isBatterTurn(progress)) return []
  return ([1, 2, 3] as const).filter((base) => startHumanSteal(progress.game.bases, progress.stealingFrom, base) !== progress.stealingFrom)
}

/**
 * **도루 출발** — 공이 나는 동안(상태 0x11) 사람 키 '3'·'2'·'1'(`0x53610` → 메시지 0x583 → `0xa9bd4`).
 *
 * 주자를 출발만 시킨다 — 성공·실패는 공이 도착한 뒤(`arriveTeamPitch`) 여는 도루 판(종류 5)에서 포수 송구와 주자
 * 도착이 겨뤄 정한다(`features/defense-play/model/stealPlay`). 간이 엔진 표 0xd9064 는 CPU 끼리 경기(자동 진행) 전용이라
 * 여기서는 안 쓴다(c18a833). 걸 수 없는 루면 같은 객체를 돌려준다.
 * 받으면 같은 메시지의 52222 가 CPU 송구 결정 0xafa60 을 한 번 돌린다(상대 수비가 앞 판이 끝난 그대로 공을 쥐고 +0x128 이 서
 * 있을 때만 굴림 — `stealStartSceneOf`, r214). 바뀐 장면은 곧바로 `defenseScene` 에 남는다.
 */
export function startSteal(progress: TeamGameProgress, base: StealBase, random: RandomPort): TeamGameProgress {
  if (!isBatterTurn(progress)) return progress
  const stealingFrom = startHumanSteal(progress.game.bases, progress.stealingFrom, base)
  if (stealingFrom === progress.stealingFrom) return progress
  const { options } = progress
  // 수비 · 주자 칸은 공 도착 판(`arriveTeamPitch` 의 사람 공격 갈래)과 같다
  const defenseScene = stealStartSceneOf(
    {
      scene: progress.defenseScene,
      bases: progress.game.bases,
      outs: progress.game.outs,
      defenseAbilities: defenseAbilitiesFor(progress, options.opponentTeamId),
      runAbilities: runAbilitiesOnBaseOf(progress, '공격'),
      runnerTeamGrade: offenseRunnerTeamGradeOf(progress, true),
    },
    stealingFrom,
    random,
  )
  // 0xa9bd4 가 st[0x14 + 루] 를 세운다 — 판정 입력과 표시가 한 칸이다
  return {
    ...progress,
    stealingFrom,
    stealDisplayFrom: stealingFrom,
    ...(defenseScene === progress.defenseScene ? {} : { defenseScene }),
  }
}
