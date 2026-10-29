import type { PitcherRepertoire } from '@/shared/config/original/pitcherRepertoires'
import type { PitcherRole } from '@/entities/pitcher-career/model/pitcherRole'

/**
 * 경기에 들어간 팀의 **명단 한 칸** — 원본 `team[0xe + 칸]` 이 가리키는 선수 레코드다.
 *
 * 원본은 팀 구조체에 "칸 → 선수" 이름 목록 하나를 두고 (`team+0xe`, 0x16칸), **앞 아홉 칸이
 * 타순**, 그 뒤가 벤치다 (벤치 타자 수 = `team+0x28c`). 대타 확정 `0xaebe4` 가 이 목록의 두 칸을
 * 맞바꾸고 빠진 선수를 목록에서 지운다(`0xb95b1`) — 그래서 웹도 로스터 칸 번호를 바로 쓰지 않고
 * 이 목록을 들고 다닌다.
 */
export interface TeamEntryBatter {
  readonly name: string
  /**
   * 히트 · 파워 · 수비 · 주루 (원본 0~999 눈금) — 레코드의 **`0xb6414(rec, k, 1)`**(장비 니블 · 장착 스킬까지, 마선수는 레벨
   * 배율 전 값). 경기용 보정(0xb570c 의 시즌·팀 부분)은 `entryBatterGameAbilities` 가 이 위에 먹인다
   */
  readonly ability: readonly [number, number, number, number]
  /**
   * 레코드 +0x19 · +0x1a 장비 니블 네 칸 (0 없음 · n = 레벨 + 1) — 붙박이 표 선수 · 기록으로 선 영입 선수(기록 사본의 니블)가 든다
   * (마선수는 없다). 타석 그림 0x10866 → 0x78fd8 이 이 니블로 장비 겹을 고른다
   */
  readonly equipment?: readonly number[]
  /**
   * 레코드 +0xb 한 바이트 — 기록으로 선 영입 선수만 든다(기록 사본 `TeamEntryBatterRecord.profile`). 붙박이 표 선수는 Xls 행
   * (`RosterPlayer.profile`)에서 읽는다. 폼 = `>> 4`(0xb6e24) · 피부 = `(>> 2) & 3` · 손 0xb63c0 = 폼 & 1
   */
  readonly profile?: number
  /** 수비 위치 코드 = 레코드 `+0x1c & 0xf`. **0 은 자리 없는 후보(벤치)** 다 */
  readonly position: number
  /** 마타자면 `ACE_BATTERS` 칸 0~4, 아니면 −1 */
  readonly aceIndex: number
  /**
   * 이 선수의 **로스터 칸**(리그 로스터 12명 중 몇 번째인가) — 마타자는 리그 로스터 선수가 아니라
   * `NO_ROSTER_SLOT` 이다.
   *
   * 원본 명단 `team+0xe` 는 처음에 `team[0xe+i] = i` 로 서고(`0xb891c` 의 b895a) 대타 확정
   * `0xaebe4` 가 칸을 맞바꾸고 지운다 — 곧 명단 한 칸은 **선수 레코드를 가리키는 번호**다. 기록 함수
   * `0xa8024` 는 그 선수 레코드에 쌓으므로 대타가 들어온 뒤에는 타순 칸과 로스터 칸이 갈린다.
   * 선수 객체째 옮기는 웹 명단에서는 이 칸이 선수를 따라간다.
   */
  readonly rosterSlot: number
  /**
   * `rosterSlot` 이 가리키는 **붙박이 표 팀** — 트레이드(0xd1cc~0xd3ae)로 다른 팀 레코드에서 옮겨 온 선수만 든다(없으면 경기 팀).
   * 원본 선수 레코드의 id(+0)는 Xls 행 번호(`팀 × 12 + 칸`)라 옮겨 와도 옛 팀 행이고, 기록 함수 0xa8024 는 그 레코드 +0x20~
   * 에 쌓아 성적이 선수를 따라간다 — 웹 리그 기록표도 이 팀 · 칸(`leagueBatterIdOf`)으로 센다.
   */
  readonly tableTeamId?: number
  /**
   * 붙박이 표 밖 선수(시즌에 영입한 명전·나리)의 원본 id — 기록을 실어 선 칸(`rosterSlot` 이 `NO_ROSTER_SLOT`)만 든다.
   * 0xa8024 가 그 선수 레코드 +0x20~ 에 쌓으므로(0xa56dc 모드 2 갈래가 마선수만 거른다) 리그 기록표의 표 밖 줄
   * (`LeaguePlayerStats.recordBatters`)로 센다. 마선수는 없다
   */
  readonly recordId?: number
  /**
   * 레코드 +0x1b(연봉 칸) — 기록으로 선 영입 선수(명전 · 나리)만 든다. 상세 창 0x5b798 이 모드 2 에서 5c87c~5c884 로
   * `rec+0x1b × 10 × 100` 을 연봉으로 찍는다(나리 사본은 0xa4fd8 의 min(연봉/10, 255) — `SeasonEntryBatterRecord.salaryGrade`).
   * 옛 사본엔 없다(연봉 칸을 0 으로)
   */
  readonly salaryGrade?: number
  /**
   * 레코드 `+0x14` 장착 스킬 비트 — 간이 타석 스윙 0xab214 의 스킬 갈래(ab91c~)가 모드 검사 없이 `0xb62b4(타자, n)` 로 읽는다.
   * 붙박이 표 줄은 Xls 행 그대로(`RosterPlayer.skillBits`), 기록으로 선 영입 선수는 그 기록의 비트(옛 사본은 없어 0),
   * 마타자는 0xb53f0 이 통째 베낀 XlsACE_BAT 행 그대로(`withAceBatter` — 킹타이거 압도 22)
   */
  readonly skillBits?: number
  /**
   * 레코드 칸 `0xb6394` = `+0xa & 0x1f` — 경기 장면 셋업 0x39fdc(3a2fa · 3a302)가 두 팀에 0xb8768 → 0xb603c 를 불러 마선수
   * 아닌 줄을 **경기 시작 때의 레코드 첨자**로 다시 매기고(0xb6605), 마타자는 XlsACE_BAT 순번(+0xa = 0x40 + 순번) 그대로다.
   * 대타 0xaebe4 는 명단 칸(team+0xe)만 맞바꿔 레코드 +0xa 는 그대로라 선수를 따라간다. 0xab214 의 투수 스킬 31(0xabcd8)이
   * 2·3·4 를 본다. 경기를 세울 때(`withEntryRecordSlots`) 단다 — 없으면 0
   */
  readonly recordSlot?: number
}

