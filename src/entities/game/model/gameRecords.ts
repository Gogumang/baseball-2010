import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { BALANCE } from '@/shared/config/original/balance'

/**
 * 기록달성 (binary.mod 0xa77f0 기록 추가 · 0x4ea0c 경기 끝 지급 — 누락 탐색 9차, QA 대조).
 * 기록마다 횟수를 세고, 경기가 끝나면 Σ 횟수 × 금액을 G포인트로 준다 (상한 99999). 이름은 StrGAME[id+8].
 * 금액 표는 두 벌이고 값은 같다: 경기 끝 지급이 0xcfbf8, 경기 중 누계가 0xd8158.
 *
 * **원본은 기록을 팀 단위로 센다.** 지급 게이트 0xa77f0 은 그 밖에도 세 가지를 본다 (R8 1절·9절):
 *   ① 자동진행(30G 스킵)으로 넘어간 뒤에는 아무것도 주지 않는다
 *   ② 모드 5·6·7(미션 투수·타자·홈런더비)에서는 아무것도 주지 않는다
 *   ③ 번호마다 방향이 고정이다 — 0~15·32~35·37~39 는 사람 **공격**, 16~31·36 은 사람 **수비**
 *      (28~31·37~39 는 게이트를 건너뛰고 0xa7de8 이 직접 가린다)
 * 지금 웹은 나만의리그 타자편(모드 4)이고 자동진행이 없으며, 모드 3·4 에서는 내 팀 전체가
 * "사람 팀" 이라(0x3a20a) 공격·수비 양쪽이 다 통과한다 → 세 조건 모두 지금은 걸리지 않는다.
 * 동료 여덟 타순의 기록도 여기로 들어온다 — `batterGameLog.ts` 가 타순별로 따로 세고,
 * 사용자 타석과 같은 `recordBatterAtBat` 을 쓴다.
 * 완투 계열 28~31 도 들어왔다 (`completeGameRecordIdsOf`) — 상대 공격이 실제 타석으로 돌아가
 * 피안타·실점을 셀 수 있게 되면서 가능해졌다.
 * 삼진 계열 16~23 과 삼구 삼자범퇴 25 도 들어왔다 — 투구 판정 경로(0xc1818)를 옮기면서 공 수·볼 카운트를
 * 셀 수 있게 된 덕이다.
 * 남은 아홉 가지(5 대타 홈런 · 6·7 백투백 · 8 도루 성공 · 24 도루 저지 · 26·27 병살·삼중살 ·
 * 32·33 연속 파울 · 36 필살송구 아웃)는 **판정 함수만 있고 아직 배선되지 않았다** — 이 파일 아래쪽,
 * 함수마다 "배선 자리" 를 적어 두었다. 붙기 전까지는 그만큼 원본보다 G 수입이 적다.
 * 상대 공격은 이제 원본 간이 타석(0xc11f0)으로 돌지만 아직 타격 결과만 만든다 —
 * 삼진 콤보·병살·삼자범퇴 같은 투구·수비 사건을 세려면 수비 쪽 상태(state+0x88~0x8a)를 더 옮겨야 한다.
 * 경기 중 누계를 화면에 실시간으로 보여 주는 것(0xa77f0)도 아직 없다.
 */
export const RECORD_NAMES: readonly string[] = [
  '3루타', '솔로 홈런', '2점 홈런', '3점 홈런', '만루 홈런', '대타 홈런', '백투백 홈런', '백투백투백 홈런',
  '도루 성공', '연타석 히트 x3', '연타석 히트 x4', '연타석 히트 x5', '한 타자 2홈런', '한 타자 3홈런',
  '한 타자 4홈런', '사이클링 히트', '삼구 삼진', '풀카운트 삼진', '삼진 콤보 x3', '삼진 콤보 x6', '삼진 콤보 x9',
  '한 투수 10삼진', '한 투수 15삼진', '한 투수 20삼진', '도루 저지', '삼구 삼자범퇴', '더블플레이', '트리플플레이',
  '완투승', '완봉승', '노히트노런', '퍼펙트게임', '3연속 파울', '4연속 파울', '한 타자 2볼넷', '한 타자 3볼넷',
  '필살송구 아웃', '10점차 이상 승', '20점차 이상 승', '30점차 이상 승',
]

