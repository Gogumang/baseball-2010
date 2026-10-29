import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { myBatterIndexOf, nariTeamRecordOf, nariTeamsOf } from '@/entities/career/model/nariTeamRecord'
import { batterCardStatsOf, batterLineOfRecord } from '@/widgets/matchup-cards/lib/matchupRecord'
import type { MatchupBatterCard } from '@/widgets/matchup-cards/ui/MatchupCards'
import { hallOfFameRecordSlotOf } from '@/entities/collection/model/collection'
import { DERBY_HALL_OF_FAME_BATTER_SLOT, DERBY_MISSING_BATTER_SLOT } from '@/entities/home-run-derby/model/derbyLineup'
import type { HallOfFamer } from '@/entities/collection/model/collection'

/**
 * **홈런더비 상태 0xe 의 타자 판 값** (0x44944 — 타자 `0xae89c(팀 0)` = 모드 타자 기록 0x1fc20 의 사본).
 * - 나리 타자편 저장(0x213c0(앱, 4, 0))의 내 선수 레코드: 이름 · 시즌 줄 `career.stats`(웹이 내 레코드 +0x20~ 대신 세는 칸) —
 *   기록 게이트 0xa56dc 는 모드 7 에서 거짓이라 더비 중에는 안 오른다.
 * - 명예 타자 기록(0x1f640): 이름 · 등록 때 통째 베낀 시즌 줄(`recordLine`) — 그 칸을 남기기 전 옛 명전 기록은 이름만.
 * 타순(팀+0x32)과 수비(0xb53f0 이 남긴 옛 [k] 마스터 줄의 +0x1c)는 화면이 타순(`derbyLineup`)에서 채운다.
 * 오늘 타석 기록(링)은 비운다 — 더비 타석은 정산 0xa8024 를 안 지난다(2026-10-16 직접 떴다): 판정 A 0xae24c 의 더비 갈래
 * (st[1] == 7, ae270~ae336 → 0xd · 0x1a)와 판정 B 0xae3e8 의 더비 갈래(ae408~ae552 → ae5ca)는 0xa8024 를 부르지 않고(그 호출
 * ae36a · ae5b0 은 경기 끝 0xb68fc 갈래 · 보통 갈래 몫), 링 넣기 0xa908c 를 부르는 곳은 0xa8024 하나다(xref).
 * 더비 경기를 세울 때 링은 비워진다(r181 확정): 경기 장면 셋업 0x39fdc 의 모드 7 갈래(점프표 0xcfef8[7] = 0x3a43e)가 0x3a500 에서
 * 팀 셋업 0xb891c 를 부르고, 그 b899e~b89ac 가 타순 칸 22개(24바이트 간격)마다 링 초기화 0xb8cfc(칸, 10)을 부른다 — 머리 +0xa ·
 * 쓰기 +0xb · 개수 +0xc = 0, 용량 +0xd = 10. 곧 웹의 빈 링이 원본 그대로다.
 */
export function derbyMatchupBatterOf(
  famer: { readonly name: string; readonly recordLine?: readonly number[] } | null,
  career: PlayerCareer | null | undefined,
): Omit<MatchupBatterCard, 'isComputer'> | undefined {
  if (famer !== null) {
    return famer.recordLine === undefined ? { name: famer.name } : { name: famer.name, ...batterCardStatsOf(batterLineOfRecord(famer.recordLine)) }
  }
  if (career === null || career === undefined) return undefined
  return { name: career.name, ...batterCardStatsOf(career.stats) }
}

/**
 * **모드 타자가 든 명부 칸 k** = 3a550 의 `0xb6394(0x1fc20(앱))` = 기록 +0xa & 0x1f — 나리 저장 선수면 나리 팀 레코드의 내 줄 첨자
 * (142 · 경기 장면이 0xb8768 로 다시 매긴 칸, 미션 `nariBatterRecordSlot` 과 같은 값), 명예 타자면 그 전역 기록의 아랫 5비트
 * (등록 0 · 시즌 영입이 고른 자리 — `hallOfFameRecordSlotOf`). 내 줄이 없으면 끝 칸 12 — 원본은 P = NULL 이라 옮길 값이 없다
 * (`DERBY_MISSING_BATTER_SLOT`).
 */
export function derbyModeBatterSlotOf(famer: HallOfFamer | null, career: PlayerCareer | null | undefined): number {
  if (famer !== null) return hallOfFameRecordSlotOf(famer)
  if (career === null || career === undefined) return DERBY_HALL_OF_FAME_BATTER_SLOT
  const index = myBatterIndexOf(nariTeamRecordOf(nariTeamsOf(career), career.teamId))
  return index < 0 ? DERBY_MISSING_BATTER_SLOT : index
}
