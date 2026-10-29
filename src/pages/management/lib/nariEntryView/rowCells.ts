import { entryBatterLineOfRecord, entryPitcherLineOfRecord } from '@/entities/season-mode/model/entryEditor'
import type { EntryBatterLine, EntryPitcherLine } from '@/entities/season-mode/model/entryEditor'
import { staminaPercentOf } from '@/entities/season-mode/model/seasonEntry'
import { recordAbilityOf } from '@/entities/team/model/recordAbility'
import type { RosterPlayer } from '@/shared/config/original/roster'
import { leagueBatterIdOf, leagueBatterLineOf, leaguePitcherIdOf, leaguePitcherLineOf } from '@/entities/league/model/leaguePlayerStats'
import { staminaCapacityOf } from '@/entities/pitcher-career/model/pitcherStamina'
import type { NariEntryCellSource } from './types'

const FULL_RECORD_STAMINA = 10000

export function nariBatterCellsOf(cells: NariEntryCellSource | undefined, teamId: number, slot: number, player: RosterPlayer) {
  if (cells === undefined) return {}
  // 대회 칸 — Xls 행 +0x20~+0x2b 그대로, +0x2c 도루는 표 바이트 0 · +0x2e 실책은 표 0 에 대회 중 대표팀 칸에 쌓인 수
  if (cells.isCupRecord === true) {
    return { batterLine: { ...entryBatterLineOfRecord(player.recordLine), errors: cells.cupErrors?.[slot] ?? 0 } }
  }
  return { batterLine: leagueBatterEntryLineOf(leagueBatterLineOf(cells.stats, leagueBatterIdOf(teamId, slot))) }
}

/** 리그 기록표 타자 줄 → 레코드 +0x20~ 칸. +0x2e 실책 — 수비 그림 0x43278 4381a~43904 가 쌓은 칸(옛 저장은 0) */
function leagueBatterEntryLineOf(line: ReturnType<typeof leagueBatterLineOf>): EntryBatterLine {
  return {
    atBats: line.atBats,
    hits: line.hits,
    doubles: line.doubles ?? 0,
    triples: line.triples ?? 0,
    homeRuns: line.homeRuns,
    runsBattedIn: line.runsBattedIn,
    steals: line.steals ?? 0,
    errors: line.errors ?? 0,
  }
}

export function nariPitcherCellsOf(cells: NariEntryCellSource | undefined, teamId: number, slot: number, player: RosterPlayer) {
  if (cells === undefined) return {}
  const staminaAbility = player.ability[3] ?? 0
  // 대회 칸 — Xls 행 줄 그대로(승 · 패 0), +0x2c 는 표값 · 0xb6190 모두 10000 (`nariCupEntryCellSourceOf`)
  if (cells.isCupRecord === true) return aceCellsOf(cells, player.recordLine, true, staminaAbility)
  const line = leaguePitcherLineOf(cells.stats, leaguePitcherIdOf(teamId, slot))
  // +0x2a 사사구 — 정산 0xa8024 꼬리 a8b04~a8bee 가 쌓은 칸(옛 저장은 0)
  const pitcherLine: EntryPitcherLine = {
    outs: line.outs,
    runsAllowed: line.runsAllowed,
    saves: line.saves,
    strikeouts: line.strikeouts,
    pitches: line.pitches,
    walks: line.walks ?? 0,
    wins: line.wins,
    losses: line.losses,
  }
  return {
    pitcherLine,
    stamina: {
      capacity: staminaCapacityOf(staminaAbility, cells.morale, false),
      percent: staminaPercentOf(cells.staminaMode, cells.staminas?.[slot] ?? FULL_RECORD_STAMINA),
    },
  }
}

/**
 * 마선수 줄 — XlsACE 행을 통째 베낀 레코드(0xb521c · 0xb53f0): 줄은 표의 `recordLine`. 마투수 +0x2c 는 XlsACE_PIT_DATA 다섯 행 모두
 * 0x2710(10000, r165 표 바이트 확인)이고 CPU 경기 준비 0xb88c8 → 0xb521c 가 경기마다 그 값으로 8번 칸을 다시 베낀다(P1 3-0).
 * **143 의 마투수 체력은 늘 가득이다** (r244 확정 — 직접 떴다): 경기가 깎은 끝 값은 팀 레코드 8번 칸에 남고 하루 끝 0xb617c 도
 * 그 칸을 돈다(0xb60e0 은 투수 수 [+0xc] — 0xb521c 의 0xb4e34 가 늘린 8번 칸 포함 — 만큼 +0x2c 를 채운다). 그런데 143 에 오는 길은
 * 142 하나이고, 142 진입 0x1c46c 는 앞 상태가 143 이 아니고(1c560) 장면+0x288 == 0 이면(1c56e) 국가대항전이 아닐 때(1c5fc S+0x12c)
 * 두 팀 모두 `0xb88c8` → `0xb521c` 로 마투수 행을 8번 칸에 **통째로 다시 베낀다**(b528e~b529c memcpy 0x30 — 8번이 이미 마선수여도
 * 덮는 갈래 b5262 가 같은 memcpy 로 간다). +0x288 은 장면 0x106 이 새로 설 때(경기 뒤)만 0 이라 같은 장면의 142 재진입 사이에는
 * 경기가 없다. 그래서 143 이 보는 두 팀의 8번 칸은 늘 방금 베낀 행 +0x2c = 10000 이다 — 아래 `FULL_RECORD_STAMINA` 가 원본 그대로다.
 */
export function aceCellsOf(cells: NariEntryCellSource | undefined, recordLine: readonly number[], isPitcher: boolean, staminaAbility: number) {
  if (cells === undefined) return {}
  if (!isPitcher) return { batterLine: entryBatterLineOfRecord(recordLine) }
  return {
    pitcherLine: entryPitcherLineOfRecord(recordLine),
    stamina: { capacity: staminaCapacityOf(staminaAbility, cells.morale, false), percent: staminaPercentOf(cells.staminaMode, FULL_RECORD_STAMINA) },
  }
}

/**
 * 붙박이 표 줄의 상세 창 도형 값 — 레코드 장비 니블이 있으면 `0xb6414(rec, k, 1)`(니블 보너스 뒤 장착 스킬 단계), 없으면 행 그대로
 * (리그 열 팀 Xls 행은 니블 0 이고 스킬 5 · 7 · 20 · 22 비트도 없어 예전 값과 같다).
 */
export function equippedRowAbilityOf(player: RosterPlayer, equipment: readonly number[] | undefined, isPitcher: boolean): readonly number[] {
  return equipment === undefined ? player.ability : recordAbilityOf({ ...player, equipment }, isPitcher)
}
