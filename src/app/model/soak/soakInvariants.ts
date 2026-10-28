/**
 * 장기 진행 점검(soak) 공용 검사 — 화면 없이 세션 훅을 오래 돌릴 때 걸음마다 부른다.
 *
 * 시험 전용 모듈이다(앱이 부르지 않는다). 검사는 예외를 던지지 않고 **문제 줄**을 모아 돌려준다 — 하네스가
 * 한 판을 끝까지 돌린 뒤 모은 줄을 한꺼번에 보여 주게 한다(첫 문제에서 멈추면 뒤에 숨은 문제를 못 본다).
 */

/** `SOAK=1` 이면 긴 점검을 켠다 (`SOAK=1 yarn vitest run src/app/model/soak`) */
export const isSoakEnabled = (): boolean => typeof process !== 'undefined' && process.env.SOAK === '1'

/** 환경변수 숫자 — 없거나 숫자가 아니면 기본값 */
export function soakNumber(name: string, fallback: number): number {
  const raw = typeof process === 'undefined' ? undefined : process.env[name]
  const value = raw === undefined ? NaN : Number(raw)
  return Number.isFinite(value) ? value : fallback
}

/** 환경변수 씨앗 목록 — `SOAK_SEEDS=1,2,3`. 없으면 기본값 */
export function soakSeeds(fallback: readonly number[]): readonly number[] {
  const raw = typeof process === 'undefined' ? undefined : process.env.SOAK_SEEDS
  if (raw === undefined || raw.trim() === '') return fallback
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .map(Number)
    .filter((value) => Number.isFinite(value))
}

/**
 * 직렬화할 수 없는 값 — NaN · ±Infinity · 배열 속 undefined · 함수 · Map/Set/Date 같은 일반 객체가 아닌 것.
 * 저장은 JSON 이라 이런 값은 불러오면 다른 값(null · {})이 된다.
 */
export function unserializablePathsOf(value: unknown, path = '$', out: string[] = [], seen = new Set<object>()): string[] {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) out.push(`${path} = ${String(value)}`)
    return out
  }
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    out.push(`${path} : ${typeof value}`)
    return out
  }
  if (value === null || typeof value !== 'object') return out
  if (seen.has(value)) {
    out.push(`${path} : 순환 참조`)
    return out
  }
  seen.add(value)
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (item === undefined) out.push(`${path}[${index}] = undefined`)
      else unserializablePathsOf(item, `${path}[${index}]`, out, seen)
    })
  } else {
    const proto = Object.getPrototypeOf(value)
    if (proto !== Object.prototype && proto !== null) {
      out.push(`${path} : ${proto?.constructor?.name ?? '알 수 없는'} 객체`)
    } else {
      for (const [key, item] of Object.entries(value)) unserializablePathsOf(item, `${path}.${key}`, out, seen)
    }
  }
  seen.delete(value)
  return out
}

/**
 * JSON 을 한 번 지나도 같은 꼴인가 — 다르면 다른 첫 자리를 돌려준다. `undefined` 인 객체 칸은 JSON 이 지우므로
 * 없는 칸과 같게 본다(불러오는 쪽이 `?? 기본값` 으로 받는다).
 */
export function jsonRoundTripDiffOf(value: unknown): string | null {
  const back: unknown = JSON.parse(JSON.stringify(value) ?? 'null')
  return firstDiffOf(value, back, '$')
}