/** 리그 로스터 선수가 아니다 (마타자 — `0x1f84c` 로 저장에서 꺼낸 레코드) */
export const NO_ROSTER_SLOT = -1

/** 타순 아홉 칸 — 그 뒤가 벤치다 */
export const BATTING_ORDER_SLOTS = 9

/** 마선수가 아니라는 표시 (준비 기록 `skin+0xbc` +0xd 가 비었을 때와 같은 값) */
export const NO_ACE_BATTER = -1

/**
 * 경기에 들어간 팀의 **투수 명단 한 칸** — 원본 `team[0 + 칸]` 이 가리키는 투수 레코드다.
 *
 * 타자 목록(`team+0xe`, 0x16칸)과 **짝을 이루는 목록이 하나 더 있다**: `team+0x00`, 0xe칸.
 * 팀 세우기 `0xb891c` 가 두 목록을 나란히 채운다 (직접 떴다):
 * ```
 * b8950: r3 = 0      ; strb r3,[r5,r3] ; r3++ ; cmp r3,#0xd ; ble   → team[i]      = i  (i 0..13)
 * b895a: r2 = 0      ; strb r2,[r3,#0xe] ; r2++ ; cmp r2,#0x15 ; ble → team[0xe+i] = i  (i 0..21)
 * b896c: team[+0x33]  = 명부[0xc] − 1      ; 벤치 **투수** 수 = 투수 수 − 1 (선발 하나)
 * b8988: team[+0x28c] = 명부[0x10] − 9     ; 벤치 타자 수 = 타자 수 − 9 (타순 아홉)
 * ```
 * 곧 **투수는 0번이 선발, 1번부터가 벤치**다 (타자가 0~8 타순, 9부터 벤치인 것과 같은 꼴).
 */
