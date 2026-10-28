import type { RandomPort } from '@/shared/api/random/randomPort'
import { pickoffPlayForKey, type PickoffBase } from '@/entities/defense-controls/model/pickoff'
import { type PickoffPlayInput, runPickoffPlay } from '@/features/defense-play/model/pickoffPlay'
import { defenseTeamBonusFor } from '@/features/play-team-game/model/teamGameRoster'
import { applyPickoffPlay } from '@/features/play-team-game/model/teamGameFlow/baseRunning/applyPickoffPlay'
import { hasRunnerOn, offenseRunnerTeamGradeOf } from '@/features/play-team-game/model/teamGameFlow/baseRunning/runners'
import { abilityContextOf } from '@/features/play-team-game/model/teamGameFlow/context/abilityContext'
import {
  defenseAbilitiesFor,
  fielderPlatesFor,
  fielderRecordsFor,
  fielderSkillIdsFor,
  runnerAcesFor,
} from '@/features/play-team-game/model/teamGameFlow/defense/fielders'
import { runAbilityFor } from '@/features/play-team-game/model/teamGameFlow/roster/batters'
import { isBatterTurn, isPitchTurn } from '@/features/play-team-game/model/teamGameFlow/turn/turns'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/* ── 견제 (메시지 0x10 → 0x50f28 → 플레이 종류 4) ─────────────────────────────── */

/**
 * **사람 투수의 견제** — 구질 고르기(상태 0xf)에서 '3' 1루 · '1' 2루 · '7' 3루 (0x53548 → 메시지 0x10 → 0x50f28).
 * 투수편 `pitcherGameFlow.pickoff` 와 같은 길이다.
 *
 * 그 루에 주자가 없거나 견제 키가 아니면 **아무 일도 없다**(원본도 키를 먹고 끝난다 — 같은 객체를 돌려준다).
 * 견제는 투구가 아니다: 투구 수·스태미나·볼카운트·마구 횟수·상대 타순을 건드리지 않는다 (0x10~0x12 를 안 지난다).
 *
 * 견제 판(종류 4)도 vt4c 가 돌아 사람 송구 키(+0x160)로 받은 야수가 던진다 — 화면이 도는 갈래(`live`)는 판을 붙들어
 * 화면이 한 틱씩 돌리고 `resolveRunnerPlay` 가 잇는다(`liveRunnerPlay`). 안 주면 키 없이 미리 돌려 `lastDefensePlay` 로 재생한다.
 * 난수는 그 안의 **주자 리드 굴림 · 악송구 굴림(0xa1828) 1번 · 악송구면 +2번**뿐이다.
 */
export function pickoff(
  progress: TeamGameProgress,
  webKey: string,
  random: RandomPort,
  /** 화면이 판을 실시간으로 돌린다 — 판을 붙들고(`pendingRunnerPlay`) 끝나면 `resolveRunnerPlay` (사람 송구 키 +0x160) */
  live = false,
): TeamGameProgress {
  // 공이 날거나 0x12 인 동안(붙든 공)은 0xf 키가 없다
  if (!isPitchTurn(progress) || !progress.atBatPrepared || progress.pendingPitchArrival != null) return progress
  const bases = progress.game.bases
  const play = pickoffPlayForKey(webKey, (base) => hasRunnerOn(bases, base))
  if (play === null) return progress
  const input: PickoffPlayInput = {
    targetBase: play.targetBase,
    bases,
    outs: progress.game.outs,
    // 우리가 수비 중이다 — 아홉 칸은 우리 팀, 주자는 상대 (타구 진행기 `defensiveDefenseInputOf` 와 같은 근사:
    // 주자 모두가 지금 타자의 주루를 쓴다)
    defenseAbilities: defenseAbilitiesFor(progress, progress.options.ourTeamId),
    defenseTeamBonus: defenseTeamBonusFor(abilityContextOf(progress.options), progress.options.ourTeamId),
    runnerTeamGrade: offenseRunnerTeamGradeOf(progress, false),
    // 경기 +0xfd4 — 견제는 0x11 을 안 지나 앞 공의 값이 남는다
    sceneResultCode: progress.sceneResultCode,
    fielderPlates: fielderPlatesFor(progress, progress.options.ourTeamId, progress.ourPitcherIndex),
    fielderSkillIds: fielderSkillIdsFor(progress, progress.options.ourTeamId),
    // 야수 · 주자 그림 팔레트 (defender.mpl 15벌 — 팀 번호, C-1)
    defenseTeamIndex: progress.options.ourTeamId,
    fielderRecords: fielderRecordsFor(progress, progress.options.ourTeamId),
    offenseTeamIndex: progress.options.opponentTeamId,
    runnerAces: runnerAcesFor(progress, false),
    runAbility: runAbilityFor(progress, progress.options.opponentTeamId, progress.opponentOrderIndex),
    random,
    // 공격이 CPU 라 자동 진루 제어기(0xaf918)가 돈다 (0xae690 첫 항)
    offenseIsCpu: true,
    // 사람이 수비한다 — 0xae6c8 은 환경설정 "송구"(+0xf4) 혼자가 받은 야수의 0xafa60 을 켠다 (타구 진행기와 같은 배선)
    defenseIsCpu: false,
    throwMode: progress.options.throwModeManual === false ? '자동' : '수동',
    scene: progress.defenseScene,
  }
  if (live) return { ...progress, pendingRunnerPlay: { kind: 'pickoff', input } }
  return applyPickoffPlay(progress, runPickoffPlay(input), '수비', random)
}

