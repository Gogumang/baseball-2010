import type { LeagueFieldingError } from '@/entities/league/model/leaguePlayerStats'

/**
 * **실책 +0x2e** — 수비 화면(상태 0x17) 그리기 0x46c88 → 야수 그리기 0x43278 이 야수 아홉([경기+0x111c+4i], i = 8..0 — 홈런더비는
 * i = 0 만, 43290)을 그릴 때마다 올린다 (직접 뜬 것):
 * ```
 * 437a4  +0xb4(동작 잠금) > 0 → 먼지 · 애니 15 를 그리고 이 야수 끝 (아래 둘을 안 본다)
 * 4381a  +0xb8 > 0 :  == 6(펌블 b4280) 이면 [+0xec] != 0 일 때 [+0xec]+0x2e += 1 → 0..9999(4383e · 43852) · 0xa755d(…, 3)
 *                     · 소리 29                                ; 6 이 아니면 "!" 만
 * 438c4  아니면 +0xc0 > 0 :  == 4(악송구 a1908 · 원바운드 a17fc · 송구 예보 b188e) 이면 [+0xec] != 0 일 때 +0x2e += 1(438ea · 43904)
 * ```
 * 정산이 아니라 **그림**이 올리므로 그림이 도는 동안만이다 — 키 건너뛰기(+0xfe7) 동안(52b26 이 G1 → G2 만 되풀이) · CPU 끼리 경기 ·
 * 자동진행(0x21) · 간이 타석은 안 쌓인다. +0xb8 · +0xc0 은 야수 틱 0xa1284 가 잠금이 없을 때 틱마다 −1 하므로 한 그림만 6 · 4 를 본다.
 * 모드 게이트(0xa56dc)는 없다.
 */
export interface DrawnFieldingError {
  /** 수비 칸 0~8 (0 투수 … 8 중견) */
  readonly slot: number
  /** 그 그림의 수비 팀 번호 (`DefenseFielder.teamIndex` = 판 입력 `defenseTeamIndex`). 모르면 null */
  readonly teamIndex: number | null
  /**
   * 펌블 갈래(4381a `+0xb8 == 6`)에서 올랐나 — 이 갈래만 +0x2e 뒤 43854~43862 `0xa755d([ctx], 3)`(시즌 평판 코드 3 수비실수,
   * 게이트 0xa755c — 모드 2 · 코드 ≤ 5 라 공격측이 CPU 일 때만)을 부른다. 악송구 갈래(438c4)는 +0x2e 만 (r248)
   */
  readonly isFumble?: true
}

/** 그림 하나의 야수 칸 — 0x43278 이 보는 세 카운터 */
export interface DrawnFielderCounters {
  readonly slot: number
  readonly teamIndex?: number | null
  /** +0xb4 */
  readonly lockTicks?: number
  /** +0xb8 */
  readonly fumbleTicks?: number
  /** +0xc0 */
  readonly throwErrorTicks?: number
}

/** 4381a 의 펌블 값 · 438c4 의 악송구 값 — 세우는 곳의 첫 값 그대로 (`playerEffects.FUMBLE_MARK_TICKS` · `THROW_ERROR_MARK_TICKS`) */
const FUMBLE_RECORD_TICKS = 6
const THROW_ERROR_RECORD_TICKS = 4

/** 그림 하나에서 +0x2e 를 올리는 야수 칸 — 0x43278 의 고리 차례(칸 8 → 0) 그대로 */
export function drawnFieldingErrorsOf(fielders: readonly DrawnFielderCounters[]): DrawnFieldingError[] {
  const errors: DrawnFieldingError[] = []
  const ordered = [...fielders].sort((left, right) => right.slot - left.slot)
  for (const fielder of ordered) {
    if ((fielder.lockTicks ?? 0) > 0) continue
    const fumble = fielder.fumbleTicks ?? 0
    const hit = fumble > 0 ? fumble === FUMBLE_RECORD_TICKS : (fielder.throwErrorTicks ?? 0) === THROW_ERROR_RECORD_TICKS
    if (!hit) continue
    const error: DrawnFieldingError = { slot: fielder.slot, teamIndex: fielder.teamIndex ?? null }
    errors.push(fumble > 0 ? { ...error, isFumble: true } : error)
  }
  return errors
}

