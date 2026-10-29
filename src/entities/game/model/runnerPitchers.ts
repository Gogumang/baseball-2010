import type { BaseNumber, BaseRunners } from '@/entities/game/model/baseRunners'
import { runnerOnBase } from '@/entities/game/model/baseRunners'

/**
 * **루에 선 주자마다 그 주자를 내보낸 투수(책임 투수)** — 원본 주자 객체의 `+0x30` (S1 5절 · 직접 떴다).
 *
 * ## 적는 곳 · 옮기는 곳 · 읽는 곳
 * ```
 * a93ac  주자 추가(관리, 선수, 팀, 투수 레코드):  a9438 +0x30 = −1 ; a94dc 투수 레코드가 있으면 a94ec +0x30 = 레코드 +0xa(투수 번호)
 *        부르는 곳 다섯 — 0x4650e(0x17 진입 0x46418 의 타자주자) · 0xa9a5a(루 상황 세우기 0xa9a10 — 미션 시작 · 자동진행 멈춤 판) ·
 *        0xc108a(간이 홈런) · 0xc119e(간이 안타) · 0xc1940(간이 볼넷) — 넷째 인자는 모두 0xae83d(수비 팀) = **그때 마운드 투수**
 * a9c68  목록 정리(죽은 · 들어온 주자 빼기): 남는 주자를 앞으로 당기며 +0x30 을 **그대로 복사**한다(a9db8~a9dba)
 * a8ea4  정산 주자 루프: 홈을 밟은 주자(+0x95)마다 — 3아웃이고 목록 0번이 끝났으면(a8ec0) 하나도 안 센다 —
 *          P = 0xb8c44(수비 팀, 주자+0x30)          ; 레코드 +0xa 가 그 번호인 투수(첫 일치), 없으면 건너뜀
 *          a8ef4 0xa56dc(R, P, 0) 이면 P+0x22(시즌 실점)++
 *          a8f06 0xb8cdc(수비 팀, 0xb8c0c(수비 팀, 주자+0x30))[2]++   ; 그 투수의 이번 경기 기록 실점
 *          a8f3c 0xb6388(P) && 0xa56dc(R, P, 0) 이면 R+0x128++         ; 나리 투수 평가 칸
 * ```
 * 바이너리 전체에서 주자 `+0x78 + 0x30` 에 쓰는 곳은 a93ac 하나다(`str rX, [rY, #0x30]` 앞 `adds rY, #0x78` 전수) — 투수가 바뀌어도
 * 루에 남은 주자의 책임 투수는 그대로이고, 반 이닝 넘김(0xa9250)이 목록을 비울 때까지 간다.
 * → **승계 주자가 들어오면 실점(레코드 +0x22 · 경기 기록 [2])은 지금 마운드 투수가 아니라 그 주자를 내보낸 투수에게 간다.**
 *
 * ## 웹의 꼴
 * 주자 신원(`BaseRunners` — 루별 공격 팀 타순 칸)과 같은 모양으로 루별 투수 열쇠를 든다. 투수 열쇠는 진행기마다 그 투수 줄을
 * 가르는 값이다(타자편 · 투수편 붙박이 표 칸, 팀 경기 마운드 명단 차례, 반 이닝 엔진 표 칸). 적을 때의 신원(`runners`)을 함께 들어
 * 루의 신원이 바뀌었으면(이 칸을 안 고친 길로 주자가 섰으면) 그 루는 모르는 것으로 보고 부르는 쪽의 지금 투수로 대신한다.
 */
export interface RunnerPitcherTags {
  /** 적을 때 루에 선 주자 신원 */
  readonly runners: BaseRunners
  /** 그 주자를 내보낸 투수 열쇠 */
  readonly pitchers: BaseRunners
}

/** 루 b 의 주자를 내보낸 투수 — 모르면(적은 신원과 지금 신원이 다르면) `fallback` */
export function pitcherOnBase(tags: RunnerPitcherTags | undefined, runners: BaseRunners, base: BaseNumber, fallback: number): number {
  const runner = runnerOnBase(runners, base)
  if (tags === undefined || runner === null || runnerOnBase(tags.runners, base) !== runner) return fallback
  return runnerOnBase(tags.pitchers, base) ?? fallback
}

const BASES: readonly BaseNumber[] = [1, 2, 3]

