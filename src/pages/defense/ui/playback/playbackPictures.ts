import type { DefenseViewState } from '@/entities/fielding/model/defenseView/defenseViewState'

/** 0x35108 의 0xbb428 — 줌 펀치 전역을 내린다(0x1c 그림에 줌이 없다) */
export function unzoomed(state: DefenseViewState): DefenseViewState {
  if (state.zoom == null) return state
  const { zoom: _zoom, ...rest } = state
  return rest
}

/**
 * 판이 닫힌 뒤 그림 — 0x3f060 이 3f0b8 관문(G1)에서 닫혀 대상 · 따라가기(3f1c0)까지 안 가므로 카메라가 그 자리에 선다.
 * G2 만 닫히고 G1 은 열린 그림(+0x120 세기가 G1 · G2 사이에서 51 이 될 때)은 진행기가 `closingListFrame` 으로 마지막에 찍어 둔다 —
 * 그 그림까지는 카메라가 움직이고 그 다음 갱신부터 선다.
 */
export function frozenCamera(state: DefenseViewState): DefenseViewState {
  return state.cameraFrozen === true ? state : { ...state, cameraFrozen: true }
}
