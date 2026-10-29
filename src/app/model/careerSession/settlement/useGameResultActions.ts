import { isManagementCycleOpen, isSeasonFinished, type PlayerCareer } from '@/entities/career/model/playerCareer'
import { awardTitles } from '@/entities/career/model/titles'
import { entersYearEndChainInPostseason } from '@/entities/career/model/postseasonFlow'
import { leagueDayCounterOf } from '@/entities/career/model/leagueGameSetup'
import { streakEventOf } from '@/entities/career/model/gameEvaluation'
import { applyEventRewards, type EventReward } from '@/entities/story/model/eventReward'
import { gameResultSoundIdOf } from '@/features/play-game/model/gameSounds'
import { playSoundIds } from '@/app/model/useSound'
import { type CareerScope, useCareerValue } from '@/app/model/careerSession/atoms/careerScope'
import { rawCareerAtom } from '@/app/model/careerSession/atoms/careerAtoms'
import { evaluationRewardsAtom } from '@/app/model/careerSession/atoms/uiAtoms'
import { useShownCareer } from '@/app/model/careerSession/state/useShownCareer'
import { useMatchPrepare } from '@/app/model/careerSession/nextGame/useMatchPrepare'
import { seasonFlowOf } from '@/app/model/careerSession/seasonEnd/seasonFlow'

/** 116 → 114 평가 이벤트의 보상 명령과 이미 준 몫 (`evaluationRewardsAtom`) */
interface HeldEvaluationRewards {
  readonly rewards: readonly EventReward[]
  readonly given: number
}

/**
 * 116 → 114: 0x8a6fc 가 쌓은 내장 이벤트를 114 가 틀며 보상 명령(연속 기록 평판 · 슬럼프 스킬)을 먹고, 114 진입 0x11d00 이
 * S+0x50 = 2 → 3 으로 둔다(웹 null — 포스트시즌 g == 0 의 0xb 는 136 진입이 다시 쓴다). 창이 선 명령은 이미 줬다
 * (`giveEvaluationRewards`) — 남은 몫만
 */
function careerAfterEvaluationOf(rawCareer: PlayerCareer, held: HeldEvaluationRewards | null): PlayerCareer {
  if (held !== null) return { ...applyEventRewards(rawCareer, held.rewards.slice(held.given)), seasonEndState: null }
  if (rawCareer.seasonEndState === 116) return { ...streakEventOf(rawCareer).apply(rawCareer), seasonEndState: null }
  return rawCareer
}

/**
 * 이번 창까지 줄 평가 보상 명령 — 이미 준 몫(`given`) 뒤로 `count` 까지. 116 을 지난 커리어가 아니거나 더 줄 것이 없으면 null
 */
function evaluationRewardGrantOf(
  rawCareer: PlayerCareer,
  held: HeldEvaluationRewards | null,
  shownRewards: readonly EventReward[] | undefined,
  count: number,
): HeldEvaluationRewards | null {
  if (held !== null) return count <= held.given ? null : held
  if (rawCareer.seasonEndState !== 116 || count <= 0) return null
  return { rewards: shownRewards ?? streakEventOf(rawCareer).rewards, given: 0 }
}