export interface RunnerPitcherStep {
  readonly tags: RunnerPitcherTags | undefined
  /** 플레이 앞 루의 주자 신원 */
  readonly before: BaseRunners
  /** 플레이 뒤 루의 주자 신원 (반 이닝이 넘어갔으면 빈 루) */
  readonly after: BaseRunners
  /** 이번에 나갈 수 있었던 타자의 신원 — 주자 판(견제 · 도루 · 폭투)은 null */
  readonly batter: number | null
  /** 지금 수비 팀 마운드 투수 — 새로 나간 타자주자의 책임 투수(0xae83d) */
  readonly pitcher: number
  /**
   * 실점을 매길 주자의 투구 때 루 (0 = 타자주자) — 정산 주자 루프가 세는 주자다(`chargedFromBasesOfFates`, 3아웃 갈래 포함).
   * 부르는 쪽이 운명을 모르면 `scoredFromBasesOf` 로 앞선 주자부터 든다
   */
  readonly scoredFromBases: readonly number[]
}

export interface RunnerPitcherSettlement {
  readonly tags: RunnerPitcherTags
  /** 실점 하나마다 그 주자의 책임 투수 열쇠 (앞선 주자부터) */
  readonly charged: readonly number[]
}

/** 플레이 하나 뒤 — 살아남은 주자는 책임 투수를 그대로 들고, 새로 나간 타자주자는 지금 투수를 적는다(a93ac · a9c68) */
export function settleRunnerPitchers(step: RunnerPitcherStep): RunnerPitcherSettlement {
  const ofBefore = (base: BaseNumber) => pitcherOnBase(step.tags, step.before, base, step.pitcher)
  const seats: (number | null)[] = [null, null, null]
  for (const base of BASES) {
    const runner = runnerOnBase(step.after, base)
    if (runner === null) continue
    const from = BASES.find((candidate) => runnerOnBase(step.before, candidate) === runner)
    seats[base - 1] = from === undefined ? step.pitcher : ofBefore(from)
  }
  const charged = step.scoredFromBases.map((fromBase) => (fromBase >= 1 && fromBase <= 3 ? ofBefore(fromBase as BaseNumber) : step.pitcher))
  return {
    tags: {
      runners: step.after,
      pitchers: { first: seats[0] ?? null, second: seats[1] ?? null, third: seats[2] ?? null },
    },
    charged,
  }
}

/**
 * **운명 없이 들어온 주자** — 앞 루의 주자가 빠진 차례(3 → 2 → 1 → 타자)대로 `runs` 명. 주자는 서로 앞지르지 못하고 간이 엔진은
 * 주자를 죽이지 않으므로(0xc0fb4 는 목록 전원을 민다) 빠진 주자가 곧 들어온 주자다. 모자라면 타자주자(0)로 채운다.
 */
export function scoredFromBasesOf(before: BaseRunners, after: BaseRunners, runs: number): readonly number[] {
  if (runs <= 0) return []
  const remaining = new Set(BASES.map((base) => runnerOnBase(after, base)).filter((runner) => runner !== null))
  const gone = [3, 2, 1].filter((base) => {
    const runner = runnerOnBase(before, base as BaseNumber)
    return runner !== null && !remaining.has(runner)
  })
  const scored = gone.slice(0, runs)
  while (scored.length < runs) scored.push(0)
  return scored
}

/** 책임 투수 열쇠별 실점 수 (나온 차례대로) */
export function chargedRunsByPitcher(charged: readonly number[]): readonly (readonly [number, number])[] {
  const counts = new Map<number, number>()
  for (const pitcher of charged) counts.set(pitcher, (counts.get(pitcher) ?? 0) + 1)
  return [...counts.entries()]
}

/**
 * **투수가 바뀔 때** — 루에 선 주자는 책임 투수를 그대로 든다(교체 0xaec64 · 0xaebe4 는 주자 목록을 안 건드린다). 웹이 모르는 루
 * (이 칸을 안 고친 길로 선 주자)는 내려가는 투수가 내보낸 것으로 굳혀, 뒤에 들어와도 새 투수 몫이 되지 않게 한다
 */
export function freezeRunnerPitchers(tags: RunnerPitcherTags | undefined, runners: BaseRunners, outgoing: number): RunnerPitcherTags {
  const seat = (base: BaseNumber) => (runnerOnBase(runners, base) === null ? null : pitcherOnBase(tags, runners, base, outgoing))
  return { runners, pitchers: { first: seat(1), second: seat(2), third: seat(3) } }
}
