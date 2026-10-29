import type { PitcherRun } from '@/entities/mission/model/pitcherRun'
import { MISSION_PITCHER_MODE } from '@/entities/mission/model/pitcherRun'
import { missionCpuBatterAbilityOf, missionCpuBatterOf } from '@/entities/mission/model/missionCpuTeam'
import { missionRunAbilitiesOnBaseOf } from '@/entities/mission/model/missionRunners'
import { runnerCountOf } from '@/entities/game/model/baseState'
import { ROOKIE_BATTER_ABILITY } from '@/entities/batting/model/batter'
import { pitchAgainstBatterDetailed } from '@/entities/pitching/model/simulateBatter'
import { missionDefenseAbilitiesOf } from '@/entities/mission/model/missionRunners'
import { rollCpuStealStart, stealStartSceneOf } from '@/features/defense-play/model/pitchArrivalPlay'
import { BATTER_SLOT, gameAbilityOf } from '@/features/play-team-game/model/gameAbilities'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { AtBatRunner } from '@/app/model/useAtBatRunner'
import type { ModePitcher } from '@/app/model/modePitcher'
import { UNFILLED_SPECIAL_SWING } from '@/app/model/missionSession/constants/missionConstants'
import type { MissionAtoms } from '@/app/model/missionSession/atoms/missionScope'
import { specialRunnersMirrorAtom } from '@/app/model/missionSession/atoms/mirrorAtoms'
import { missionSceneAtom, pitcherStealDisplayAtom } from '@/app/model/missionSession/atoms/fieldAtoms'
import { missionOpponentAbility } from '@/app/model/missionSession/opponent/missionOpponent'
import { missionOpponentSpecialSwingOf } from '@/app/model/missionSession/opponent/specialSwing'
import { missionCpuBatterSkillIdsOf, missionCpuSwingSituationOf } from '@/app/model/missionSession/lineup/cpuBatter'
import type { HumanPitch } from '@/app/model/missionSession/pitcher/humanPitch'

type CpuBatter = ReturnType<typeof missionCpuBatterOf>

/**
 * 지금 타석의 CPU 타자 0xae89c(공격 팀) — 타순 team+0x32 칸에 선 명단 줄 (`missionCpuBatterOf`).
 * 마타자 칸이면 마선수 레코드(0xb6414 첫 단계 레벨 배율 0xd88aa[mgr[0x13f + 순번]] 을 네 칸 모두), 그 밖은 마스터 팀 줄의
 * 0xb6415(타자, k, 1) — 0xaae7c 는 마타자를 시작 타순 칸에만 세우고, 다른 칸 · 대타는 마스터 줄이다.
 * CPU 타자 결정 0x34334 의 h 는 **경기용 히트** 0xb570d(ctx, 0, 타자, 1, 90, 1) 다 (ce462ce).
 * 미션 모드 5 에서 0xb570c 는 나만의리그 갈래(모드 3·4)도 시즌 갈래(2)도 안 타고, 체력 인자 90 은
 * 감소가 없고, 팀 능력치 마스크 {1,2,8,9} 에도 없다 → 0xb6414 값을 0..999 로 자른 것이다.
 * 마타자의 0xb6414 스킬 보정(+0x14, 플래그 1)은 `missionOpponentAbility`(`aceRecordAbilityAtLevel`)가 먹인다(마스터 줄도 붙인다).
 */
function cpuBatterAbilityOf(run: PitcherRun, cpuBatter: CpuBatter, aceLevels: Readonly<Record<number, number>> | undefined) {
  const isAceBatter = cpuBatter?.isAce === true
  const rawBatter = (isAceBatter ? missionOpponentAbility(run.mission, aceLevels) : missionCpuBatterAbilityOf(run.cpu)) ?? ROOKIE_BATTER_ABILITY
  return {
    ...rawBatter,
    hit: gameAbilityOf({ mode: MISSION_PITCHER_MODE, base: rawBatter.hit, isPitcher: false, slot: BATTER_SLOT.히트, isMyTeam: false }),
  }
}

/**
 * 마타자 필살 0x34468~0x34488 — 남은 칸(0xaea30)이 0 이 아니면 휘두를 때마다 필살이다 (난수 없음). 칸은 s8 팀[+0x29 + 타순].
 * 일반 CPU 타자(마스터 줄)는 S+0x10 을 쓰지 않는다 (Q1 5절)
 */
function cpuSpecialSwingOf(run: PitcherRun, cpuBatter: CpuBatter, aceLevels: Readonly<Record<number, number>> | undefined) {
  if (cpuBatter?.isAce !== true) return null
  const stored = run.cpu.batting?.specialSwing[cpuBatter.order ?? 0] ?? UNFILLED_SPECIAL_SWING
  return missionOpponentSpecialSwingOf(run.mission, stored, aceLevels)
}

/** CPU 타자 스윙의 재료 — 던진 공과 그 앞의 판 */
export interface CpuSwingInput {
  readonly atoms: MissionAtoms
  readonly runner: AtBatRunner
  readonly run: PitcherRun
  readonly pitcher: ModePitcher
  readonly thrown: HumanPitch
  readonly aceLevels: Readonly<Record<number, number>> | undefined
}

