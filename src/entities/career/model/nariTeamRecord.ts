/**
 * **나만의리그 팀 레코드** — 나리 저장 블록 `[저장+0xb8]`(투수편) · `[저장+0xbc]`(타자편) 의 `+4 + 0x1c·팀` 열 칸 (`0x1f989`).
 *
 * 공개 이름 모음 — 하위 폴더 (`nariTeamRecord/`): `types`(레코드 꼴 · 내 선수 표지 0xfe · 마선수 칸) · `records`(붙박이 표 0x204e1 ·
 * 내 선수 넣기 0xb53f0 · 열 팀) · `aces`(마타자 0xb8870 · 마투수 0xb88c8 · CPU 경기 0xc239c · 142 0x1c46c) · `lineup`(경기 명단 0xb891c ·
 * 대타 니블 0xaebe4) · `battingOrder`(타순 보상 0xb5d09 · B-71 · 다시 매기기 0xb8768) · `otherSlices`(다른 조각)
 */
export {
  MY_RECORD_SLOT,
  NO_RECORD_ACE,
  ROOKIE_BATTER_SLOT,
  type NariRecordFielder,
  type NariTeamRecord,
  type NariTeamRecordFields,
  type NariTeamRecords,
} from '@/entities/career/model/nariTeamRecord/types'
export {
  createNariTeamRecords,
  insertMyBatter,
  nariTeamRecordOf,
  nariTeamsOf,
  tableNariTeamRecord,
  withNariTeamRecord,
} from '@/entities/career/model/nariTeamRecord/records'
export {
  recordMatchAcesOf,
  recordTeamAcesOf,
  seatAceBatter,
  seatNariMatchAces,
  withCpuGameRecordAces,
} from '@/entities/career/model/nariTeamRecord/aces'
export { nariFieldersAfterPinchHits, nariLineupSlotsOf, nariQuickLineupOf, nariRecordFieldersOf } from '@/entities/career/model/nariTeamRecord/lineup'
export {
  applyBattingOrderRewards,
  moveMyBatter,
  myBatterIndexOf,
  renumberedBattingOrderOf,
} from '@/entities/career/model/nariTeamRecord/battingOrder'
