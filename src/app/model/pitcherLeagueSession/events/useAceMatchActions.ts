import { useCallback } from 'react'
import { spendPitcherCycleAction, type PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { aceMatchMissionOf, matchResultEventOf, type StoryCarry } from '@/entities/story/model/aceMatch'
import { markRewardedEvent } from '@/entities/story/model/storyScene'
import { type PitcherScope, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { careerAtom } from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'
import { sceneAtom, storyAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import { aceMatchAtom } from '@/app/model/pitcherLeagueSession/atoms/gameAtoms'
import { portsMirrorAtom } from '@/app/model/pitcherLeagueSession/atoms/portsAtoms'
import type { MatchCommand } from '@/app/model/pitcherLeagueSession/types/scene'
import { usePitcherSaveWriters } from '@/app/model/pitcherLeagueSession/state/usePitcherSaveWriters'
import { useSetUpPitcherScene } from '@/app/model/pitcherLeagueSession/state/useSceneSetUp'
import { useOpenStory } from '@/app/model/pitcherLeagueSession/events/useOpenStory'
import { useEnterOutingMap } from '@/app/model/pitcherLeagueSession/outing/useEnterOutingMap'
import { useQuitGame } from '@/app/model/pitcherLeagueSession/game/useQuitGame'

/**
 * **match 로 나가는 장소 이벤트의 끝 처리** — 이벤트 관리자 0x8cf64 의 match(SYS 8, 0x8d734~0x8d904)는 미션 장면 전환
 * (0xbdae9)을 걸고 0x8a380 으로 관리자를 비운 뒤 **1(끝남)** 을 돌려준다(보통 이벤트 끝 0x8d506 → 0x8d8ee 와 같은 꼬리).
 * 그래서 같은 틀의 114 끝 처리 0x1c014 가 그 자리에서 돌아, 뒤 상태가 113 이고 +0x167 == 0 이면 S+4 = 1(행동함) ·
 * S+0x6a(외출 수)++ · 105 · 저장을 한다. match 는 빈 장소 이벤트(440~444)에 없다.
 */
const settlePlaceForAceMatch = (current: PitcherCareer) => spendPitcherCycleAction({ ...current, outingsThisSeason: current.outingsThisSeason + 1 })

/** 마선수 대결 — 나가기 · 마치기 · 경기 중 나가기 */
export function useAceMatchActions(scope: PitcherScope) {
  const { atoms } = scope
  const career = usePitcherValue(atoms, careerAtom)
  const story = usePitcherValue(atoms, storyAtom)
  const aceMatch = usePitcherValue(atoms, aceMatchAtom)
  const { commit } = usePitcherSaveWriters(scope)
  const setUpPitcherScene = useSetUpPitcherScene(atoms)
  const openStory = useOpenStory(atoms)
  const enterOutingMap = useEnterOutingMap(atoms)
  const quitGame = useQuitGame(scope)
  /**
   * SYS 8(0x8d734 → 0x8d764)이 `g[0x175] = team − 1`(투수편 미션 레코드 번호)를 적고 미션 장면으로 나간다. 이벤트 데이터의 team 은
   * 16~20 뿐이라 투수 미션 16~20 "메디카·킹타이거·로제·크라이져·어거지죠" (목표 아웃) 에 떨어진다 — 원본은 범위 검사 없이 연다.
   * SYS 8 투수편 갈래(0x8d7d0~0x8d834): g[0x175] = team − 1 · g[0x170]/g[0x172] = 결과 이벤트 · g[0x176] = 1 · g[0x177] = 0 ·
   * g[0xf6] = 모드 → 전역기록 저장(8d84a) · 지금 이벤트 본 표시(8d85c) · 커리어 저장(8d870). match 가 끝남을 돌려 114 끝
   * 0x1c014 가 떠나온 줄 본 표시(0x8b0e4) · 장소 끝 처리를 **나가는 자리에서** 한다 — 결과 이벤트(140)의 끝에서는 다시 하지 않는다.
   */
  const beginAceMatch = useCallback(
    (command: MatchCommand, carry: StoryCarry) => {
      if (career === null || story === null) return
      const mission = aceMatchMissionOf(command.team, '투수')
      if (mission === null) return
      const settled = story.context === '장소' ? settlePlaceForAceMatch(career) : career
      atoms.get(portsMirrorAtom).current.aceMatchPending.hold(command.resultEvents)
      commit(markRewardedEvent(settled, null, carry.viewedEventIds))
      atoms.set(storyAtom, null)
      atoms.set(aceMatchAtom, { mission, resultEvents: command.resultEvents, carried: carry })
      atoms.set(sceneAtom, '마선수대결')
    },
    [atoms, career, commit, story],
  )
  /**
   * 대결이 끝나 장면 0x106 으로 돌아왔다 — 미션 끝이 결과를 저장 +0x177 에 적고(0x4efc6~0x4f018, G 없음) 원래 모드로 돌린다.
   * 대결(미션 장면)을 마치면 장면 0x106 이 새로 선다(0xf684). 140 진입 0x10df8 — 대기 칸을 지우고 전역기록 저장(10f72).
   * 105 진입의 +0x176 갈래(0x11bb2)가 현재를 112 로 두고 0x118e4 — [!] 칸을 다시 찍는다(140 밑 지도가 이 값을 그린다) →
   * resultEvents[이김 ? 0 : 1] 을 0x8bdc9 로 부르고 `[다음 114, 뒤 105]` (0x10e40). 140 은 115·117 보다 앞이다.
   */
  const finishAceMatch = useCallback(
    (isWin: boolean) => {
      if (aceMatch === null) return
      atoms.set(aceMatchAtom, null)
      setUpPitcherScene()
      atoms.get(portsMirrorAtom).current.aceMatchPending.clear()
      enterOutingMap()
      openStory({ eventId: matchResultEventOf(aceMatch.resultEvents, isWin), context: '대결결과', viewed: [], carried: aceMatch.carried })
    },
    [aceMatch, atoms, enterOutingMap, openStory, setUpPitcherScene],
  )
  /** 0x40140 — g[0x176] · g[0x177] · 결과 이벤트 칸을 안 건드리고 저장도 없다. 장면 0x106 은 헐리고 다음에 100 → 0x1c154 로 선다 */
  const quitAceMatch = useCallback(() => {
    atoms.set(aceMatchAtom, null)
    quitGame()
  }, [atoms, quitGame])
  return { beginAceMatch, finishAceMatch, quitAceMatch, quitGame }
}
