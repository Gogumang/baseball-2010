import {
  myDefenseAbilitiesOf,
  myFielderPlatesOf,
  myFielderRecordsOf,
  myFielderSkillIdsOf,
  opponentRunnerAcesOf,
} from '@/features/play-pitcher-game/model/pitcherGameFlow/fielding/fielderInputs'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/**
 * **사람(나)이 수비하는 판의 공통 칸** — 타구 판 · 공 도착 판(도루 · 폭투 · 밀어내기) · 견제 판이 같은 배선으로 받는다.
 * - 수비 아홉 칸은 우리 팀 — 칸 0(투수 = 나)은 판 시작 0xb0fb4 가 선수를 찾지 않는다(b1032, `myDefenseAbilitiesOf`).
 * - 공 가진 야수 이름 판(0x43cb0) · 마선수 주자 그림(0x79d10) · 야수 · 주자 그림 팔레트(defender.mpl 15벌 — 팀 번호, C-1).
 * - 공격이 CPU 라 `0xae690` 의 첫 항(`경기[0x31 + 공격측] == 1`)이 서서 **환경설정 주루와 무관하게 늘 자동 진루**다.
 * - **송구는 여기서만 환경설정이 먹는다** — `0xae6c8` 의 첫 항(`경기[0x31 + 수비측] == 1`)이 사람 수비라 거짓이므로
 *   설정 +0xf4 혼자가 답을 정한다. 원본 기본값은 **수동**이다.
 */
export function myDefenseFieldsOf(progress: PitcherGameProgress) {
  return {
    defenseAbilities: myDefenseAbilitiesOf(progress),
    fielderPlates: myFielderPlatesOf(progress),
    fielderSkillIds: myFielderSkillIdsOf(progress),
    defenseTeamIndex: progress.options.ourTeamId,
    fielderRecords: myFielderRecordsOf(progress),
    offenseTeamIndex: progress.options.opponentTeamId,
    runnerAces: opponentRunnerAcesOf(progress),
    defenseIsCpu: false,
    offenseIsCpu: true,
    throwMode: throwModeOf(progress),
    scene: progress.defenseScene,
  } as const
}

/** 환경설정 "송구" (설정 +0xf4) — 안 넘기면 원본 기본값 수동 */
function throwModeOf(progress: PitcherGameProgress): '자동' | '수동' {
  return progress.options.throwModeManual === false ? '자동' : '수동'
}