const RECORD_GAME_POINTS: readonly number[] = BALANCE.recordGamePoints

const RECORD = {
  triple: 0,
  soloHomeRun: 1,
  consecutiveHits: 9,
  multipleHomeRuns: 12,
  cycle: 15,
  multipleWalks: 34,
  marginWin: 37,
} as const

export interface AtBatRecordInput {
  readonly outcome: AtBatOutcome
  /** 이 플레이로 들어온 점수 — 홈런이면 1~4 */
  readonly runsScored: number
  /** 이 타석까지 이어진 연타석 안타 수 */
  readonly consecutiveHits: number
  /** 이 타석까지 이 경기 홈런 수 */
  readonly homeRunsInGame: number
  /** 이 타석까지 이 경기 볼넷 수 */
  readonly walksInGame: number
  /** 이 타석으로 사이클링 히트가 완성되었는가 */
  readonly completesCycle: boolean
}

const TIERED_FROM = { consecutiveHits: 3, homeRuns: 2, walks: 2 }
const tierOf = (count: number, from: number, tiers: number) =>
  count >= from && count < from + tiers ? count - from : null

/** 사용자 타석 하나에서 달성한 기록 id (판정 함수 0xa8024 · 0xa7b90 · 0xa7b00 · 0xa7a7c) */
export function atBatRecordIdsOf(input: AtBatRecordInput): number[] {
  const ids: number[] = []
  const { outcome } = input
  if (outcome.kind === '안타' && outcome.bases === 3) ids.push(RECORD.triple)
  if (outcome.kind === '홈런') ids.push(RECORD.soloHomeRun + Math.min(Math.max(input.runsScored, 1), 4) - 1)
  const isHit = outcome.kind === '안타' || outcome.kind === '홈런'
  const hitTier = isHit ? tierOf(input.consecutiveHits, TIERED_FROM.consecutiveHits, 3) : null
  if (hitTier !== null) ids.push(RECORD.consecutiveHits + hitTier)
  const homeRunTier = outcome.kind === '홈런' ? tierOf(input.homeRunsInGame, TIERED_FROM.homeRuns, 3) : null
  if (homeRunTier !== null) ids.push(RECORD.multipleHomeRuns + homeRunTier)
  if (input.completesCycle) ids.push(RECORD.cycle)
  const walkTier = outcome.kind === '볼넷' ? tierOf(input.walksInGame, TIERED_FROM.walks, 2) : null
  if (walkTier !== null) ids.push(RECORD.multipleWalks + walkTier)
  return ids
}

const MARGIN_STEP = 10
const MARGIN_TIERS = 3

/** 경기 끝 점수차 승 (0xa7de8) — 30 → 20 → 10 순 if/else 라 가장 큰 단계 하나만 준다 (0xa7f22 확인) */
export function gameEndRecordIdsOf(winningMargin: number): number[] {
  const tier = Math.min(MARGIN_TIERS, Math.floor(winningMargin / MARGIN_STEP))
  return tier >= 1 ? [RECORD.marginWin + tier - 1] : []
}

const COMPLETE_GAME = { completeGame: 28, shutout: 29, noHitter: 30, perfect: 31 } as const
/** 퍼펙트게임은 아웃이 28 미만일 때만 인정된다 — 연장에 가면 안 된다 (0xa7de8) */
const PERFECT_GAME_OUT_LIMIT = 28
const OUTS_PER_INNING = 3

