import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { MissionGameSetup } from '@/entities/mission/model/missionGame'
import type { OriginalMission } from '@/shared/config/original/missions'
import {
  createProgress,
  inningGoalOf,
  isCleared,
  OUTS_PER_INNING,
  recordPitcherOutcome,
} from '@/entities/mission/model/missionGoal'
import { EMPTY_BASES } from '@/entities/game/model/baseState'
import { isHit } from '@/entities/at-bat/model/atBatOutcome'
import { limitOrNull, missionPlay } from '@/entities/mission/model/missionRun'
import type { MissionRun, MissionStatus } from '@/entities/mission/model/missionRun'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { baserunnerAllowedOfFates, chargedRunsOfFates } from '@/features/defense-play/model/runnerFates'
import type { RandomPort } from '@/shared/api/random/randomPort'
import {
  insertMissionAceBatter,
  isMissionCpuBatterAce,
  missionCpuAfterPlateAppearance,
  startMissionCpuTeam,
} from '@/entities/mission/model/missionCpuTeam'
import {
  cpuSideOf,
  flipMissionHalf,
  isMissionGameOver,
  simulateHumanTeamAutoHalf,
  startMissionGame,
  withMissionScore,
} from '@/entities/mission/model/missionGame'

/**
 * 투수편 미션 진행.
 *
 * 타자편과 제한 규칙은 같지만("제한 조건 내에서 목표 달성"),
 * 제한이 타석이 아니라 **투구 수**인 미션이 있다 — 원본 레코드의 투구 수 제한
 * ("10개의 공으로 2삼진을 잡아라!", "6개의 공으로 삼진을 잡아라!").
 */

export interface PitcherRun extends MissionRun {
  /** 남은 투구 수. 제한이 없으면 null. */
  readonly remainingPitches: number | null
  /** 이번 타석에서 나온 PERFECT 게이지 수 */
  readonly perfectGauges: number
  /** 지금까지 잡은 아웃 수 (이닝 목표 계산용) */
  readonly totalOuts: number
  /** 허용한 실점·피안타·볼넷(사구 제외)·출루 허용 — 레코드 실패 한도와 비교한다 (0xaac76~0xaaccc) */
  readonly allowed: {
    readonly runs: number
    readonly hits: number
    readonly walks: number
    /**
     * R+0x130 — **누계가 아니라 방금 정산한 플레이 하나의 값**(0/1). 정산 0xa8c86 이
     * `0xa57f8(R, 0x17, r5)` 로 넣고 점프표 0xd8218[0x17] = 0xa591c 가 `strb (r5 != 0)` 로 **덮어쓴다**.
     * 판정 0xaaa6c 은 정산 바로 뒤에 돌고(0xae24c: 0xae36a → 0xae382 · 0xae3e8: 0xae5b0 → 0xae5c4)
     * 실패(2)는 다음 판정부터 맨 앞(0xaaa8e)에서 돌아가 버려 그대로 남는다.
     */
    readonly baserunner: number
  }
}

export { inningGoalOf, OUTS_PER_INNING } from '@/entities/mission/model/missionGoal'

/** `setup` — 마선수 대결이면 사람 칸 팀을 바꾼다 (`missionHumanTeamIdOf`, 0xaa57c aa6dc~aa728) */
export function startPitcherMission(mission: OriginalMission, setup: MissionGameSetup = {}): PitcherRun {
  return {
    mission,
    progress: createProgress(),
    status: '진행중',
    remainingSeconds: limitOrNull(mission.timeLimitSeconds),
    remainingPlateAppearances: limitOrNull(mission.plateAppearanceLimit),
    remainingSwings: null,
    remainingPitches: limitOrNull(mission.pitchLimit),
    perfectGauges: 0,
    bases: mission.start.runners,
    outs: mission.start.outs,
    totalOuts: 0,
    allowed: { runs: 0, hits: 0, walks: 0, baserunner: 0 },
    cpu: startMissionCpuTeam(mission),
    game: startMissionGame(mission, setup),
  }
}

