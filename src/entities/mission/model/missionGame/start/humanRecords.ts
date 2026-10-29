import { BATTERS_PER_TEAM, MISSION_NARI_RECORD, MISSION_NARI_RECORD_FALLBACK, type MissionGame } from '@/entities/mission/model/missionGame/types'

/**
 * **사람 칸 팀 타자 레코드** — 0xaa57c aa7b0~aa7ee (모드 6) · 0xb87cc · 0xb53f0 · 0xb8768 · 0xb6394 (직접 재역어셈):
 * ```
 * aa7b8  0xb87cc(팀[사람 칸]):
 *          b87dc  P = 0x1fc20(저장)                   ; 미션 타자 (명예 0x1f640 또는 나리 타자편 저장 선수)
 *          b87e8  k = 0xb53f0(명부, P, 1)             ; −1 이 아니면 b8768(목록 다시 매김) · 팀 +0x27 ++ · +0x28c(벤치) ++
 *            b53f0: P+0xa 의 0x40(마선수) → 아님 · 0x80(내 선수) → k = P+0xa & 0x1f (0xb6720):
 *              b54a2 0xb4e34(명부, 0) — 타자 배열 한 칸 늘림(12 → 13)
 *              b54b6 pos = 레코드[k]+0x1c & 0xf · 0xb8e84(레코드[k], 0, 0)
 *              b54da 0xb6604(레코드[k], 수 − 1) · b54fa 레코드[수 − 1] ← 레코드[k] (0x30 바이트) — **옛 k 를 맨 끝으로**
 *              b550c 레코드[k] ← P (0x30 바이트) · b5520 0xb8e84(레코드[k], pos, 0) — 수비 위치는 옛 선수 것
 * aa7c2  r1 = 0xb6394(0x1fc20(저장)) = P+0xa & 0x1f = k     ; 저장 쪽 선수를 다시 읽는다 — 고친 것은 명부 사본뿐이라 같은 k
 * aa7d2  레코드 +1 비트 0 이면(원본 표는 모두 꺼짐) aa7e8 0xb8cb8(팀, 레코드 +7 윗 4비트, k) — 레코드 [시작 타순] ↔ [k]
 * ```
 * 그래서 k 가 시작 타순과 다르면 마스터 줄 `시작 타순` 이 k 칸으로 가고 마스터 줄 k 는 레코드 12(벤치)로 밀린다 — k 가 타순(0~8)이면
 * 자동진행 반 이닝의 타선이 바뀐다. k 는 그 선수가 자기 나리 팀에서 앉은 칸이다(경기 장면 0xb8768 이 배열 첨자로 다시 매긴 값,
 * `app/ui/EntryRoutes` 더비 타순과 같은 칸). k > 12 는 0xb53d0 이 배열 밖을 읽어 옮길 수 없다 — 끝 칸 12 로 둔다(⚠️ 미해결).
 */
export function humanRecordsOf(startOrder: number, nariRecordSlot: number = MISSION_NARI_RECORD_FALLBACK): number[] {
  const records = Array.from({ length: BATTERS_PER_TEAM }, (_unused, record) => record)
  const k = missionRecordSlotOf(nariRecordSlot)
  // b54a2 · b54fa — 한 칸 늘리고 옛 k 를 맨 끝으로 (k = 12 면 늘린 빈 칸이 제자리로)
  records.push(records[k] ?? k)
  // b550c — k 에 미션 타자
  records[k] = MISSION_NARI_RECORD
  // aa7e8 0xb8cb8 — 레코드 [시작 타순] ↔ [k]
  const atOrder = records[startOrder]
  records[startOrder] = records[k]
  records[k] = atOrder
  return records
}

/** 미션 타자가 드는 레코드 칸 k — 0..12 밖이면 끝 칸 12 (`humanRecordsOf`) */
export function missionRecordSlotOf(nariRecordSlot: number = MISSION_NARI_RECORD_FALLBACK): number {
  return Number.isInteger(nariRecordSlot) && nariRecordSlot >= 0 && nariRecordSlot <= BATTERS_PER_TEAM ? nariRecordSlot : MISSION_NARI_RECORD_FALLBACK
}

/**
 * 사람 칸 팀 선수(`battingRecordAt` 의 값)의 레코드 칸 0xb6394 (타자 미션) — 미션 타자는 k, 마스터 줄 m 은 m(0xb8768 이 첨자로
 * 매긴 값이 맞바꿈 0xb5e98 을 따라간다), 0xb53f0 이 끝으로 밀어낸 옛 [k] 줄만 b54da `0xb6604(레코드[k], 수 − 1)` 로 끝 칸 12
 */
export function missionHumanRecordSlotOf(game: Pick<MissionGame, 'humanRecordSlot'>, player: number): number {
  const k = game.humanRecordSlot ?? MISSION_NARI_RECORD_FALLBACK
  if (player === MISSION_NARI_RECORD) return k
  return player === k ? BATTERS_PER_TEAM : player
}