export interface CompleteGameInput {
  /** 게임 모드 (0x1552d10). 원본은 **모드 4(나만의리그 타자편)면 완투 계열을 주지 않는다** */
  readonly mode: number
  /** 사람 팀이 이겼는가 (0xb69c8 — 동점이면 팀 0 승) */
  readonly won: boolean
  /** 이 경기에서 사람이 투구 코스를 한 번이라도 확정했는가 (state+0x8c) */
  readonly pitchCourseConfirmed: boolean
  /** 실제로 치른 이닝 수 — 연장이면 그만큼 늘어난다 (state[0x6b]+1) */
  readonly inningsPlayed: number
  /** 우리 투수가 잡은 아웃 수 */
  readonly outsRecorded: number
  readonly hitsAllowed: number
  readonly walksAllowed: number
  readonly runsAllowed: number
}

/** 완투 계열을 주지 않는 모드 — 나만의리그 타자편 (0xa7de8 의 `모드 == 4 → 끝`) */
const NO_COMPLETE_GAME_MODE = 4

/**
 * 완투 계열 기록 (0xa7de8). 마스크 0xe0f 라 0xa77f0 의 팀 게이트는 건너뛰지만,
 * **부르는 쪽인 0xa7de8 이 스스로 네 가지를 먼저 본다** (R8 6절, 확정):
 *   ① 사람 팀이 이긴 경기 ② 모드 ≠ 4(나만의리그 타자편)
 *   ③ 이 경기에서 사람이 투구 코스를 한 번이라도 확정했음 (state+0x8c)
 *   ④ 현재 투수가 잡은 아웃 == 3 × 치른 이닝 — **정규 9이닝이 아니라 경기에서 치른 이닝 전부**
 * 그 다음에 등급을 가린다:
 *   출루·피안타·실점이 모두 0 이고 아웃 ≤ 27 → 퍼펙트게임(31)
 *   피안타·실점이 0 → 노히트노런(30) · 실점이 0 → 완봉승(29) · 그 밖 → 완투승(28)
 *
 * 지금 웹의 나만의리그 타자편은 모드 4 라 **원본대로면 이 넷이 한 번도 나오지 않는다.**
 * 투수편·일반모드를 옮기면 그때 살아난다.
 *
 * 볼넷은 투구 판정 경로(0xc1818)를 옮기면서 들어왔다. 데드볼(코드 4, 상태 플래그 state[0x12])의 조건은
 * 해독돼 있다(P7-leftovers 55행 · R10 6절): **스윙하지 않았고** 공의 화면 좌표가 사각형 0xcfd50
 * (x 171, y 240, 폭 38, 높이 130) 안이면 사구다(0x35a20) — 좌타자는 x 를 480 − x − 폭 으로 뒤집어 본다.
 * 정산 0xa8024 는 사구에도 투수 볼넷 칸 +0x2a 를 올리고 타석 결과 9 로 적는다(R8 5-4). 퍼펙트 판정의
 * 출루 칸 state[0x88] 에 사구가 들어가는지는 이 칸을 쓰는 곳을 안 봐서 미해결이다(R8 6절 "유력").
 */
export function completeGameRecordIdsOf(input: CompleteGameInput): number[] {
  if (!input.won) return []
  if (input.mode === NO_COMPLETE_GAME_MODE) return []
  if (!input.pitchCourseConfirmed) return []
  if (input.outsRecorded !== input.inningsPlayed * OUTS_PER_INNING) return []
  if (
    input.hitsAllowed === 0 &&
    input.walksAllowed === 0 &&
    input.runsAllowed === 0 &&
    input.outsRecorded < PERFECT_GAME_OUT_LIMIT
  ) {
    return [COMPLETE_GAME.perfect]
  }
  if (input.hitsAllowed === 0 && input.runsAllowed === 0) return [COMPLETE_GAME.noHitter]
  if (input.runsAllowed === 0) return [COMPLETE_GAME.shutout]
  return [COMPLETE_GAME.completeGame]
}

