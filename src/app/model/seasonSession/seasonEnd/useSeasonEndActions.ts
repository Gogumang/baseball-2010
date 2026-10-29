import { useCallback } from 'react'
import { type LeagueFirstAward, type SeasonReward, applySeasonReward } from '@/entities/season-mode/model/seasonRewards'
import { withAwardedBit, withStoredAwardedBits } from '@/entities/collection/model/collectionRewards'
import { isSeasonNationalCupYear } from '@/entities/national-cup/model/nationalCupFlow'
import { createNationalCup, KOREA_TEAM_ID } from '@/entities/national-cup/model/nationalCup'
import { tableRosterOf } from '@/entities/season-mode/model/seasonEntry'
import { EMPTY_LEAGUE_PLAYER_STATS } from '@/entities/league/model/leaguePlayerStats'
import {
  NATIONAL_CUP_INTRO_EVENT_ID,
  SEASON_FINAL_EVENT_ID,
  type SeasonEventReward,
  YEAR_GOAL_EVENT_ID,
  markEventSeen,
  opensSeasonGoalWindow,
  applySeasonEventRewards,
  cursorAfterCalling,
  seasonEventFollowUpOf,
} from '@/entities/season-mode/model/seasonEventFlow'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { seasonGoalResultEventId, achievedSeasonGoalCount } from '@/entities/season-mode/model/seasonGoals'
import { rewardResumePatchOf } from '@/entities/story/model/storyScene'
import { seasonAwardFollowUpOf } from '@/app/model/seasonSession/awards/seasonAwards'
import { SEASON_STAT_MODE } from '@/app/model/seasonSession/constants/seasonConstants'
import { seasonGoalInputOf } from '@/app/model/seasonSession/goals/seasonGoals'
import { withEvent100Awarded } from '@/app/model/seasonSession/save/globals'
import type { SeasonSave } from '@/app/model/seasonSession/save/seasonSave'
import { nextYearOf } from '@/app/model/seasonSession/year/nextYear'
import { type SeasonScope, useSeasonValue } from '@/app/model/seasonSession/atoms/seasonScope'
import { rewardRecordAtom, saveAtom } from '@/app/model/seasonSession/atoms/saveAtoms'
import { sceneAtom } from '@/app/model/seasonSession/atoms/sceneAtoms'
import { eventPlaybackAtom } from '@/app/model/seasonSession/atoms/uiAtoms'
import { eventCursorAtom, seasonMvpKindAtom } from '@/app/model/seasonSession/atoms/eventAtoms'
import { useSeasonSaveWriters } from '@/app/model/seasonSession/state/useSeasonSaveWriters'
import { useGamePointPurse } from '@/app/model/seasonSession/state/useGamePointPurse'
import { useStartEvent } from '@/app/model/seasonSession/state/useStartEvent'
import { useSeasonGameSetup } from '@/app/model/seasonSession/state/useSeasonGameSetup'

