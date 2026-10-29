import { atom } from 'jotai'
import type { AceMatchHoldPort, AceMatchPendingPort } from '@/entities/mode-save/model/modeSave'
import { createMemoryAceMatchPendingPort } from '@/entities/mode-save/model/modeSave'
import type { NariGameSavePort } from '@/pages/management/lib/nariMatchPrepare'

/**
 * 손잡이 칸 — 콜백 신원이 흔들리지 않게 상자로 읽는 매개변수(옛 `nariGameSaveRef` · `aceMatchPendingRef` · `aceMatchHoldRef`).
 * 세션 훅이 그림마다 적는다(`usePitcherPorts`).
 */
export interface PitcherPorts {
  /** 전역기록 +0x4f 손잡이 */
  readonly nariGameSave: NariGameSavePort | undefined
  /** 나간 마선수 대결 대기(전역기록) 손잡이 — 안 넘기면 세션 메모리 */
  readonly aceMatchPending: AceMatchPendingPort
  /** 두 편 대결 대기(전역기록) — 자동 훑기 가드 1cfe4~1d008 (`isAutoScanHeldByAceMatch`) */
  readonly aceMatchHold: AceMatchHoldPort | undefined
}

/** 대결 대기를 안 넘겼을 때 쓰는 세션 메모리 칸 — 세션마다 하나 */
export const memoryAceMatchPendingAtom = atom<AceMatchPendingPort>(createMemoryAceMatchPendingPort())
/** 지난 그림의 손잡이들 — 세션마다 새 상자 (`createPitcherAtoms`) */
export const portsMirrorAtom = atom<{ current: PitcherPorts }>({
  current: { nariGameSave: undefined, aceMatchPending: createMemoryAceMatchPendingPort(), aceMatchHold: undefined },
})
