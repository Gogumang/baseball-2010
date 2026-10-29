import type { GameAutoRelay, GameProgress } from '@/features/play-game/model/gameFlow'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { CareerAtoms } from '@/app/model/careerSession/atoms/careerScope'
import { progressAtom } from '@/app/model/careerSession/atoms/gameAtoms'
import * as endAtoms from '@/app/model/careerSession/atoms/gameEndAtoms'

/** 미룬 정산이 남았으면 끝난 경기로 지난 그림의 경기 끝을 부른다 — `markSeen` 은 그 경기의 재생 판 · 중계를 다 본 것으로 적는다 */
function endPendingGame(atoms: CareerAtoms, markSeen?: (finished: GameProgress) => void): void {
  const current = atoms.get(progressAtom)
  if (current === null || !current.game.isFinished) return
  markSeen?.(current)
  atoms.get(endAtoms.endGameMirrorAtom).current(current)
}

/** 재생 · 중계 화면이 붙고 떼고 다 그린 것을 알리는 길 — 경기 끝 미룸(`useEndGame`)을 푼다. 그림마다 새 함수다(옛 꼴 그대로) */
export function gameEndHostActionsOf(atoms: CareerAtoms) {
  return {
    /**
     * 재생 화면이 붙었다 — 붙어 있는 동안 재생 판으로 끝난 경기의 정산을 재생 뒤로 미룬다(`endGame`). 돌려준 함수로 뗀다.
     * 떼는 자리에서 미룬 정산이 남았으면 곧장 한다(화면이 그 판을 못 그리고 내려갔다)
     */
    attachReplayHost: () => {
      atoms.set(endAtoms.replayHostCountAtom, (count) => count + 1)
      return () => {
        atoms.set(endAtoms.replayHostCountAtom, (count) => count - 1)
        if (atoms.get(endAtoms.replayHostCountAtom) > 0 || !atoms.get(endAtoms.isGameEndPendingAtom)) return
        endPendingGame(atoms, (current) => atoms.set(endAtoms.replayedPlayAtom, current.lastDefensePlay))
      }
    },

    /**
     * 중계 화면이 붙었다 — 붙어 있는 동안 경기를 끝낸 남은 중계(`autoRelay`)를 다 틀 때까지 정산을 미룬다(`endGame`, A-38). 돌려준 함수로 뗀다.
     * 떼는 자리에서 미룬 정산이 남았으면 곧장 한다(화면이 그 중계를 못 틀고 내려갔다)
     */
    attachRelayHost: () => {
      atoms.set(endAtoms.relayHostCountAtom, (count) => count + 1)
      return () => {
        atoms.set(endAtoms.relayHostCountAtom, (count) => count - 1)
        if (atoms.get(endAtoms.relayHostCountAtom) > 0 || !atoms.get(endAtoms.isGameEndAwaitingRelayAtom)) return
        endPendingGame(atoms, (current) => atoms.set(endAtoms.relayedAtom, current.autoRelay ?? null))
      }
    },

    /** 중계 묶음(`autoRelay`)을 다 틀었다 — 0xc2198 이 거짓을 낸 틱. 미룬 정산이 있으면 이제 경기 끝 판 · 정산 */
    finishRelay: (relay: GameAutoRelay | null) => {
      atoms.set(endAtoms.relayedAtom, relay)
      if (!atoms.get(endAtoms.isGameEndAwaitingRelayAtom)) return
      endPendingGame(atoms)
    },

    /** 재생 판(`lastDefensePlay`)을 다 그렸다 — 그 판 실책(`recordFieldingErrors`)이 먼저 들어와 있다. 미룬 정산이 있으면 이제 한다 */
    finishReplay: (play: DefensePlayResult | null) => {
      atoms.set(endAtoms.replayedPlayAtom, play)
      if (!atoms.get(endAtoms.isGameEndPendingAtom)) return
      endPendingGame(atoms)
    },
  }
}
