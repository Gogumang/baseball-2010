import { useCallback } from 'react'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import type { CareerAtoms, CareerScope } from '@/app/model/careerSession/atoms/careerScope'
import { shownCareerMirrorAtom } from '@/app/model/careerSession/atoms/careerAtoms'
import { cupGameAtom, progressAtom } from '@/app/model/careerSession/atoms/gameAtoms'
import * as endAtoms from '@/app/model/careerSession/atoms/gameEndAtoms'
import { useFinishGame } from '@/app/model/careerSession/settlement/useFinishGame'
import { useFinishCupGame } from '@/app/model/careerSession/nationalCup/useFinishCupGame'

/**
 * **재생 판 뒤의 경기 끝** — 미리 돌려 재생 칸(`lastDefensePlay`)에 넣은 판(밀어내기 · 낫아웃 · 진루만 하는 판)이 경기를 끝내면
 * 원본은 그 판을 상태 0x17 로 끝까지 그린 뒤에야 0xd → 경기 끝 판 0x18 로 간다(판정 A/B 0xae3e8). 그 그리기 0x43278 이 실책 +0x2e 를
 * 올리므로(`recordFieldingErrors`) 정산 0x4ea0c 의 기록에 그 판 실책이 든다. 예전 웹은 판 결과를 먹인 자리에서 곧장 정산해
 * 재생이 잘리고 그 판 실책이 요약에서 빠졌다(r237 남김 — "웹 구조"). 재생 화면(`GameRoute`)은 판을 다 그리면 `finishReplay` 로
 * 알리므로 그때까지 정산을 미룬다. 재생 화면이 붙어 있지 않으면(화면 없는 시험) 곧장 정산한다 — 예전과 같다. soak 는 재생 화면 대신 붙어 알린다.
 */
function awaitsReplay(atoms: CareerAtoms, settled: GameProgress): boolean {
  const play = settled.lastDefensePlay
  return atoms.get(endAtoms.replayHostCountAtom) > 0 && play !== null && play.ticks.length > 0 && play !== atoms.get(endAtoms.replayedPlayAtom)
}

/**
 * **남은 중계 뒤의 경기 끝** (A-38) — 0x12 끝(4e7ca) · 0x17 끝(52a8e)이 예약한 +0x1b6c 를 0x35108 이 자동진행 중계 0x21 로 덮으면
 * 동료 타석 · 상대 반 이닝을 그 상태에서 다 돈 뒤에야 0xc2198 이 거짓을 내 경기 끝 판 0x18 → 정산 0x19 다(K · R10). 돌발 판정이
 * 참이면 그 앞에 결과 창 0x1d 가 선다(`useGameEndHeldByBurst`). 웹 진행기는 그 중계를 한 걸음에 굴려 `autoRelay` 에 담고 경기 화면(`GameRoute`)이
 * 틱마다 튼다 — 예전 웹은 정산이 그것을 기다리지 않아 경기를 끝낸 중계가 잘렸다. 중계 화면이 붙어 있는 동안(`attachRelayHost`) 아직 다
 * 틀지 않은 중계가 있으면 정산을 그 끝(`finishRelay`)까지 미룬다. 화면이 붙어 있지 않으면(화면 없는 시험 · soak) 곧장 — 예전과 같다
 */
function awaitsRelay(atoms: CareerAtoms, settled: GameProgress): boolean {
  const relay = settled.autoRelay ?? null
  return atoms.get(endAtoms.relayHostCountAtom) > 0 && relay !== null && relay.ticks.length > 0 && relay !== atoms.get(endAtoms.relayedAtom)
}

/** 경기 끝 — 재생 판 · 돌발 결과 창 · 남은 중계를 기다린 뒤 정산한다 */
export function useEndGame(scope: CareerScope): (finished: GameProgress) => void {
  const { atoms } = scope
  const finishGame = useFinishGame(scope)
  const finishCupGame = useFinishCupGame(scope)
  return useCallback(
    (finished: GameProgress) => {
      // 재생 판이 실책을 올렸으면 진행 칸이 더 새 값이다 — 같은 끝난 경기면 그것으로 정산한다
      const latest = atoms.get(progressAtom)
      const settled = latest !== null && latest.game.isFinished ? latest : finished
      if (awaitsReplay(atoms, settled)) return atoms.set(endAtoms.isGameEndPendingAtom, true)
      atoms.set(endAtoms.isGameEndPendingAtom, false)
      // 돌발 결과 창 뒤 — 0x12 끝(4e7ca) · 0x17 끝(52a8e)의 돌발 판정 0x8f414 가 참이면 결과 창(0x1d · 0x1c)을 먼저 거친다
      if (settled.lastBurstResolution !== null) return atoms.set(endAtoms.isGameEndHeldByBurstAtom, true)
      // 결과 창 다음이 남은 중계(0x21)다 — 다 튼 뒤 경기 끝 판 · 정산
      if (awaitsRelay(atoms, settled)) return atoms.set(endAtoms.isGameEndAwaitingRelayAtom, true)
      atoms.set(endAtoms.isGameEndAwaitingRelayAtom, false)
      // 국가대항전 경기는 커리어 정산을 타지 않고 대회 하루를 넘긴다 (상태 142 → 101 → 134)
      const cup = atoms.get(cupGameAtom)
      if (cup !== null) return finishCupGame(settled, cup)
      const currentCareer = atoms.get(shownCareerMirrorAtom).current
      if (currentCareer !== null) finishGame(settled, currentCareer)
    },
    [atoms, finishCupGame, finishGame],
  )
}