/** 공 하나를 던졌다. 아직 타석이 끝나지 않은 경우에도 투구 수는 줄어든다. */
export function recordPitch(run: PitcherRun, wasPerfectGauge: boolean): PitcherRun {
  if (run.status !== '진행중') return run

  const remaining = run.remainingPitches === null ? null : run.remainingPitches - 1
  return {
    ...run,
    remainingPitches: remaining,
    perfectGauges: run.perfectGauges + (wasPerfectGauge ? 1 : 0),
  }
}

/**
 * 한도에 닿으면 깨지는 조건 이름 — 실점 → 무실점, 피안타 → 무안타, 볼넷 → 무사사구, 출루 허용 → 무출루.
 *
 * 원본 판정 0xaac76~0xaacd6 은 레코드 바이트(행+0xa0)의 니블을 투수 기록 R 칸과 견준다
 * (`0xaa940`: 한도 > 0 이고 칸 ≥ 한도면 실패 2):
 *   +0xa1 아래 ↔ R+0x128(실점) · +0xa2 위 ↔ **R+0x144(볼넷)** · +0xa2 아래 ↔ R+0x12c(피안타) · +0xa3 ↔ R+0x130(출루 허용, u8)
 * "무사사구" 한도가 보는 R+0x144 는 **볼넷만**이다 — 코드 0x1c 는 볼 카운트 state[5] > 3 일 때뿐(0xa8e04~0xa8e0e)이고
 * 사구는 R+0x148(코드 0x1d, 0xa8e2a)로 따로 간다. 그래서 사구는 이 한도를 채우지 않는다 (이름과 달리 — 원본 그대로).
 *
 * 넷째 한도 +0xa3(s8, `0xaacca ldrsb`) ↔ R+0x130 (`0xaacc6 ldrb [r6,#0xc]`, r6 = R+0x124) — `0xaaccc bl 0xaa940` — 투수 13·14 번만 1 이다.
 *   R+0x130 은 `baserunnerAllowedOfFates`(주자 운명 목록) 로 센다 — 아래 주석. 볼넷·사구 타자도 주자 목록에 들므로 **노히트노런(13번)도
 *   볼넷·사구 하나로 실패**다 — 원본 그대로.
 *
 * 첫 한도 +0xa1 아래 ↔ R+0x128(실점)은 **원본에서도 걸린다** (전수 확인). P1 5-1 의 "쓰는 곳 없음" 은 사건 함수
 * 0xa57f8 의 코드 0x15 만 본 것이다 — 0xa57f8 로 가는 BL 34곳의 r1 은 모두 상수이고 0x15 는 없지만(맞다),
 * 정산 0xa8024 가 사건 함수를 거치지 않고 **직접** 올린다:
 * ```
 * a8ea4  for i in 0 .. 0xa9598(주자관리)−1:  주자 = 0xa9564(관리, i)
 * a8eb2    주자+0x95(득점 표시) == 0 → 건너뜀            ; 바로 득점·보류 득점 둘 다 +0x95 를 세운다 (0xaa1c0)
 * a8ec0    state[6](아웃) == 3 이고 목록 0번 주자+0x96(아웃) != 0 → 건너뜀
 * a8ee4    P = 0xb8c44(수비 팀, 주자+0x30)             ; 그 주자를 내보낸 투수 (+0xa 바이트가 같은 투수)
 * a8f04    기록 대상이면 P+0x22(실점)++ …
 * a8f3c    0xb6388(P) (+0xa 비트7 = 육성·명전 선수) && 0xa56dc(R, P, 0)(기록 대상) 이면
 * a8f56      R+0x128 += 1                                  ; movs r3,#0x94 ; lsls r3,#1 ; ldr/adds/str
 * ```
 * 미션 투수는 육성·명예 투수(선수 고르기 코드 1·3, Q2)라 비트7 이 서 있고, 미션 시작 주자도 0xa9a10 이 지금 투수를
 * 내보낸 투수로 적으므로(0xa9a4e `0xae83d(수비 팀)` → 0xa93ac 넷째 인자) **+0x95 주자 하나마다 1** 이다.
 * 그래서 점수판 득점(`runsScored`)이 아니라 주자 운명 목록으로 센다 — `chargedRunsOfFates`.
 * (상수 0x128 을 만드는 곳을 바이너리 전체에서 훑어 R 객체 함수 영역 0xa5000~0xa9000 에 쓰기는 0xa8f56 하나, 읽기는
 *  평가 0xa651c·0xa65d6·0xa6b7c·0xa6bd8·0xa6c92·0xa6d1c·0xa726c 뿐이다.)
 *
 * 3아웃으로 끝난 플레이에서 원본은 "목록 0번 주자가 살아 있으면 보류됐다 날아간 득점까지 +0x95 로 세고,
 * 죽었으면 그 플레이 득점을 하나도 안 센다" — 점수판 득점과 다를 수 있는 갈래다. 진행기 결과의 `runnerFates`
 * (보류 무효 주자도 `scored`)로 그대로 옮겼다.
 */
