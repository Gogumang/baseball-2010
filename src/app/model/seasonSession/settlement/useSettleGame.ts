import { useCallback } from 'react'
import type { TeamGameSummary } from '@/features/play-team-game/model/teamGameFlow'
import { setLiveGameInningIndex, setLiveGameSides, liveGameSidesOf } from '@/shared/lib/liveGameState/liveGameState'
import { applySeasonBurstRewards } from '@/entities/season-mode/model/seasonRewards'
import { lapPlayClock } from '@/entities/collection/model/playClock'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { clearRepeatableSeen, tickAfterAnyGame, START_SEASON_EVENT_CURSOR } from '@/entities/season-mode/model/seasonEventFlow'
import { seasonHumanWonOf, seasonGameIsEvaluated, evaluateSeasonGame, applySeasonGameEvaluation } from '@/entities/season-mode/model/seasonEvaluation'
import { advancePostseason, recordLeagueResult } from '@/entities/league/model/league'
import { EMPTY_LEAGUE_PLAYER_STATS, recordLeagueStolenBases, recordLeaguePlateAppearances } from '@/entities/league/model/leaguePlayerStats'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { playLeagueDay } from '@/entities/league/model/leagueDay'
import { postseasonDayOf } from '@/app/model/seasonSession/awards/seasonAwards'
import { NO_CHAMPION, SEASON_STAT_MODE, seasonEvaluationJingleIdOf } from '@/app/model/seasonSession/constants/seasonConstants'
import { seasonAbilityContextOf } from '@/app/model/seasonSession/game/pitcherOrder'
import {
  humanGameRecordAcesOf,
  recordSeasonHumanGamePitchers,
  recordUngatedSeasonRecords,
  seasonRecordAcesAfterGame,
} from '@/app/model/seasonSession/records/humanGameRecords'
import { cpuLeagueRecordOf } from '@/app/model/seasonSession/roster/roster'
import type { SeasonSave, SettledSeasonGame } from '@/app/model/seasonSession/save/seasonSave'
import { withDayEndRecovery, withGameEndStamina } from '@/app/model/seasonSession/stamina/stamina'
import { cupSettledSaveOf, regularSeasonSettledSaveOf } from '@/app/model/seasonSession/settlement/settledSaves'
import type { EntryEditActionsContext } from '@/app/model/seasonSession/nextGame/useEntryEditActions'

