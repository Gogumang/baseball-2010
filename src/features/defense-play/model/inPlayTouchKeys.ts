import { useTouchKeyOffer } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import type { TouchKeyOffer } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import type { ControlSide } from '@/entities/defense-controls/model/defenseKeys'

/**
 * **수비 인플레이(상태 0x17) 터치 상황 버튼** (웹 껍데기) — 원본 키 표(`entities/defense-controls/model/defenseKeys`)를 그대로 쏜다.
 * 화면 안에 그 칸이 없다(작은 지도는 61×59 라 손가락으로 루를 못 고른다). 공격 쪽 OK(Enter) 슬라이딩 · CLR(Escape) 전원 귀루도
 * 그림 자리가 없어 여기 상황 버튼으로 낸다(r186 — 늘 있던 확인 · 뒤로 버튼을 걷었다).
 *
 * - 수비(송구 0x533c8): '6' 1루 · '2' 2루 · '4' 3루 · '8' 홈
 * - 공격(주루 0x5331c): 진루 '2' 1루 주자 · '4' 2루 주자 · '8' 3루 주자 · '0' 전원, 슬라이딩 OK(0x53420 → 0x585),
 *   귀루 '3' 1루 주자 · '1' 2루 주자 · '7' 3루 주자 · CLR 전원(0x533a6)
 *
 * 버튼은 누르면 keydown, 떼면 keyup 이라 누르고 있으면 키보드처럼 4틱 되풀이(`keyHold`)도 그대로 난다.
 */
export const DEFENSE_THROW_OFFERS: readonly TouchKeyOffer[] = [
  { key: '6', label: '1루 송구', order: 0, isHold: true },
  { key: '2', label: '2루 송구', order: 1, isHold: true },
  { key: '4', label: '3루 송구', order: 2, isHold: true },
  { key: '8', label: '홈 송구', order: 3, isHold: true },
]

export const OFFENSE_RUNNER_OFFERS: readonly TouchKeyOffer[] = [
  { key: '2', label: '1루주자 진루', order: 0, isHold: true },
  { key: '4', label: '2루주자 진루', order: 1, isHold: true },
  { key: '8', label: '3루주자 진루', order: 2, isHold: true },
  { key: '0', label: '전원 진루', order: 3, isHold: true },
  { key: 'Enter', label: '슬라이딩', order: 4, isHold: true },
  { key: '3', label: '1루주자 귀루', order: 5 },
  { key: '1', label: '2루주자 귀루', order: 6 },
  { key: '7', label: '3루주자 귀루', order: 7 },
  { key: 'Escape', label: '전원 귀루', order: 8, isHold: true },
]

/** 사람이 잡은 쪽의 상황 버튼 — 자동(`side` 없음)이면 없다 */
export function inPlayTouchOffersOf(side: ControlSide | undefined): readonly TouchKeyOffer[] {
  if (side === '수비') return DEFENSE_THROW_OFFERS
  if (side === '공격') return OFFENSE_RUNNER_OFFERS
  return []
}

/** 판이 서 있는 동안 사람이 잡은 쪽의 송구 · 주루 버튼을 알린다 (훅 수는 늘 아홉 — 빈 자리는 null) */
export function useInPlayTouchKeys(side: ControlSide | undefined): void {
  const offers = inPlayTouchOffersOf(side)
  useTouchKeyOffer(offers[0] ?? null)
  useTouchKeyOffer(offers[1] ?? null)
  useTouchKeyOffer(offers[2] ?? null)
  useTouchKeyOffer(offers[3] ?? null)
  useTouchKeyOffer(offers[4] ?? null)
  useTouchKeyOffer(offers[5] ?? null)
  useTouchKeyOffer(offers[6] ?? null)
  useTouchKeyOffer(offers[7] ?? null)
  useTouchKeyOffer(offers[8] ?? null)
}
