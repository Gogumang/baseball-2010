import { regularSeasonPopupOnEnter } from '@/entities/career/model/postseasonFlow'
import type { EntryKey } from '@/entities/season-mode/model/entryEditor'
import { nariMatchCancelTargetOf } from '@/pages/management/lib/nariMatchPrepare'
import { pointNariEntryCursor, pressNariEntryKey } from '@/pages/management/lib/nariEntryView'
import { pitcherNariEntryViewOf } from '@/pages/pitcher-league/lib/pitcherEntryView'
import { resetLiveGameState } from '@/shared/lib/liveGameState/liveGameState'
import { type PitcherScope, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { careerAtom } from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'
import { sceneAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import { postseasonPopupAtom } from '@/app/model/pitcherLeagueSession/atoms/yearEndAtoms'
import {
  cupGameAtom,
  cupMatchAtom,
  cupViewAtom,
  entryViewAtom,
  gameOptionsAtom,
  nextGameFromManagementAtom,
} from '@/app/model/pitcherLeagueSession/atoms/gameAtoms'
import { portsMirrorAtom } from '@/app/model/pitcherLeagueSession/atoms/portsAtoms'
import { usePitcherSaveWriters } from '@/app/model/pitcherLeagueSession/state/usePitcherSaveWriters'
import { cupGameOptionsOf, pitcherCupTeamsOf } from '@/app/model/pitcherLeagueSession/game/gameOptions'
import { useBeginGame, useRecordGameOptionsOf } from '@/app/model/pitcherLeagueSession/game/useBeginGame'
import { useOpenMatchPrepare } from '@/app/model/pitcherLeagueSession/nextGame/useOpenMatchPrepare'
import { useNextGameStandingsActions } from '@/app/model/pitcherLeagueSession/nextGame/useNextGameStandingsActions'

/**
 * 다음 경기 — 109 순위표 · 142 경기 준비 · 143 엔트리 보기. 옛 훅처럼 그림마다 새 함수다(콜백 신원을 바꾸지 않는다).
 */
export function useNextGameActions(scope: PitcherScope) {
  const { atoms, gaugeSettingOn, throwModeManual } = scope
  const career = usePitcherValue(atoms, careerAtom)
  const scene = usePitcherValue(atoms, sceneAtom)
  const cupMatch = usePitcherValue(atoms, cupMatchAtom)
  const entryView = usePitcherValue(atoms, entryViewAtom)
  const { commitWith } = usePitcherSaveWriters(scope)
  const recordGameOptionsOf = useRecordGameOptionsOf(scope)
  const beginGame = useBeginGame(scope)
  const openMatchPrepare = useOpenMatchPrepare(scope)
  const settings = { gaugeSettingOn, throwModeManual }
  return {
    ...useNextGameStandingsActions(scope),
    confirmNextGameStandings: openMatchPrepare,
    /**
     * 142 확인 0x13cb6 → 144 → 경기. 굴린 마선수는 진입이 두 팀 명부에 넣었다(0xb88c8 · 0xb8870) — 경기에 그대로 실린다.
     * 0x13cca — 저장 [모드+0x4c] = 1(전역기록 +0x4f "모드 3 경기 중간 저장됨") · 저장. [14]·[최근게임] 의 0x327b8 모드 3 갈래가
     * `+0x43 && +0x4f` 면 곧장 경기(`resumeInterruptedGame`). 명부의 마선수는 커리어 저장의 나리 팀 레코드(`nariTeams`)가 들고 간다.
     * 모드 저장 칸에는 국가대항전 여부(S+0x12c)만 남긴다. 국가대항전이면 대회 레코드 두 칸으로 선다(`cupGameOptionsOf`)
     */
    confirmMatchPrepare: () => {
      if (career === null || scene !== '경기준비') return
      atoms.get(portsMirrorAtom).current.nariGameSave?.start({ aces: null, isNationalCup: cupMatch !== null })
      if (cupMatch === null) return beginGame()
      atoms.set(cupGameAtom, cupMatch.cup)
      resetLiveGameState()
      atoms.set(gameOptionsAtom, cupGameOptionsOf(career, cupMatch.matchup, cupMatch.cup, settings))
      atoms.set(sceneAtom, '경기')
    },
    /** 142 의 '4'/왼 · '6'/오른 → 143 경기 전 엔트리 보기(0x16af8, 보기 전용). 국가대항전이면 대회 레코드 두 칸(0x1f9a9 → 0x1f940) */
    openEntryView: (isMyTeam: boolean) => {
      if (career === null || scene !== '경기준비') return
      if (cupMatch === null) return atoms.set(entryViewAtom, pitcherNariEntryViewOf(career, recordGameOptionsOf(career), isMyTeam))
      const options = cupGameOptionsOf(career, cupMatch.matchup, cupMatch.cup, settings)
      atoms.set(entryViewAtom, pitcherNariEntryViewOf(career, options, isMyTeam, pitcherCupTeamsOf(career, cupMatch.matchup.opponent)))
    },
    /** 143 키 0x1457c — 끝 코드 1 · 2(상대 팀) · 3(내 팀)이면 142 로 (142 진입은 이전이 143 이라 다시 안 굴린다) */
    pressEntryViewKey: (key: EntryKey) => {
      if (entryView === null) return
      const pressed = pressNariEntryKey(entryView, key)
      atoms.set(entryViewAtom, pressed.leaves ? null : pressed.view)
    },
    pointEntryViewCursor: (index: number) => {
      if (entryView !== null) atoms.set(entryViewAtom, pointNariEntryCursor(entryView, index))
    },
    /**
     * 142 취소(−16) — 0x13c72: S+0x12c 면 135(진입 함수가 없어 순위표가 그대로 다시 선다. 장면+0x288 은 그대로) · 포스트시즌이면
     * 128 진입 0x120a4 를 다시(S+0x50 = 0xf · 저장, 정규시즌 우승 보상을 아직 안 받았으면 팝업 0xb) · 아니면 109 진입 0x10d8c
     * (이전 상태 142 라 취소가 안 먹고 저장도 건너뛴다 — S+0x50 은 이미 4)
     */
    cancelMatchPrepare: () => {
      if (career === null || scene !== '경기준비') return
      const target = nariMatchCancelTargetOf({ isNationalCup: cupMatch !== null, isPostseason: career.postseason !== null })
      if (target === '국가대항전' && cupMatch !== null) {
        atoms.set(cupViewAtom, { cup: cupMatch.cup, atStandings: true })
        atoms.set(cupMatchAtom, null)
        return atoms.set(sceneAtom, '국가대항전')
      }
      if (target === '포스트시즌') {
        commitWith((current) => (current.seasonEndState === 128 ? current : { ...current, seasonEndState: 128 }))
        atoms.set(postseasonPopupAtom, regularSeasonPopupOnEnter(career))
        return atoms.set(sceneAtom, '포스트시즌')
      }
      commitWith((current) => (current.seasonEndState === 109 ? current : { ...current, seasonEndState: 109 }))
      atoms.set(nextGameFromManagementAtom, false)
      atoms.set(sceneAtom, '다음경기순위')
    },
  }
}