export interface TeamEntryPitcher {
  readonly name: string
  /** 제구 · 구속 · 변화 · 체력 (원본 0~999 눈금) — 레코드 +0xc 부터 u16 넷에 `0xb6414(rec, k, 1)`(장비 니블 · 장착 스킬)를 먹인 값 */
  readonly ability: readonly [number, number, number, number]
  /** 폼·마구·보유 구질 (레코드 `+0xb>>4` · `+0x18` · `+0x1c`) */
  readonly repertoire: PitcherRepertoire
  /** 마투수면 `ACE_PITCHERS` 칸 0~4, 아니면 −1 */
  readonly aceIndex: number
  /**
   * 경기를 세울 때 받은 **명단 차례**에서 몇 번째였나 — `ourEntryOrder.pitchers`(없으면 표 칸) 의 첨자.
   * 마투수는 명단 밖이라 −1. 시작·끝 스태미나(`TeamGameOptions.ourPitcherStaminas` · 요약)를 이 차례로 잇는다
   * (마투수가 8번에 들어오면 옛 8번이 맨 끝으로 가 명단 칸과 갈릴 수 있다).
   */
  readonly orderIndex: number
  /**
   * 보직 `+0xb & 3` (0xb6dec) — 로스터 칸 표(`rosterPitcherRoleOf`)에서. 마투수는 마선수 문턱·거르기를 타서
   * 보직을 안 쓴다(0xac428 ac4f2 · 0xabfcc). 없으면 CPU 투수 교체가 선발로 본다
   */
  readonly role?: PitcherRole
  /**
   * 붙박이 표 칸(0~7) — 리그 선수 기록표의 투수 번호(`leaguePitcherIdOf(팀, 칸)`)가 이 칸을 쓴다. 명단 차례(`orderIndex`)는
   * 엔트리 편집으로 표 칸과 갈릴 수 있다. 마투수(명단 밖 저장 레코드)는 없다.
   */
  readonly tableSlot?: number
  /** `tableSlot` 의 붙박이 표 팀 — 트레이드로 옮겨 온 투수만 든다(없으면 경기 팀). `TeamEntryBatter.tableTeamId` 주석 */
  readonly tableTeamId?: number
  /** 붙박이 표 밖 투수(영입한 명전·나리)의 원본 id — `TeamEntryBatter.recordId` 주석 */
  readonly recordId?: number
  /** 레코드 +0x1b(연봉 칸) — `TeamEntryBatter.salaryGrade` 주석 */
  readonly salaryGrade?: number
  /**
   * 레코드 `+0x14` 장착 스킬 비트 — 공 하나 소모 0xa5e14 가 `0xb62b4(투수, 18)`(비겁자 ×2) · `(…, 10)`(끈기 −1)로, 실투 판정
   * 0x33cbc 가 16 안정감 · 17 새가슴 · 22 냉정으로 본다. 붙박이 표 줄은 Xls 행 그대로(`RosterPlayer.skillBits`), 마투수는 0xb521c 가
   * 통째 베낀 XlsACE_PIT 행 그대로(`withAcePitcher` — 붕붕머신 16 · 발렌타인 16 · 22, 18 · 10 은 다섯 줄 모두 0). 없으면 0.
   */
  readonly skillBits?: number
  /**
   * 레코드 +0x19 · +0x1a 장비 니블 네 칸(제구 · 구속 · 변화 · 체력 = 모자 · 글러브 · 아대 · 신발) — 타석 교대 0x47cc8 이 마운드 투수가
   * 마투수(0xb633c)가 아니면 48138~4816a 에서 이 니블 − 1 로 투수 그림 0x79790 장비 겹을 싣는다. 표 줄은 Xls 행(또는 시즌 명단 니블),
   * 마투수는 안 쓴다. 기록으로 선 영입 투수는 영입 0xc554 가 통째로 옮긴 기록 사본의 니블(`TeamEntryPitcherRecord.equipment`).
   * 없으면 맨몸(옛 기록 사본 — 니블 칸이 생기기 전에 영입한 나리 사본 · 니블 없는 옛 명전 기록)
   */
  readonly equipment?: readonly number[]
}