function brokenConditionsOf(mission: OriginalMission, allowed: PitcherRun['allowed']): string[] {
  const limits = mission.failLimits
  const reached = (count: number, limit: number) => limit > 0 && count >= limit
  return [
    reached(allowed.runs, limits.runs) ? '무실점' : null,
    reached(allowed.hits, limits.hits) ? '무안타' : null,
    reached(allowed.walks, limits.walks) ? '무사사구' : null,
    reached(allowed.baserunner, limits.baserunners) ? '무출루' : null,
  ].filter((name): name is string => name !== null)
}

/**
 * 수비 쪽에서 주자·아웃을 옮긴다. 3아웃이면 다음 이닝(주자 없음, 0아웃).
 *
 * 인플레이 타구는 타자편 미션과 **같은** 길(`missionPlay` = `missionAdvance` + 주자 운명)로 간다 — 원본 수비 시뮬레이션
 * (태그업 0xa9620 + 자동 진루 0xaf918 "송구보다 2틱 이상 빠를 때만" + 2아웃 득점 보류)이다.
 * 실점(`allowed.runs`)·이닝 목표(`totalOuts`)가 이 결과를 그대로 받는다 (P2 7절 · U-02).
 */
function advanceDefense(run: PitcherRun, outcome: AtBatOutcome, options: PitcherOutcomeOptions) {
  const { advance, runnerFates, outcome: settled } = missionPlay(run.bases, run.outs, outcome, {
    random: options.random,
    played: options.played,
    gameMode: MISSION_PITCHER_MODE,
  })
  const outs = run.outs + advance.outsAdded
  const isInningOver = outs >= OUTS_PER_INNING
  return {
    bases: isInningOver ? EMPTY_BASES : advance.bases,
    outs: isInningOver ? 0 : outs,
    outsAdded: advance.outsAdded,
    /** 점수판 득점 (0xa5c34) — CPU 측 점수 */
    runsScored: advance.runsScored,
    isInningOver,
    /** 기록할 결과 — 판을 돈 타구는 판 끝 정산(0xa8024)이 낸 것 */
    outcome: settled,
    /** 정산(0xa8024)이 보는 주자 목록 — 이닝 정리보다 앞이다 */
    runnerFates,
    /**
     * 정산 때의 state[6] — 원본은 셋째 아웃에서 플레이가 끝나 3 을 넘지 않는다.
     * 웹 진행기가 혹시 넘겨 세어도 원본 칸처럼 3 에서 멈춘 값으로 본다.
     */
    outsAtSettlement: Math.min(OUTS_PER_INNING, outs),
  }
}

/** 미션 투수편 = 원본 전역 모드 **5** (타자편이 6 다 — Q2-mission-rewards 1-0 확정) */
export const MISSION_PITCHER_MODE = 5

export interface PitcherOutcomeOptions {
  /** 주면 수비 진행기의 원본 확률 굴림(펌블·악송구·필살수비)이 돈다 */
  readonly random?: RandomPort
  /** 화면(상태 0x17)이 이미 다 돌린 수비 플레이. 주면 여기서 또 굴리지 않는다 */
  readonly played?: DefensePlayResult
}

