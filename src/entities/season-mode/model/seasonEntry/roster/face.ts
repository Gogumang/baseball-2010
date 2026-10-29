import type { AcePlayer } from '@/shared/config/original/acePlayers'
import type { SeasonPlayer, SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import {
  aceLevelOf,
  aceLevelSlotOf,
  aceRecordAbilityAtLevel,
  recordAbilityOf,
  teamBatters,
  teamPitchers,
} from '@/entities/season-mode/model/seasonEntry/otherSlices'
import { tableRowOf } from '@/entities/season-mode/model/seasonEntry/roster/tableRow'

/** 시즌 명단 선수의 이름 · 능력치 */
export interface PlayerFace {
  readonly name: string
  readonly ability: readonly number[]
}

/** 붙박이 표의 한 팀을 시즌 명단 모양으로 — 칸 번호(`+0xa & 0x1f`)·id 는 표의 첨자, 수비 위치는 표의 값 */
export function tableRosterOf(teamId: number): SeasonTeamRoster {
  return {
    pitchers: teamPitchers(teamId).map((_player, slot) => ({ id: slot, kindByte: slot, fieldPosition: 0, stamina: 0 })),
    batters: teamBatters(teamId).map((player, slot) => ({
      id: slot,
      kindByte: slot,
      fieldPosition: player.position ?? 0,
      stamina: 0,
    })),
  }
}

/**
 * 시즌 명단 선수의 이름·능력치 — 리그 선수(id < 0xb4)는 그 선수의 붙박이 표 팀(`tableTeamOf` — 트레이드로 옮겨 온
 * 선수는 옛 팀) 표의 id 번째에서 빌려 온다. 영입해 온 나리·명예 선수는 기록 사본, 그것도 없으면 `투수 N번` 이다.
 *
 * **능력치는 레코드의 `0xb6415(rec, k, 1)`** 다 — 0xe0 그림 0xb074 → 목록 창 0x5cfec(0x5c984) 의 '0' 상세 창
 * `0x5b798(skin, 종류, 팀[+0x14 | +0x18] + 커서·0x30)`(0x5cf90~0x5cfc8, 투수 3 · 타자 2)이 능력치 도형
 * `0x5aefc(…, 레코드, …, 팀객체 0)` 을 부르고, 도형은 팀 객체가 0 이라 0xb570d 대신
 * `0xb6415(레코드, k, 1)`(0x5b234 · 투수 0x5b322) 를 칸 값으로, `0xb6415(레코드, k, 0)`(0x5b248 · 0x5b336) 를
 * 견줄 밑값으로 읽는다(0x5b5ba: 밑값과 같으면 보통 · 밑값이 크면 빨강 · 작으면 초록 글씨).
 * 그래서 붙박이 선수도 **밑값이 아니라 장비 니블(+0x19 · +0x1a — 시즌 명단 `equipment`, 없으면 표 행) · 장착 스킬(+0x14)을
 * 얹은 값**이고(`recordAbilityOf`), 영입 선수는 옮겨 온 0x30 바이트의 밑값 · +0x14 · 지금 니블로 다시 센다 — 영입 뒤 시즌
 * 장비 창이 니블을 바꾸면 그 값이 얹힌다. 밑값 칸이 없는 옛 기록 사본은 영입 때의 `0xb6414(…, 1)` 값 그대로다.
 */
export function playerFaceOf(teamId: number, player: SeasonPlayer, isPitcher: boolean, index: number): PlayerFace {
  const found = tableRowOf(teamId, player, isPitcher)
  if (found !== undefined) {
    const equipment = player.equipment ?? found.equipment
    return { name: found.name, ability: recordAbilityOf({ ability: found.ability, skillBits: found.skillBits, equipment }, isPitcher) }
  }
  // 영입 때 옮긴 기록 사본(나리 선수)은 그 이름(rec + 1)·0x30 바이트로
  const record = player.record
  if (record === undefined) return { name: `${isPitcher ? '투수' : '타자'} ${index + 1}번`, ability: [] }
  return copiedRecordFaceOf(player, record, isPitcher)
}

/** 영입 사본 — 밑값 · +0x14 · 지금 니블로 다시 센다. 밑값 칸이 없는 옛 사본은 영입 때의 `0xb6414(…, 1)` 값 그대로 */
function copiedRecordFaceOf(player: SeasonPlayer, record: NonNullable<SeasonPlayer['record']>, isPitcher: boolean): PlayerFace {
  if (record.baseAbility === undefined) return { name: record.name, ability: record.ability }
  const equipment = player.equipment ?? record.equipment ?? []
  return {
    name: record.name,
    ability: recordAbilityOf({ ability: record.baseAbility, skillBits: record.skillBits ?? 0, equipment }, isPitcher),
  }
}

/**
 * 마선수 줄의 칸 값 — 0xe0 상세 창 도형이 다른 줄과 같이 `0xb6415(레코드, k, 1)` 을 읽는다(`playerFaceOf` 주석). 마선수 레코드는
 * 0xb521c · 0xb53f0 이 XlsACE 행을 통째 베낀 것이라 레벨 배율 → 장비 니블(모두 0) → 장착 스킬(+0x14) 단계를 먹는다
 * (`aceRecordAbilityAtLevel`)
 */
export function aceFaceAbilityOf(ace: AcePlayer, order: number, levels: Readonly<Record<number, number>> | undefined): readonly number[] {
  const { hit, power, defense, run } = aceRecordAbilityAtLevel(ace, aceLevelOf(levels, aceLevelSlotOf(ace.role, order + 1)))
  return [hit, power, defense, run]
}
