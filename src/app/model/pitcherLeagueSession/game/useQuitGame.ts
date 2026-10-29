import { useCallback } from 'react'
import { enterPitcherYearEndEvent, pitcherResumePointOf } from '@/entities/pitcher-career/model/pitcherYearEnd'
import { regularSeasonPopupOnEnter } from '@/entities/career/model/postseasonFlow'
import { type PitcherScope, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { careerAtom } from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'
import { sceneAtom, storyAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import { postseasonPopupAtom } from '@/app/model/pitcherLeagueSession/atoms/yearEndAtoms'
import {
  cupGameAtom,
  cupMatchAtom,
  cupViewAtom,
  gameOptionsAtom,
  matchPreparedAtom,
  nextGameFromManagementAtom,
} from '@/app/model/pitcherLeagueSession/atoms/gameAtoms'
import { useSetUpPitcherScene } from '@/app/model/pitcherLeagueSession/state/useSceneSetUp'
import { useStartNewSeason } from '@/app/model/pitcherLeagueSession/seasonEnd/useStartNewSeason'

/**
 * **경기 중 메뉴 "나가기"** — 경기 상태 0x22 갱신 `0x40140` 은 모드를 가리지 않고 0x140006c = 4 · 장면 0x103(메인 메뉴 처음 단)으로
 * 나간다. 저장(0x22754)도 전역기록 +0x4f 도 안 건드린다 — 142 확인 0x13cca 가 세운 +0x4f 가 남아 [14]·[최근게임] 의
 * 0x327b8 모드 3 갈래가 곧장 경기(`resumeInterruptedGame`)로 다시 세운다.
 * 장면 0x106 은 나갈 때 헐리고 다음에 새로 서므로, 웹은 세션 장면을 새로 선 장면의 이어하기(상태 100 진입 0x1c154 —
 * `pitcherResumePointOf`)로 되돌려 둔다. ⚠️ 웹 전용 갈래: +0x4f 손잡이가 없어 곧장 경기가 안 될 때만 이 장면이 보인다.
 * ⚠️ 원본은 나간 그 이닝이 +0x6b 에 남는다(0x40140 은 상태를 안 지운다) — 웹 투수 경기 화면(pages/pitching)이 지금 이닝을 넘기지
 * 않아 경기 시작 때의 0 이 남는다 (미해결)
 */
export function useQuitGame(scope: PitcherScope) {
  const { atoms } = scope
  const career = usePitcherValue(atoms, careerAtom)
  const setUpPitcherScene = useSetUpPitcherScene(atoms)
  const startNewSeason = useStartNewSeason(scope)
  return useCallback(() => {
    atoms.set(gameOptionsAtom, null)
    atoms.set(nextGameFromManagementAtom, false)
    atoms.set(matchPreparedAtom, false)
    // 경기를 나가면 장면 0x106 이 다시 선다 — 반복 이벤트 · 커서 · mgr+0x304 (0xf684)
    setUpPitcherScene()
    if (career === null) return atoms.set(sceneAtom, '등록')
    const point = pitcherResumePointOf(career)
    if (point.kind === '이벤트') {
      atoms.set(careerAtom, enterPitcherYearEndEvent(career, point.eventId))
      atoms.set(storyAtom, { eventId: point.eventId, context: '연말', viewed: [] })
      return atoms.set(sceneAtom, '이벤트')
    }
    // 1c25e — S+0x50 == 0x11 → 새 시즌 처리 0x1b768 (경기 중에는 이 값이 남지 않지만 같은 분기라 함께 둔다)
    if (point.kind === '새시즌') return startNewSeason(career, true)
    if (point.kind === '포스트시즌') atoms.set(postseasonPopupAtom, regularSeasonPopupOnEnter(career))
    if (point.kind === '국가대항전') {
      // 그 밖 갈래 S+0x12c → 134 대진판 (1c348~1c358)
      atoms.set(cupGameAtom, null)
      atoms.set(cupMatchAtom, null)
      atoms.set(cupViewAtom, { cup: point.cup, atStandings: false })
    }
    atoms.set(sceneAtom, point.kind)
  }, [atoms, career, setUpPitcherScene, startNewSeason])
}
