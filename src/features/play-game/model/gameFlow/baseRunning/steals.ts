import type { StealBase } from '@/entities/fielding/model/stealStart'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { isPlayerTurn } from '@/entities/game/model/gameState'
import { startHumanSteal, stealStartSceneOf } from '@/features/defense-play/model/pitchArrivalPlay'
import { runAbilitiesOnBaseOf } from '@/features/play-game/model/gameFlow/baseRunning/runners'
import { opponentDefenseAbilitiesOf } from '@/features/play-game/model/gameFlow/defense/opponentFielders'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/**
 * **도루 출발** — 공이 나는 동안(상태 0x11) 사람 키 '3'·'2'·'1'(`0x53610` → 메시지 0x583 → `0xa9bd4`).
 *
 * `base` 는 **대상 주자가 선 루**다. 주자를 출발만 시킨다 — 성공·실패는 공이 도착한 뒤(`arrivePitch`) 여는
 * 도루 판(종류 5)에서 포수 송구와 주자 도착이 겨뤄 정한다(`features/defense-play/model/stealPlay`).
 * 간이 엔진 표 0xd9064 는 CPU 끼리 경기 전용이라 여기서는 안 쓴다. 3루 주자도 홈으로 뛴다(0xb6228).
 * 받아들이는 문턱은 `canStartSteal`(0xa97a0 · 0xa9924 앞길 검사) — 같은 투구에 앞 주자가 이미 출발했으면 겹도루.
 * 받으면 같은 메시지의 52222 가 **CPU 송구 결정 0xafa60 을 한 번** 돌린다 — 앞 판이 끝난 그대로의 수비(`DefenseScene.playEnd`)로,
 * 공이 쥐여 있고 +0x128 이 서 있을 때만 굴림(점수식 0xafb24 · 홈이면 특수 rand(0,100) · 송구면 악송구 굴림)이 있다
 * (`stealStartSceneOf`, r214). 바뀐 장면은 곧바로 `defenseScene` 에 남는다 — 판이 안 열리는 공(2아웃 삼진 · 파울 · 타구)에도.
 *
 * 원본은 상태 0x11(공이 나는 동안)에만 키를 받는다 — 화면(`GameScreen`)이 타석 화면의 비행 판정
 * (`BattingStage.flightProbeRef`, 스윙·번트 키와 같은 `isFlying`)으로 거른 뒤에만 부른다.
 */
export function startSteal(progress: GameProgress, base: StealBase, random: RandomPort): GameProgress {
  const { game } = progress
  if (game.isFinished || !isPlayerTurn(game) || progress.pendingDefensePlay !== null || progress.pendingRunnerPlay != null) {
    return progress
  }
  const stealingFrom = startHumanSteal(game.bases, progress.stealingFrom, base)
  if (stealingFrom === progress.stealingFrom) return progress
  // 52222 0xafa60 한 번 — 공 도착 판과 같은 수비 · 주자 칸(`arrivePitch`)
  const defenseScene = stealStartSceneOf(
    {
      scene: progress.defenseScene,
      bases: game.bases,
      outs: game.outs,
      defenseAbilities: opponentDefenseAbilitiesOf(progress),
      runAbilities: runAbilitiesOnBaseOf(progress),
    },
    stealingFrom,
    random,
  )
  // 0xa9bd4 가 st[0x14 + 루] 를 세운다 — 판정 입력과 표시가 한 칸이다
  return {
    ...progress,
    stealingFrom,
    stealDisplayFrom: stealingFrom,
    stealDisplayUntilConfirm: null,
    ...(defenseScene === progress.defenseScene ? {} : { defenseScene }),
  }
}

/** 지금 출발시킬 수 있는 루 — 화면의 도루 키 안내용 (`canStartSteal`) */
export function stealableBasesOf(progress: GameProgress): readonly StealBase[] {
  const { game } = progress
  if (game.isFinished || !isPlayerTurn(game) || progress.pendingDefensePlay !== null || progress.pendingRunnerPlay != null) {
    return []
  }
  return ([1, 2, 3] as const).filter((base) => startHumanSteal(game.bases, progress.stealingFrom, base) !== progress.stealingFrom)
}