/**
 * **마투수가 들어가는 칸 = 8번**. 마타자의 9번과 **다르다** — 직접 떠서 확인했다.
 *
 * `0xb88c8(팀, k)` → `0x1f824(저장, k)` 로 마투수 레코드를 꺼내 `0xb521c(명부, 레코드, 1)`:
 * ```
 * b523a: 0xb6720(레코드, 0x60, &b)      ; 레코드[0xa] & 0x60 이면 참 (b = [0xa] & 0x1f)
 * b5244: cmp 명부[0xc], #8 ; ble b5266  ; 투수 수가 8 이하면 바로 늘린다
 * b524a:   0xb51fc(명부, 8) → 8번 칸 ; 0xb6720(그 칸, 0x60, …) 이 참이면 r4 = 0 (덮어쓰고 −1 반환)
 * b5266: 0xb4e34(명부, 1)              ; 투수 벡터를 한 칸 늘리고
 * b527e:   memcpy(&투수[수−1], &투수[8], 0x30)   ; 옛 8번을 **맨 끝으로** 옮긴 뒤
 * b528e: memcpy(&투수[8], 레코드, 0x30)          ; 8번에 마투수를 넣는다
 * b52aa: return 8
 * ```
 * 마투수 레코드 다섯의 `+0xa` 는 **0x60·0x61·0x62·0x63·0x64** 다 (`XlsACE_PIT_DATA.zt1` 을
 * 풀어 눈으로 확인). 비트 6 이 서 있어 늘 이 가지를 탄다. 마타자 쪽은 `+0xa` 가 0x40~0x44 라
 * `0xb53f0` 의 `0x40` 가지 → **9번**이다. 로스터 투수는 여덟(칸 0~7, `+0xa` = 0~7)이므로
 * 8번은 **한 칸 늘린 자리 = 맨 끝**이고, 옛 칸을 끝으로 옮기는 셈이 없다.
 *
 * ⚠️ 원본 그대로의 결말 하나: 8번에 이미 마투수가 있으면 **덮어쓰고 −1 을 돌려준다** →
 * 부르는 쪽 `0xb88c8` 이 `team[+0x26]`·`team[+0x33]` 을 안 올린다 (b88ee `beq`).
 */
export const PITCHER_ENTRY_ACE_SLOT = 8

/**
 * **엔트리 편집기(0x55864)가 고친 명단 차례** — 원본은 편집기가 팀 레코드(시즌 저장 안 `0x1f570`, 일반모드는
 * 경기용 팀 `0x30f20` 이 세운 것)의 선수 배열을 그 자리에서 맞바꾸고, 경기용 팀 객체 `0xb891c` 는
 * `team[i] = i` 첨자만 들고 선수를 같은 레코드에서 읽는다(`0xb8680`) — 곧 **고친 차례가 곧 그 경기의 타순·벤치·
 * 투수 차례**다. 시즌은 `entities/season-mode` 의 `seasonEntryOrderOf(save.roster)` 가 만든다.
 *
 * - `batters[i]` = 명단 i 번째 타자의 **로스터 칸**(붙박이 표 첨자)과 **수비 위치**(+0x1c 하위 니블, 0 = 벤치).
 *   앞 아홉이 타순, 그 뒤가 벤치다.
 * - `pitchers[i]` = 투수 명단 i 번째의 로스터 칸. 선발 칸은 따로 정한다(시즌 `rotationSlotOf(g)` — 저장 레코드가
 *   g 번 돌기 전 모양이라 원본의 "g 번 돈 배열의 0번" 과 같다 · 일반모드는 0x30f20 의 0↔k).
 */
