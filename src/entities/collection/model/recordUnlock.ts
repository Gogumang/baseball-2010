import type { AnnalsStats } from '@/entities/collection/model/annalsStats'
import { recordCountOf } from '@/entities/collection/model/annalsStats'

/**
 * **기록달성 누계 해금 `0x62234(ui, k)`** (직접 떴다, 0x62234~0x6232a · 점프표 0xd1ca8):
 * ```
 * 0xa77f0 (경기 중 기록 k 달성) — 이번 경기 칸 [ctx+0x28][k] += 1 · G 누계 · 알림 줄 0xa91fc → a7922 0x62234(ui, k)
 * 0x62234: k − 1 > 30 → 끝 ; (id, 문턱) = 표[k] (없는 k 는 끝)
 *          0x61f5c(ui, id)(이미 열렸나) 참 → 끝
 *          통계 [mgr+0xc8] 의 바이트 [k + 4] < 문턱 → 끝          ; 0x62298 `cmp; blt`
 *          0x620b8(ui, id) 열기 · 글 = StrCOMMON[140|138|139] + 이름 · 0x1f1b9 저장 · 0x74ef5(공용 창, 글, 1, 0, 0)
 * ```
 * 문턱이 보는 칸은 **통계 누계** `+4 + k` 다. 이번 경기 칸 `[ctx+0x28]` 은 0x1fce0 이 주는 모드 버퍼라(0xa7802 · 0xa7830 이 같은
 * 포인터를 두 번 읽는다) 누계에는 정산 0x4ec8a `0x22e10` 에서야 더해진다 — 곧 **지난 경기까지의 누계**가 문턱에 닿은 뒤
 * 그 기록을 다시 달성하는 순간 열린다. (K 3-1 의 "+1 한 뒤 검사" 는 이번 경기 칸을 누계로 잘못 본 것이다.)
 */
interface RecordUnlock {
  /** 해금 id — 0~7 마선수 (0 레오니 … 7 킹타이거) · 그 밖 히든 아이템 */
  readonly id: number
  readonly threshold: number
}

/** 점프표 0xd1ca8 (k = 기록 번호, StrGAME[8 + k]) */
const RECORD_UNLOCKS: Readonly<Record<number, RecordUnlock>> = {
  1: { id: 5, threshold: 54 }, // 솔로 홈런 → 로제
  4: { id: 7, threshold: 54 }, // 만루 홈런 → 킹타이거
  7: { id: 46, threshold: 2 }, // 백투백투백 홈런 → 히든 아이템 46
  8: { id: 4, threshold: 54 }, // 도루 성공 → 어거지죠
  15: { id: 6, threshold: 2 }, // 사이클링 히트 → 크라이져
  16: { id: 23, threshold: 100 }, // 삼구 삼진 → 히든 아이템 23
  17: { id: 1, threshold: 54 }, // 풀카운트 삼진 → 붕붕머신
  18: { id: 0, threshold: 14 }, // 삼진 콤보 x3 → 레오니
  27: { id: 30, threshold: 2 }, // 트리플플레이 → 히든 아이템 30
  31: { id: 2, threshold: 3 }, // 퍼펙트게임 → 발렌타인
}

/** 해금 id 0~7 이 여는 마선수 칸 — id 0~3 → 전역 +0x31 + id(마투수 칸 1~4) · 4~7 → +0x32 + id(마타자 칸 6~9) (0x620b8) */
const LAST_ACE_UNLOCK_ID = 7
const ACE_PITCHER_UNLOCKS = 4

export function aceCellOfUnlock(id: number): number | null {
  if (!Number.isInteger(id) || id < 0 || id > LAST_ACE_UNLOCK_ID) return null
  return id < ACE_PITCHER_UNLOCKS ? id + 1 : id + 2
}

/**
 * 기록 k 를 달성한 순간 0x62234 가 열 id — 표에 없거나 누계가 문턱 밑이면 null. 이미 열렸는지(0x61f5c)는 부르는 쪽이 본다
 * (마선수는 마선수 칸, 히든 아이템은 전역 해금표)
 */
export function recordUnlockIdOf(stats: AnnalsStats, recordId: number): number | null {
  const unlock = RECORD_UNLOCKS[recordId]
  if (unlock === undefined) return null
  return recordCountOf(stats, recordId) >= unlock.threshold ? unlock.id : null
}
