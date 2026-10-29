/**
 * **시즌 0xe0 엔트리 편집이 보는 명단** — 갱신 `0x63dc` · 키 `0x7044` · 그림 `0xb074` (직접 떴다).
 * 공개 이름 모음 — 하위 폴더 (`seasonEntry/`): `types/`(목록 줄 · 칸 재료 · 기록 사본 · 명단 차례) · `roster/`(표 행 · 이름/능력치 ·
 * 마선수 칸 · 로테이션) · `detail/`(상세 창 0x5b798 칸) · `cells/`(목록 창 0x5c984 칸) · `lists/`(편집기 목록 · 되적기) ·
 * `records/`(기록 사본 0xb6414 · +0xb) · `order/`(팀 경기 명단 차례) · `otherSlices`(다른 조각 값)
 *
 * ## 어느 레코드를 고치는가 — 시즌 저장의 팀 레코드 그 자체
 * ```
 * 63f4  SR+0x12c(국가대항전) ? 0xb7614(L, 대회 날, 0/1) : SR[1]·0xb765c(L, SR[1])   ; 두 팀
 * 6462  this+0x120 ? 내 팀 : 상대 팀
 * 6472  팀레코드 = 0x1f9a9(저장, 모드 [this+0x15c], 팀)     ; 모드 2 → 표 0xcd7e0[1] = 0x1f9ba → 0x1f570(저장, 팀)
 * 64ae  0x5561c(ed, &팀레코드, this+0x120, this+0x120, 1)   ; 편집 가능 = this+0x120 (유저 팀만)
 * ```
 * `0x1f570(저장, 팀)` 은 **시즌 저장 안의 팀 레코드**(`[저장+0xb4] + 4 + 팀×0x1c`, 국가대항전 중이면 대한민국
 * `+0x918` · 상대국 `+0x934`)다. 경기용 팀 객체 `0xb891c` 는 `team[i] = i` 첨자만 들고 선수는 `0xb8680` →
 * 같은 저장 레코드에서 읽으므로, **편집기가 바꾼 순서가 곧 그날 경기의 타순·선발이고 저장에 남아 다음 경기까지
 * 이어진다.** 나가는 키 `0x7044` 는 저장을 따로 쓰지 않는다 — 파일 쓰기는 0xdd 의 경기 시작(`0x22754`)이 한다.
 *
 * 웹에서 그 레코드에 해당하는 것이 시즌 세이브의 `roster`(`SeasonTeamRoster`, 선수영입·트레이드가 고치는 배열)다.
 *
 * ## 0xe0 에 들어올 때 이미 일어난 일 (0xdd 들어옴 `0x6548`)
 * - `0xb8768` 이 두 팀 레코드의 칸 번호를 첨자로 다시 매긴다(`0xb603c`) — 웹 `SeasonPlayer` 는 칸 번호를
 *   이름 찾는 열쇠로도 쓰므로 다시 매기지 않는다(표시용 칸 번호만 다르다).
 * - 정규·포스트시즌이면 내 팀에 고른 **마투수를 8번**(`0xb88c8`), **마타자를 9번**(`0xb8870`)에 넣는다
 *   (옛 8·9번은 맨 끝으로). 웹 명단 배열에는 안 넣고 편집기 목록에만 끼운다 — 마선수는 편집기에서 못 움직이니
 *   빼고 되돌려도 순서가 같다.
 * - `SR+0xb2 ≠ 0` 이면 두 팀 로테이션 `0xb8c80`(투수 0~3 한 칸 당김)을 돈다. 웹 세이브는 배열을 돌리지 않고
 *   돈 칸 수로 셈하므로(`pitcherRotation.rotationSlotOf`) **편집기에는 그만큼 돌린 모양을 보여 주고**,
 *   고친 결과는 다시 되돌려 적는다. 그러면 "투수 탭 0번 = 오늘 선발" 이 원본과 같고 다음 날 로테이션도
 *   고친 배열에서 이어진다. 시즌 세션은 이 칸 수 자리(`dayCounter`)에 날짜 g 대신 리그 투수 레코드 차례의 선발 칸
 *   (`useSeasonSession.seasonLeagueStarterSlotOf` — 지난 시즌·포스트시즌에서 이어진 차례)을 넣는다.
 *
 * ## 상대 팀 · 대회 레코드 (웹 저장 자리)
 * - 상대 팀(this+0x120 = 0)은 보기 전용이라 고칠 일이 없다. 상대 팀 레코드는 트레이드로 바뀐 CPU 팀이면 시즌 저장의
 *   `cpuRosters`, 아니면 붙박이 표다(`useSeasonSession.cpuRosterOf` — 팀 경기 `opponentEntryOrder` 도 같은 레코드).
 *   원본은 상대 팀에도 굴린 마선수(`0x66968`·`0x66994`)를 넣는다 — `useSeasonSession` 이 0xdd 진입에서 굴려
 *   경기 옵션 `opponentAces` 로 싣고, CPU 팀 목록에도 같은 값을 `acePitcherId`·`aceBatterId` 로 끼운다.
 * - 국가대항전의 대한민국 레코드(`+0x918`)는 대회 내내 이어진다 — 웹은 시즌 세이브의 `cupRoster` 에 둔다
 *   (`useSeasonSession`, 대회를 열 때 표에서 채우고 대회가 끝나면 비운다).
 */
export type { SeasonEntryCellSource, SeasonEntryLists } from '@/entities/season-mode/model/seasonEntry/types/entryLists'
export type {
  SeasonEntryBatterRecord,
  SeasonEntryPitcherRecord,
  SeasonEntryRecordSource,
  SeasonRecordAces,
} from '@/entities/season-mode/model/seasonEntry/types/records'
export { aceDetailSourceOf, seasonDetailSourceOf, tableDetailSourceOf } from '@/entities/season-mode/model/seasonEntry/detail/detailSource'
export { SEASON_ENTRY_CELL_SOURCE, seasonEntryCellsOf, staminaPercentOf } from '@/entities/season-mode/model/seasonEntry/cells/entryCells'
export { playerFaceOf, tableRosterOf } from '@/entities/season-mode/model/seasonEntry/roster/face'
export {
  SEASON_RECORD_ACE_BATTER_SLOT,
  SEASON_RECORD_ACE_PITCHER_SLOT,
  recordAceSeatOf,
  rotatedPitchersOf,
  seatAce,
  unrotatedPitchersOf,
} from '@/entities/season-mode/model/seasonEntry/roster/seats'
export {
  seasonEntryListsOf,
  seasonRecordEntryListsOf,
  seasonRosterOfEntry,
  seasonStarterNameOf,
  type SeasonEntryInput,
} from '@/entities/season-mode/model/seasonEntry/lists/entryLists'
export { seasonRecordProfileOf } from '@/entities/season-mode/model/seasonEntry/records/recordAbility'
export { seasonEntryOrderOf } from '@/entities/season-mode/model/seasonEntry/order/entryOrder'
