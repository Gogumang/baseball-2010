import {
  STADIUM_HIDDEN_UNLOCK_IDS,
  stadiumCollectorUnlocks,
  STADIUM_KINDS,
  ownsStadiumItem,
  STADIUM_HIDDEN_FIRST_SLOT,
} from '@/entities/season-mode/model/stadiumItems'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonSave } from '@/app/model/seasonSession/save/seasonSave'

/**
 * 전역기록 칸 중 시즌모드만 쓰는 둘 — 구장 히든 `+0xe0` 과 이벤트 100 수령 `+0xbe`. 세션이 따로 들고 있고 시즌 저장을 쓸 때마다
 * 함께 적는다(`commit` · `resetSeason`). 시즌 파일과 생사를 같이 하지 않으므로 새 시즌·시즌 초기화에도 남는다.
 */
export interface SeasonGlobalSlots {
  readonly openedStadiumIds: readonly number[]
  readonly event100Awarded: boolean
}

/** 구장 히든 id 13~18 (`STADIUM_HIDDEN_UNLOCK_IDS`) */
const STADIUM_HIDDEN_IDS: readonly number[] = STADIUM_HIDDEN_UNLOCK_IDS.flat()

/** 이벤트 100 — 날짜 창 now 21 의 1000 G 이벤트 (P4 1b) */
const SEASON_EVENT_100_ID = 100

/**
 * 저장에서 전역 칸 둘을 읽는다. 칸이 없는 **옛 저장 이사**(웹 전용 규칙 — 예전에는 세션 상태에만 있어 저장되지 않았다):
 * - 구장 히든: 지금 시즌 레코드가 가진 히든 칸(4~6)은 열려 있어야 살 수 있었고(구매 가드 0x9a84 미오픈), 기본 네 칸을 다 가졌으면
 *   그 구매 뒤 0x81d0 이 컬렉터 13 · 16 을 열었다 — 그 둘을 연 것으로 본다. 다른 길(명전 · 🌐 이벤트)로 연 칸은 모른다.
 * - 이벤트 100: 본 비트(SR+8~)에 100 이 서 있으면 받은 것으로 본다 — 100 은 보상으로 +0xbe 를 세우거나, 이미 서 있어 불발로
 *   본 것으로만 쳐지거나 둘 중 하나라서다.
 */
export function seasonGlobalSlotsOf(raw: unknown, legacy: SeasonSave | null): SeasonGlobalSlots {
  const value = raw !== null && typeof raw === 'object' ? (raw as Partial<SeasonSave>) : {}
  const record = legacy?.state.record
  const openedStadiumIds = Array.isArray(value.openedStadiumIds)
    ? value.openedStadiumIds.filter((id, index, ids) => STADIUM_HIDDEN_IDS.includes(id) && ids.indexOf(id) === index)
    : record === undefined
      ? []
      : legacyOpenedStadiumIdsOf(record)
  const event100Awarded =
    typeof value.event100Awarded === 'boolean' ? value.event100Awarded : (record?.seenEvents.includes(SEASON_EVENT_100_ID) ?? false)
  return { openedStadiumIds, event100Awarded }
}

/** 이벤트 100 보상 — 전역기록 +0xbe = 1 (0x8c714). 이미 서 있으면 같은 객체 */
export function withEvent100Awarded(slots: SeasonGlobalSlots): SeasonGlobalSlots {
  return slots.event100Awarded ? slots : { ...slots, event100Awarded: true }
}

/** 옛 저장 이사 — 레코드가 가진 구장 히든 칸 + 컬렉터 해금 (위 `seasonGlobalSlotsOf`) */
function legacyOpenedStadiumIdsOf(record: SeasonRecord): readonly number[] {
  const opened = new Set<number>(stadiumCollectorUnlocks(record))
  STADIUM_KINDS.forEach((kind, kindIndex) => {
    STADIUM_HIDDEN_UNLOCK_IDS[kindIndex]?.forEach((id, offset) => {
      if (ownsStadiumItem(record, kind, STADIUM_HIDDEN_FIRST_SLOT + offset)) opened.add(id)
    })
  })
  return STADIUM_HIDDEN_IDS.filter((id) => opened.has(id))
}

/**
 * **시즌이 없어도 남는 전역 칸** — 경기진행 설정(+0x12c+1 계열)과 창 본 표시(+0x11e). 원본은 전역기록이라 모드 초기화
 * 0x224ec(2)(시즌 파일 지움)가 안 건드린다. 웹은 시즌 저장에 두므로 시즌을 지울 때 이 두 칸만 남긴 덩어리를 쓴다
 * (`normalizeSeasonSave` 는 `state` 가 없으면 시즌 없음으로 본다).
 */
export type SeasonGlobalCarry = Pick<SeasonSave, 'matchSettings' | 'matchSettingsSeen'>

/** 저장(또는 시즌 없는 덩어리)에서 전역 칸만 고른다 */
export function seasonGlobalCarryOf(raw: unknown): SeasonGlobalCarry {
  if (raw === null || typeof raw !== 'object') return {}
  const value = raw as Partial<SeasonSave>
  return {
    ...(value.matchSettings === undefined || value.matchSettings === null || typeof value.matchSettings !== 'object'
      ? {}
      : { matchSettings: value.matchSettings }),
    ...(typeof value.matchSettingsSeen === 'boolean' ? { matchSettingsSeen: value.matchSettingsSeen } : {}),
  }
}