/** 경기 결과 화면(정산 0x19) · 116 경기 뒤 평가 · 대회 경기 결과 (그림마다 새 함수 — 옛 꼴 그대로) */
export function useGameResultActions(scope: CareerScope) {
  const { atoms, audio, screen, setScreen } = scope
  const career = useShownCareer(scope)
  const rawCareer = useCareerValue(atoms, rawCareerAtom)
  const { enterNextGameStandings } = useMatchPrepare(scope)
  const { enterGameEvaluationScreen, enterYearEndChain, enterPostseason } = seasonFlowOf(scope)

  /**
   * 경기 뒤 평가 116 의 끝(0x12b74~0x12b94) — S+0xb4(포스트시즌 중) ≠ 0 이면 **S+0xb2(= L+0x32) == 0 → [114 → 136],
   * 아니면 [114 → 128]** 이다. 관리 주기·중간평가를 안 탄다 (R9 116절).
   *   - 45번째 경기: 하루 끝 0xb818c 가 대진 0xb80a8 을 열며 L+0x32 = 0 → 136(392 목표 평가) 사슬.
   *   - 시리즈가 끝난 내 경기: 0xb76dc 의 0xb7724 가 L+0x32 = −1(b777a), 곧이어 하루 끝 0xb818c(0x4f29c)가 +1 → 0 이라
   *     **136 부터 사슬을 다시 돈다.** 136 진입 0x10bb0 은 0x8bdc9(392) 를 그대로 부르고, 0x8bdc8 → 0xae170 은
   *     레코드를 번호로 찾아 틀 뿐 본 표시를 보지 않는다 — 392 → 130(370) → 131(375) 가 보상째 다시 나오고 128 로 온다.
   *     원본 버그(B-05, 미션·대결 같은 반복 가드가 없는 자리다) — 고친 길(기본)은 대진이 막 열린 때만 사슬로 간다.
   *   - 그 밖 포스트시즌 경기: 128.
   *   116 끝은 0xbcb49(0x88 = 136) · 0xbcb49(0x72 = 114) 를 바로 예약한다(12b8c~12bbe) — 사이에 시즌 요약 화면이 없다.
   */
  const leaveEvaluation = (next: PlayerCareer) => {
    if (next.postseason !== null) {
      // B-05 고침이면 시리즈 끝(대진이 막 열린 때 말고)은 사슬을 다시 안 틀고 128 로 (`entersYearEndChainInPostseason`)
      if (leagueDayCounterOf(next) === 0 && entersYearEndChainInPostseason(next.postseason)) return enterYearEndChain(next)
      return enterPostseason(next)
    }
    if (isSeasonFinished(next)) return enterYearEndChain(next)
    // 22경기 뒤 중간 성적표 117 은 여기가 아니라 [114 → 105] 뒤 105 진입 곁가지(0x11910 11bda)가 세운다 — 22 는 짝수라 관리 주기다
    if (isManagementCycleOpen(next)) return setScreen({ kind: '관리' })
    // 관리 주기가 아니면 116 의 끝(0x12bb0)이 [114 → 109] 로 보낸다 — 이전 상태가 105 가 아니라 취소가 안 먹는다
    enterNextGameStandings(false)
  }

  return {
    /**
     * 정산 상태 0x19 진입 — 0x4ea0c 끝 4f41a~4f544: 0x4a350(이긴 칸이 사람 팀) ≠ 0 이면 31, 아니면 32 를 예약한다(무승부는 0xb6a0c 가
     * 측 0 을 이긴 칸으로 본다 — 선공 31 · 후공 32). 대회 경기도 같은 정산을 지난다
     */
    enterGameSettlement: () => {
      if (screen.kind !== '경기결과' && screen.kind !== '대회경기결과') return
      if (screen.settlementPlayerSide === undefined) return
      playSoundIds(audio, [gameResultSoundIdOf(screen.summary.result, screen.settlementPlayerSide)])
    },

    /**
     * 정산 판을 나갔다 — 키 0x407f0 의 40980~4098c `0xbfbac(+0x70, 0x3f3)`. 경기 장면 0x104 가 내려가고 나리 장면 0x106 이 서서
     * 상태 100 `0x1c154` 가 S+0x50 == 2(정산 0x4ea0c 4f03a 가 쓴 값)로 116 을 띄운다(1c26a → 진입 0x1278c)
     */
    leaveGameSettlement: () => {
      if (screen.kind !== '경기결과') return
      const { newTitles, evaluation, streakNotices, streakRewards } = screen
      enterGameEvaluationScreen(
        streakRewards === undefined ? { newTitles, evaluation, streakNotices } : { newTitles, evaluation, streakNotices, streakRewards },
      )
    },

    /** 116 의 칭호 39 팝업 키 0x1b1e4 — 비트 · 곧바로 장착(+0x1c4) · 저장 (관리 화면 `confirmTitle` 과 같은 콜백) */
    confirmGameResultTitle: () => {
      if (career === null || screen.kind !== '경기평가') return
      const title = screen.newTitles[0]
      if (title === undefined || career.titleIds.includes(title)) return
      atoms.set(rawCareerAtom, awardTitles(career, [title]))
    },

    /**
     * 114 평가 이벤트의 보상 명령 창이 섰다 — 0x8c460 이 그 명령의 보상을 주고 끝에서 저장한다(0x8b0e4 · 0x8cd44 → 0x22755). 114 진입
     * 0x11d00 이 S+0x50 = 2 → 3(포스트시즌 g == 0 이면 0xb — 웹 null, 136 진입이 다시 쓴다)으로 둔 뒤라 그 저장부터 이어하기가 116 을
     * 다시 안 띄운다 — B-28 원본 길의 카운터 겹쳐 쌓임도 그 뒤로는 없다(Q-23). `count` 는 이제까지 준 명령 수
     */
    giveEvaluationRewards: (count: number) => {
      if (rawCareer === null || screen.kind !== '경기평가') return
      const grant = evaluationRewardGrantOf(rawCareer, atoms.get(evaluationRewardsAtom), screen.streakRewards, count)
      if (grant === null) return
      atoms.set(evaluationRewardsAtom, { rewards: grant.rewards, given: count })
      atoms.set(rawCareerAtom, { ...applyEventRewards(rawCareer, grant.rewards.slice(grant.given, count)), seasonEndState: null })
    },

    confirmGameResult: () => {
      if (rawCareer === null) return
      const held = atoms.get(evaluationRewardsAtom)
      atoms.set(evaluationRewardsAtom, null)
      const next = careerAfterEvaluationOf(rawCareer, held)
      atoms.set(rawCareerAtom, next)
      leaveEvaluation(next)
    },

    /**
     * 대회 경기 결과 화면 [확인] — 정산 0x19 의 OK 가 나리 장면 0x106 을 새로 세우고 상태 100 `0x1c154` 가 S+0x12c 로 134 대진판에
     * 돌려보낸다(1c348~1c358). 134 진입 0x19f30 은 히든 팀을 열고(대한민국 · 우승이면 결승 상대) 대진판을 그린다.
     */
    confirmCupGameResult: () => {
      if (screen.kind !== '대회경기결과') return
      setScreen({ kind: '국가대항전', cup: screen.cup })
    },
  }
}