/**
 * 재생 판(`lastDefensePlay`) 하나를 건너뛰기 없이 끝까지 그렸을 때 올라가는 실책 — 판 틱마다 그림 한 번(`DefensePlayback` 재생 갈래의
 * 셈과 같다: 틱 0..끝을 한 번씩 그리고 닫힌 갱신의 다시 그리기는 안 센다). 화면 없는 하네스(soak)가 재생 화면 대신 쓴다
 */
export function drawnReplayFieldingErrorsOf(
  views: readonly { readonly fielders: readonly DrawnFielderCounters[] }[],
): DrawnFieldingError[] {
  return views.flatMap((view) => drawnFieldingErrorsOf(view.fielders))
}

/**
 * 그림 하나가 펌블 함성 29 를 예약하는가 — 4381a 의 `+0xb8 == 6` 갈래는 [+0xec] 를 보기 **앞**에서 갈라 4383a~43852(+0x2e) ·
 * 43854(0xa755d)만 [+0xec] != 0 일 때 돌고, 43866~43870 `0x6e499(소리, 0x1d, 0)` 은 늘 지난다. 야수마다 따로 예약하지만 예약은
 * 한 칸 덮어쓰기(L 1-A2)라 같은 번호를 여러 번 넣어도 한 번이다.
 */
export function drawnFumbleCheerOf(fielders: readonly DrawnFielderCounters[]): boolean {
  return fielders.some((fielder) => (fielder.lockTicks ?? 0) <= 0 && (fielder.fumbleTicks ?? 0) === FUMBLE_RECORD_TICKS)
}

/**
 * 야수 +0xec — 수비 팀 레코드 차례에서 자리 니블(`+0x1c & 0xf`)이 **칸 + 1** 인 첫 선수.
 * - 칸 1~8: 판 시작 0xb0fb4 b1032~b1060 · b1184 가 판마다 다시 찾는다(못 찾으면 앞 값이 남는다).
 * - 칸 0(투수): 판 시작은 건너뛰고(b1032 `cmp r4, #0 ; beq`) 공수 교대 판 0x3fac4 3fe1a~3fe4c 가 같은 식으로 넣은 값 —
 *   니블 1 = **지명타자**다. 투수의 펌블 · 악송구는 지명타자 기록에 붙는다(원본 그대로).
 *
 * ⚠️ 미확인: 0x3fac4 는 공수 교대 판이 서서 OK 를 기다릴 때만 불려(R10) 판이 안 선 반 이닝 뒤의 칸 0 은 앞 판의 값이 남는다 —
 * 웹은 늘 지금 수비 팀의 지명타자로 본다. 못 찾은 칸도 앞 값 대신 null(안 쌓음)이다.
 */
export function fielderRecordIndexOf(
  lineup: readonly { readonly position?: number }[],
  slot: number,
): number {
  return lineup.findIndex((player) => ((player.position ?? 0) & 0xf) === slot + 1)
}

/** 그림이 낸 실책을 리그 기록표 열쇠로 — `keyOf` 가 수비 팀 · 칸으로 그 야수 레코드를 고른다(못 고르면 null) */
export function fieldingErrorRecordsOf(
  drawn: readonly DrawnFieldingError[],
  keyOf: (error: DrawnFieldingError) => LeagueFieldingError | null,
): LeagueFieldingError[] {
  const records: LeagueFieldingError[] = []
  for (const error of drawn) {
    const key = keyOf(error)
    if (key !== null) records.push(key)
  }
  return records
}