export interface TeamEntryOrder {
  readonly batters: readonly {
    readonly rosterSlot: number
    readonly position: number
    /** 붙박이 표 밖 선수(영입 id ≥ 0xb4)면 그 선수 기록 — 있으면 `rosterSlot` 대신 이것으로 선다 */
    readonly record?: TeamEntryBatterRecord
    /**
     * `rosterSlot` 의 붙박이 표 팀 — 트레이드로 옮겨 온 선수(원본 id 가 옛 팀 Xls 행)만 든다. 있으면 그 팀 표의
     * `rosterSlot` 번째로 서고 기록도 그 자리로 쌓는다. 없으면 경기 팀
     */
    readonly tableTeamId?: number
    /**
     * 레코드 +0x19 · +0x1a 장비 니블 네 칸 — 시즌 저장 명단의 값(`SeasonPlayer.equipment`). 표 자리로 선 선수의 `0xb6414` 가
     * 이 니블로 보너스를 먹는다. 없으면 그 Xls 행의 니블. 기록(`record`)으로 선 선수는 쓰지 않는다
     */
    readonly equipment?: readonly number[]
  }[]
  /** 로스터 칸, 붙박이 표 밖 선수(영입 id ≥ 0xb4)의 기록, 또는 표 자리(트레이드로 옮겨 온 투수 · 장비 니블을 든 투수) */
  readonly pitchers: readonly (number | TeamEntryPitcherRecord | TeamEntryTablePitcher)[]
}

/**
 * 붙박이 표 자리의 투수 — 트레이드로 옮겨 온 투수(원본 id = 옛 팀 `× 8 + 칸`), 또는 레코드 장비 니블을 실은 제 팀 투수
 */
export interface TeamEntryTablePitcher {
  /** 붙박이 표 팀 — 없으면 경기 팀(장비 니블만 실은 제 팀 투수) */
  readonly tableTeamId?: number
  readonly tableSlot: number
  /** 레코드 장비 니블 네 칸 — `TeamEntryOrder.batters[].equipment` 와 같다. 없으면 그 Xls 행의 니블 */
  readonly equipment?: readonly number[]
}

/**
 * **붙박이 표 밖 선수의 기록** — 영입해 온 명예·나리 선수(id ≥ 0xb4). 원본은 이 선수를 따로 다루지 않는다:
 *
 * ```
 * b891c  경기용 팀 = team[0xe + i] = i (b895a)        ; 팀 레코드의 선수 배열 그대로 — id 로 거르는 갈래가 없다
 * b8680  선수 = 같은 팀 레코드(모드별 0x1f891·0x1f8a9 …)의 i 번째 0x30 바이트
 * b62c0  이름 = 0x20498(관리자, rec[0], 0xb6278(rec)) → 0xaa458: 투수 id ≤ 0x4f · 타자 id ≤ 0x77 만 에디트 이름 표,
 *        그 밖(곧 id ≥ 0xb4) 은 null → rec + 1 (기록 안의 이름)
 * b6414  능력치 = 기록 +0xc 네 칸에 장비 니블·장착 비트를 얹은 값 (나리·명예 기록이 같은 꼴)
 * ```
 * 영입(0xdf)이 기록 0x30 바이트를 통째로 팀 레코드에 옮기므로(S6 4-2·4-3) 그 선수는 **자기 기록으로, 놓인 칸에서**
 * 리그 선수와 똑같이 경기에 선다. 웹 붙박이 표에는 그 기록이 없어 부르는 쪽이 이 칸에 실어 준다.
 * `ability` 는 0xb6414 를 먹인 값(명전 `equippedAbility` 꼴)이다 — 경기 보정(0xb570c)은 리그 선수와 같은 길을 탄다.
 *
 * 시즌 개인 기록: 0xa8024 는 `0xa56dc(R, 선수, 0)` 이 참이면 그 레코드 +0x20~ 에 쌓고, 모드 2 갈래(0xa56fa)는 마선수
 * (0xb633d)만 거른다(직접 떴다) — 명전·나리 선수도 쌓인다. 웹은 로스터 칸이 없으니(`NO_ROSTER_SLOT` · `tableSlot` 없음)
 * 부르는 쪽이 `recordId`(원본 id)를 실어 주면 리그 기록표의 표 밖 줄(`LeaguePlayerStats.recordBatters`·`recordPitchers`)로 센다.
 */