/** 두 값의 첫 차이 자리 — 객체의 undefined 칸은 없는 칸으로 본다 */
export function firstDiffOf(a: unknown, b: unknown, path = '$'): string | null {
  if (Object.is(a, b)) return null
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return `${path}: ${short(a)} ≠ ${short(b)}`
  }
  if (Array.isArray(a) !== Array.isArray(b)) return `${path}: 배열/객체 꼴이 다르다`
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${path}.length: ${a.length} ≠ ${b.length}`
    for (let index = 0; index < a.length; index += 1) {
      const diff = firstDiffOf(a[index], b[index], `${path}[${index}]`)
      if (diff !== null) return diff
    }
    return null
  }
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  const keys = new Set([...Object.keys(left), ...Object.keys(right)])
  for (const key of keys) {
    const diff = firstDiffOf(left[key], right[key], `${path}.${key}`)
    if (diff !== null) return diff
  }
  return null
}

function short(value: unknown): string {
  const text = JSON.stringify(value)
  if (text === undefined) return String(value)
  return text.length > 80 ? `${text.slice(0, 77)}...` : text
}

/** 숫자 칸들이 [min, max] 안의 정수인가 — 벗어난 칸 줄 */
export function outOfRangeOf(
  label: string,
  values: Readonly<Record<string, number | undefined>>,
  min: number,
  max = Number.POSITIVE_INFINITY,
): string[] {
  const out: string[] = []
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      out.push(`${label}.${key} = undefined`)
      continue
    }
    if (!Number.isFinite(value) || value < min || value > max || !Number.isInteger(value)) {
      out.push(`${label}.${key} = ${value} (기대 ${min}..${max} 정수)`)
    }
  }
  return out
}

/** 순위표가 승 많은 차례 · 승이 같으면 패 적은 차례인가 (`rankingOf` 0xb7aa1 의 앞 두 기준 — 셋째 기준은 원본 색인 버그) */
export function rankingOrderProblemsOf(label: string, ranking: readonly number[], wins: readonly number[], losses: readonly number[]): string[] {
  const out: string[] = []
  if (new Set(ranking).size !== ranking.length) out.push(`${label}: 순위에 같은 팀이 둘 (${ranking.join(',')})`)
  for (let rank = 1; rank < ranking.length; rank += 1) {
    const front = ranking[rank - 1]!
    const back = ranking[rank]!
    const frontWins = wins[front] ?? NaN
    const backWins = wins[back] ?? NaN
    if (frontWins < backWins || (frontWins === backWins && (losses[front] ?? NaN) > (losses[back] ?? NaN))) {
      out.push(`${label}: ${rank}위 팀 ${back}(${backWins}승 ${losses[back]}패)가 앞 팀 ${front}(${frontWins}승 ${losses[front]}패)보다 낫다`)
    }
  }
  return out
}

/**
 * 리그 전적 맞춤 — 무승부가 없으니 리그 전체 승 = 패, 상대 전적 줄 합 = 그 팀 승, 경기를 다 같이 치르는 날이면
 * 팀마다 승 + 패 = 치른 날 수.
 */
export function leagueTallyProblemsOf(
  label: string,
  league: { readonly wins: readonly number[]; readonly losses: readonly number[]; readonly headToHead: readonly (readonly number[])[] },
  expectedGamesPerTeam: number | null,
): string[] {
  const out: string[] = []
  const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0)
  if (sum(league.wins) !== sum(league.losses)) out.push(`${label}: 리그 승 합 ${sum(league.wins)} ≠ 패 합 ${sum(league.losses)}`)
  league.wins.forEach((wins, team) => {
    const versus = sum(league.headToHead[team] ?? [])
    if (versus !== wins) out.push(`${label}: 팀 ${team} 상대 전적 합 ${versus} ≠ 승 ${wins}`)
    const played = wins + (league.losses[team] ?? NaN)
    if (expectedGamesPerTeam !== null && played !== expectedGamesPerTeam) {
      out.push(`${label}: 팀 ${team} 승+패 ${played} ≠ 경기 수 ${expectedGamesPerTeam}`)
    }
  })
  out.push(...outOfRangeOf(`${label}.wins`, Object.fromEntries(league.wins.map((v, i) => [i, v])), 0))
  out.push(...outOfRangeOf(`${label}.losses`, Object.fromEntries(league.losses.map((v, i) => [i, v])), 0))
  return out
}

/** 타자 기록 줄 — 타수 ≥ 안타 ≥ 장타 합 · 모두 0 이상 정수 */
export function batterLineProblemsOf(
  label: string,
  line: {
    readonly atBats: number
    readonly hits: number
    readonly homeRuns: number
    readonly runsBattedIn: number
    readonly doubles?: number
    readonly triples?: number
    readonly steals?: number
  },
): string[] {
  const out = outOfRangeOf(
    label,
    {
      atBats: line.atBats,
      hits: line.hits,
      homeRuns: line.homeRuns,
      runsBattedIn: line.runsBattedIn,
      ...(line.doubles === undefined ? {} : { doubles: line.doubles }),
      ...(line.triples === undefined ? {} : { triples: line.triples }),
      ...(line.steals === undefined ? {} : { steals: line.steals }),
    },
    0,
  )
  if (line.hits > line.atBats) out.push(`${label}: 안타 ${line.hits} > 타수 ${line.atBats}`)
  const extra = line.homeRuns + (line.doubles ?? 0) + (line.triples ?? 0)
  if (extra > line.hits) out.push(`${label}: 장타 ${extra} > 안타 ${line.hits}`)
  return out
}

/** 문제 줄 모음 — 같은 줄은 처음 본 걸음만 남기고 센다(같은 문제가 걸음마다 수천 줄 쌓이지 않게) */
export class SoakProblems {
  private readonly firstSeen = new Map<string, { readonly step: string; count: number }>()

  add(step: string, problems: readonly string[]): void {
    for (const problem of problems) {
      const key = problem.replace(/\d+/g, '#')
      const found = this.firstSeen.get(key)
      if (found === undefined) this.firstSeen.set(key, { step: `${step} — ${problem}`, count: 1 })
      else found.count += 1
    }
  }

  get size(): number {
    return this.firstSeen.size
  }

  report(): string {
    return [...this.firstSeen.values()].map((entry) => `${entry.step}${entry.count > 1 ? ` (×${entry.count})` : ''}`).join('\n')
  }
}
