import { useEffect, useState } from 'react'
import { setSkinStepCounter, skinStepCounterValue } from '@/shared/lib/skinStepCounter/skinStepCounter'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { INITIAL_FIGURE_ENTRY, INITIAL_FIGURE_LIST_MEMORY, drawListFigureTimes } from '@/pages/special/lib/hallOfFameFigure'
import type { FigureDrawing, FigureEntryState, FigureListMemory, FigureSlotInput } from '@/pages/special/lib/hallOfFameFigure'

/**
 * 목록 객체를 든 장면 — 메인 메뉴 [this+0x120](하위 16 홈런더비 · 17 미션 · 27 스페셜 명전) · 나리 [this+0xd8](상태 145 등록) ·
 * 시즌 [this+0xa8](0xe2 선수영입). 셋 다 **같은 전역 스킨 [0x1552cfc]** 이다(확정 r166 — 생성자 0x234d4 의 23620~23634 · 나리 셋업
 * 0xf684 의 f6b0~f6be · 시즌 0x3b14 의 3b3c~3b4c 가 그 값을 적는다). 그래서 그린 수 [+0x40c] · 머무름 +0x208 · 자세 +0x204 는 앱에
 * 하나다 — 그린 수는 엔트리 편집기 · 순위 판 · 경기설정 창과도 같은 칸(`shared/lib/skinStepCounter`).
 */
export type HallOfFameListOwner = '메뉴' | '나리' | '시즌'

/** 머무름 · 자세 — 앱에 하나 (그린 수는 `skinStepCounterValue`) */
let listMemory: FigureListMemory = INITIAL_FIGURE_LIST_MEMORY

interface CommittedFigure {
  readonly tick: number
  readonly entry: FigureEntryState
}

/**
 * 그린 뒤 굳힌 목록 칸 — 화면마다 하나. 렌더는 읽기만 하고(굳힌 칸에서 이번 틱까지 앞당겨 그린다) 굳히기는 그림이 나간 뒤 effect 가 한다.
 * 굳혀도 다시 그리지 않는다 — 다음 틱의 렌더가 읽는다(목록 기억 `listMemory` 와 같은 바깥 칸)
 */
function createCommittedFigure(tick: number) {
  let committed: CommittedFigure = { tick: tick - 1, entry: INITIAL_FIGURE_ENTRY }
  return {
    read: () => committed,
    commit: (next: CommittedFigure) => {
      committed = next
    },
  }
}

/**
 * 갱신 한 번에 그림 한 번 — 그린 **뒤** 목록 칸을 굳힌다(그림이 나간 뒤 effect). 건너뛴 갱신은 그만큼 앞당겨 그린다.
 * 그림·애니 객체는 진입마다 새로 만들므로 이 훅(화면)마다 따로 든다.
 */
export function useHallOfFameFigure(input: FigureSlotInput): FigureDrawing {
  const tick = useUpdateCounter()
  const [committedFigure] = useState(() => createCommittedFigure(tick))
  const committed = committedFigure.read()
  const memory: FigureListMemory = { ...listMemory, draws: skinStepCounterValue() }
  const frame = drawListFigureTimes(memory, committed.entry, input, tick - committed.tick)
  useEffect(() => {
    if (committedFigure.read().tick === tick) return
    listMemory = frame.memory
    setSkinStepCounter(frame.memory.draws)
    committedFigure.commit({ tick, entry: frame.entry })
  })
  return frame.drawing
}