/**
 * **CPU 투수의 견제** — 사람이 칠 차례에 CPU 투수 AI 목표점 고르기 `0x345fc` 가 종류 4 를 뽑으면
 * 목표점을 안 만들고 `0x34848` 이 `rand(1,4)` 를 주자 있는 루가 나올 때까지 굴려 **사람 견제와 같은
 * 메시지 0x10** 을 보낸다(I-controls 4a-2). 공은 안 던진다 — 상태 0x11 예약(0x34888)을 안 지난다.
 *
 * 여기는 **그 루가 정해진 뒤**(메시지 0x10 이후)다. 루를 고르는 굴림(`entities/pitching/model/pitchTarget`
 * 의 `isCpuPickoff` · `cpuPickoffBaseOf`)은 CPU 투구를 고르는 자리 `selectPitch`(← `widgets/batting-stage/
 * model/useStageAnimation`)에서 굴린다: 구질(0x344dc) → 목표 종류(0x9eeac) → **견제 루(0x34848, 주자 있는
 * 루까지 반복)** 이고, 그 뒤 목표점·제구·곡선 굴림은 없다. 타석 화면이 `onPickoff(루)` 로 알려 주면
 * `TeamGameScreen` 이 `TeamGameSession.actions.cpuPickoff` 로 여기에 넘긴다.
 *
 * 그 루가 비었으면 원본 루프가 거기서 안 멈추므로 부르는 쪽 잘못이다 — 아무 일도 없다.
 */
export function cpuPickoff(
  progress: TeamGameProgress,
  base: PickoffBase,
  random: RandomPort,
  /**
   * 화면이 판을 실시간으로 돌린다 — 판을 붙들고(`pendingRunnerPlay`, 사람 공격) 끝나면 `resolveRunnerPlay`. 견제 판(종류 4)은
   * 0xae794 마스크 안이라 사람 주루 키(0x5331c → 0x582 · 0x584 → 0xa9b04)와 OK 슬라이딩(0x585)을 받는다
   */
  live = false,
): TeamGameProgress {
  if (!isBatterTurn(progress) || !progress.atBatPrepared) return progress
  const bases = progress.game.bases
  if (!hasRunnerOn(bases, base)) return progress
  const input: PickoffPlayInput = {
    targetBase: base,
    bases,
    outs: progress.game.outs,
    // 우리 공격이니 수비는 상대 팀이다
    defenseAbilities: defenseAbilitiesFor(progress, progress.options.opponentTeamId),
    defenseTeamBonus: defenseTeamBonusFor(abilityContextOf(progress.options), progress.options.opponentTeamId),
    runnerTeamGrade: offenseRunnerTeamGradeOf(progress, true),
    // 경기 +0xfd4 — 견제는 0x11 을 안 지나 앞 공의 값이 남는다
    sceneResultCode: progress.sceneResultCode,
    fielderPlates: fielderPlatesFor(progress, progress.options.opponentTeamId, progress.opponentPitcherIndex),
    fielderSkillIds: fielderSkillIdsFor(progress, progress.options.opponentTeamId),
    // 야수 · 주자 그림 팔레트 (defender.mpl 15벌 — 팀 번호, C-1)
    defenseTeamIndex: progress.options.opponentTeamId,
    fielderRecords: fielderRecordsFor(progress, progress.options.opponentTeamId),
    offenseTeamIndex: progress.options.ourTeamId,
    runnerAces: runnerAcesFor(progress, true),
    runAbility: runAbilityFor(progress, progress.options.ourTeamId, progress.game.battingOrderIndex),
    random,
    // 우리가 공격이다 — 환경설정 "주루" 가 먹는다 (0xae690 의 둘째 항)
    offenseIsCpu: false,
    runningMode: progress.options.runningModeManual === true ? '수동' : '자동',
    // 수비는 CPU 다 — 0xae6c8 첫 항이 서서 받은 야수의 0xafa60 이 매 틱 돈다 (d80918a)
    defenseIsCpu: true,
    scene: progress.defenseScene,
  }
  if (live) return { ...progress, pendingRunnerPlay: { kind: 'pickoff', input, side: '공격' } }
  return applyPickoffPlay(progress, runPickoffPlay(input), '공격', random)
}
