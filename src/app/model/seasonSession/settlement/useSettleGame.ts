import { useCallback } from 'react'
import type { TeamGameSummary } from '@/features/play-team-game/model/teamGameFlow'
import { START_SEASON_EVENT_CURSOR } from '@/entities/season-mode/model/seasonEventFlow'
import { seasonGameIsEvaluated } from '@/entities/season-mode/model/seasonEvaluation'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { seasonEvaluationJingleIdOf } from '@/app/model/seasonSession/constants/seasonConstants'
import type { SettledSeasonGame } from '@/app/model/seasonSession/save/seasonSave'
import { playedSeasonRecordOf, recordSeasonGameEndStats } from '@/app/model/seasonSession/settlement/gameEndRecord'
import {
  humanWonOf,
  postseasonSettlementOf,
  recordLiveGameEnd,
  rollCupSettlement,
  rollRegularSeasonSettlement,
  savedAfterBurstOf,
} from '@/app/model/seasonSession/settlement/settleBranches'
import { type SeasonScope, useSeasonValue } from '@/app/model/seasonSession/atoms/seasonScope'
import { saveAtom } from '@/app/model/seasonSession/atoms/saveAtoms'
import { gameKindAtom, gameOptionsAtom, ownRotationShiftAtom } from '@/app/model/seasonSession/atoms/sceneAtoms'
import { eventCursorAtom, freshSceneAtom, newPlayerFlagAtom } from '@/app/model/seasonSession/atoms/eventAtoms'
import { useSeasonSaveWriters } from '@/app/model/seasonSession/state/useSeasonSaveWriters'
import { useGamePointPurse } from '@/app/model/seasonSession/state/useGamePointPurse'

/** 정산 진입 0x4ea0c 의 정산 — 결과 화면 확인(`useAfterGameActions`)이 부른다 */
export function useSettleGame(scope: SeasonScope) {
  const { atoms, recordStat, random, onRegularSeasonWin, aceLevels } = scope
  const gameOptions = useSeasonValue(atoms, gameOptionsAtom)
  const gameKind = useSeasonValue(atoms, gameKindAtom)
  const ownRotationShift = useSeasonValue(atoms, ownRotationShiftAtom)
  const { commit } = useSeasonSaveWriters(scope)
  const { gainGamePoint } = useGamePointPurse(scope)
  /**
   * 경기가 끝났다 — 원본 차례 그대로 정산한다:
   * 내 경기를 전적에 넣고, 같은 날 나머지 네 경기를 돌리고(0xc2a48 — 칸·명단 엇갈림 포함, `cpuGameSidesOf`),
   * 선수 기록표에 **양 팀 타석**을 쌓고(0xa8024), 평가(0xa719c)를 얹은 뒤 관중수입(0xe9)으로 간다.
   * 평가는 **정규시즌 경기만** 받는다 — 포스트시즌·국가대항전은 원본 0x4ea0c 가 건너뛴다.
   */
  return useCallback(
    (summary: TeamGameSummary): SettledSeasonGame | null => {
      const latest = atoms.get(saveAtom)
      if (latest === null) return null
      recordLiveGameEnd(summary, gameOptions)
      const current = savedAfterBurstOf(latest, summary, gameKind === '국가대항전')
      // 경기 끝 0x4ea0c 는 모드가 5·6(미션)이 아니면 **갈래(정규·포스트시즌·국가대항전)를 가르기 전에**
      // 기록 달성 G 합 [scene+0x17f4] 를 저장 G(+0x64)에 더하고(4ec5a, 99999 상한) 0x4ec82 `0x22c7d(합, 모드 2)` 로
      // 획득 GP 통계에 적는다. 합은 요약이 싣고 온다(fc7f196 — 30G 자동진행 뒤 타석도 기록을 쌓는다, R15 10-3)
      recordSeasonGameEndStats(summary, gainGamePoint, recordStat)

      // 경기 중 `0xa755c` 가 올린 평판 16칸 — 원본은 경기 장면이 SR+0x1a0 을 직접 올리므로
      // **갈래와 상관없이** 레코드에 남는다 (S4 2b·6절). 웹은 요약이 싣고 와서 여기서 꽂는다.
      //
      // 경기 끝 꼬리 4f374~4f3b2 — 갈래와 상관없이 SR+0x54(목표점 보기)·SR+0x7c(질병 쿨다운)를 하나씩 줄인다.
      // 그 뒤 장면 0x105 를 **새로 만든다**(0x3b14): 반복 이벤트(490)의 본 비트를 지우고(0x8ce94) 이벤트 관리자
      // (커서)와 새 선수 플래그(this+0xf9)도 새로 선다.
      //
      // 4f15a~4f19a — 모드 2 경기마다 SR+0x1bd = 내 칸 점수 · SR+0x1be = 상대 칸 점수(바이트, 0xe9 기록 줄이 s8 로 읽는다)
      const played = playedSeasonRecordOf(current.state.record, summary)
      atoms.set(eventCursorAtom, START_SEASON_EVENT_CURSOR)
      atoms.set(newPlayerFlagAtom, false)
      atoms.set(freshSceneAtom, true)
      const won = humanWonOf(summary, gameOptions)

      // 포스트시즌·국가대항전은 리그 전적·수입 정산도, **평가 0xa719c 도** 타지 않는다.
      // 원본 경기 끝 0x4ea0c 가 L+0xac(4f216)·L+0x34(4f268)이면 0x4f274 의 평가 호출을 건너뛴다
      // (`seasonGameIsEvaluated` 주석). 그래서 이 두 갈래에서 찬 16칸은 읽히지 않고 다음 경기 직전에 지워진다.
      const stage = { nationalCup: gameKind === '국가대항전', postseason: gameKind === '포스트시즌' }
      if (!seasonGameIsEvaluated(stage)) {
        const settled = stage.postseason
          ? postseasonSettlementOf(current, summary, won, played, gameOptions, ownRotationShift)
          : rollCupSettlement(current, summary, won, played, random)
        if (settled === null) return null
        commit(settled.save)
        return { next: settled.next, jingle: null }
      }

      // 4f1a2~4f212 — 모드 2 이고 L+0x34 · L+0xac 가 0(이 갈래)이고 이겼으면([sp+0x50]) 0x9f6f0 → +0xbf > 99 면 히든 45.
      // 평가 0x4f274 보다 앞이다
      if (won) onRegularSeasonWin?.()
      const settled = rollRegularSeasonSettlement(current, summary, won, played, gameOptions, ownRotationShift, random, aceLevels)
      commit(settled.save)
      // 관중수입 창(0xe9)이 뜨면서 나는 평가 징글 36·37·38 (0xdec4/0xdede) — 창은 결과 화면 확인 뒤에 선다
      return { next: SEASON_SCENE_STATE.관중수입, jingle: seasonEvaluationJingleIdOf(settled.evaluation.popularityChange) }
    },
    [aceLevels, atoms, commit, gainGamePoint, gameKind, gameOptions, onRegularSeasonWin, ownRotationShift, random, recordStat],
  )
}
