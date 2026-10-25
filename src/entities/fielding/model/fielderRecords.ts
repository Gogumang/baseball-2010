import type { LeagueFieldingError } from '@/entities/league/model/leaguePlayerStats'

/**
 * **야수 +0xec — 수비 줄 아홉 명이 가리키는 선수 레코드** (경기 장면 +0x111c+4i 의 야수 객체 칸).
 *
 * 야수 객체는 경기 장면을 세울 때 한 번 만들고(0x3e340 — `new` 0x1238 → 0x2ac4 의 memset 0, 생성자 0xa0e08 · 0xa0db8 은 +0xec 를
 * 안 적는다) 장면이 사는 동안 그대로 쓴다. +0xec 를 적는 곳은 둘뿐이다 (직접 뜸 — `adds #0xec ; str` 꼴 전수, `widgets/field-walk/lib/walkerAces`):
 * ```
 * 0x3fac4 3fe0a~3fe4c  공수 교대 판(상태 0x18, 틱 0) — 칸 i = 8..0 모두. 수비 팀(팀[st[0xa]], 3fd3c~3fd4e) 레코드 차례에서
 *                      자리 니블(+0x1c & 0xf) == i + 1 인 첫 레코드. 못 찾으면 3fee0 으로 건너뛰어 안 덮는다
 * 0xb0fb4 b1032~b1188  수비 판 시작(상태 0x17) — 칸 1..8 만(b1032 `cmp r4,#0 ; beq` 가 칸 0 을 건너뛴다). 같은 훑기, 못 찾으면 안 덮는다
 * ```
 * 0x3fac4 는 4fb20 이 부르는데 가드가 셋이다(3fad0 [장면+0x1104] · 3fade [장면+0x1784] == 0 · 3fae8 0xb68fd) — 판이 서서 OK 를
 * 기다릴 때만 돈다(자동진행 0x21 뒤의 0x18 은 4fab6 → 4fb08 자동 OK 로 판 없이 지나간다). 그래서 **칸 0(투수)은 마지막으로 선 판의
 * 수비 팀 지명타자(니블 1)** 이고, 장면을 세운 뒤 판이 한 번도 안 섰으면 0 이다. 판이 안 선 반 이닝에 수비 팀이 바뀌었으면 칸 0 은
 * **상대 팀 지명타자**를 가리킨 채다(원본 그대로).
 *
 * 이 칸을 읽는 곳 — 모두 수비 판 안이다:
 * - 펌블 b41e4: +0xec 가 있으면 표 0xd87d4[0xbbe98(0xb570d(팀[st[0xa]] 레코드, 2, +0xec, 90, 1))] 아니면 0 (굴림은 늘 먹는다)
 * - 레이저 0x66a8c: 66aa6 +0xec 가 비면 굴리지 않는다 · 66a94 같은 능력치 · 66ad4 0xb62b4(+0xec, 0x15) 초감각
 * - 실책 그림 0x43278: 4383a · 438ea [+0xec] != 0 이면 [+0xec]+0x2e += 1, 펌블 갈래는 43854 0xa755d(…, 3) 도
 *
 * 능력치를 셀 때 팀 레코드는 **지금 수비 팀**(b41ec 0xb8681(팀[st[0xa]]))이고 선수만 +0xec 다 — 그래서 상대 팀 지명타자를
 * 가리킨 칸 0 도 지금 수비 팀의 팀 능력치 · 시즌 보정으로 센다. 칸 0 의 레코드는 늘 니블 1(지명)이라 보직 불일치 벌점(0xb5844)은
 * 안 붙는다.
 *
 * 웹은 진행기가 이 아홉 칸을 들고(`fielderRecords`) 판 입력에 판 시작 뒤의 값을 실어 보낸다 — 그림이 야수마다 `record` 로 싣고
 * 실책 열쇠가 그것을 쓴다(`features/defense-play/model/fieldingErrors`).
 */
export interface FielderRecordSeat {
  /** 이 레코드가 든 팀 (지금 수비 팀이 아닐 수 있다 — 칸 0) */
  readonly teamId: number
  /** 그 팀 타자 레코드 차례에서의 칸 — 진행기마다 자기 명단 표(`teamBatters` · 팀 경기 명단)의 칸이다 */
  readonly index: number
  /** 실책 +0x2e 를 올릴 리그 기록표 열쇠 — 레코드는 있으나 기록표 칸이 없는 선수(마타자 등)면 null */
  readonly errorKey: LeagueFieldingError | null
}

const FIELDER_COUNT = 9

/** 경기 장면을 세운 직후 — 아홉 칸 모두 0 (new 의 memset) */
export const NEW_FIELDER_RECORDS: readonly null[] = Array.from({ length: FIELDER_COUNT }, () => null)

/** 자리 니블이 칸 + 1 인 첫 레코드 차례 — 0x3fac4 3fe28~3fe4c · 0xb0fb4 b103e~b105e 의 같은 훑기. 없으면 −1 */
function seatIndexOf(lineup: readonly { readonly position?: number }[], slot: number): number {
  return lineup.findIndex((player) => ((player.position ?? 0) & 0xf) === slot + 1)
}

/**
 * 공수 교대 판 0x3fac4 뒤 — 칸 0..8 모두를 판의 **수비 팀** 레코드 차례로 다시 훑는다(못 찾은 칸은 앞 값).
 * `seatOf(i)` 는 그 팀 레코드 차례 칸 i 의 자리다.
 */
export function fielderRecordsAfterBoard<S>(
  previous: readonly (S | null)[] | undefined,
  lineup: readonly { readonly position?: number }[],
  seatOf: (index: number) => S,
): readonly (S | null)[] {
  return Array.from({ length: FIELDER_COUNT }, (_unused, slot) => {
    const index = seatIndexOf(lineup, slot)
    return index >= 0 ? seatOf(index) : (previous?.[slot] ?? null)
  })
}

/**
 * 수비 판 시작 0xb0fb4 뒤 — 칸 1..8 만 그 판의 수비 팀 레코드 차례로 다시 훑는다(b1032: 칸 0 은 건너뛴다, 못 찾은 칸은 앞 값).
 *
 * 웹 명단은 자리 니블 2~9 가 늘 다 차 있다(대타 · 교체는 자리 니블을 그 타순 칸에 남긴다 — 팀 경기 `substituteBatter` 1·2) —
 * 그래서 판마다 이 값을 진행기에 되적지 않아도 칸 1..8 은 늘 그 판 수비 팀의 값이고, 판을 넘겨 남는 것은 칸 0 뿐이다.
 */
export function fielderRecordsAtPlayStart<S>(
  previous: readonly (S | null)[] | undefined,
  lineup: readonly { readonly position?: number }[],
  seatOf: (index: number) => S,
): readonly (S | null)[] {
  return Array.from({ length: FIELDER_COUNT }, (_unused, slot) => {
    if (slot === 0) return previous?.[0] ?? null
    const index = seatIndexOf(lineup, slot)
    return index >= 0 ? seatOf(index) : (previous?.[slot] ?? null)
  })
}
