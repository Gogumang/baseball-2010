import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { HalfInningPlateAppearance, HalfInningTick } from '@/entities/game/model/simulateHalfInning'
import type { MissionInningRuns } from '@/entities/mission/model/missionScoreboard'

/**
 * **자동진행 중계(경기 장면 상태 0x21)의 한 틱** — 미션(모드 5·6)도 3아웃 뒤 사람이 안 나서는 반 이닝을 0x21 로 돌린다
 * (`missionGame` 머리글). 직접 재역어셈 0x48480 · 0xc2198 · 0xc262c · 0xc25e4 · 0x4258c · 0x3abf0 · 0x3e25c:
 * ```
 * 0x48480 (갱신, 틱마다)
 *   48494  모드 ∈ {1,2,8,9} 이고 속도 v ≠ 2 면 틱 mod ((2 − v) × 4) 로 건너뜀 — **모드 5·6 은 매 틱 한 걸음**
 *   484e4  sim+0x9c(연출 대기)면 sim+0x9d−− — 0xc2198 c2250 이 모드 ∈ {1,2,8,9} · v ≠ 2 일 때만 세운다 → 미션은 대기 틱이 없다
 *   4850c  r = 0xc2198(sim, 1)   ; 3아웃이면 그 안에서 0xb6b6c 반 이닝 넘김 · 모드 5·6 은 c2248 미션 판정 — 같은 틱
 *   4852e  r 참 → 0xc262c(sim) 한 번 · 거짓 → +0x1784 = 0 · 상태 0x18 (그 틱은 중계가 아니다)
 * 0xc262c (한 번 = 타석 하나)
 *   c2630  sim+0xac = 0 · **sim+0xc4 = 0** (중계 글 코드)
 *   c2662  0xc1ba4(교체 판정) ≠ 0 → 공 없이 돌아감(c266c) — 그 틱은 글 없음, 다음 틱에 같은 타석
 *   c26be~c271c  공마다 0xa5e14 · rand(0, 100) → 0xc11f0(스윙) / 0xc1818(판정), 지금 타자(0xae89c) ≠ 예약 다음 타자(0xae944) 일 때까지
 *   c272e  0xc25e4(sim, 0xb62c0(0xae89c(공격 팀))) — 방금 친 타자 이름
 * 0xc25e4  sim+0xc4 ≠ 0 이면 글 sim+0xb0 = 이름 + " "(0xd8ffc) + 표 0x140034c[코드 − 1]
 * ```
 * 그리기 0x4258c 는 [+0xc4] ≠ 0 일 때만 124×18 반투명 칸 위에 `"!C!cffff00%s"`(0xd0744) 로 그 글을 쓴다 — 매 틱 새 타석이 글을 갈아
 * 쓰므로 **틱 하나 = 중계 글 하나**다. 0x21 의 키 0x3e25c(속도 ←→ · CLR 중단)와 배경음 0x21(진입 0x3abf0)·작은 다이아몬드·투수/타자
 * 그림·속도 칸은 모두 모드 ∈ {1,2,8,9} 에서만 — 미션은 키를 안 받고 점수판 · 두 팀 판 · "공격팀(%s)" 띠 · 중계 글만 그린다.
 *
 * **제한 시간은 이 동안에도 흐른다** — 장면 갱신 0x52c50 은 상태 갱신(0x21 이면 52e84 → 0x48480) 뒤 52ed0 에서 모드 5·6 이면
 * 상태를 안 가리고 0xaada4(미션 객체)를 부른다: 진행 중이고 시간 한도(레코드 +0xb·+0xc)가 있으면 벽시계 0x14005c8 − 시작 [st+0xac] 이
 * 1000ms 를 넘을 때마다 남은 초(0x1552af0)−− · 0xa5bb0(시작 다시 잼) → 0xaa940 한도 판정(0 이 되면 실패 2 → 메시지 0x76d).
 * 그래서 중계가 도는 틱 수 × 한 틱(환경설정 [속도])만큼 시간이 줄어든다.
 */
export interface MissionAutoRelayStep {
  /** `st[0x6b]` 0부터 센 이닝 — 이 틱의 반 이닝 */
  readonly inning: number
  /** `st[9]` 공격 측 — "공격팀(%s)" 띠와 그 팀 이름 그림(0xb6bdc(st, st[9]) + 0x41) */
  readonly offenseSide: 0 | 1
  /** `st[0x7e]` · `st[0x7f]` — 이 틱 뒤 점수 */
  readonly scores: readonly [number, number]
  /** 중계 글 (`relayLineOf`) — null 이면 sim+0xc4 = 0 이라 칸을 안 그린다 (교체 틱 · 파울 없는 코드 0 뜬공) */
  readonly line: string | null
  /** 그 틱 뒤 두 팀 판(0x420dc "PITCHER" · 0x42364 "DUE UP")의 값 — 틱 꼴이 싣는다(목록 꼴 `missionAutoRelayStepsOf` 는 없다) */
  readonly cards?: MissionAutoRelayCards
  /**
   * 그 틱 뒤 이닝별 점수 칸 st[0x6c..] (0xb6989 — 점수판 0x41c18) — 틱 꼴이 싣는다. 간이 엔진 득점 0xc100a · 0xc109e 가 한 점마다
   * 0xb6a9c 로 지금 이닝 칸과 합을 함께 올린다(`scoreMissionRuns`).
   */
  readonly inningRuns?: MissionInningRuns
}