/** 타석이 끝났다. 목표를 채우면 성공, 한도·제한에 닿으면 실패다. */
export function applyPitcherOutcome(
  run: PitcherRun,
  outcome: AtBatOutcome,
  options: PitcherOutcomeOptions = {},
): PitcherRun {
  if (run.status !== '진행중') return run

  const defense = advanceDefense(run, outcome, options)
  // 목표·피안타는 판 끝 정산이 낸 결과로 센다 — 넘겨받은 결과는 타석을 끝낸 임시 값이다(`battedContact`)
  const settled = defense.outcome
  const allowed = {
    // R+0x128 = +0x95 주자 수, 3아웃이고 목록 0번이 끝났으면 0 (0xa8ea4~0xa8f56)
    runs: run.allowed.runs + chargedRunsOfFates(defense.runnerFates, defense.outsAtSettlement),
    hits: run.allowed.hits + (isHit(settled) ? 1 : 0),
    // R+0x144 = 볼넷만 (사구는 R+0x148 — `brokenConditionsOf` 머리글)
    walks: run.allowed.walks + (settled.kind === '볼넷' ? 1 : 0),
    // R+0x130 = 이번 플레이 하나의 값 (덮어쓴다) — 목록 마지막 원소의 +0x96 이 꺼져 있나
    baserunner: baserunnerAllowedOfFates(defense.runnerFates) ? 1 : 0,
  }
  const progress = recordPitcherOutcome(
    run.progress,
    settled,
    run.perfectGauges,
    brokenConditionsOf(run.mission, allowed),
    // 아웃 콜 수 — 병살 2 · 삼중살 3 · 안타 판의 주자 아웃 1 (R+0x13c, `recordPitcherOutcome` 머리글). 셋째 아웃에서 판이 끝난다
    defense.outsAtSettlement - run.outs,
  )
  const remainingPlate =
    run.remainingPlateAppearances === null ? null : run.remainingPlateAppearances - 1
  const totalOuts = run.totalOuts + defense.outsAdded

  const next: PitcherRun = {
    ...run,
    progress,
    remainingPlateAppearances: remainingPlate,
    perfectGauges: 0,
    bases: defense.bases,
    outs: defense.outs,
    totalOuts,
    allowed,
    // 같은 정산 0xa8024 가 CPU 타자의 타순 칸 기록(+0x12 · +0x13 · +0x14)을 올리고 0xaf020 이 타순을 넘긴다
    cpu: missionCpuAfterPlateAppearance(run.cpu, settled),
    game: withHalfEnd(withMissionScore(run.game, cpuSideOf(run.mission), defense.runsScored), defense.isInningOver),
  }
  return { ...next, status: judgeStatus(next, defense.outsAtSettlement) }
}

/** 사람 반 이닝이 3아웃으로 끝났다 — 0x18 · 자동진행(`runPitcherMissionAutoHalves`)을 기다린다 */
export function withHalfEnd(game: PitcherRun['game'], isInningOver: boolean): PitcherRun['game'] {
  return isInningOver ? { ...game, halfEnded: true } : game
}

/**
 * **투수 미션의 3아웃 뒤** — 0x18 진입 0x3ac90 → 0x4f928 → 0xc2198 → 자동진행 0x21 → 0x18 → 0xd (`missionGame` 머리글).
 *
 * 1. 반 이닝 넘김 0xb6b6c (경기 끝은 그 타석의 판정 0xaaa6c aad20 이 이미 봤다 — 끝났으면 판이 진행 중이 아니라 여기 안 온다).
 * 2. 사람 칸 팀이 치는 반 이닝 — 0xc1e04 모드 5 는 수비 투수가 CPU 줄이라 통째로 자동이다(`simulateHumanTeamAutoHalf`).
 *    그 사이 경기가 끝나면(c21d6 — 끝내기 · 콜드 · 9회 3아웃) 판정 없이 0x19 → 미션 객체 +0xbc 가 안 서 **실패**.
 * 3. 다시 반 이닝 넘김 + c2248 미션 판정 0xaaa6c (경기가 안 끝났으니 목표 · 한도 그대로 — 지금 판에 바뀌는 칸이 없다).
 * 4. 사람이 수비하는 새 반 이닝 — 빈 루 · 0아웃 (0xaae7c 는 이전 상태 0x18 · 시작 이닝일 때만 시작 상황을 깔고, 여기는 늘 다른 이닝).
 *    그 0xd 의 0xaae7c(r7 = 1, aafca~)가 새 이닝이면(+0x24 ≠ st[0x6b], 시작 이닝부터 8 이닝 안) 지금 타순 레코드에 마타자를 다시 끼운다.
 * 사람이 수비 중이 아니거나 판이 끝났으면 그대로 돌려준다. 난수: 2 의 간이 엔진 굴림(타석마다 0xc1ba4 교체 판정 · 0xc262c 공).
 */
