import { useCallback } from 'react'
import { isMyTurn } from '@/entities/league/model/seasonEnd'
import { postseasonSideOf, postseasonStarterSlotOf, postseasonPitcherOrderOf } from '@/entities/league/model/league'
import { runCpuPostseasonWithStamina } from '@/entities/league/model/postseasonPlay'
import { nationalCupSideOf } from '@/entities/national-cup/model/nationalCup'
import type { NationalCupFinish } from '@/entities/national-cup/model/nationalCupFlow'
import { applySeasonReward } from '@/entities/season-mode/model/seasonRewards'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { SEASON_FINAL_EVENT_ID } from '@/entities/season-mode/model/seasonEventFlow'
import { postseasonDayOf } from '@/app/model/seasonSession/awards/seasonAwards'
import { NO_CHAMPION, SEASON_STAT_MODE } from '@/app/model/seasonSession/constants/seasonConstants'
import { nationalCupOpponentPitcherOrderOf, seasonAbilityContextOf } from '@/app/model/seasonSession/game/pitcherOrder'
import { cpuLeagueRecordOf } from '@/app/model/seasonSession/roster/roster'
import { nextYearOf } from '@/app/model/seasonSession/year/nextYear'
import type { AfterGameActionsContext } from '@/app/model/seasonSession/settlement/useAfterGameActions'