/**
 * **0x21 그리기 0x4258c 의 두 팀 판 값** — 그 틱(0xc262c 한 번)이 끝난 자리의 판:
 * - 0x420dc: 수비 팀(st[0xa]) 지금 투수 0xae83c 의 이름 0xb62c0 · 카운트 st[4] · st[5] · st[6](점은 min(s,2) · min(b,3) · min(o,2)).
 *   타석 틱이면 그 타석이 끝났을 때의 카운트 — 새 타자로 넘기며 st[4] · st[5] 를 지우는 것은 다음 부름 머리 0xc0ee8(c0f42 지금 타자 ≠
 *   예약 다음 타자 → c0f7c 0xb6764)라 이 틱에는 남는다. 교체 틱은 그 머리에서 지운 뒤라 0 이다. (⚠️ 유력: 간이 판정 0xc1818 ·
 *   0xc11f0 이 타석 끝에서 st[4] · st[5] 를 따로 지우는지는 다 훑지 않았다 — 웹은 간이 타석의 끝 카운트를 싣는다)
 * - 0x42364: 공격 팀(st[9]) 타순 칸 팀[+0x32] 부터 세 칸의 이름 — 타석 틱이면 방금 친 타자가 아직 팀[+0x32] 다(예약 확정 0xaebe4 는
 *   다음 부름 머리). 대타가 들어선 칸은 대타 이름이다.
 * - 경기 끝(0xb68fc)이면 0x420dc 는 점을, 0x42364 는 세 줄을 안 그린다(42252 · 42450).
 */
export interface MissionAutoRelayCards {
  /** 수비 팀 지금 투수 이름 — 모르면 null (글을 안 쓴다) */
  readonly pitcherName: string | null
  readonly strikes: number
  readonly balls: number
  readonly outs: number
  /** 공격 팀 타순 칸 팀[+0x32] (0~8) */
  readonly currentOrder: number
  /** 줄 0~2 의 이름 — 타순 칸 (currentOrder + i) mod 9 의 선수 */
  readonly dueUpNames: readonly (string | null)[]
  /** 0xb68fc — 경기 끝 */
  readonly gameOver: boolean
}

/**
 * **중계 글 결과 낱말** — 표 0x140034c (u32 15칸, 코드 1~15 → CP949 글).
 * 1 플라이 아웃 · 2 아웃 · 3 태그 아웃 · 4 3번트 아웃 · 5 삼진 아웃 · 6 주자중복 아웃 · 7 번트 실패 · 8 번트 성공 ·
 * 9 1루타 · 10 2루타 · 11 3루타 · 12 홈런!!! · 13 파울 · 14 포볼 · 15 데드볼
 */
export const RELAY_RESULT_WORDS: readonly string[] = [
  '플라이 아웃', '아웃', '태그 아웃', '3번트 아웃', '삼진 아웃', '주자중복 아웃', '번트 실패', '번트 성공',
  '1루타', '2루타', '3루타', '홈런!!!', '파울', '포볼', '데드볼',
]

/** 0xc25e4 의 이름 뒤 사이 글 (0xd8ffc = " ") */
const RELAY_SEPARATOR = ' '

/**
 * **타석이 끝났을 때 sim+0xc4** — 간이 타석 0xc11f0(스윙) · 0xc1818(판정)이 공마다 적고 0xc262c 머리만 0 으로 지운다:
 * - 판정 길 c1818: 삼진 5(c1912) · 포볼 14(c1974). (데드볼 15 는 간이 엔진에 사구가 없어 안 나온다 — `judgePitchOf`)
 * - 스윙 코드표 0xd9000: 3 땅볼 — 내야안타면 9(c1554), 아니면 3(c15b4) → (진루 갈래 8, c160a) → c163e 코드 ≠ 0 이라 **1 "플라이 아웃"**
 *   (c164a, 원본 그대로 덮어쓴다) · 0 뜬공 — c1640 이 코드 0 이면 안 적고 끝 → **그 타석 앞 공의 값이 남는다**(파울 13, 아니면 0) ·
 *   9 파울 13(c1662) · 15·18 안타 — 진루 굴림 뒤 1·2·3 루면 9·10·11(c16e0~c16f0) · 24 홈런 12(c1708) · 헛스윙 삼진 5(c1742 · c17d8).
 * 웹 간이 타석(`quickAtBat.verdictOf`)은 코드 3 을 '땅볼아웃'/내야안타로, 코드 0 을 '뜬공아웃' 으로 낸다. 그 밖 코드에서 오는 '땅볼아웃'
 * (웹 근사 — 번트 코드는 스윙만 하는 간이 타석에 안 나온다)도 땅볼 길과 같이 1 로 둔다.
 */