export function runPitcherMissionAutoHalves(run: PitcherRun, random: RandomPort): PitcherRun {
  if (!run.game.halfEnded) return run
  const settled: PitcherRun = { ...run, game: { ...run.game, halfEnded: false } }
  if (settled.status !== '진행중') return settled
  const auto = simulateHumanTeamAutoHalf(flipMissionHalf(settled.game), random)
  if (auto.gameEnded) return { ...settled, game: auto.game, status: '실패' }
  const game = flipMissionHalf(auto.game)
  const judged: PitcherRun = { ...settled, game, bases: EMPTY_BASES, outs: 0 }
  const status = judgeStatus(judged, 0)
  if (status !== '진행중') return { ...judged, status }
  return { ...judged, ...reinsertedAce(judged) }
}

/** 0xd 의 0xaae7c 마타자 다시 끼우기 (ab072~ab0f4) — 새 이닝 첫 0xd 에 한 번, 시작 이닝부터 8 이닝 안 */
function reinsertedAce(run: PitcherRun): Pick<PitcherRun, 'cpu' | 'game'> {
  const { mission, game, cpu } = run
  if (mission.opponentAce <= 0 || game.aceCheckedInning === game.inning) return { cpu, game }
  const checked = { ...game, aceCheckedInning: game.inning }
  const sinceStart = game.inning - (mission.start.inning - 1)
  if (sinceStart < 0 || sinceStart > 8) return { cpu, game: checked }
  const batting = cpu.batting
  if (batting === null || isMissionCpuBatterAce(cpu)) return { cpu, game: checked }
  return { cpu: { ...cpu, batting: insertMissionAceBatter(batting) }, game: checked }
}

/*
 * R+0x130 "출루 허용" — 정산 0xa8024 안 0xa8c2e~0xa8c86 (R15 11-1 · P7 A1-1, 직접 다시 뜸).
 *
 * ```
 * a8c5c  for i in 0 .. 0xa9598(주자관리)−1:          ; 주자 목록 = [타자주자?, 1루, 2루, 3루 중 찬 루] 오름차순
 * a8c66    r3 = 0xa9564(관리, i)+0x96                ; 처리 끝 (득점해도 0xa9520 이 같은 칸을 세운다)
 * a8c6a    r5 = 0 ; if r3 == 0 → r5 = 1             ; ⚠️ 루프 안에서 0 으로 되돌린다 → **마지막 원소 하나만** 본다
 * a8c86  0xa57f8(R, 0x17, r5)                       ; R+0x130 = (r5 != 0)
 * ```
 * 목록(I 3b-1): 투구 전 `0xa9a10` 이 찬 루를 **3 → 2 → 1 루 순서로 맨 앞에 끼워** `[1루, 2루, 3루]` 오름차순을 만들고,
 * 상태 0x17 진입 `0x46418` 이 타자주자를 `0xa93ac` 로 **맨 앞에** 하나 더 끼운다. 그 조건은 0x464a8~0x464cc:
 * `state[0x11] != 0 || 플레이 종류 ∈ {2, 3} || state[0x1a]`, 그리고 종류 ≠ 8. 볼넷(판정 3, 0x3e1ae)·사구(판정 4,
 * 0x3e1b4)는 **둘 다 종류 2**(0x3e1cc `movs r1,#2` → 0xb0cb8)라 타자주자가 목록에 든다. 삼진은 상태 0x17 을 안 거친다
 * (0xae24c 가 판정 5 를 바로 정산 0xa8024 로 보낸다, 0xae360) → 타자주자 없음.
 * 그래서 **마지막 원소 = 투구 때 맨 앞 주자(가장 높은 루), 주자가 없으면 타자주자**다.
 *
 * 예전에는 진행기가 주자별 운명을 안 내줘 "득점 없고 가장 높은 찬 루 ≥ 맨 앞 주자 출발 루" 로 근사했다.
 * 이제 `missionPlay` 의 `runnerFates`(진행기 결과 · 진행기 없는 결과는 `runnerFatesWithoutPlay`)를
 * `baserunnerAllowedOfFates` 로 그대로 읽는다 — 앞 주자가 잡히고 뒤 주자가 그 루 이상까지 간 플레이도 원본대로 0 이다.
 */

