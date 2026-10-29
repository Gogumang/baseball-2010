/**
 * 스페셜 메뉴의 기록연감·명예의 전당 (StrHOWTO[28]) — 공개 이름 모음. 선수 한 명이 아니라 게임 전체에 쌓인다.
 * 하위 폴더 (`collection/`): `types`(기록연감 · 명전 기록 0x30 바이트 사본의 칸) · `hallOfFame/`(칸 0x1f62c · 0x1f640 · 등록 0x62568 ·
 * 니블/자리 0x2328c · 0xc554 · 삭제 0x62994) · `merge/`(정산 0x4ea0c · 컬렉터 0x14a74 · 엔딩 0x87c7c · 칭호) · `normalize/`(저장 읽기 · 이사) ·
 * `otherSlices`(타자편 · 투수편 커리어 값)
 */
export {
  EMPTY_COLLECTION,
  type Collection,
  type HallOfFamePitcher,
  type HallOfFamePlayerPick,
  type HallOfFameResult,
  type HallOfFameSide,
  type HallOfFamer,
} from '@/entities/collection/model/collection/types'
export {
  HALL_OF_FAME_BATTER_FIRST_RECORD_ID,
  HALL_OF_FAME_MAX_BATTERS,
  HALL_OF_FAME_MAX_PITCHERS,
  HALL_OF_FAME_OPEN_BATTERS,
  HALL_OF_FAME_OPEN_PITCHERS,
  HALL_OF_FAME_PITCHER_FIRST_RECORD_ID,
  firstEmptyHallOfFameSlot,
  hallOfFameBatterAt,
  hallOfFamePitcherAt,
  hallOfFameRecordIdOf,
  isHallOfFameSlotOpen,
} from '@/entities/collection/model/collection/hallOfFame/slots'
export { HALL_OF_FAME_COST, registerHallOfFame, registerHallOfFamePitcher } from '@/entities/collection/model/collection/hallOfFame/register'
export {
  deleteHallOfFame,
  hallOfFameEquipmentNibblesOf,
  hallOfFameRecordSlotOf,
  syncHallOfFameEquipment,
  withHallOfFameRecordSlot,
} from '@/entities/collection/model/collection/hallOfFame/records'
export {
  batterCollectorHiddenIdsOf,
  countSeasonRegularWin,
  mergeCareerIntoCollection,
  mergeEndingIntoCollection,
  mergeSeasonEndingIntoCollection,
  mergeTitlesIntoCollection,
  pitcherCollectorHiddenIdsOf,
  type EndingViewer,
} from '@/entities/collection/model/collection/merge/merges'
export { normalizeCollection } from '@/entities/collection/model/collection/normalize/normalize'