const STRIKEOUT = {
  threePitch: 16,
  fullCount: 17,
  combo: 18,
  pitcherTotal: 21,
  threePitchInning: 25,
} as const
/** 삼진 콤보는 3·6·9 연속에서 준다 (18·19·20) */
const COMBO_STEPS = [3, 6, 9]
/** 한 투수 삼진은 10·15·20 에서 준다 (21·22·23) */
const PITCHER_TOTAL_STEPS = [10, 15, 20]
/** 삼구 삼진 — 세 개로 끝낸 삼진 */
const THREE_PITCH_COUNT = 3
/** 풀카운트 = 볼 셋 */
const FULL_COUNT_BALLS = 3
/** 삼구 삼자범퇴 — 한 이닝을 공 셋으로 끝낸다 */
const THREE_PITCH_INNING_PITCHES = 3

export interface StrikeoutRecordInput {
  /** 이 타석에서 던진 공 수 */
  readonly pitches: number
  /** 끝났을 때의 볼 카운트 */
  readonly balls: number
  /** 이 삼진까지 이어진 연속 삼진 수 */
  readonly comboCount: number
  /** 이 삼진까지 우리 투수가 잡은 삼진 수 */
  readonly pitcherStrikeouts: number
}

/**
 * 삼진 계열 기록 — 판정 자리는 셋으로 나뉜다 (R8 7절·9절 확정):
 *   16·17 삼구/풀카운트 삼진 → 0xa7c4c · **18~23 삼진 콤보와 한 투수 10/15/20 삼진 → 0xa7998**
 *   25 삼구 삼자범퇴 → 0xa7d0c
 *   16 삼구 삼진 · 17 풀카운트 삼진 · 18~20 삼진 콤보 x3/x6/x9 · 21~23 한 투수 10/15/20삼진
 * 우리 투수가 잡은 삼진에만 준다 (0xa77f0 게이트가 수비 팀이 사람 팀인지 본다).
 */
export function strikeoutRecordIdsOf(input: StrikeoutRecordInput): number[] {
  const ids: number[] = []
  if (input.pitches === THREE_PITCH_COUNT) ids.push(STRIKEOUT.threePitch)
  if (input.balls === FULL_COUNT_BALLS) ids.push(STRIKEOUT.fullCount)
  const comboStep = COMBO_STEPS.indexOf(input.comboCount)
  if (comboStep >= 0) ids.push(STRIKEOUT.combo + comboStep)
  const totalStep = PITCHER_TOTAL_STEPS.indexOf(input.pitcherStrikeouts)
  if (totalStep >= 0) ids.push(STRIKEOUT.pitcherTotal + totalStep)
  return ids
}

/** 삼구 삼자범퇴 (25) — 한 이닝을 공 셋으로 끝냈는가 */
export function threePitchInningRecordIdsOf(pitchesInInning: number, outs: number): number[] {
  return pitchesInInning === THREE_PITCH_INNING_PITCHES && outs >= OUTS_PER_INNING
    ? [STRIKEOUT.threePitchInning]
    : []
}

export function recordGamePointsOf(recordIds: readonly number[]): number {
  return recordIds.reduce((total, id) => total + (RECORD_GAME_POINTS[id] ?? 0), 0)
}

/*
 * ── 남은 아홉 가지 (R8 5절·4-4·8절 표) — 판정 함수만 있다. 배선은 아직 없다. ──
 *
 * 모두 0xa77f0 게이트를 **통과하기 전** 의 후보를 돌려준다. 게이트는 번호마다 방향이 고정이다:
 *   5·6·7·8·32·33 = 사람 **공격** 때만, 24·26·27·36 = 사람 **수비** 때만 집계.
 * 부르는 쪽이 그 방향을 맞춰야 한다 (예: 사람 공격 중 잡힌 도루는 24 후보가 나오지만 게이트에서 버려진다).
 */

const PLAY_RECORD = {
  pinchHitHomeRun: 5,
  backToBack: 6,
  backToBackToBack: 7,
  stolenBase: 8,
  caughtStealing: 24,
  doublePlay: 26,
  triplePlay: 27,
  threeFouls: 32,
  fourFouls: 33,
  laserThrowOut: 36,
} as const

