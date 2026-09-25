import type { RandomPort } from '@/shared/api/random/randomPort'
import { KOREA_TEAM_ID } from '@/entities/season-mode/model/seasonRewards'

/**
 * 국가대항전 대회 레코드.
 *
 * 근거: `docs/re/_raw/notes/P5-national-match.md` 1a 절 (확정) —
 *   초기화 `0xb7bf0` · 하루 끝 `0xb818c` 의 국가대항전 가지 · 대진 `0xb7614` ·
 *   순위 `0xb7f0c` · 승패 기록 `0xb76dc`/`0xb77e0` · 동전 던지기 `0xb858c` ·
 *   대한민국 결승 여부 `0xb8565`.
 *
 * 원본은 정규 리그와 **같은 구조체 L** 의 뒤쪽 칸(`L+0xa8`~`L+0xc4`)을 대회 전용으로 돌려 쓴다.
 * 웹판은 정규 리그(`entities/league`)와 섞이지 않게 따로 뺐다 — 칸 주석의 `L+0x..` 가 원본 자리다.
 *
 * 진행 플래그 자체는 여기 없다. 그건 `SeasonRecord.nationalCup`(`S+0x12c` = `L+0xac`) 이다.
 */
export interface NationalCup {
  /** L+0xa8..0xab — 참가 4국 팀 번호 (대한민국·일본·쿠바·미국) */
  readonly teams: readonly number[]
  /** L+0xb0..0xb3 — 4국 승 (칸 차례는 `teams` 와 같다) */
  readonly wins: readonly number[]
  /** L+0xb4..0xb7 — 4국 패 */
  readonly losses: readonly number[]
  /** L+0xb8..0xc3 — 풀리그 3라운드 × 4칸 대진 (라운드마다 [내팀, 상대, CPU a, CPU b]) */
  readonly matches: readonly (readonly number[])[]
  /** L+0xad — 남은 단계. 4 → 3 → 2(풀리그) → 1(결승) → 0(끝) */
  readonly stage: number
  /** L+0xae / L+0xaf — 결승 두 팀. 정해지기 전에는 15 다 */
  readonly finalists: readonly [number, number]
  /** L+0xc4 — 우승국. 정해지기 전에는 15 다 */
  readonly champion: number
  /** L+0x32 — 대회 날짜 g (0 부터). 선발 투수 칸을 고르는 데 쓴다 */
  readonly day: number
}

export { KOREA_TEAM_ID }

/** 참가 4국 — 원본 `0xb7bf0` 이 `L+0xa8..ab = 10,11,12,13` 으로 채운다. `teams.ts` 의 히든 팀과 같다 */
export const NATIONAL_CUP_TEAM_IDS: readonly number[] = [10, 11, 12, 13]

/** 아직 안 정한 팀 번호 (원본 15 = 0xf) */
export const UNDECIDED_TEAM = 15

/**
 * 대진 표 `0xd89bc` = `[0,1,2,3, 0,2,1,3, 0,3,1,2]`.
 * 값은 `teams` 의 칸 번호라 풀리그 3라운드 × 2경기가 된다:
 *   1R 한국–일본 · 쿠바–미국 / 2R 한국–쿠바 · 일본–미국 / 3R 한국–미국 · 일본–쿠바
 * 대한민국은 **늘 라운드 첫 경기의 칸 0** 이라 칸 1 이 내 상대다.
 */
export const ROUND_TABLE: readonly number[] = [0, 1, 2, 3, 0, 2, 1, 3, 0, 3, 1, 2]

/** 풀리그 라운드 수 (표 0xd89bc 가 4칸 × 3) */
export const NATIONAL_CUP_ROUNDS = 3
/** 한 라운드 칸 수 — [내팀, 상대, CPU a, CPU b] */
export const SLOTS_PER_ROUND = 4
/** 초기 단계 (`L+0xad = 4`) */
export const FIRST_STAGE = 4
/** 결승 날 단계 */
export const FINAL_STAGE = 1

/**
 * 국가대항전 투수 스태미나 — 원본은 선발 시(`0xb7bf0` 끝)·하루 끝(`0xb818c`)·첫날(`0x19f30`) 마다
 * `0xb6190` 으로 대한민국 투수 **전원을 10000(완전 회복)** 으로 만든다. 즉 매 경기 완전 회복이다.
 *
 * ⚠️ 웹판에는 팀 투수의 누적 스태미나를 들고 있는 자리가 아직 없어(`entities/team` 은 붙박이 표다)
 * 옮길 데가 없다. 값만 남겨 두니 스태미나 저장이 생기면 매 경기 이 값으로 채우면 된다.
 */
export const NATIONAL_CUP_FULL_STAMINA = 10_000

