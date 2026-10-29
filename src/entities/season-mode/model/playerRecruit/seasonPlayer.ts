import type { SeasonEntryBatterRecord, SeasonEntryPitcherRecord } from '@/entities/season-mode/model/seasonEntry'

/** 시즌 로스터에 들어가는 선수 한 명 (원본 0x30 바이트 레코드 중 이 규칙이 쓰는 칸만) */
export interface SeasonPlayer {
  /**
   * 영입 때 옮긴 **기록 사본**(이름 rec + 1 · 0xb6414 능력치 · 투수 레퍼토리·보직) — 붙박이 표 밖 선수만.
   * 영입 0xc554 는 원본 기록 0x30 바이트를 통째로 팀 레코드에 복사하므로(S6 4-2) 그 뒤 원본(나리 저장)이 바뀌어도
   * 시즌 선수는 영입 순간의 기록으로 선다. 나리 선수(id 0xfe)가 이 칸을 든다. 명전 선수는 지금의 명전 칸을 읽는다
   * (`seasonHallOfFameRecordSourceOf` — 칸이 바뀌는 길은 삭제뿐이라 결과가 같다).
   */
  readonly record?: SeasonEntryBatterRecord | SeasonEntryPitcherRecord
  /** +0 */
  readonly id: number
  /** +0xa — 상위 3비트(종류·육성)와 하위 5비트(칸 번호)가 한 바이트에 같이 있다 */
  readonly kindByte: number
  /** +0x1c 하위 니블 — 타자의 수비 위치 */
  readonly fieldPosition: number
  /** +0x2c — 투수 스태미나 */
  readonly stamina: number
  /**
   * **+0x19 · +0x1a 장비 니블 네 칸** (부위 k = 바이트 +0x19 + k/2, k 짝수 = 윗니블 · 0 없음 · n = 레벨 + 1).
   * 팀 레코드는 Xls 행 0x30 바이트를 그대로 복사해 시작하므로(S6 3-1) 처음 값은 붙박이 표의 `equipment` 다 — 리그 열 팀은
   * 모두 0. 원본에서 이 칸을 바꾸는 곳은 아이템 → 장착아이템(0xd0 칸 0 → 선수 고르기 0xdf 목적 1 → 장비 창 0xdc,
   * 키 0x957c 적용 0x7d90 — P4 5절)뿐이고 트레이드·영입은 레코드를 통째로 옮긴다.
   * **없으면 붙박이 표 값**이다(`seasonPlayerEquipmentOf`) — 옛 저장이나 아직 이 칸을 쓴 적 없는 선수가 그렇다.
   * 웹은 장비 창 0xdc 종류 3(`SeasonRoute` → `equipSeasonPlayer`)이 이 칸을 쓴다.
   */
  readonly equipment?: readonly number[]
  /**
   * **웹 전용 — 부위별 산 장비 칸 비트**(비트 i = 칸 i, 네 칸). 원본에는 없는 칸이다 — 원본 버그 B-23(산 기록이 없다)의 고친 길
   * (`seasonEquipment.applySeasonEquipment`)만 쓴다. 없으면 산 기록 없음(옛 저장 · 원본 길)
   */
  readonly ownedEquipment?: readonly number[]
  /**
   * **이 선수의 붙박이 표 팀** — 원본 id(+0)는 Xls 행 번호 그대로라(투수 `팀 × 8 + 칸` · 타자 `팀 × 12 + 칸`,
   * `base/extracted/XlsPITCHER_DATA.json` 줄마다 바이트 0 이 줄 번호다) 팀이 id 안에 들어 있다. 웹 `id` 는 그 팀 안
   * 칸만 들어서, 트레이드(0xd1cc~0xd3ae)로 **다른 팀 레코드에 옮겨진** 선수는 그 팀을 여기 따로 든다.
   * 없으면 명단 주인 팀이다 — 옛 저장·표에서 만든 명단은 모두 그렇다. 주인 팀과 같아지면 지운다(`withTableTeam`).
   */
  readonly tableTeamId?: number
}

/** 이 선수의 이름·능력치·+0x1b·기록 번호를 읽을 붙박이 표 팀 — `tableTeamId`, 없으면 명단 주인 팀 */
export function tableTeamOf(player: SeasonPlayer, ownerTeamId: number): number {
  return player.tableTeamId ?? ownerTeamId
}

/**
 * 선수를 `ownerTeamId` 의 명단으로 옮길 때 붙박이 표 팀을 적는다 — 원본은 레코드를 통째로 옮겨 id 가 따라가므로
 * 표 팀이 바뀌지 않는다. 표 팀이 새 주인과 같으면 칸을 지워 "주인 팀 선수" 와 같은 모양으로 둔다.
 */
export function withTableTeam(player: SeasonPlayer, fromOwnerTeamId: number, toOwnerTeamId: number): SeasonPlayer {
  const team = tableTeamOf(player, fromOwnerTeamId)
  const { tableTeamId: _dropped, ...rest } = player
  return team === toOwnerTeamId ? rest : { ...rest, tableTeamId: team }
}

export interface SeasonTeamRoster {
  readonly pitchers: readonly SeasonPlayer[]
  readonly batters: readonly SeasonPlayer[]
}
