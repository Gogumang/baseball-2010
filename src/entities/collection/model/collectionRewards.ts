/**
 * **전부 수집 보상 8칸의 지급 비트** — 전역기록 `+0x145` 한 바이트 (Q2 5-0 확정).
 *
 * 전역기록 = `0x1f1d9(mgr)` 가 주는 `[mgr+0xac]` 객체 — 저장 `0x1f1b9(mgr)` 가 크기 `[mgr+0xcc]`(0xe44)로
 * **`game_o.sav`**(문자열 0xcdb68)에 통째로 쓴다(0x1f1b8~0x1f1d0 직접 떴다). G(+0x64)·명예의 전당(+0x880·+0x940)과
 * 같은 레코드라 시즌을 새로 시작해도, 나리 편을 지워도 남는다.
 * ```
 * 9f708: ldr r3,=0x145 ; adds r0,r3 ; ldrb r2,[r0] ; movs r3,#1 ; lsls r3,r1 ; orrs r3,r2 ; strb r3,[r0]   ; 비트 k 켜기
 * 9f71c: (rec[0x145] >> k) & 1                                                                            ; 읽기
 * ```
 * k 0·1·2 = 시즌 리그 1위 1·5·10회 (결산 0x6900 · 0x87e8), k 3~7 = 메인 메뉴 전부 수집 보상(0x28e98 — 웹 아직 없음).
 *
 * 웹은 지갑(`entities/wallet`)처럼 이 한 칸을 저장소 하나에 담는다. 이 칸이 생기기 전 웹은 세션 상태로만 들고 있어
 * 옛 저장에는 남은 값이 없다 — 없으면 0(새 저장 기본, 0x9f26c 초기화)에서 시작한다.
 */
export interface CollectionRewardRecord {
  /** 전역기록 +0x145 — 비트 k 가 서 있으면 k 번 보상을 이미 받았다 (u8) */
  readonly awardedBits: number
}

export const EMPTY_COLLECTION_REWARD_RECORD: CollectionRewardRecord = { awardedBits: 0 }

const BYTE_MASK = 0xff

/** 저장에서 읽은 값은 믿지 않는다 — 한 바이트 정수가 아니면 0 */
export function normalizeCollectionRewardRecord(raw: unknown): CollectionRewardRecord {
  const saved = (raw as Partial<CollectionRewardRecord> | null | undefined)?.awardedBits
  if (typeof saved !== 'number' || !Number.isInteger(saved)) return EMPTY_COLLECTION_REWARD_RECORD
  return { awardedBits: saved & BYTE_MASK }
}

/** 비트 k 켜기 `0x9f709(rec, k)` — 이미 서 있으면 같은 객체 */
export function withAwardedBit(record: CollectionRewardRecord, bit: number): CollectionRewardRecord {
  const awardedBits = (record.awardedBits | (1 << bit)) & BYTE_MASK
  return awardedBits === record.awardedBits ? record : { awardedBits }
}

/** 읽기 `0x9f71d(rec, k)` */
export function isRewardAwarded(record: CollectionRewardRecord, bit: number): boolean {
  return ((record.awardedBits >> bit) & 1) !== 0
}