/**
 * 5 대타 홈런 — 0xa8024 @a8764: 홈런 수(sp+0x24) > 0 이고 ctx+0x160 ≠ 0.
 * ctx+0x160 은 대타 교체 0xa5bf0(ctx, 0) 이 1 로 세우고(0xa5c1e, 공격 팀이 사람일 때만 —
 * 경기 상태 0x16 처리 0x3d458 → 0x3d57e), 타석 초기화 0xa5bcc 가 0 으로 지운다.
 * → "사람 팀이 대타를 낸 **그 타석** 의 홈런". 홈런 단계 1~4 와 **함께** 준다.
 * ⚠️ **유력**: 타석 초기화(상태 0xd)가 교체(0xb → 0x16)보다 먼저 돈다는 순서에 기댄다 —
 *    거꾸로면 플래그가 곧바로 지워져 5 는 영영 안 나온다 (R8 5-3).
 * 배선 자리: gameFlow.ts 에는 없다 — 나만의리그 타자편에는 사람 대타가 없다. 대타가 있는 쪽
 *   (teamGameFlow 의 `pinchHit` 뒤 첫 타석 결과 처리)에서 그 타석이 대타 타석인지 넘겨야 한다.
 *   gameFlow.ts 에 대타가 생기면 `finishPlayerOutcome` 의 `recordBatterAtBat` 바로 뒤.
 */
export function pinchHitHomeRunRecordIdsOf(input: {
  readonly isHomeRun: boolean
  /** 이 타석이 사람 팀이 낸 대타의 타석인가 (ctx+0x160) */
  readonly isPinchHitAtBat: boolean
}): number[] {
  return input.isHomeRun && input.isPinchHitAtBat ? [PLAY_RECORD.pinchHitHomeRun] : []
}

export interface BackToBackInput {
  /** 지금까지 이어진 사람 팀 연속 홈런 수 (ctx+0x162) */
  readonly streak: number
  /** 이 타석의 공격 팀이 사람 팀인가 (state[0x31 + state[9]] == 0) */
  readonly humanOffense: boolean
  readonly isHomeRun: boolean
}

/**
 * 6 백투백 · 7 백투백투백 — 0xa794c(@a797e·a798a), 카운터 ctx+0x162 (s8).
 *   홈런 타석(0xa8024 @a8606 이 부름): 공격 팀이 사람이면 ++ → 2 면 6, 3 이면 7 을 주고 0 으로.
 *                                      사람이 아니면 0.
 *   홈런 아닌 결과로 끝난 타석: 공격 팀과 무관하게 0 — 안타 @a86b4 · 범타·삼진 @a8ab2 · 볼넷 @a8b7e ·
 *                                      사구 @a8bf8.
 * 3연속이면 두 번째에 6, 세 번째에 7. 7 뒤 0 으로 돌아가므로 다섯 번째 연속 홈런에서 다시 6.
 * 도루 같은 주자 플레이(종류 5, 타석 완료 아님)는 카운터를 건드리지 않는다 — 이 함수를 부르지 말 것.
 * 배선 자리: gameFlow.ts `finishPlayerOutcome`(사용자 타석, recordBatterAtBat 옆)과 `playTeammateAtBat`
 *   (동료 타석 — 간이 엔진도 0xa8024 를 지난다)에서 humanOffense = true 로, `playOpponentInning` 의
 *   상대 타석마다 humanOffense = false 로 부른다. 카운터는 GameProgress 에 한 칸(팀 단위)으로 둔다.
 */
export function backToBackRecordOf(input: BackToBackInput): { readonly streak: number; readonly recordIds: number[] } {
  if (!input.isHomeRun || !input.humanOffense) return { streak: 0, recordIds: [] }
  const streak = input.streak + 1
  if (streak === 2) return { streak, recordIds: [PLAY_RECORD.backToBack] }
  if (streak === 3) return { streak: 0, recordIds: [PLAY_RECORD.backToBackToBack] }
  return { streak, recordIds: [] }
}