export function relayCodeOf(outcome: AtBatOutcome, fouled: boolean): number {
  switch (outcome.kind) {
    case '삼진':
      return 5
    case '볼넷':
      return 14
    case '사구':
      return 15
    case '안타':
      return 8 + outcome.bases
    case '홈런':
      return 12
    case '아웃':
      if (outcome.detail === '뜬공아웃') return fouled ? 13 : 0
      return 1
  }
}

/** 0xc25e4 — 코드가 0 이면 글이 없다 */
export function relayLineOf(batterName: string, code: number): string | null {
  const word = RELAY_RESULT_WORDS[code - 1]
  return code === 0 || word === undefined ? null : `${batterName}${RELAY_SEPARATOR}${word}`
}

/**
 * **자동진행 반 이닝 하나의 중계 틱들** — 타석마다 교체 틱(`substitutionCalls`, 글 없음) 뒤 타석 틱 하나. 점수는 그 틱 뒤 값이다.
 * `nameOf` 는 그 타석에 선 레코드 칸(`rosterSlot`, 대타 포함)의 이름 0xb62c0.
 */
export function missionAutoRelayStepsOf(
  half: { readonly inning: number; readonly offenseSide: 0 | 1; readonly scores: readonly [number, number] },
  plateAppearances: readonly HalfInningPlateAppearance[],
  nameOf: (appearance: HalfInningPlateAppearance) => string,
): MissionAutoRelayStep[] {
  const steps: MissionAutoRelayStep[] = []
  const scores: [number, number] = [half.scores[0], half.scores[1]]
  for (const appearance of plateAppearances) {
    for (let call = 0; call < (appearance.substitutionCalls ?? 0); call += 1) {
      steps.push({ inning: half.inning, offenseSide: half.offenseSide, scores: [scores[0], scores[1]], line: null })
    }
    scores[half.offenseSide] += appearance.runsBattedIn
    steps.push({
      inning: half.inning,
      offenseSide: half.offenseSide,
      scores: [scores[0], scores[1]],
      line: relayLineOf(nameOf(appearance), relayCodeOf(appearance.outcome, appearance.fouled === true)),
    })
  }
  return steps
}

/**
 * **중계 틱 하나** — 0xc262c 한 번(`HalfInningTick`)을 중계 칸으로. `scores` 는 그 틱 앞 점수 — 타석 틱이면 타점을 더한 값을 칸에 싣는다.
 * `missionAutoRelayStepsOf` 의 한 칸과 같다.
 */
export function missionAutoRelayStepOfTick(
  half: { readonly inning: number; readonly offenseSide: 0 | 1 },
  scoresBefore: readonly [number, number],
  tick: HalfInningTick,
  nameOf: (appearance: HalfInningPlateAppearance) => string,
  /** 그 틱 뒤 두 팀 판 값 (`MissionAutoRelayCards`) — 안 주면 싣지 않는다 */
  cardsOf?: (tick: HalfInningTick, scores: readonly [number, number]) => MissionAutoRelayCards,
): MissionAutoRelayStep {
  const scores: [number, number] = [scoresBefore[0], scoresBefore[1]]
  if (tick.kind === 'plateAppearance') scores[half.offenseSide] += tick.appearance.runsBattedIn
  const line = tick.kind === 'substitution'
    ? null
    : relayLineOf(nameOf(tick.appearance), relayCodeOf(tick.appearance.outcome, tick.appearance.fouled === true))
  return {
    inning: half.inning,
    offenseSide: half.offenseSide,
    scores,
    line,
    ...(cardsOf === undefined ? {} : { cards: cardsOf(tick, scores) }),
  }
}

/** 틱 묶음을 끝까지 돌린다 — 중계 칸들과 끝 값 (한꺼번에 굴리는 길 · 시험) */
export function drainMissionAutoTicks<R>(ticks: Generator<MissionAutoRelayStep, R, void>): {
  readonly steps: MissionAutoRelayStep[]
  readonly result: R
} {
  const steps: MissionAutoRelayStep[] = []
  for (;;) {
    const next = ticks.next()
    if (next.done === true) return { steps, result: next.value }
    steps.push(next.value)
  }
}

/** 한 번의 자동진행(0x18 → 0x21 → 0x18) 동안 쌓인 중계 — `serial` 은 새로 돌 때마다 오른다 (화면이 한 번씩 튼다) */
export interface MissionAutoRelay {
  readonly serial: number
  readonly steps: readonly MissionAutoRelayStep[]
}
