import { BATTERS, PITCHERS } from '@/shared/config/original/roster'
import type { RosterPlayer } from '@/shared/config/original/roster'
import { EMPTY_EDITED_NAMES, editedNameOf } from '@/entities/player-name/model/editedNames'
import type { EditedNameTable } from '@/entities/player-name/model/editedNames'

/**
 * 지금 쓰고 있는 에디트 이름표 — 원본은 앱 데이터(save) 한 벌을 모든 화면이 함께 읽는다.
 * 앱이 저장에서 읽어 꽂고(`useEditedNames`), 에디트가 고칠 때마다 바꾼다.
 */
let activeTable: EditedNameTable = EMPTY_EDITED_NAMES

export function setActiveEditedNames(table: EditedNameTable): void {
  activeTable = table
}

export function activeEditedNames(): EditedNameTable {
  return activeTable
}

/**
 * **선수 이름 `0xb62c0(선수)`** — 화면에 선수 이름을 쓰는 26곳이 모두 이 함수를 부른다 (R11 1c):
 * ```
 * b62c0  p = 0x20499(save, rec[0] = id, 0xb6278(rec) 투수?)   ; → 0xaa458 이름표 칸 (범위 밖 NULL)
 *        p && strlen(p) ? p : rec + 1                         ; 고친 이름, 없으면 레코드 속 원래 이름
 * ```
 * 칸은 **id 로만** 걸리므로 같은 id 의 모든 복사본(시즌 팀·경기 명단)에 함께 적용된다.
 */
export function playerNameOf(id: number, isPitcher: boolean, originalName: string): string {
  return editedNameOf(activeTable, id, isPitcher) ?? originalName
}

/** 붙박이 표 레코드에 원래 이름을 따로 적어 두는 칸 — 묶기를 다시 해도(HMR) 원래 이름을 잃지 않게 */
const ORIGINAL_NAME = Symbol.for('baseball-2010/original-player-name')

type BoundRosterPlayer = RosterPlayer & { [ORIGINAL_NAME]?: string }

/**
 * 붙박이 선수표(`XlsPITCHER_DATA` · `XlsBATTER_DATA`, 원본 레코드 +1 이름)의 `name` 을 **읽을 때마다 `0xb62c0` 을 타게** 한다.
 *
 * 원본은 이름을 레코드에서 곧장 읽지 않고 늘 0xb62c0 을 거친다. 웹은 붙박이 표의 `player.name` 을
 * 경기·기록·관리 화면 수십 곳이 그대로 읽으므로, 그 읽기 하나하나를 고치는 대신 표 레코드의 `name` 을
 * 0xb62c0 과 같은 게터로 바꿔 둔다 — 레코드 객체는 그대로(같은 참조)라 `PITCHERS.indexOf(선수)` 같은 쓰임도 안 깨진다.
 *
 * 투수? 는 `0xb6278`(레코드 +0xa 비트5·6, id 0xb4~0xc7)인데 붙박이 표에서는 투수표 = 투수 · 타자표 = 타자다.
 * 범위 밖 id(국가대표·외인구단 = 투수 id ≥ 0x50 · 타자 id ≥ 0x78)는 이름표 칸이 없어 늘 원래 이름이다.
 */
function bindRosterNames(players: readonly RosterPlayer[], isPitcher: boolean): void {
  for (const player of players as readonly BoundRosterPlayer[]) {
    const originalName = player[ORIGINAL_NAME] ?? player.name
    const id = player.id
    Object.defineProperty(player, ORIGINAL_NAME, { value: originalName, enumerable: false, configurable: true })
    Object.defineProperty(player, 'name', {
      get: () => playerNameOf(id, isPitcher, originalName),
      enumerable: true,
      configurable: true,
    })
  }
}

/** 레코드에 든 원래 이름 (`rec + 1`) — 에디트 화면이 고치기 전 이름을 보일 때 등 */
export function originalNameOf(player: RosterPlayer): string {
  return (player as BoundRosterPlayer)[ORIGINAL_NAME] ?? player.name
}

bindRosterNames(PITCHERS, true)
bindRosterNames(BATTERS, false)