/** `useSeasonSession` 몸통 문장 102~102 을 그대로 옮겼다 (r346) — 부르는 차례 · 훅 차례는 `useSeasonSession` 그대로 */
export function useSettleGame(ctx: EntryEditActionsContext) {
  const { latestSave, gameOptions, gameKind, gainGamePoint, recordStat, eventCursor, newPlayerFlag, freshScene, ownRotationShift, commit } = ctx
  const { random, onRegularSeasonWin, aceLevels } = ctx
  /**
   * 경기가 끝났다 — 원본 차례 그대로 정산한다:
   * 내 경기를 전적에 넣고, 같은 날 나머지 네 경기를 돌리고(0xc2a48 — 칸·명단 엇갈림 포함, `cpuGameSidesOf`),
   * 선수 기록표에 **양 팀 타석**을 쌓고(0xa8024), 평가(0xa719c)를 얹은 뒤 관중수입(0xe9)으로 간다.
   * 평가는 **정규시즌 경기만** 받는다 — 포스트시즌·국가대항전은 원본 0x4ea0c 가 건너뛴다.
   */
  const settleGame = useCallback(
    (summary: TeamGameSummary): SettledSeasonGame | null => {
      const latest = latestSave.current
      if (latest === null) return null
      // 전역 경기 상태 +0x6b 에 이 경기 끝 이닝이 남는다(0xb6b6c — 정규·포스트시즌·국가대항전 모두) (`liveGameState`)
      setLiveGameInningIndex(summary.inningsPlayed - 1)
      // 측별 팀 +0x28(0x6548 의 0xb6bd4) · 점수 +0x7e 도 남는다 — 0xd9 상세의 스킬 14 갈래(0xb5a28~)가 본다
      const playerSide = summary.playerSide ?? gameOptions?.playerSide
      if (playerSide !== undefined) setLiveGameSides(liveGameSidesOf(summary, { ...summary, playerSide }))
      // 0x4f3d6 — 같은 진입이 +0x4c+모드(+0x4e)를 0 으로 쓰고 0x1fded · 0x22755 · 0x1f1b9 로 저장한다. 정산과 한 커밋이다
      const savedBefore: SeasonSave = { ...latest, isGameInProgress: false, gameSave: null }
      // 돌발미션 보상·페널티 (0x8e34c 모드 2) — 원본은 판정이 난 경기 중에 SR·팀 사기에 바로 더하므로 평가보다 앞이다.
      // 요약이 경기 중 `resolveBurst` 의 deltas 를 판정 차례대로 싣고 온다(`burstRewardDeltas`)
      const burstDeltas = summary.burstRewardDeltas ?? []
      // 국가대항전 중 사기(종류 1)는 리그 칸이 아니라 상대국 슬롯 +0x934 에 쌓인다(원본 버그 — `applySeasonBurstRewards`)
      const afterBurst = applySeasonBurstRewards(savedBefore.state, burstDeltas, gameKind === '국가대항전')
      const current: SeasonSave = afterBurst === savedBefore.state ? savedBefore : { ...savedBefore, state: afterBurst }
      const { record } = current.state
      const opponent = summary.opponentTeamId

      // 경기 끝 0x4ea0c 는 모드가 5·6(미션)이 아니면 **갈래(정규·포스트시즌·국가대항전)를 가르기 전에**
      // 기록 달성 G 합 [scene+0x17f4] 를 저장 G(+0x64)에 더하고(4ec5a, 99999 상한) 0x4ec82 `0x22c7d(합, 모드 2)` 로
      // 획득 GP 통계에 적는다. 합은 요약이 싣고 온다(fc7f196 — 30G 자동진행 뒤 타석도 기록을 쌓는다, R15 10-3)
      const earned = summary.gamePoints ?? 0
      if (earned !== 0) gainGamePoint(earned)
      recordStat?.({ kind: 'G획득', mode: SEASON_STAT_MODE, amount: earned })
      // 이어서 0x4ec8a `0x22e10` — 이번 경기 기록달성 횟수(0x1fce0, 모드 2 저장+0x8f0)를 통계 +4+n 누계에 더한다
      recordStat?.({ kind: '기록달성', recordIds: summary.recordIds ?? [] })
      // 0x4ea0c 끝 0x4f54a `0x4e8b0` — 지난 시간을 칸 3(시즌) 플레이 시간에 (0x22efc)
      recordStat?.({ kind: '플레이시간', mode: SEASON_STAT_MODE, elapsed: lapPlayClock() })

      // 경기 중 `0xa755c` 가 올린 평판 16칸 — 원본은 경기 장면이 SR+0x1a0 을 직접 올리므로
      // **갈래와 상관없이** 레코드에 남는다 (S4 2b·6절). 웹은 요약이 싣고 와서 여기서 꽂는다.
      //
      // 경기 끝 꼬리 4f374~4f3b2 — 갈래와 상관없이 SR+0x54(목표점 보기)·SR+0x7c(질병 쿨다운)를 하나씩 줄인다.
      // 그 뒤 장면 0x105 를 **새로 만든다**(0x3b14): 반복 이벤트(490)의 본 비트를 지우고(0x8ce94) 이벤트 관리자
      // (커서)와 새 선수 플래그(this+0xf9)도 새로 선다.
      //
      // 4f15a~4f19a — 모드 2 경기마다 SR+0x1bd = 내 칸 점수 · SR+0x1be = 상대 칸 점수(바이트, 0xe9 기록 줄이 s8 로 읽는다)
      const played: SeasonRecord = clearRepeatableSeen(
        tickAfterAnyGame({
          ...record,
          gameRecord: summary.gameRecord,
          lastGameScore: (summary.ourScore << 24) >> 24,
          lastGameConceded: (summary.opponentScore << 24) >> 24,
        }),
      )
      eventCursor.current = START_SEASON_EVENT_CURSOR
      newPlayerFlag.current = false
      freshScene.current = true

      // 승패는 원본 셈 `0xb69c8`·`0x4f072` 로 다시 낸다 — 이긴 칸 = R(1) > R(0) ? 1 : 0 이라
      // **동점이면 선공(칸 0) 쪽이 이긴다**. 요약의 `won`(내 점수 > 상대 점수)은 동점을 패로 본다.
      // 원본 시즌 경기는 동점으로 끝나지 않는다(경기 끝 판정 0xb68fc 가 동점이면 끝을 안 낸다 — E 3d ·
      // `seasonHumanWonOf` 주석). 웹 경기도 연장 상한이 없어(`gameState`) 같다 — 비교식만 원본 모양 그대로 둔다.
      // 사람 칸은 이 경기 옵션의 `playerSide` 다 (`state[0x31 + 칸] == 0`)
      const tied = summary.ourScore === summary.opponentScore
      const won = gameOptions === null ? summary.won : seasonHumanWonOf(summary.ourScore, summary.opponentScore, gameOptions.playerSide)

      // 포스트시즌·국가대항전은 리그 전적·수입 정산도, **평가 0xa719c 도** 타지 않는다.
      // 원본 경기 끝 0x4ea0c 가 L+0xac(4f216)·L+0x34(4f268)이면 0x4f274 의 평가 호출을 건너뛴다
      // (`seasonGameIsEvaluated` 주석). 그래서 이 두 갈래에서 찬 16칸은 읽히지 않고 다음 경기 직전에 지워진다.
      const stage = { nationalCup: gameKind === '국가대항전', postseason: gameKind === '포스트시즌' }
      if (!seasonGameIsEvaluated(stage)) {
        if (stage.postseason) {
          const series = current.series ?? null
          if (series === null) return null
          const winner = won ? record.teamId : opponent
          // 4f268 → 4f29a 0xb818c(포스트시즌 갈래는 스태미나를 안 건드린다) → 4f2bc 열 팀 +20%.
          // CPU 끼리 경기 0xc2760 은 여기서 돌지 않는다 — 부르는 곳은 결산 0xef 키 0x9dc8(9eba) 하나뿐이라 정산 → 장면 0x105
          // 새로 세우기(팁 rand(0, 73)) → 0xef 진입 → 사람이 키를 눌렀을 때다(`continuePostseason`). 그때 회복이 **끝난** 이 표로
          // 서고 깎인 값이 그대로 남는다(0xc2760 의 하루 끝 0xb818c 포스트시즌 갈래는 회복이 없고, 0xb617c 는 0x4ea0c 에서만 불린다)
          const rested = withDayEndRecovery(withGameEndStamina(current, summary, ownRotationShift))
          const advanced = advancePostseason(series, winner)
          commit({
            ...rested,
            // 포스트시즌도 0xdd 진입이 두 팀 시즌 레코드에 마선수를 넣는다(L+0x34 를 안 본다 — 66ae 는 S+0x12c 만) (U-105 r154)
            recordAces: seasonRecordAcesAfterGame(rested.recordAces, humanGameRecordAcesOf(gameOptions, summary, record.teamId)),
            // 사사구 +0x2a(정산 꼬리 a8b04~a8bee) · 실책 +0x2e(그림 0x43278)는 게이트 0xa56dc 밖이라 포스트시즌에도 쌓인다
            playerStats: recordUngatedSeasonRecords(current.playerStats ?? EMPTY_LEAGUE_PLAYER_STATS, summary),
            series: advanced,
            state: {
              ...current.state,
              record: { ...played, games: postseasonDayOf(advanced), postseasonChampion: advanced.champion ?? NO_CHAMPION },
            },
          })
          return { next: SEASON_SCENE_STATE.시즌결산, jingle: null }
        }
        const cup = current.cup ?? null
        if (cup === null) return null
        // 내 쪽은 시즌 팀(SR[1], 0~9)이 아니라 **경기에 들어간 대한민국(10)** 이다 — 0x6548 국가대항전
        // 가지(65e2 `cmp r5,#0xa`)가 경기[0x28+side] 에 10 을 꽂았고, 결과 장면 0x4ea0c 는 그 경기 팀으로
        // 0xb76dc/0xb77e0 을 부른다. 시즌 팀 번호를 넘기면 참가국 표(10~13)에 없어 대한민국 승패가 안 쌓이고
        // 결승을 이겨도 우승국(L+0xc4)이 15 로 남았다. 커리어 `finishCupGame` 과 같이 요약의 팀 번호를 쓴다
        const winner = won ? summary.ourTeamId : opponent
        const loser = won ? opponent : summary.ourTeamId
        // 같은 날 CPU 경기 두 나라는 사람 경기가 깎아 둔 상대국 슬롯 레코드(base+0x934)의 투수 +0x2c 에서 선다 (701a7a9) —
        // 요약의 상대 투수 끝 스태미나(표 칸 차례)가 그 값이다
        // 몸통에서 그대로 떼어 냈다(r346) — 커밋할 저장 꼴만 `cupSettledSaveOf` 로 (굴림 `advanceNationalCupDay` 는 그 안에서 같은 자리에 돈다)
        commit(cupSettledSaveOf(current, cup, winner, loser, random, summary, opponent, burstDeltas, played))
        return { next: SEASON_SCENE_STATE.국가대항전, jingle: null }
      }

      // 4f1a2~4f212 — 모드 2 이고 L+0x34 · L+0xac 가 0(이 갈래)이고 이겼으면([sp+0x50]) 0x9f6f0 → +0xbf > 99 면 히든 45.
      // 평가 0x4f274 보다 앞이다
      if (won) onRegularSeasonWin?.()
      const afterMyGame = won
        ? recordLeagueResult(current.league, record.teamId, opponent)
        : recordLeagueResult(current.league, opponent, record.teamId)
      // 내 경기의 끝 스태미나를 되적고 → 같은 날 CPU 경기 0xc2a48 이 그 표로 치러 깎고 → 하루 끝 4f2bc 열 팀 +20%
      const afterGameStamina = withGameEndStamina(current, summary, ownRotationShift)
      const day = playLeagueDay(
        afterMyGame,
        record.games,
        record.teamId,
        random,
        // 투수 줄도 같은 정산 0xa8024 · 경기 끝 0xa7de8 이 쌓는다 — 0xa56dc 모드 2 갈래(0xa56fa)는 포스트시즌·국가대항전이면
        // 거짓이라 정규시즌 경기만이다(이 갈래가 곧 정규시즌이다). 요약 `leaguePitchers` 는 양 팀 표 칸으로 싣고 온다
        recordUngatedSeasonRecords(
          recordSeasonHumanGamePitchers(
            // 도루 +0x2c 도 같은 정산 0xa8024 가 쌓는다(도루 판 종류 5) — 같은 정규시즌 갈래
            recordLeagueStolenBases(
              recordLeaguePlateAppearances(current.playerStats ?? EMPTY_LEAGUE_PLAYER_STATS, summary.leaguePlateAppearances),
              summary.leagueStolenBases ?? [],
            ),
            summary.leaguePitchers,
          ),
          summary,
        ),
        afterGameStamina.cpuPitcherStaminas,
        aceLevels,
        // 사람 경기 두 팀의 로테이션 한 칸(0x6548 670e~673e)은 여기서 리그 차례에 넣는다 — 선발은 `optionsFor` 가 미리 셈했다
        true,
        seasonAbilityContextOf(current.state),
        // 트레이드로 바뀐 CPU 팀은 시즌 저장의 레코드로 선다 (0xc239c → 0xb8680 → 0x1f570)
        (team) => cpuLeagueRecordOf(current, team),
      )
      const rested = withDayEndRecovery({ ...afterGameStamina, cpuPitcherStaminas: day.pitcherStaminas })

      // 평가가 위에서 꽂은 16칸(played.gameRecord)을 읽는다. 원본 차례는 내 경기 전적 → 평가 →
      // 나머지 네 경기 → 하루 끝이지만, 평가는 리그를 읽지 않아 웹처럼 하루를 먼저 돌려도 값이 같다.
      const evaluation = evaluateSeasonGame(played, {
        myRuns: summary.ourScore,
        opponentRuns: summary.opponentScore,
        won,
        tied,
        // 완투 두 칸이 이제 실제로 채워진다 — 인기도와 평판이 서로 다른 이닝 칸을 본다
        popularityCompleteGame: summary.popularityCompleteGame,
        reputationCompleteGame: summary.reputationCompleteGame,
        opponentTeamId: opponent,
      })
      const evaluated = applySeasonGameEvaluation({ ...current.state, record: played }, evaluation)

      // 몸통에서 그대로 떼어 냈다(r346) — 커밋할 저장 꼴만 `regularSeasonSettledSaveOf` 로
      commit(regularSeasonSettledSaveOf(rested, day, gameOptions, summary, record, evaluated))
      // 관중수입 창(0xe9)이 뜨면서 나는 평가 징글 36·37·38 (0xdec4/0xdede) — 창은 결과 화면 확인 뒤에 선다
      return { next: SEASON_SCENE_STATE.관중수입, jingle: seasonEvaluationJingleIdOf(evaluation.popularityChange) }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
    [aceLevels, commit, gainGamePoint, gameKind, gameOptions, onRegularSeasonWin, ownRotationShift, random, recordStat],
  )
  return { settleGame }
}

/** `useSettleGame` 까지 선 값 */
export type SettleGameContext = EntryEditActionsContext & ReturnType<typeof useSettleGame>