/** 주자 플레이 정산에서 보는 주자 한 명 (0xa9565(i) 의 주자 객체) */
export interface StealPlayRunner {
  /** 그 주자가 선 루에서 도루를 걸었는가 (state[0x14 + 출발 루] ≠ 0) */
  readonly stealStarted: boolean
  /** 출발 루 (r+0x90) */
  readonly fromBase: number
  /** 지금 루 (r+0x8c) */
  readonly currentBase: number
  /** 목표 루 — r+0x80 · r+0x84 중 큰 것 */
  readonly targetBase: number
  /** 플레이가 끝났는가 (r+0x96) */
  readonly finished: boolean
  /** 세이프·득점했는가 (r+0x95) */
  readonly safe: boolean
}

/**
 * 8 도루 성공 · 24 도루 저지 — 0xa8024 @a83c6 · @a83de (0xa8268~0xa83e2 확인).
 * 플레이 종류 state[0x26] == 5(주자 플레이)인 정산에서만 본다.
 *   (가) 도루를 걸고 다음 루(출발+1 == 목표)를 노린 주자가 끝났는데 세이프가 아니면 → 24 **한 번** 주고 끝
 *       (둘을 잡아도 1회, 그리고 (나)를 건너뛴다)
 *   (나) 아무도 안 잡혔으면 도루를 걸었고 루가 바뀐(출발 ≠ 지금) 주자**마다** 8
 * 한 명이라도 잡히면 나머지가 살아도 8 은 없다. 게이트상 8 은 사람 공격, 24 는 사람 수비 때만 남는다.
 * 간이 엔진의 자동 도루(0xc1818 끝)는 0xa77f0 을 부르지 않는다 → 동료 타석 자동 도루에는 붙이지 말 것.
 * 배선 자리: gameFlow.ts `stealBase` — 성공 갈래(`도루 성공` 로그)에서 runners 하나(출발 ≠ 지금)로,
 *   실패 갈래에서 잡힌 주자로 부르면 원본대로 8 / (24 후보 → 사람 공격이라 게이트에서 버림)이 된다.
 *   24 가 실제로 쌓이는 곳은 사람 수비 화면(투수편·팀 경기의 CPU 도루 수비)이다.
 */
export function stealPlayRecordIdsOf(input: {
  /** 정산 때 플레이 종류가 5(주자 플레이)인가 (state[0x26] == 5) */
  readonly isRunnerPlay: boolean
  readonly runners: readonly StealPlayRunner[]
}): number[] {
  if (!input.isRunnerPlay) return []
  const caught = input.runners.some(
    (runner) =>
      runner.stealStarted &&
      runner.fromBase + 1 === runner.targetBase &&
      runner.finished &&
      !runner.safe,
  )
  if (caught) return [PLAY_RECORD.caughtStealing]
  return input.runners
    .filter((runner) => runner.stealStarted && runner.fromBase !== runner.currentBase)
    .map(() => PLAY_RECORD.stolenBase)
}

/**
 * 26 더블플레이 · 27 트리플플레이 — 0xa8024 @a8e70 · @a8e84 (0xa8e58~0xa8e84 확인).
 * 아웃 수 = 이 플레이 이벤트 목록의 삼진(5)·아웃(0xd) 개수 — 목록은 **투구마다** 비워진다(0xa5e80),
 * 그러니 "공 하나로 생긴 플레이" 의 아웃 수다.
 *   아웃 2 → 주자 달리는 중 삼진(state[0x1a], 0xb6c3c)이 아니면 26 · 아웃 3 → 27 (state[0x1a] 와 무관)
 * 플레이 종류와 무관하게 매 정산 본다. 게이트상 사람 수비 때만 남는다.
 * 배선 자리: gameFlow.ts 에는 없다 — `playOpponentInning` 은 간이 엔진이라 한 타석 아웃이 하나다(E-9),
 *   사용자 타석의 병살은 사람 공격이라 게이트에서 버려진다. 사람 수비 화면(투수편 pitcherGameFlow,
 *   팀 경기 수비)의 플레이 정산에서 outsInPlay 로 부른다.
 */