/**
 * 대회 초기화 `0xb7bf0(L)` — 나리 선발(`0x1a0ea`)·시즌모드 상태 242(`0xe5f8`) 둘 다 이것을 부른다.
 *
 * ```
 * L+0xae = L+0xaf = 15 ; L+0xa8..ab = 10,11,12,13
 * memset(L+0xb0,0,4) ; memset(L+0xb4,0,4)
 * L+0xad = 4 ; L+0xc4 = 15 ; L+0x32 = 0
 * for i 0..2, j 0..3: L+0xb8+4i+j = L+0xa8[ 표 0xd89bc[4i+j] ]
 * ```
 */
export function createNationalCup(): NationalCup {
  const teams = [...NATIONAL_CUP_TEAM_IDS]
  return {
    teams,
    wins: teams.map(() => 0),
    losses: teams.map(() => 0),
    matches: Array.from({ length: NATIONAL_CUP_ROUNDS }, (_unused, round) =>
      Array.from({ length: SLOTS_PER_ROUND }, (_slot, slot) => teams[ROUND_TABLE[round * SLOTS_PER_ROUND + slot]]),
    ),
    stage: FIRST_STAGE,
    finalists: [UNDECIDED_TEAM, UNDECIDED_TEAM],
    champion: UNDECIDED_TEAM,
    day: 0,
  }
}

/**
 * 대진 읽기 `0xb7614(L, n, k)`.
 *
 * ```
 * n > 1  → L+0xb8 + 4·(4−n) + k     ; 라운드 (4−n) 의 k 번째 칸
 * n == 1 → L+0xae+k                 ; 결승 두 팀
 * n <= 0 → L+0xc4                   ; 우승국 (k 를 안 본다)
 * ```
 */
export function matchTeamOf(cup: NationalCup, stage: number, slot: number): number {
  if (stage > FINAL_STAGE) return cup.matches[FIRST_STAGE - stage][slot]
  if (stage === FINAL_STAGE) return cup.finalists[slot === 0 ? 0 : 1]
  return cup.champion
}

/**
 * 4국 순위 `0xb7f0c(L, k)` — 승 내림차순, 같으면 패 오름차순. 둘 다 같으면 **원래 차례**
 * (= 한·일·쿠·미) 가 앞선다. 원본은 교환정렬이고 `i < j` 자리를 지킨다.
 *
 * `entities/league` 의 `rankingOf`(0xb79d8)와 달리 상대전적 비교가 없어 **색인 버그도 없다**.
 */
export function nationalCupRankingOf(cup: NationalCup): number[] {
  const order = cup.teams.map((_unused, index) => index)
  const wins = [...cup.wins]
  const losses = [...cup.losses]

  for (let i = 0; i < order.length - 1; i += 1) {
    let best = i
    for (let j = i + 1; j < order.length; j += 1) {
      if (wins[best] < wins[j]) best = j
      else if (wins[best] === wins[j] && losses[best] > losses[j]) best = j
    }
    ;[wins[i], wins[best]] = [wins[best], wins[i]]
    ;[losses[i], losses[best]] = [losses[best], losses[i]]
    ;[order[i], order[best]] = [order[best], order[i]]
  }

  return order.map((index) => cup.teams[index])
}

const replaced = (values: readonly number[], index: number, value: number) =>
  values.map((current, position) => (position === index ? value : current))

/**
 * 승 기록 `0xb76dc(L, 팀)` 의 국가대항전 가지.
 * 참가국 순번 i 를 찾아 `L+0xb0+i` 를 올리고, **결승 날(`L+0xad == 1`)이면 `L+0xc4` = 이긴 팀** 이다.
 * 정규 기록(연승·상대전적 등)은 건드리지 않는다.
 */
export function recordNationalCupWin(cup: NationalCup, team: number): NationalCup {
  const index = cup.teams.indexOf(team)
  if (index < 0) return cup
  return {
    ...cup,
    wins: replaced(cup.wins, index, cup.wins[index] + 1),
    champion: cup.stage === FINAL_STAGE ? team : cup.champion,
  }
}

/** 패 기록 `0xb77e0(L, 팀)` 의 국가대항전 가지 — `L+0xb4+i` 만 올린다 */
export function recordNationalCupLoss(cup: NationalCup, team: number): NationalCup {
  const index = cup.teams.indexOf(team)
  if (index < 0) return cup
  return { ...cup, losses: replaced(cup.losses, index, cup.losses[index] + 1) }
}

/** 한 경기 결과를 그대로 넣는다 (원본은 승·패를 따로 부른다 — 여기서는 순서까지 같게 묶었다) */
export function recordNationalCupResult(cup: NationalCup, winner: number, loser: number): NationalCup {
  return recordNationalCupLoss(recordNationalCupWin(cup, winner), loser)
}

/**
 * 하루 끝 `0xb818c(L)` 의 국가대항전 가지.
 *
 * ```
 * L+0x32 += 1
 * L+0xad -= 1
 * if L+0xad == 1: L+0xae = 0xb7f0c(L,0) ; L+0xaf = 0xb7f0c(L,1)   ; 결승 두 팀 = 1·2위
 * 0xb6191(대한민국)                                               ; 투수 스태미나 전부 회복
 * opp = 0xb7614(L, L+0xad, 1) ; if opp == 10: opp = 0xb7614(L, L+0xad, 0)
 * ```
 * 단계를 **먼저 줄이고** 결승 두 팀을 채우므로, 다음 상대는 줄어든 단계에서 읽는다.
 */
