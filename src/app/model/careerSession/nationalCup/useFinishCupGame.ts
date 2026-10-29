import { useCallback } from 'react'
import { summaryOf, type GameProgress } from '@/features/play-game/model/gameFlow'
import { gamePointRewardOf, type PlayerCareer } from '@/entities/career/model/playerCareer'
import { nextNariCupDayTeams, recordNariCupGame } from '@/entities/career/model/nariCupTeams'
import { nariCupGameResultOf, settleNariCupGame } from '@/entities/career/model/nariCupGame'
import { nationalCupMatchupOf, type NationalCup } from '@/entities/national-cup/model/nationalCup'
import { advanceNationalCupDay } from '@/entities/national-cup/model/nationalCupPlay'
import { BATTER_LEAGUE_MODE } from '@/entities/collection/model/annalsStats'
import type { CareerScope } from '@/app/model/careerSession/atoms/careerScope'
import { rawCareerAtom } from '@/app/model/careerSession/atoms/careerAtoms'
import { cupGameAtom, stadiumSkyRowAtom } from '@/app/model/careerSession/atoms/gameAtoms'
import { portsMirrorAtom } from '@/app/model/careerSession/atoms/portsAtoms'
import { useSetUpNariScene } from '@/app/model/careerSession/state/useSceneSetUp'
import { leaveLiveGameState, recordSettlementStats } from '@/app/model/careerSession/settlement/settlementSideEffects'

/**
 * 하루 끝 b8216 — 다음 날 사람 경기 상대를 +0xbe0 에 마스터에서 새로 복사. 대회 칸(L+0xa8~ · L+0x32)은 정산 끝 0x4f3c4 가 저장.
 * 대표팀 칸(+0xbc4)에 남는 것 먼저 — +2 사기는 0xb570c b5762 가 마지막으로 덮은 나리 사기(대회 중이라 상대국 칸 값, 상대 칸
 * 덮기와 같은 공이라 `opponentRecordMorale` 과 같은 때). 실책 +0x2e 는 타자편 수비 그림이 상대 야수뿐이라 대표팀 몫이 없다
 */
function withCupDaySettled(current: PlayerCareer, finished: GameProgress, summary: ReturnType<typeof summaryOf>, next: NationalCup): PlayerCareer {
  const settled = { ...settleNariCupGame(current, gamePointRewardOf(summary)), nationalCup: next }
  if (current.nariCupTeams === undefined) return settled
  const recorded = recordNariCupGame(current.nariCupTeams, {
    morale: finished.opponentRecordMorale ?? finished.teamMorale,
    errors: summary.leagueErrors,
  })
  return { ...settled, nariCupTeams: nextNariCupDayTeams(recorded, nationalCupMatchupOf(next)?.opponent ?? null) }
}

/**
 * 국가대항전 사람 경기가 끝났다 — 경기 장면 0x104 의 경기 끝 판(상태 0x18) → [OK] → 상태 0x19 진입 `0x4ea0c`(정산 · 그림
 * 0x4a384) → [OK] → 나리 장면 0x106 상태 100 `0x1c154` → S+0x12c 라 134 대진판. 116 은 안 지난다 — 0x4ea0c 4f03a 가 S+0x50 = 2 를
 * 대회가 아닐 때만 쓰고(대회면 4eb3e 의 3 그대로), 0x1c154 는 S+0x50 == 2 일 때만 116 이다.
 * 정산 차례: 기록 달성 G(4ebaa~4ec90) → 승패 4f072~4f136 → 행동 S+4 = 0(4f156) → 같은 라운드 CPU 경기 `0xc2dac` → 하루 끝
 * `0xb818c`(`advanceNationalCupDay`) → 부상 경기 수 · S+0x54 · S+0x7c(4f344~4f3b2) → 저장 (`settleNariCupGame`).
 * 리그 승패 · 평가 0xa719c(4f216 이 건너뛴다) · 내 시즌 기록(0xa56dc 거짓) · 경기 수 · 칭호는 안 건드린다.
 * 웹 경기 끝 판 · 정산 그림은 정규 경기처럼 결과 화면(`GameResultScreen`) 한 장이다 — [확인]이 134 로 간다(`confirmCupGameResult`).
 */
export function useFinishCupGame(scope: CareerScope): (finished: GameProgress, cup: NationalCup) => void {
  const { atoms, random, recordStat, setScreen } = scope
  const setUpNariScene = useSetUpNariScene(scope)
  return useCallback(
    (finished: GameProgress, cup: NationalCup) => {
      const summary = summaryOf(finished)
      // 0x4ea0c 4f072~4f136 — 후공(측 1) 점수가 더 많을 때만 후공 승, 동점이면 선공(측 0) 승 (`nariCupGameResultOf`)
      const { winner, loser } = nariCupGameResultOf({
        mySide: finished.game.playerSide,
        myTeam: summary.ourTeamId,
        opponentTeam: summary.opponentTeamId,
        myScore: summary.ourScore,
        opponentScore: summary.opponentScore,
      })
      atoms.set(cupGameAtom, null)
      // 경기 장면 0x104 를 지나 나리 장면이 새로 선다 — 장면+0x288 = 0 · 반복 이벤트 · 커서 · mgr+0x304
      setUpNariScene()
      // 대회 경기도 정산 진입 0x4ea0c 를 지난다 — 0x4f3d6 은 모드를 가리지 않고 +0x4c + 모드 = 0
      atoms.get(portsMirrorAtom).current.nariGameSave?.clear()
      // 전역 경기 상태 +0x6b — 대회 경기도 끝 이닝을 남긴다 (측별 팀 · 점수도)
      leaveLiveGameState(finished)
      // 같은 날 CPU 경기 두 나라는 상대국 슬롯 레코드(base+0x934) 하나를 쓴다 — 사람 경기가 깎아 둔 그 레코드의
      // 투수 +0x2c 에서 선다 (701a7a9). 사람 경기 끝 상대 투수 칸별 값을 넘긴다
      // 그 CPU 경기(0xc2dac)의 간이 엔진도 0xb570c b5768 로 두 나라 레코드 +2 에 나리 사기를 쓴다 — 대회 중이라 상대국 칸 +2, 곧 사람
      // 경기 끝의 그 칸(돌발 보상 사기가 쌓인 값, `GameProgress.teamMorale`)이다
      const next = advanceNationalCupDay(
        cup,
        winner,
        loser,
        random,
        summary.pitcherStaminas?.opponent,
        finished.teamMorale === undefined ? undefined : { mode: BATTER_LEAGUE_MODE, nariMorale: finished.teamMorale },
      )
      // 기록 달성 G (4ebaa~4ec7c — 사람 팀 공·수로 거른 기록이라 대회 경기도 쌓인다)
      const gamePointReward = gamePointRewardOf(summary)
      atoms.set(rawCareerAtom, (current) => (current === null ? current : withCupDaySettled(current, finished, summary, next)))
      recordSettlementStats(recordStat, gamePointReward, summary.recordIds ?? [])
      // 승리 31 · 패배 32 징글 — 정규 경기와 같이 정산 0x19 진입에서(`enterGameSettlement`). 116 의 평가 징글은 없다
      setScreen({
        kind: '대회경기결과',
        summary,
        gamePointReward,
        cup: next,
        settlementInning: finished.game.inning,
        settlementPlayerSide: finished.game.playerSide,
        settlementSkyRow: atoms.get(stadiumSkyRowAtom),
      })
    },
    [atoms, random, recordStat, setScreen, setUpNariScene],
  )
}