export function multiOutPlayRecordIdsOf(input: {
  readonly outsInPlay: number
  /** state[0x1a] — 주자가 달리는 중 나온 삼진 (P7 E3) */
  readonly strikeoutWhileRunning: boolean
}): number[] {
  if (input.outsInPlay === 2) return input.strikeoutWhileRunning ? [] : [PLAY_RECORD.doublePlay]
  if (input.outsInPlay === 3) return [PLAY_RECORD.triplePlay]
  return []
}

/**
 * 32 3연속 파울 · 33 4연속 파울 — 0xa7dbc @a7dda (확인). 파울 한 개마다 ctx+0x15f 를 올리고
 * 3 이 되면 32, 4 가 되면 33. 5 번째부터는 아무것도 없고 4 에서 되돌리지도 않는다.
 * 부르는 곳은 사람 타석 판정 0x51408 의 v = 7(파울) 갈래 하나뿐 → 간이 엔진 동료 타석에서는 안 나온다.
 * 0 으로: 타석 초기화 0xa5bcc, 그리고 공 도착 판정 0x3dfac 끝의 0xa5fdc → 파울 아닌 공이 오면 끊긴다
 *   (⚠️ **유력** — 0x3dfac 의 모든 갈래가 끝을 지나는지는 안 봤다. 리셋은 부르는 쪽이 0 을 넘겨 한다).
 * 게이트상 사람 공격 때만.
 * 배선 자리: gameFlow.ts 는 타석 결과만 받으므로 공 하나하나의 파울을 모른다 — 사용자 타석의 투구 루프
 *   (play-at-bat 의 공 판정)에서 파울마다 부르고, 모인 id 를 `applyPlayerOutcome` → `finishPlayerOutcome` 의
 *   recordIds 에 함께 얹는다. 동료 타석(`playTeammateAtBat`)에는 붙이지 말 것.
 */
export function foulRecordOf(foulStreak: number): { readonly foulStreak: number; readonly recordIds: number[] } {
  const next = foulStreak + 1
  if (next === 3) return { foulStreak: next, recordIds: [PLAY_RECORD.threeFouls] }
  if (next === 4) return { foulStreak: next, recordIds: [PLAY_RECORD.fourFouls] }
  return { foulStreak: next, recordIds: [] }
}

/**
 * 36 필살송구 아웃 — 0xa8024 @a810c (0xa80f8~0xa8116 확인, R3 5절).
 * 이 플레이 아웃 수(sp+0x30) > 0 이고 state[0x8b](레이저 송구 뒤 아웃 결과)가 서 있으면 36 을 주고
 * state[0x8b] 를 0 으로. **아웃이 없으면 플래그를 지우지 않는다** — 지우는 strb 가 BL 뒤에만 있다.
 * 게이트상 사람 수비 때만, 사람 수비 화면이 있어야 한다.
 * 배선 자리: gameFlow.ts 에는 없다(타자편 수비는 간이 엔진). 사람 수비 플레이 정산(투수편·팀 경기 수비)에서
 *   돌려받은 laserThrowFlag 를 상태에 되돌려 둔다.
 */
export function laserThrowOutRecordOf(input: {
  /** state[0x8b] */
  readonly laserThrowFlag: boolean
  readonly outsInPlay: number
}): { readonly laserThrowFlag: boolean; readonly recordIds: number[] } {
  if (input.outsInPlay > 0 && input.laserThrowFlag) {
    return { laserThrowFlag: false, recordIds: [PLAY_RECORD.laserThrowOut] }
  }
  return { laserThrowFlag: input.laserThrowFlag, recordIds: [] }
}