/** `useSeasonSession` 몸통 문장 113~115 을 그대로 옮겼다 (r346) — 부르는 차례 · 훅 차례는 `useSeasonSession` 그대로 */
export function usePostseasonActions(ctx: AfterGameActionsContext) {
  const { save, optionsFor, enterPreGameSquad, random, aceLevels, commit, enterMatchInfo, gainGamePoint, recordStat, startEvent, setScene } = ctx
  /**
   * 결산 화면(0xef)이 포스트시즌을 한 걸음 진행시킨다.
   * 내 팀이 지금 시리즈에 있으면 **사람이 친다**(원본 0xd7 선수단 → 경기),
   * 없으면 내 차례가 오거나 우승이 정해질 때까지 CPU 끼리 돌린다 (0x13da0 → 0xc2760).
   */
  const continuePostseason = useCallback(() => {
    const series = save?.series ?? null
    if (save === null || series === null) return
    const myTeam = save.state.record.teamId
    if (isMyTurn(series, myTeam)) {
      // 포스트시즌 가지 — 윗 시드(대진 칸 0)가 홈이다 (0xb7844 의 리그+0x34 가지)
      const opponent = series.teams[0] === myTeam ? series.teams[1] : series.teams[0]
      const options = optionsFor(opponent, postseasonSideOf(series, myTeam))
      if (options === null) return
      // 날짜 카운터는 시즌 경기 수가 아니라 **이 시리즈의 g**(L+0x32 — 0xb80a8 b811c 0 · 0xb7724 b777a −1 ·
      // 0xb818c b819a +1)이고, 경기 준비 0x6548 의 로테이션(670e~673e)이 g ≠ 0 이면 양 팀 레코드를 한 칸 돌린다.
      // 레코드는 영구로 섞이므로 정규시즌 끝 차례(`baseOrders`)에 앞 시리즈 이월 칸과 g 가 팀마다 얹힌다 — 그 0번을
      // 날짜 칸에 넣는다(`optionsFor` 주석과 같은 방식)
      const postseasonOptions = {
        ...options,
        dayCounter: postseasonStarterSlotOf(series, myTeam),
        opponentDayCounter: postseasonStarterSlotOf(series, opponent),
        opponentPitcherOrder: postseasonPitcherOrderOf(series, opponent),
        // SR+0xb4 — 정산 타자 게이트 0xa56dc 의 모드 2 갈래가 거짓이 된다 (`settlementBatterGateOf`)
        isPostseason: true,
      }
      // 0xef 키: 내 팀이 X/Y 면 this+0x11c = 1 → 0xd7 (P4 4b) — 정규시즌과 같은 경기 전 흐름이다
      return enterPreGameSquad({ kind: '포스트시즌', options: postseasonOptions })
    }
    // 0xc2760 은 CPU 팀 투수 레코드 +0x2c 를 깎기만 한다 — 회복(0xb617c)은 다음 내 경기 끝 0x4ea0c 에서다
    const cpu = runCpuPostseasonWithStamina(series, myTeam, random, save.cpuPitcherStaminas, aceLevels, seasonAbilityContextOf(save.state), (team) =>
      cpuLeagueRecordOf(save, team),
    )
    const advanced = cpu.series
    commit({
      ...save,
      cpuPitcherStaminas: cpu.pitcherStaminas,
      series: advanced,
      state: {
        ...save.state,
        record: { ...save.state.record, games: postseasonDayOf(advanced), postseasonChampion: advanced.champion ?? NO_CHAMPION },
      },
    })
  }, [aceLevels, commit, enterPreGameSquad, optionsFor, random, save])
  /**
   * 국가대항전 한 경기 — 원본대로 **사람이 대표팀을 조작한다** (시즌 221).
   * 대진은 대회 화면이 골라 주고, 끝나면 `finishGame` 이 `advanceNationalCupDay` 로 하루를 넘긴다.
   */
  const playCupGame = useCallback(
    (myTeam: number, opponent: number) => {
      const cup = save?.cup ?? null
      if (save === null || cup === null) return
      // 국가대항전 가지 — 대진 칸 0 이 홈이다. `myTeam` 은 원본 0xb7614 가 고른 대한민국(10)이다
      const options = optionsFor(opponent, nationalCupSideOf(cup, myTeam))
      if (options === null) return
      // 내 팀도 시즌 팀이 아니라 **대한민국(10)** 이다 — 경기 준비 0x6548 의 국가대항전 가지:
      //   65c6 [sp+0x18] = 0xb7614(L,n,0) · 65da [sp+0x14] = 0xb7614(L,n,1)
      //   65e2 cmp r5,#0xa — 칸 0 이 10 이 아니면 둘을 맞바꿈 → [sp+0x18] = 내 팀 = 늘 10
      //   664c 0xb6bd4(경기, 내side, [sp+0x18]) — 경기[0x28+내side] = 10
      // 시즌모드는 대표팀 명단을 안 건드려 팀 10 기본 명단 그대로 친다 (P5 1b·2절, 0x1f9a9 호출 없음)
      //
      // 날짜 카운터도 시즌 경기 수가 아니라 **대회 날짜**다. 경기 준비 0x6548 의 로테이션
      // (670e~673e: `S+0xb2` ≠ 0 이면 양 팀에 0xb8c80 → 0xb5ca8)이 보는 `S+0xb2` = `L+0x32` 를
      // 대회 초기화 0xb7bf0 이 0 으로 놓고(b7c42) 하루 끝 0xb818c 가 1 씩 올린다 = cup.day.
      //
      // 대표팀 명단 (S6 2-2, 직접 떴다) — 대회 중 팀 얻기 0x1f570 은 팀 10 을 슬롯 base+0x918 로,
      // **나머지 팀 전부를 상대국 슬롯 base+0x934 하나로** 돌린다. 두 슬롯을 채우는 곳:
      //   b7c72 0x205c0(g, 모드)         ; 대회 초기화 — memset(+0x918, 0x1c) 뒤 마스터 팀 10 깊은 복사
      //   b7c88 0xb6190(팀10)            ; 투수 스태미나 전원 10000
      //   b7ca4 0x20648(g, 모드, b7614(L, 4, 1))  ; 첫날 상대 = 마스터 팀 복사 → +0x934
      //   b81e0 0xb818c 대회 갈래(L+0xac): L+0x32++ · L+0xad-- · 팀10 스태미나 10000 다시 ·
      //   b8216 0x20648(g, 모드, b7614(L, L+0xad, 1), 그게 10 이면 칸 0)  ; **하루마다 다음 상대를 마스터에서 새로**
      // 대한민국 명단은 저장의 `cupRoster`(+0x918, 대회 초기화에서 표로 채움)라 엔트리 편집이 대회 내내 남는다.
      // 상대국은 매일 마스터에서 새로 덮이므로 웹의 붙박이 표와 같다.
      //
      // 선발 — 로테이션 0xb5ca8 은 **팀 레코드를 제자리에서** 한 칸 당긴다(셈이 아니라 상태다):
      //   대한민국: 대회 첫날 새로 만든 슬롯이 L+0x32 ≠ 0 인 날마다 한 칸씩 → 선발 = cup.day % 4 (확정)
      //   상대국:  매일 마스터에서 새로 덮인 슬롯을 그날 한 번만 돌린다 → 선발 = day 0 이면 0번,
      //            그 뒤로는 **늘 1번** — cup.day % 4 를 따르지 않는다 (확정)
      //   → 상대 칸만 `opponentDayCounter` 로 따로 넘긴다 (0 이면 0번, 1 이면 rotationSlotOf(1) = 1번)
      //
      // 대회는 0xd7 을 안 지나고 0xf4 → 0xdd 로 바로 간다 (키 0x4a18) — 마선수도 안 넣는다(0x6548 66ae)
      enterMatchInfo(
        save,
        {
          kind: '국가대항전',
          options: {
            ...options,
            ourTeamId: myTeam,
            dayCounter: cup.day,
            opponentDayCounter: cup.day === 0 ? 0 : 1,
            opponentPitcherOrder: nationalCupOpponentPitcherOrderOf(cup.day),
            // L+0xad — 경기 준비 0x352e8 모드 2 갈래의 구장 2(풀리그) · 8(결승)
            nationalCupStage: cup.stage,
          },
        },
        null,
      )
    },
    [enterMatchInfo, optionsFor, save],
  )
  /**
   * 대회 끝 — 결과 팝업을 닫으면(`0x896c`) 보상을 넣고(`0x8a56`/`0x8b10`) **곧장 새 해 `0x6e0c`** 다
   * (`0x8b88: bl 0x6e0c`, S6 1-2). 새 해의 리그 초기화가 국가대항전 플래그 `SR+0x12c` 를 함께 지운다.
   */
  const finishCup = useCallback(
    (finish: NationalCupFinish) => {
      if (save === null) return
      const record = applySeasonReward(save.state.record, finish.reward)
      // 우승(SR+0x144 == 10) 갈래 0x8acc~0x8b04 — 전역 +0x64 += 1000(0..99999) → 0x22c7d(전역, 1000, 2) 획득 GP 통계 →
      // 0x1f1e1 통계 저장. 준우승 갈래(0x8b10~)에는 없다 — 보상표의 gamePoint 가 그 차이다
      if (finish.reward.gamePoint > 0) {
        gainGamePoint(finish.reward.gamePoint)
        recordStat?.({ kind: 'G획득', mode: SEASON_STAT_MODE, amount: finish.reward.gamePoint })
      }
      const next = nextYearOf(
        {
          ...save,
          state: { ...save.state, record: { ...record, nationalCupChampion: finish.champion } },
          cup: null,
          cupRoster: null,
          cupPlayerStats: null,
        },
        random,
      )
      commit(next.save)
      // 히든 팀은 여기서 열지 않는다 — 0xf3 갱신 0xe684 가 대진판에 있는 동안 열었다(`openCupHiddenTeams`)
      // 대회 연차(짝수 idx)는 마지막 해(9)가 아니라 엔딩 갈래에 닿지 않지만, 같은 0x6e0c 라 같게 둔다
      if (next.scene === SEASON_SCENE_STATE.엔딩) return startEvent(SEASON_FINAL_EVENT_ID, next.scene)
      setScene(next.scene)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
    [commit, gainGamePoint, random, recordStat, save, startEvent],
  )
  return { continuePostseason, playCupGame, finishCup }
}

/** `usePostseasonActions` 까지 선 값 */
export type PostseasonActionsContext = AfterGameActionsContext & ReturnType<typeof usePostseasonActions>