export interface TeamEntryBatterRecord {
  readonly name: string
  /** 히트 · 파워 · 수비 · 주루 — 0xb6414(기록, k, 1) */
  readonly ability: readonly [number, number, number, number]
  /** 그 선수의 원본 id(+0) — 있으면 리그 기록표의 표 밖 줄로 쌓는다 (`TeamEntryBatter.recordId`) */
  readonly recordId?: number
  /** 레코드 +0x1b(연봉 칸) — 상세 창 0x5b798 이 연봉으로 찍는다 (`TeamEntryBatter.salaryGrade`). 옛 사본엔 없다 */
  readonly salaryGrade?: number
  /** 레코드 `+0x14` 장착 스킬 비트 (`TeamEntryBatter.skillBits`). 시즌 명단은 기록 사본에 있으면 싣는다(옛 사본은 없어 0) */
  readonly skillBits?: number
  /**
   * 레코드 +0x19 · +0x1a 장비 니블 네 칸 — 영입 0xc554 가 옮긴 0x30 바이트의 니블(시즌 장비 창이 바꾸면 그 값). 타석 그림 장비 겹
   * (타자 0x78fd8 · 투수 0x79790)이 이 니블 − 1 로 고른다. 옛 사본엔 없다
   */
  readonly equipment?: readonly number[]
  /** 레코드 +0xb 한 바이트 (`seasonRecordProfileOf`) — 폼 · 피부 · 손. 옛 사본엔 없다 */
  readonly profile?: number
}

/** 붙박이 표 밖 투수의 기록 — `TeamEntryBatterRecord` 주석과 같다 */
export interface TeamEntryPitcherRecord {
  readonly name: string
  /** 제구 · 구속 · 변화 · 체력 — 0xb6414(기록, k, 1) */
  readonly ability: readonly [number, number, number, number]
  /** 폼 0xb6e24 · 고른 마구 +0x18 · 구질 마스크 +0x1c */
  readonly repertoire: PitcherRepertoire
  /** 보직 `+0xb & 3` (0xb6dec) — 없으면 CPU 투수 교체가 선발로 본다 */
  readonly role?: PitcherRole
  /** 그 선수의 원본 id(+0) — 있으면 리그 기록표의 표 밖 줄로 쌓는다 (`TeamEntryBatter.recordId`) */
  readonly recordId?: number
  /** 레코드 +0x1b(연봉 칸) — 상세 창 0x5b798 이 연봉으로 찍는다 (`TeamEntryBatter.salaryGrade`). 옛 사본엔 없다 */
  readonly salaryGrade?: number
  /** 레코드 `+0x14` 장착 스킬 비트 (`TeamEntryPitcher.skillBits`). 시즌 명단은 기록 사본에 있으면 싣는다(옛 사본은 없어 0) */
  readonly skillBits?: number
  /** 레코드 +0x19 · +0x1a 장비 니블 네 칸 — `TeamEntryBatterRecord.equipment` 와 같다. 마운드 장비 겹 0x79790 이 고른다 */
  readonly equipment?: readonly number[]
}