export function endNationalCupDay(cup: NationalCup): NationalCup {
  const stage = cup.stage - 1
  const advanced: NationalCup = { ...cup, day: cup.day + 1, stage }
  if (stage !== FINAL_STAGE) return advanced

  const ranking = nationalCupRankingOf(advanced)
  return { ...advanced, finalists: [ranking[0], ranking[1]] }
}

/** 대회가 끝났는가 (`L+0xad == 0`) */
export function isNationalCupOver(cup: NationalCup): boolean {
  return cup.stage <= 0
}

/** 결승 날인가 (`L+0xad == 1`) */
export function isNationalCupFinalDay(cup: NationalCup): boolean {
  return cup.stage === FINAL_STAGE
}

/** 대한민국이 결승 두 팀에 있는가 `0xb8565(L)` */
export function isKoreaInFinal(cup: NationalCup): boolean {
  return cup.finalists[0] === KOREA_TEAM_ID || cup.finalists[1] === KOREA_TEAM_ID
}

export interface NationalCupMatchup {
  /** 내 팀 — 늘 대한민국이다 */
  readonly myTeam: number
  readonly opponent: number
}

/**
 * 오늘 사람이 치를 경기 (경기 준비 `0x1c46c`, 나리 상태 142 / 시즌 221).
 *
 * ```
 * 내 팀 = 0xb7614(L, n, 0) ; 상대 = 0xb7614(L, n, 1)
 * 내 팀 != 10 이면 둘을 맞바꾼다            (1c496~1c4da)
 * ```
 * 풀리그에서는 대한민국이 늘 칸 0 이라 맞바꿈이 안 일어나고, 결승에서 `L+0xae` 가 다른 나라일 때만
 * 뒤집힌다. 대회가 끝났으면(단계 0) 치를 경기가 없다.
 */
export function nationalCupMatchupOf(cup: NationalCup): NationalCupMatchup | null {
  if (isNationalCupOver(cup)) return null
  const first = matchTeamOf(cup, cup.stage, 0)
  const second = matchTeamOf(cup, cup.stage, 1)
  if (first === UNDECIDED_TEAM || second === UNDECIDED_TEAM) return null
  return first === KOREA_TEAM_ID ? { myTeam: first, opponent: second } : { myTeam: second, opponent: first }
}

/**
 * 국가대항전에서 그 팀이 홈인가 원정인가 — `0xb7844` 의 **`리그+0xac != 0`** 가지 (확정).
 *
 * ```
 * b7852: r3 = L + 0xad ; r1 = (s8)[r3]   ; 남은 단계 n
 * b785a: r2 = 0
 * b785c: bl 0xb7614                      ; = 대진 칸 0
 * b7860: cmp r0, r5 ; beq 0xb78dc → r0 = 1 ; 아니면 r0 = 0
 * ```
 *
 * 곧 **대진 칸 0 이 side 1(홈·후공)** 이다.
 * 풀리그(`n` 4·3·2)의 칸 0 은 표 `0xd89bc` 상 늘 참가국 0 = 대한민국이라 **대한민국이 후공**이고,
 * 결승(`n`=1)은 칸 0 = `L+0xae` = 풀리그 **순위 1위** 라 대한민국이 2위로 올라갔으면 **선공**이다.
 */
export function nationalCupSideOf(cup: NationalCup, team: number): number {
  return matchTeamOf(cup, cup.stage, 0) === team ? 1 : 0
}

/**
 * 같은 라운드의 **둘째 경기** (CPU 끼리). 사람 경기 결과 장면 `0x4ea0c` 가
 * `L+0xad > 1`(풀리그 날)일 때만 `0xb7614(L,n,2)` vs `(L,n,3)` 을 시뮬한다 — 결승 날엔 없다.
 */
export function otherMatchOf(cup: NationalCup): readonly [number, number] | null {
  if (cup.stage <= FINAL_STAGE) return null
  return [matchTeamOf(cup, cup.stage, 2), matchTeamOf(cup, cup.stage, 3)]
}

/**
 * ⚠️ **원본 그대로 옮긴 동작** (`0xb858c`, DECISIONS 2026-09-20):
 * 대한민국이 풀리그 2위 안에 못 들면 **결승을 치르지 않고** `rand(0,2)` 동전 던지기로 우승국을 정한다.
 * `rand(0,2) == 0` 이면 `L+0xaf`(2위), 아니면 `L+0xae`(1위)가 우승이다.
 */
export function coinFlipChampion(cup: NationalCup, random: RandomPort): NationalCup {
  const roll = Math.trunc(random.nextInRange(0, 2))
  return { ...cup, champion: roll === 0 ? cup.finalists[1] : cup.finalists[0] }
}