/**
 * CPU 도루 0x520de — 상태 0x11 의 10번째 틱(0x537dc → 메시지 0x583)이라 실투 판정(0x4dea0) 뒤, CPU 타자 결정
 * (11번째 틱 0x34334) **바로 앞**이다. 후보가 있을 때만 rand(0,1000) 한 번 → 0xa9bd4 출발 (`rollCpuStealStart`).
 * 주자 주루는 루에 선 CPU 타선 주자의 신원대로(`missionRunAbilitiesOnBaseOf` — 마스터 줄 0xb6415(선수, 3, 1) · 마타자 레벨 배율)
 * 같은 메시지 0x583 의 52222 — CPU 송구 결정 0xafa60 한 번(앞 판이 끝난 그대로의 사람 칸 수비). 11번째 틱 CPU 타자 결정보다
 * 먼저다(`stealStartSceneOf`, r214 — 예전 웹은 공 도착 판 맨 앞에서 굴렸다). 수비 · 주자 칸은 아래 공 도착 판과 같다
 */
function rollCpuStealOf({ atoms, run }: CpuSwingInput, random: RandomPort) {
  const runAbilities = missionRunAbilitiesOnBaseOf(run, atoms.get(specialRunnersMirrorAtom).current(run.mission))
  const stealingFrom = rollCpuStealStart({ bases: run.bases, offenseIsCpu: true, runAbilityOf: (base) => runAbilities[base] ?? 0 }, random)
  atoms.set(
    missionSceneAtom,
    stealStartSceneOf(
      { scene: atoms.get(missionSceneAtom), bases: run.bases, outs: run.outs, defenseAbilities: missionDefenseAbilitiesOf(run), runAbilities },
      stealingFrom,
      random,
    ),
  )
  // 0xa9bd4 가 세운 st[0x14 + 루] 는 화면 표시 칸이기도 하다 — 0x35b94 가 그 루 주자를 안 그린다(`pitcherStealDisplay`).
  // 때: 원본은 0x11 의 틱 10(0x537dc `[+0x18] == 10` → 0x583)에 출발한다 — 공을 놓는 틱(0x4e060 `[+0x2c] > 9`)과 같은 그림이라
  // 공을 던지는 이 걸음(게이지가 틱 10 에 부른다)이 곧 그 틱이다
  atoms.set(pitcherStealDisplayAtom, stealingFrom.length === 0 ? null : { bases: stealingFrom, selectionEntered: false })
  return { stealingFrom, runAbilities }
}

/** CPU 타자의 스윙 — 도루 출발 · 송구 결정 뒤 0x34334 판정. 필살 · 번트 · 파울 각 공(`playsFoulBall`)까지 */
export function rollCpuSwing(input: CpuSwingInput, random: RandomPort) {
  const { runner, run, pitcher, thrown, aceLevels } = input
  const cpuBatter = missionCpuBatterOf(run.cpu)
  const batterAbility = cpuBatterAbilityOf(run, cpuBatter, aceLevels)
  const specialSwing = cpuSpecialSwingOf(run, cpuBatter, aceLevels)
  const steal = rollCpuStealOf(input, random)
  // 원본 0x34334 가 보는 상황 — state 의 볼카운트·아웃과 주자 유무(0xa9599)
  const swing = pitchAgainstBatterDetailed(
    thrown.pitch,
    batterAbility,
    random,
    // ab548(구속) · ab582(제구) — 0xb570c(…, 체력%)로 깎은 뒤 피로를 먹인 값
    { control: thrown.fatigued.control, velocity: thrown.fatigued.velocity },
    { strikes: runner.atBatRef.current.strikes, balls: runner.atBatRef.current.balls, outs: run.outs, hasRunner: runnerCountOf(run.bases) > 0 },
    {
      isMistakePitch: thrown.isMistake,
      // 0xb633d(타자) — 마타자 미션의 상대는 마선수 레코드(+0xa 비트 6)라 번트 칸을 뽑아도 친다
      isMagicBatter: cpuBatter?.isAce === true,
      ...(specialSwing === null ? {} : { specialSwing }),
      // 판정 묶음 '투수미션' = 모드 5 — 수비(사람) −10 (0xab5c0, 모드 3·4 밖) 과
      // 0xab42a 의 비트7 투수 +100. 미션 투수는 나리 투수편 저장 [저장+0x3c] 의 선수(0x1fbd0, 9fe86db) 또는
      // 명예 투수(+0x880) 라 레코드 rec[0xa] 비트7(등록 투수 0x80 — C 노트 · 0xb6389)이 서 있다.
      // 연차(+0xb3)는 모드 3·4 갈래(sp40)에서만 읽혀 여기서는 안 쓰인다 — 넘기지 않는다
      swingMode: '투수미션',
      isPitcherOwnPlayer: true,
      // ab838 — 깎은 뒤 체력% 0 이면 B · C 에 +2000
      pitcherStaminaPercent: thrown.pitcherStaminaPercent,
      // 파울 각 공도 수비 판을 돈다 — 낙구 전에 잡히면 파울 뜬공 아웃(13), 아니면 판이 닫힌 뒤 스트라이크(0x35108 → 0xb6b58)
      playsFoulBall: true,
      // 0xab214 ab91c~ — 지금 CPU 타자 레코드 +0x14 (`0xb62b4(타자, n)` — 마스터 줄은 Xls 행 사본, 마타자는 제 행)
      batterSkillIds: missionCpuBatterSkillIdsOf(run, cpuBatter),
      // 같은 갈래가 던지는 미션 투수(나리 · 명전 기록) +0x14 도 `0xb62b4(투수, n)` 로 읽는다 — 장착 비트 + 16
      pitcherSkillIds: pitcher.skillIds,
      skillSituation: missionCpuSwingSituationOf(run, cpuBatter),
    },
  )
  return { swing, steal, batterOrderSlot: cpuBatter?.order ?? 0 }
}
