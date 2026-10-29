import { nariMatchCancelTargetOf } from '@/pages/management/lib/nariMatchPrepare'
import { type CareerScope, useCareerValue } from '@/app/model/careerSession/atoms/careerScope'
import { rawCareerAtom } from '@/app/model/careerSession/atoms/careerAtoms'
import { portsMirrorAtom } from '@/app/model/careerSession/atoms/portsAtoms'
import { entryViewAtom } from '@/app/model/careerSession/atoms/uiAtoms'
import { useShownCareer } from '@/app/model/careerSession/state/useShownCareer'
import { useMatchPrepare, withRenumberedBattingOrder } from '@/app/model/careerSession/nextGame/useMatchPrepare'
import { useBeginGame } from '@/app/model/careerSession/game/useBeginGame'
import { seasonFlowOf } from '@/app/model/careerSession/seasonEnd/seasonFlow'
import { batterNariEntryViewOf, pointNariEntryCursor, pressNariEntryKey } from '@/pages/management/lib/nariEntryView'
import type { EntryKey } from '@/entities/season-mode/model/entryEditor'

/** 109 다음경기 순위표 · 142 경기 준비 · 143 엔트리 보기 (그림마다 새 함수 — 옛 꼴 그대로) */
export function useNextGameActions(scope: CareerScope) {
  const { atoms, screen, setScreen } = scope
  const career = useShownCareer(scope)
  const entryView = useCareerValue(atoms, entryViewAtom)
  const { enterNextGameStandings, enterMatchPrepare } = useMatchPrepare(scope)
  const { beginGame, beginCupGame } = useBeginGame(scope)
  const { enterPostseason } = seasonFlowOf(scope)
  return {
    /** 109 순위표 확인(−5 · '5', 0x105f0) → 142 경기 준비 */
    confirmNextGameStandings: () => {
      if (career === null) return
      enterMatchPrepare()
    },

    /**
     * 142 확인(−5 · '5', 0x13cb6) — 저장 [모드+0x4c] = 1 · 저장 · 밀기 → 144 → 경기 장면 (0x15ce0).
     * 굴린 마선수(`matchAces`)는 진입이 이미 두 팀 명부에 넣었다(0xb88c8 · 0xb8870 — 마타자 명단 9번 · 마투수 투수 8번) —
     * 경기 장면이 같은 명부로 팀을 세우므로 경기에 그대로 실린다.
     * 저장 [모드+0x4c] = 1 은 전역기록(0x1f1d9) +0x4c + 모드 = "그 모드 경기가 중간 저장돼 있음" 칸이다 — 타자편은 +0x50
     * (`entities/mode-save` 의 `nariGames[4]`). 경기 장면 셋업 0x39fdc 의 모드 3·4 갈래(0x3a342)가 다시 1, 경기 끝 정산
     * 0x4f3d6 · 104 등록 0x112c0 · 모드 저장 지우기 0x224ec 가 0 으로 쓴다. ~~나리 칸은 읽는 곳이 없다~~(89a6b81 정정):
     * **0x327b8 의 모드 3·4 갈래(3289c~328b0)가 읽는다** — [14]·[최근게임] 에서 `+0x44 && +0x50` 이면 0x213c0(앱, 4, 0) 으로
     * 저장을 올려 곧장 경기 장면 0x104(`resumeInterruptedGame`), 아니면 장면 0x106. 89a6b81 의 전수는 0x327b8 을 +0x4d(모드 1
     * 갈래)로만 적었다 — 모드 2·3·4·8·9 갈래도 `기록 + m` 에 0x4c 를 더해 그 모드 칸을 읽는다. 나리 경기는 반 이닝 저장이 없어
     * (0x4f928 은 모드 1·2·8·9 만) 곧장 경기는 그 경기를 처음부터 다시 세운다.
     */
    confirmMatchPrepare: () => {
      if (career === null || screen.kind !== '경기준비') return
      // 0x13cca — 전역기록 +0x4c + 모드(+0x50) = 1 · 저장. 마선수는 커리어 저장의 나리 팀 레코드(`nariTeams`)가 들고 간다 —
      // 모드 저장 칸에는 국가대항전 여부(S+0x12c)만 남긴다(대회 칸은 커리어 저장의 `nationalCup`)
      atoms.get(portsMirrorAtom).current.nariGameSave?.start({ aces: null, isNationalCup: screen.cup !== undefined })
      if (screen.cup !== undefined) return beginCupGame(career, screen.cup.matchup, screen.cup.cup)
      beginGame()
    },

    /** 142 취소(−16, 0x13c72) — S+0xb4(포스트시즌) → 128 진입 0x120a4 를 다시, 그 밖 → 109 (이전 상태 142 라 취소가 안 먹는다) */
    cancelMatchPrepare: () => {
      if (career === null || screen.kind !== '경기준비') return
      const target = nariMatchCancelTargetOf({ isNationalCup: screen.cup !== undefined, isPostseason: career.postseason !== null })
      // S+0x12c → 135 (0x13c72). 135 는 진입 함수가 없어 순위표가 그대로 다시 선다
      if (target === '국가대항전' && screen.cup !== undefined) return setScreen({ kind: '국가대항전', cup: screen.cup.cup, atStandings: true })
      if (target === '포스트시즌') return enterPostseason(career, screen.postseasonFromReentry === true)
      enterNextGameStandings(false)
    },

    /** 109 순위표 취소(−16, 0x1060e) — 이전 상태가 105 일 때만 105 로. 그 밖에는 아무 일도 없다 */
    cancelNextGameStandings: () => {
      if (screen.kind !== '다음경기순위' || !screen.fromManagement) return
      // 105 진입 0x11910 이 S+0x50 = 3 · 저장(0x11990) — 109 의 4 를 덮는다 (웹 null)
      atoms.set(rawCareerAtom, (current) => (current === null || current.seasonEndState !== 109 ? current : { ...current, seasonEndState: null }))
      setScreen({ kind: '관리' })
    },

    /**
     * 142 의 '4'/왼(−3) · '6'/오른(−4) — 장면+0x164 = 1/0 · 밀기(8, 0, 4/3, 1000) → **143 경기 전 엔트리 보기**(0x16af8).
     * 내 팀('4')이든 상대 팀('6')이든 보기 전용이다(0x5561c 셋째 인자 0 — `pages/management/lib/nariEntryView` 머리말).
     */
    openEntryView: (isMyTeam: boolean) => {
      if (career === null || screen.kind !== '경기준비') return
      const cup = screen.cup === undefined ? undefined : screen.cup.matchup
      atoms.set(entryViewAtom, batterNariEntryViewOf(career, isMyTeam, cup))
    },

    /** 143 키 0x1457c — 끝 코드 1 · 2(상대 팀) · 3(내 팀)이면 142 로. 142 진입은 이전이 143 이라 마선수를 다시 안 굴린다 */
    pressEntryViewKey: (key: EntryKey) => {
      if (entryView === null) return
      const pressed = pressNariEntryKey(entryView, key)
      if (!pressed.leaves) return atoms.set(entryViewAtom, pressed.view)
      atoms.set(entryViewAtom, null)
      // 142 진입 0x1c54a — 칸 번호 다시 매기기(보기 전용이라 바뀐 것이 없다)
      atoms.set(rawCareerAtom, withRenumberedBattingOrder)
    },

    /** 웹 전용 — 143 줄을 눌러 커서를 옮긴다 */
    pointEntryViewCursor: (index: number) => {
      if (entryView !== null) atoms.set(entryViewAtom, pointNariEntryCursor(entryView, index))
    },
  }
}
