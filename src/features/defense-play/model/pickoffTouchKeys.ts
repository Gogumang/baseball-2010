import { useTouchKeyOffer } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import type { TouchKeyOffer } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import type { PickoffBase } from '@/entities/defense-controls/model/pickoff'

/**
 * **견제 키** — 원본 0x53548: '3' 1루 · '1' 2루 · '7' 3루 (`entities/defense-controls/model/defenseKeys` 의 견제 표와 같다).
 * 터치 상황 버튼(웹 껍데기)이 쏠 키를 루에서 찾는 쪽 표다.
 */
export const PICKOFF_KEY_OF_BASE: Readonly<Record<PickoffBase, string>> = { 1: '3', 2: '1', 3: '7' }

interface BaseOccupancy {
  readonly first: boolean
  readonly second: boolean
  readonly third: boolean
}

/** 루 하나의 견제 상황 버튼 */
export function pickoffOfferOf(base: PickoffBase): TouchKeyOffer {
  return { key: PICKOFF_KEY_OF_BASE[base], label: `${base}루 견제` }
}

/** 주자가 있는 루의 견제 상황 버튼 — 1루 · 2루 · 3루 차례. 빈 루는 원본도 키를 먹고 아무 일이 없으니(0x50f28) 버튼을 안 띄운다 */
export function pickoffTouchOffersOf(bases: BaseOccupancy): readonly TouchKeyOffer[] {
  const occupied: Readonly<Record<PickoffBase, boolean>> = { 1: bases.first, 2: bases.second, 3: bases.third }
  return ([1, 2, 3] as const)
    .filter((base) => occupied[base])
    .map(pickoffOfferOf)
}

/**
 * 견제 키를 받는 동안(구질 고르기 0xf — 화면의 `acceptsPickoff`) 주자가 있는 루마다 상황 버튼을 알린다.
 * 버튼은 키 사건을 쏘므로 키보드 견제와 같은 길(`pushSceneKey` → 세션 `pickoff`)로 든다. 게임 쪽은 바뀌지 않는다.
 */
export function usePickoffTouchKeys(isAccepting: boolean, bases: BaseOccupancy): void {
  const offerFor = (base: PickoffBase, isOccupied: boolean) => (isAccepting && isOccupied ? pickoffOfferOf(base) : null)
  useTouchKeyOffer(offerFor(1, bases.first))
  useTouchKeyOffer(offerFor(2, bases.second))
  useTouchKeyOffer(offerFor(3, bases.third))
}
