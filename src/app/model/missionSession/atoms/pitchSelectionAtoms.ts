import { atom } from 'jotai'

/**
 * **상태 0xf 진입 `0x3d954` 신호** — 미션도 공마다 0xf 로 들어서며 CPU 교체를 묻는다(`missionCpuTeam` 머리글).
 * `'new'` 는 새 타석(0xd → 0xe 확인 뒤), `'same'` 은 같은 타석 다음 공(판정 A 의 "그 밖" · 파울로 닫힌 판 · 주자 판 끝 ae592).
 * 진행이 다 먹인 뒤의 판을 봐야 해서 아래 효과가 그린 뒤에 돈다.
 * `delayTicks` — 0xf 진입 틀까지 남은 장면 틱. 투수 미션은 공을 놓는 걸음에 판정까지 다 내므로(`handlePitcherThrow`) 같은 타석 다음 공의
 * 0xf 는 0x12 를 다 선 뒤의 틀이다(`pitchSelectionEntryDelayTicksOf`). 타자 미션은 결과 띠가 걷히는 때를 아래 효과가 본다
 */
export interface PitchSelectionEntry {
  readonly serial: number
  readonly kind: 'new' | 'same'
  readonly delayTicks: number
}
export const pitchSelectionEntryAtom = atom<PitchSelectionEntry | null>(null)
/** 0xf 진입 틀이 온 신호 번호 — `delayTicks` 를 장면 틱으로 다 센 신호(`setGameSceneTickTimeout`) */
export const pitchSelectionDueSerialAtom = atom(0)
/** 이미 물은 신호 번호 (그림에 안 쓰는 칸) */
export const handledPitchSelectionAtom = atom(0)
/** 장면 틱 시계를 건 신호 번호 (그림에 안 쓰는 칸) */
export const armedPitchSelectionAtom = atom(0)
/** 0xf 진입 고리가 읽는 지난 그림의 값 — 고리는 공 · 마감 · 결과 띠가 바뀔 때만 돈다. 세션마다 새 상자 (`createMissionAtoms`) */
export interface PitchSelectionScene {
  readonly isPitcherSide: boolean
  readonly askPitchSelection: (kind: 'new' | 'same') => void
}
export const pitchSelectionSceneMirrorAtom = atom<{ current: PitchSelectionScene }>({
  current: { isPitcherSide: false, askPitchSelection: () => {} },
})
