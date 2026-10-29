import type { RosterPlayer } from '@/shared/config/original/roster'
import { batterCardStatsOf, batterLineOfRecord } from '@/widgets/matchup-cards/lib/matchupRecord'
import type { MatchupBatterCard, MatchupPitcherCard } from '@/widgets/matchup-cards/ui/MatchupCards'

/*
 * **미션(모드 5 · 6) 상태 0xe 의 투수 · 타자 소개 판 값** (0x44944 — 0x4d9ec 하나가 부르고 모드 검사가 없다, R10 10-3).
 *
 * 판은 투수 `0xae83c([장면+0x228+4·st[0xa]])` · 타자 `0xae89c([장면+0x220])` 의 선수 레코드(0x30 바이트)를 그대로 읽는다
 * (0x449ce~0x44a22). 미션의 두 팀은 이렇게 선다 (직접 뜸):
 * ```
 * 0x1ff98   마스터 팀 15개 — 팀마다 Xls 행을 투수 8 × 0x30 · 타자 12 × 0x30 바이트 통째 memcpy(2001a~2004e). 지우는 칸 없음
 *           → 레코드 +0x20~+0x2b 시즌 줄 = **Xls 행 바이트 32~43** (`RosterPlayer.recordLine`)
 * 0xb8680   모드 5 · 6(점프표 0xd8a30 → b86e2): (g[0x11f] || g[0x176]) && g[0xf6] == 2 && 팀 ≤ 9 면 시즌 0x1f571, 아니면
 *           마스터 0x1f8c1(team+0x25) — 웹 대결은 나리(3 · 4)뿐이라 늘 마스터 팀 레코드(+2 사기 = XlsTEAM_DATA 표값)
 * 0xa56dc   기록 게이트 — 점프표 0xd8204[모드 − 2] 의 5 · 6 갈래 0xa5764: [ctx+0xa8](= 1 & ~레코드[1], 모든 미션 1)이 서 있으면
 *           a576e 0xb6389(+0xa 비트 7 육성) || a577e 0xb6349(명예 번호) 일 때만 참
 *           → **미션 선수(나리 · 명예)만** 정산 0xa8024 가 경기 중에 줄을 올리고, 마스터 줄 · 마선수는 표의 줄 그대로다
 * 마선수     0x20094 6번 갈래가 XlsACE_* 행을 그대로 부은 저장 레코드를 0xb521c / 0xb53f0 로 통째 베낀다(`AcePlayer.recordLine`)
 * ```
 * - 타자 미션(모드 6): 투수 = CPU 마운드(마스터 줄 · 마투수), 타자 = 사람 칸 팀 지금 타순 — 미션 타자 차례면 선수 게터 0x1fc20 의 기록
 *   (0xb87cc 가 통째 넣어 줄이 따라온다) + 이 경기 줄, 마스터 타순 차례면 그 줄의 표값.
 * - 투수 미션(모드 5): 투수 = 미션 투수(0xb8820 이 0x1fbd0 기록을 통째 넣는다) + 이 경기 줄, 타자 = CPU 타선 지금 타순(마스터 줄 · 마타자).
 * - 팀 글자 0xb6c20: 사람 칸 PLAYER · 다른 칸 COM. 손 0xb63c0 · 보직 +0xb & 3 · 수비 +0x1c & 0xf · 타순 팀+0x32 · 오늘 타석 링(타순 칸).
 * - 체력 막대 길이 0x66e44(0xb8680(수비 팀), 투수, f) — 사기 = 수비 팀 마스터 레코드 +2, f = 팀[+0x26] − [+0x33] == 1(교체 전).
 */

/** 미션 타자 — 선수 게터 0x1fc20 (나리 타자편 저장 선수 · 명예 타자) */
export interface MissionCardBatter {
  readonly name: string | null
  /** 0xb63c0 — 폼 & 1 (1 좌타) */
  readonly hand: number
  /** 레코드 +0x20~+0x2b (`ModeBatter.recordLine`) — 모르면 판의 줄 칸을 비운다 */
  readonly recordLine?: readonly number[]
}

/** 미션 투수 — 선수 게터 0x1fbd0 (나리 투수편 저장 선수 · 명예 투수) */
export interface MissionCardPitcher {
  readonly name: string | null
  /** 보직 +0xb & 3 — 모르면 칸 0 */
  readonly role?: number
  /** 폼 rec[0xb] >> 4 (0xb6e24) */
  readonly form: number
  /** 체력 실효 능력치 `0xb6415(P, 3, 1)` */
  readonly staminaAbility: number
  /** 지금 레코드 +0x2c */
  readonly stamina: number
  readonly recordLine?: readonly number[]
}

export interface MissionMatchupCards {
  readonly batterHand: number
  readonly pitcher: MatchupPitcherCard
  readonly batter: MatchupBatterCard
}

/** 타순 칸 기록 링 — 0x53100(칸, i) 의 오래된 차례 */
export function ringOf(records: readonly { readonly results?: readonly number[] }[], slot: number): readonly number[] {
  return records[slot]?.results ?? []
}

/** 판 앞머리 — PLAYER/COM · 타순 · 오늘 타석 링 */
export interface BatterCardCommon {
  readonly isComputer: boolean
  readonly battingOrder: number
  readonly recentResults: readonly number[]
}

/** 마스터 줄 타자 판 — 그 행의 이름 · 수비 · 표값 줄 (게이트 0xa5764 가 안 열려 경기 중 줄이 안 붙는다) */
export function rosterBatterCardOf(player: RosterPlayer, common: BatterCardCommon): MatchupBatterCard {
  return {
    ...common,
    name: player.name,
    ...(player.position === undefined ? {} : { position: player.position }),
    ...batterCardStatsOf(batterLineOfRecord(player.recordLine)),
  }
}
