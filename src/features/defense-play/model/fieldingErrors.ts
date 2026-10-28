import { isBugFixed } from '@/shared/config/bugfixes'
import type { FielderRecordSeat } from '@/entities/fielding/model/fielderRecords'
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
 *
 * **미션(모드 5 · 6)도 올리지만 보이는 곳이 없다** (직접 뜸): 미션의 두 팀 레코드는 0xb8680 의 모드 5 · 6 갈래(b86e2 — 대결 대기가
 * 시즌에서 설 수 없어 늘 b8728)가 주는 **마스터 팀 레코드** 0x1f8c1(`[g+0xac]+0xac0+팀×0x1c`)이고, 미션을 마치는 길마다 마스터를
 * Xls 행으로 통째 다시 짓는다 — 정산 0x4ea0c 4ef1a · 결과 진입 0x4f574 4f696 · 경기 중 메뉴 0x3c158(3c794 · 3c9a8)이 `0x20094(g, 5)`
 * → 0x1ff98(행 memcpy 2001a~2004e). 미션 중 레코드를 읽는 그림(소개 판 0x44944)은 +0x20~+0x2b 시즌 줄만 본다. 그래서 웹 미션은
 * 그림의 실책을 쌓지 않는다(홈런더비 모드 7 과 같은 꼴 — `entities/home-run-derby/model/derbyPitcher`).
 */
export interface DrawnFieldingError {
  /** 수비 칸 0~8 (0 투수 … 8 중견) */
  readonly slot: number
  /** 그 그림의 수비 팀 번호 (`DefenseFielder.teamIndex` = 판 입력 `defenseTeamIndex`). 모르면 null */
  readonly teamIndex: number | null
  /**
   * 그 야수의 +0xec 선수 레코드 (`DefenseFielder.record` = 판 입력 `fielderRecords`) — 실책을 올릴 열쇠. 칸 0 은 마지막 교대 판의
   * 수비 팀 지명타자라 지금 수비 팀이 아닐 수 있다(`entities/fielding/model/fielderRecords`). 안 주면 모른다(옛 시험 입구 — 지금 수비 팀
   * 명단으로 찾는다)
   */
  readonly record?: FielderRecordSeat
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
  /** +0xec — null 이면 0(4383a · 438ea 가 +0x2e 를 안 올리고 0xa755d 도 안 부른다). 안 주면 모른다 */
  readonly record?: FielderRecordSeat | null
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
    // 4383a · 438ea — [+0xec] == 0 이면 +0x2e 도 0xa755d 도 건너뛴다 (펌블 함성 29 는 `drawnFumbleCheerOf` — 늘 지난다)
    if (fielder.record === null) continue
    const error: DrawnFieldingError = {
      slot: fielder.slot,
      teamIndex: fielder.teamIndex ?? null,
      ...(fielder.record === undefined ? {} : { record: fielder.record }),
    }
    errors.push(fumble > 0 ? { ...error, isFumble: true } : error)
  }
  return errors
}

/**
 * 재생 판(`lastDefensePlay`) 하나를 건너뛰기 없이 끝까지 그렸을 때 올라가는 실책 — 판 틱마다 그림 한 번(`DefensePlayback` 재생 갈래의
 * 셈과 같다: 틱 0..끝을 한 번씩 그리고 닫힌 갱신의 다시 그리기는 안 센다). 화면 없는 하네스(soak)가 재생 화면 대신 쓴다
 */
export function drawnReplayFieldingErrorsOf(views: readonly { readonly fielders: readonly DrawnFielderCounters[] }[]): DrawnFieldingError[] {
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
 * 지금 수비 팀 명단에서 칸의 +0xec 를 찾는다 — 자리 니블(`+0x1c & 0xf`)이 **칸 + 1** 인 첫 선수(칸 0 은 니블 1 = 지명타자).
 * 그림이 레코드를 안 실은 옛 입구(`DrawnFieldingError.record` 없음)만 쓴다 — 진행기는 판 입력 `fielderRecords` 로 +0xec 를 넘기고
 * 실책은 그 레코드에 붙는다(`entities/fielding/model/fielderRecords` — 칸 0 은 마지막 교대 판 0x3fac4 의 값, 판 없이는 0).
 */
export function fielderRecordIndexOf(lineup: readonly { readonly position?: number }[], slot: number): number {
  return lineup.findIndex((player) => ((player.position ?? 0) & 0xf) === slot + 1)
}

/**
 * 그림이 낸 실책을 리그 기록표 열쇠로 — 그림이 실은 +0xec 레코드(`record`)가 있으면 그 열쇠(`errorKey`, 기록표 칸이 없는 레코드면 버림),
 * 없으면(옛 입구) `keyOf` 가 수비 팀 · 칸으로 그 야수 레코드를 고른다(못 고르면 null)
 */
export function fieldingErrorRecordsOf(
  drawn: readonly DrawnFieldingError[],
  keyOf: (error: DrawnFieldingError) => LeagueFieldingError | null,
): LeagueFieldingError[] {
  const records: LeagueFieldingError[] = []
  for (const error of drawn) {
    const key = error.record !== undefined ? error.record.errorKey : keyOf(error)
    if (key !== null) records.push(key)
  }
  return records
}

/**
 * **창 첫 그림(다시 그리기 52efe)이 내는 실책 · 펌블 함성** — 원본은 앞 그림과 같은 야수 칸을 다시 보아 실책 +0x2e 와 함성 29 를
 * **한 번 더** 낸다(0x43278 4381a~43904, B-56). **고침(`bugfixes.json` B-56, 기본 켬)**: 다시 그리기는 아무것도 안 낸다. 굴림 없음.
 */
export function redrawnFieldingErrorsOf(fielders: readonly DrawnFielderCounters[]): DrawnFieldingError[] {
  return isBugFixed('B-56') ? [] : drawnFieldingErrorsOf(fielders)
}

export function redrawnFumbleCheerOf(fielders: readonly DrawnFielderCounters[]): boolean {
  return isBugFixed('B-56') ? false : drawnFumbleCheerOf(fielders)
}