/** 시즌 끝 — 리그 1위 G · 결산 닫기 · 이벤트 재생 끝과 보상 */
export function useSeasonEndActions(scope: SeasonScope) {
  const { atoms, rewardStore, recordStat, random } = scope
  const save = useSeasonValue(atoms, saveAtom)
  const eventPlayback = useSeasonValue(atoms, eventPlaybackAtom)
  const { commit, updateGlobals } = useSeasonSaveWriters(scope)
  const { gainGamePoint } = useGamePointPurse(scope)
  const startEvent = useStartEvent(scope)
  const { recordSourceNow } = useSeasonGameSetup(scope)
  /**
   * 리그 1위 G 지급 (`0x6900` → `0x87e8`). 받은 칸은 **전역 저장 +0x145 비트**라
   * 시즌을 새로 시작해도 남는다 — 그래서 시즌 저장이 아니라 따로 둔다.
   */
  const awardLeagueFirst = useCallback(
    (award: LeagueFirstAward) => {
      // 0x6a56~0x6a94: G += 금액(99999 상한) → 비트 k 켜기 0x9f709 → 저장 0x1f1b9 — 팝업을 띄우는 그 자리에서 다 한다.
      // 같은 바이트의 k 3~7 은 메인 메뉴 전부 수집 보상(0x292f8)이 켠다 — 저장된 비트를 합친 뒤 켜야 그 비트를 안 지운다
      atoms.set(rewardRecordAtom, (record) => withAwardedBit(withStoredAwardedBits(record, rewardStore?.load()), award.bit))
      gainGamePoint(award.gamePoint)
      // 0x6a98~0x6abc: 이어서 0x22dd5(mgr, k = 0·1·2) — 통계 [mgr+0xc8] +0x106+k 달성 표시 → 통계 저장 0x1f1e1
      recordStat?.({ kind: '달성표시', index: award.bit })
    },
    [atoms, gainGamePoint, recordStat, rewardStore],
  )
  /**
   * 결산을 닫았다 (`0x87b4`) — 연차 idx 가 **짝수**면 국가대항전, 홀수면 곧장 새 해 `0x6e0c`(`nextYearOf`)다.
   * 새 해는 머리에서 먼저 **10년차 엔딩 판정 `0xa3084`** 를 본다 (P4 1c).
   * 예전에는 이 머리 분기가 통째로 빠져 있어 **10년차 엔딩에 영영 닿지 못했다**.
   *
   * 엔딩 갈래(6e1e~6e7a, 직접 떴다): `전역기록(0x1f1d9)+0xa0+e = 1` · 0x1f1b9 → phase 6 · 0x1fded · 0x22755 →
   * 0x8bdc9(이벤트 500 "시즌모드 10년은 모두 종료") · [다음 0xf5] · 0xd3. 웹은 500 을 `startEvent` 로 틀어 끝나면 0xf5 로 가고,
   * 본 엔딩 표시(+0xa0+e)는 앱이 phase 6 레코드의 판정값을 기록연감 엔딩 칸에 켜 저장한다(`App` → `useCollection`
   * `mergeSeasonEndingIntoCollection`).
   */
  const finishSeason = useCallback(
    (reward?: SeasonReward | null) => {
      if (save === null) return
      // 0x85ec 꼬리표 9·10 — 보상 팝업이 닫힐 때 인기도·평판·소지금을 더하고(저장 없음) 곧장 0x87b4 (0x86dc~ · 0x8752~)
      const rewarded =
        reward === undefined || reward === null ? save : { ...save, state: { ...save.state, record: applySeasonReward(save.state.record, reward) } }
      const { record } = rewarded.state
      if (isSeasonNationalCupYear(record.yearIndex)) {
        commit({
          ...rewarded,
          state: { ...rewarded.state, record: { ...record, nationalCup: true } },
          cup: createNationalCup(),
          // b7c72 0x205c0 — 대표팀 슬롯 +0x918 을 마스터 팀 10 으로 새로 채운다 (마스터 행 +0x2a · +0x2e 는 그 표 값 — 쌓인 수 0)
          cupRoster: tableRosterOf(KOREA_TEAM_ID),
          cupPlayerStats: EMPTY_LEAGUE_PLAYER_STATS,
        })
        // 0xf2 진입 0xe5f8: SR+0x12c = 1 · 461 을 틀고 · 대회 초기화 · 저장 · [다음 0xf3] (e600~e64c)
        return startEvent(NATIONAL_CUP_INTRO_EVENT_ID, SEASON_SCENE_STATE.국가대항전)
      }
      const next = nextYearOf(rewarded, random)
      commit(next.save)
      // 엔딩 갈래는 500 을 틀고 [다음 0xf5] (6e54~6e76)
      if (next.scene === SEASON_SCENE_STATE.엔딩) return startEvent(SEASON_FINAL_EVENT_ID, next.scene)
      atoms.set(sceneAtom, next.scene)
    },
    [atoms, commit, random, save, startEvent],
  )
  /**
   * 이벤트 재생 0xd3 이 끝났다 (실행기 0x8cf64 의 끝 → 이전 상태 `this+0x24`).
   *
   * - **본 비트**: 실행기가 마지막 명령에 닿으면 그 이벤트를 본 것으로 켜고 저장한다(8cf92~8cfc2). 선택지로 건너간
   *   이벤트도 각각 켜진다. 연초 목표 내장 이벤트는 켜지 않는다(mgr+0xa ≠ 0).
   * - **목표 창**(SYS sub 1)이 닫히면 `0x7fe90` 이 SR+0x187 = 1 · 저장 (8d928~8d942).
   * - **보상**(명령 7)은 모드 2 갈래로 (`applySeasonEventRewards`) — 393~396 은 연차 보정이 붙는다.
   * - **이어지는 이벤트**: 392 는 끝에서 `0xa37bc` 로 달성 수를 세어 393~396 을 번호로 튼다(8d0d2~8d12c).
   * - 선택지로 다른 이벤트를 번호로 불렀으면 커서 +0x2c 가 마지막으로 부른 레코드 다음을 가리킨다.
   *
   * 재생 화면은 보상을 명령마다 그 자리에서 준다(`giveSeasonEventReward`, 알림 글 0x8beb8 와 함께) — 그때 여기 오는 `rewards` 는 비어 있다.
   * 이벤트 배경음 40(0xd3 진입 0x5110 512c~5152)은 `app/model/screenBgm` 의 `STORY_BGM` 이 두 가드(S+0x50 · [관리자+0x39f])대로 튼다.
   */
  const finishSeasonEvent = useCallback(
    (rewards: readonly SeasonEventReward[], viewedEventIds: readonly number[], endingEventId: number | null = null) => {
      const playback = eventPlayback
      if (save === null || playback === null) return
      // 첫 종류 21(s_event 500)로 끝났으면 그 이벤트만 본 표시를 안 한다 — 0x8d4ce 는 0x8cf8c 를 안 지나고, 0xd3 끝 0x78f0 의
      // 0x8b0e4 가 떠나온 이벤트 줄만 켠다. [0x1552adc] 는 0xe9ac(ec04)가 지우기만 한다 — 엔딩 0xf5 는 500 을 튼 쪽이 줄에 넣었다
      const fileEvents = viewedEventIds.filter((id) => id !== YEAR_GOAL_EVENT_ID && id !== endingEventId)
      let record = fileEvents.reduce(markEventSeen, save.state.record)
      if ([playback.eventId, ...viewedEventIds].some(opensSeasonGoalWindow)) record = { ...record, yearGoalShown: true }
      const applied = applySeasonEventRewards({ ...save.state, record }, rewards, playback.eventId, random)
      const next: SeasonSave = { ...save, state: applied.state }
      commit(next)
      if (rewards.some((reward) => reward.kind === 10)) {
        gainGamePoint(applied.gamePoint)
        // 0x8c6e4 `0x22c7d(v, 모드)` — 획득 GP 통계
        recordStat?.({ kind: 'G획득', mode: SEASON_STAT_MODE, amount: applied.gamePoint })
      }
      if (applied.event100Awarded) updateGlobals(withEvent100Awarded)
      // 선택지가 번호로 부른 마지막 이벤트 다음부터 이어 훑는다 (0xae170)
      const lastCalled = viewedEventIds[viewedEventIds.length - 1]
      if (lastCalled !== undefined && lastCalled !== playback.eventId) {
        atoms.set(eventCursorAtom, cursorAfterCalling(atoms.get(eventCursorAtom), lastCalled))
      }
      const goalRecordOf = recordSourceNow()
      const followUp = seasonEventFollowUpOf(playback.eventId, () =>
        seasonGoalResultEventId(
          achievedSeasonGoalCount(
            applied.state.record.yearIndex,
            seasonGoalInputOf({
              state: applied.state,
              league: next.league,
              roster: next.roster,
              playerStats: next.playerStats ?? EMPTY_LEAGUE_PLAYER_STATS,
              series: next.series ?? null,
              ...(goalRecordOf === undefined ? {} : { recordOf: goalRecordOf }),
              // 392 는 포스트시즌 첫날 — 마지막 정규 경기 날 넣은 마투수가 내 팀 레코드에 남아 있다 (0xa3764, U-105 r163)
              recordAces: next.recordAces?.[applied.state.record.teamId],
            }),
          ),
        ),
      )
      // 실행기 끝 0x8d134~0x8d19c: 370 · 371 은 0x8b04c, 376 은 0x8b370 이 결과 이벤트를 고른다(시즌 갈래)
      const awardFollowUp = seasonAwardFollowUpOf(playback.eventId, next, goalRecordOf, atoms.get(seasonMvpKindAtom))
      if (awardFollowUp !== null) return startEvent(awardFollowUp, playback.returnScene)
      if (followUp !== null) return startEvent(followUp, playback.returnScene)
      atoms.set(eventPlaybackAtom, null)
      atoms.set(sceneAtom, playback.returnScene)
    },
    [atoms, commit, eventPlayback, gainGamePoint, random, recordSourceNow, recordStat, save, startEvent, updateGlobals],
  )
  /**
   * 보상 명령 하나를 그 자리에서 준다 — 0x8c460 모드 2 갈래(`applySeasonEventRewards`). 이벤트 번호는 그 명령이 든 이벤트다
   * (연차 보정 0x8d508 · 이벤트 100 의 전역 +0xbe 가 지금 이벤트를 본다). G 는 지갑으로 · 0x8c6e4 `0x22c7d(v, 모드)` 통계.
   *
   * **본 표시 · 이어하기 자리 · 저장** — 0x8c460 의 끝(0x8cbe0~0x8cd5e)은 모드 2 · 3 · 4 공용이다(직접 떴다):
   * ```
   * 8cbe0  [mgr+0xa] == 0(파일 이벤트) → 0xacf49(지금 이벤트) 본 표시
   * 8cbfa  지금 이벤트 trigger 2~6 이면 SR+4 = 1      ; s_event 는 모두 trigger 0 이라 시즌에서는 안 탄다
   * 8cc1a  0x8b0e4 — 떠나온 이벤트 줄마다 본 표시 → 0x1fded · 0x22755(저장, 1)
   *        (그 안 0x8b12c 의 [[mgr+0xb4]+0x174] == 0x70|0x71 갈래는 나리 외출 상태 번호라 시즌 상태(0xc9~)와 안 겹친다)
   * 8ccc8  시즌(0x7b999 참) — 이벤트 번호로 SR+0x50(phase)을 고친다 (`rewardResumePatchOf(…, '시즌')`)
   * 8cd44  0x1fded · 0x22755(저장, 1) · 0x1f1b9
   * ```
   * 곧 시즌 끝 사슬의 결과 이벤트(393~396 · 373 · 375 · 379 · 401~403)가 보상을 주면 phase 가 다음 단계로 넘어가 저장된다 —
   * 보상 창에서 끄고 다시 들어와도 진입 분기 0xcb 가 그 결과 이벤트를 다시 틀지 않는다(보상이 겹치지 않는다).
   * 연초 목표 내장 이벤트(번호 0, mgr+0xa ≠ 0)는 본 표시를 안 한다. 끝(`finishSeasonEvent`)에서 다시 켜도 같은 값이다.
   */
  const giveSeasonEventReward = useCallback(
    (rewards: readonly SeasonEventReward[], eventId: number, viewedEventIds: readonly number[] = [eventId]) => {
      const current = atoms.get(saveAtom)
      if (current === null) return
      const applied = applySeasonEventRewards(current.state, rewards, eventId, random)
      const seen = [eventId, ...viewedEventIds].filter((id) => id !== YEAR_GOAL_EVENT_ID).reduce(markEventSeen, applied.state.record)
      const patch = rewardResumePatchOf(eventId, '시즌')
      const record = patch === null || seen.phase === patch.resumeCode ? seen : { ...seen, phase: patch.resumeCode }
      commit({ ...current, state: { ...applied.state, record } })
      if (rewards.some((reward) => reward.kind === 10)) {
        gainGamePoint(applied.gamePoint)
        recordStat?.({ kind: 'G획득', mode: SEASON_STAT_MODE, amount: applied.gamePoint })
      }
      if (applied.event100Awarded) updateGlobals(withEvent100Awarded)
    },
    [atoms, commit, gainGamePoint, random, recordStat, updateGlobals],
  )
  return { awardLeagueFirst, finishSeason, finishSeasonEvent, giveSeasonEventReward }
}