/**
 * 진행 중인 판을 판 끝 판정 0xaaa6c 의 순서(실패 한도 → 목표 → 남은 기회)로 다시 잰다 — 정산이 칸을 고친 뒤
 * (낫아웃 보정 a8cfc 등) 판정이 도는 갈래를 위해 내보낸다. 이미 끝난 판은 그대로다.
 */
export function judgePitcherRun(run: PitcherRun, outs: number = run.game.halfEnded ? OUTS_PER_INNING : run.outs): PitcherRun {
  return run.status === '진행중' ? { ...run, status: judgeStatus(run, outs) } : run
}

/**
 * **판 끝 미션 판정 0xaaa6c 의 모드 5 갈래** (aab9c~aad20) — `outs` 는 판정 때 state[6](3아웃 판이면 3).
 * ```
 * aac48  +0xa1 아래(실점) · +0xa2 아래(피안타) · +0xa3(출루 허용) 한도가 모두 있으면: 경기 끝(0xb68fc)이 아니면 상태 ≥ 1(아직)
 * aac76~ 목표 칸(0xaa928) · 실패 한도(0xaa940) · 목표가 다 안 찼으면 타석 · 투구 수 한도
 * aad20  경기 끝이고 아직(1)이면 실패(2)
 * ```
 * 노히트노런(13) · 퍼펙트게임(14)은 첫 줄이 서는 미션이다 — 이닝 수를 세지 않고 **한도가 깨지지 않은 채 경기가 끝나면** 성공이다
 * (예: 9회초 3아웃에 사람 칸(홈)이 앞서 있으면 끝). 목표 칸 +0xa4(아웃)이 둘 다 0 이라 aabd6 갈래는 어느 미션에서도 안 선다.
 */
function judgeStatus(run: PitcherRun, outs: number): MissionStatus {
  if (run.progress.brokenConditions.length > 0) return '실패'

  const gameOver = isMissionGameOver(run.game, outs)
  const limits = run.mission.failLimits
  const waitsForGameEnd = limits.runs > 0 && limits.hits > 0 && limits.baserunners > 0
  const inningGoal = inningGoalOf(run.mission)
  const isDone = (!waitsForGameEnd || gameOver) && (inningGoal !== null || isCleared(run.mission, run.progress))
  if (isDone) return '성공'
  if (gameOver) return '실패'
  return isOutOfChances(run.remainingPlateAppearances, run.remainingPitches) ? '실패' : '진행중'
}

function isOutOfChances(remainingPlate: number | null, remainingPitches: number | null): boolean {
  if (remainingPlate !== null && remainingPlate <= 0) return true
  return remainingPitches !== null && remainingPitches <= 0
}

/** 투구 수를 다 쓰면 타석 도중이라도 실패다. */
export function checkPitchExhausted(run: PitcherRun): PitcherRun {
  if (run.status !== '진행중' || run.remainingPitches === null) return run
  return run.remainingPitches <= 0 ? { ...run, status: '실패' } : run
}
