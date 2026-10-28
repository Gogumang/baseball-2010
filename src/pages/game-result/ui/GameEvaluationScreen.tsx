import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { setAppTickTimeout } from '@/shared/lib/frameClock/frameClock'
import { RawScreen } from '@/shared/ui'
import { TitleWindow } from '@/widgets/title-window/ui/TitleWindow'
import type { GameEvaluation, StreakNotice } from '@/entities/career/model/gameEvaluation'
import { applyEventRewards } from '@/entities/story/model/eventReward'
import type { EventReward } from '@/entities/story/model/eventReward'
import { rewardNoticeContextOf, rewardNoticeOf } from '@/entities/story/model/rewardNotice'
import { nariRecordLineTextOf } from '@/entities/career/model/playerCareer'
import type { NariRecordLine, PlayerCareer } from '@/entities/career/model/playerCareer'
import { ORIGINAL_USER_EVENTS } from '@/shared/config/original/userEvents'
import { EvaluationEventPlayer } from '@/pages/story/ui/EvaluationEventPlayer'
import { evaluationGaugeDivisorOf } from '@/pages/story/lib/evaluationGauge'
import { batterEvaluationExpressionOf, streakSayExpressionOf } from '@/pages/story/lib/evaluationDialogue'
import { hasHitlessStreak, nariStreakSayOf } from '@/pages/game-result/lib/nariStreakSay'
import { yearGoalWindowValuesOf } from '@/entities/career/model/seasonFlow'
import { leagueDayCounterOf } from '@/entities/career/model/leagueGameSetup'
import { messageGameNumberOf } from '@/pages/management/lib/managementLayout'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

interface GameEvaluationScreenProps {
  /** 116 진입 0x1278c 가 직접 거는 칭호(39 다이너마이트 배트 — 1299e~129c8) — 칭호 팝업 0x1274c(종류 0x78, `TitleWindow`)로 띄운다 */
  readonly newTitles: readonly string[]
  /** 칭호 팝업 키 0x1b1e4 — 비트 · 곧바로 장착 · 저장. 116 진입은 팝업만 걸고 주는 것은 이 키다 */
  readonly onConfirmTitle?: () => void
  /** 116 경기 뒤 평가 — 감독 글 · 변화 글 */
  readonly evaluation: GameEvaluation
  readonly streakNotices?: readonly StreakNotice[]
  /**
   * 0x8a6fc 가 연속 기록 say 뒤에 쌓은 보상 명령(종류 7) 차례 — 평판 합 · 슬럼프 ±18 (`streakEventOf().rewards`). 114 가 명령마다
   * 창(공용 알림 · 스킬 창 0x8e054)을 띄운다. 보상 자체는 [확인](`onContinue` → 114 끝)이 얹는다
   */
  readonly streakRewards?: readonly EventReward[]
  /**
   * 보상 몫을 먹인 선수로 평가 밑그림을 다시 그린다 — 0x8c460 이 창을 띄운 갱신에 보상을 줘 상태판(0x7d34c)의 평판이 그 창부터
   * 새 값이다. 없으면 `underlay` 그대로
   */
  readonly rewardUnderlay?: (career: PlayerCareer) => ReactNode
  /**
   * 116 기록 줄 S+0x1d8 (타수 · 안타 · 타점 · 홈런) — 평가 대사가 이 줄 뒤에 감독 글을 잇는다(`nariRecordLineTextOf`).
   * 포스트시즌 경기 뒤에는 앞 평가 경기의 줄이다. 안 넘기면 감독 글만.
   */
  readonly recordLine?: NariRecordLine
  /** 평가가 반영된 뒤의 선수 — 변화 창의 "현재" 값 */
  readonly career: PlayerCareer
  /** 114 끝 — 116 의 끝(0x12b74~0x12bbe)이 예약해 둔 다음(105 · 109 · 128 · 136) */
  readonly onContinue: () => void
  /** 보상 명령 창이 선 갱신 — 그 몫을 주고 저장한다(0x8c460 끝, Q-23). 인자는 이제까지 준 명령 수 */
  readonly onRewardsGiven?: (givenRewardCount: number) => void
  /**
   * 114 평가 대화(내장 이벤트 0x8a6fc)의 밑그림. 116 그림 0x11e0c 와 대화창 0x8b5ac 가
   * 공 무늬 · 상태판 0x7d34c(gfx, [이벤트+0xb] = 1 — 메시지줄 경기 번호 −1) · 머리띠를 깐다. 부르는 쪽이 넘긴다.
   */
  readonly underlay?: ReactNode
  /**
   * 116 이 선 첫 틀의 그림 — 116 그리기 0x11e0c 는 머리띠 0x7f4ed · 상태판 0x7d34c(gfx, **0**) 뿐이다(앞그림 0x16a34 의 공 무늬 위).
   * 114(평가 이벤트)는 116 진입 끝 12bb6~12bbe 의 0xbcb49(114) 로 **다음 틀**에 들어선다. 안 주면 `underlay` 를 쓴다.
   */
  readonly entryUnderlay?: ReactNode
}

const NO_STREAK_NOTICES: readonly StreakNotice[] = []
const NO_STREAK_REWARDS: readonly EventReward[] = []
/** 보상 알림 글의 모드 — 나리 타자편 4 */
const BATTER_REWARD_MODE = 4
/**
 * 평가 이벤트의 이벤트 번호 자리 — 0x8a6fc 가 짓는 내장 이벤트는 파일 이벤트가 아니라([mgr+0xa] = 1) 연차 보정(393~396)에 안 걸린다
 */
const EVALUATION_EVENT_ID = 0
/** 평가 이벤트 보상(평판 · 스킬)은 0x8beb8 에서 굴리지 않는다(종류 11 질병만 굴린다) */
const NO_ROLL_RANDOM = createSeededRandom(0)

/**
 * 나리 타자편 **116 경기 뒤 평가** — 나리 장면 0x106 상태 116 → 114 가 내장 이벤트 0x8a6fc 를 재생:
 * 명령 1 say(기록 줄 + 감독 글) → 명령 2 system sub 2 변화 창(0x86c90) → (있으면) 명령 3 say(연속 기록) → 끝나면 `onContinue`.
 * 칭호 39 를 막 받았으면 116 진입이 칭호 팝업 0x1274c 를 띄운다.
 *
 * 경기 결과(경기 장면 0x104 의 0x18 · 0x19 — `GameResultScreen`)와는 다른 장면의 상태다: 정산 판을 나간 메시지 0x3f3 이 장면
 * 0x106 을 새로 세우고 상태 100 `0x1c154` 가 116 으로 보낸다(1c26a). 이어하기도 같은 100 → 116 이다. 평가 징글(36~38, 116 진입
 * 12c96~12cc6)은 이 화면을 띄우는 쪽이 낸다.
 */
export function GameEvaluationScreen({
  newTitles,
  onConfirmTitle,
  evaluation,
  streakNotices = NO_STREAK_NOTICES,
  streakRewards = NO_STREAK_REWARDS,
  rewardUnderlay,
  recordLine,
  career: liveCareer,
  onContinue,
  onRewardsGiven,
  underlay,
  entryUnderlay,
}: GameEvaluationScreenProps) {
  // 114 가 보상 명령마다 몫을 주고 저장하므로(Q-23) 세션 선수는 도중에 바뀐다 — 평가 이벤트는 116 이 쌓은 그때 값으로 돈다(0x8a6fc)
  const [career] = useState(liveCareer)
  /**
   * 116 → 114 가 들어섰는가 — 116 진입 0x1278c 는 칭호 팝업 0x1274c 를 건 뒤 끝(12bb6~12bbe)에서 0xbcb49(114) 를 걸 뿐이라,
   * 그 틀은 116 그림(0x11e0c)과 팝업만 그리고 114 진입 0x11d00 · 갱신 0x1c014(이벤트 실행기)는 다음 틀 머리(1ce00)에서 돈다.
   */
  const [isEvaluationEntered, setEvaluationEntered] = useState(false)
  useEffect(() => {
    if (isEvaluationEntered) return undefined
    return setAppTickTimeout(() => setEvaluationEntered(true), 1)
  }, [isEvaluationEntered])
  const [isTitlePopupOpen, setIsTitlePopupOpen] = useState(newTitles.length > 0)
  // 0x86531(gfx, S+7, 사기, S+0x4a, 인기도, S+0x64, 평판) — 116 0x12b08~0x12b70 이 넘기는 차례
  const changeValues = {
    changes: [evaluation.moraleChange, evaluation.popularityChange, evaluation.reputationChange],
    currents: [career.morale, career.popularity, career.reputation],
  } as const
  const title = newTitles[0]
  return (
    <RawScreen>
      {/* 116 이 선 틀 — 116 그림 0x11e0c 만(평가 이벤트 114 는 다음 틀부터) */}
      {!isEvaluationEntered && (entryUnderlay ?? underlay)}
      {isEvaluationEntered && (
        <EvaluationEventPlayer
          underlay={underlay}
          // 0x8bab8 — 이벤트 +0x2cc 의 기록 줄(…홈런!N) 뒤에 감독 글을 이어 한 대사로
          dialogue={`${recordLine === undefined ? '' : nariRecordLineTextOf(recordLine)}${ORIGINAL_USER_EVENTS[evaluation.commentIndex] ?? ''}`}
          dialogueExpression={batterEvaluationExpressionOf(career.reputation, evaluation.popularityChange)}
          changeValues={changeValues}
          goals={yearGoalWindowValuesOf(career)}
          year={career.season}
          // 0x7d120(…, 1) — 막 치른 경기 번호
          game={messageGameNumberOf(leagueDayCounterOf(career), career.postseason !== null, true)}
          streak={nariStreakSayOf(streakNotices, ORIGINAL_USER_EVENTS)}
          streakExpression={streakSayExpressionOf(hasHitlessStreak(streakNotices))}
          gauge={{ popularityChange: evaluation.popularityChange, divisor: evaluationGaugeDivisorOf({ kind: 'batter' }) }}
          // 보상 명령마다 0x8beb8 글 → 창 (모드 4 — 스킬 이름 0x8457c 갈래). 평가 이벤트 보상은 평판 · 스킬뿐이라 굴림이 없다
          rewardNotices={streakRewards.map(
            (reward) => rewardNoticeOf([reward], EVALUATION_EVENT_ID, rewardNoticeContextOf(career, BATTER_REWARD_MODE, NO_ROLL_RANDOM)).notice,
          )}
          {...(rewardUnderlay === undefined
            ? {}
            : { underlayAfterRewards: (given: number) => rewardUnderlay(applyEventRewards(career, streakRewards.slice(0, given))) })}
          {...(onRewardsGiven === undefined ? {} : { onRewardsGiven })}
          onDone={onContinue}
        />
      )}
      {isTitlePopupOpen && title !== undefined && (
        /*
          116 진입 1299e~129c8 — 칭호 39 가 없고 이 경기 홈런 > 3 이면 +0x270 = 39 로 칭호 팝업 0x1274c(종류 0x78)를 건다.
          그리기 0x1afe8 · 키 0x1b1e4 는 관리 화면 칭호 팝업과 같은 창(`TitleWindow`) — 키가 주고 그 자리에서 치운다.
          **밑의 평가 이벤트는 팝업과 함께 돈다** (2026-10-14 직접 뜸): 116 진입은 팝업을 건 뒤 끝(12bb6~12bbe)에서
          0xbcb49(114) 를 걸고, 나리 틀 0x1cdec 는 창이 떠 있어도(0x1d070 0x754f9 참) 상태 키 표 0xcc7e0 만 건너뛰고
          상태 바꿈(0x1ce00) · 진입 · 갱신(0x1d1b2 → 114 0x1c014 — 이벤트 실행기 0x8cf65)· 그리기는 돌린다.
          그래서 다음 틀에 114 가 들어와 명령 1 say 상자가 팝업 밑에서 오르고, 키(114 키 0x13b88 → 0x8b805)는 창이 먹어
          대사는 팝업이 치워진 뒤의 키부터 넘어간다(치우는 그 틀의 키도 0x754f9 가 1 이라 이벤트에 안 간다).
          팝업이 선 첫 틀은 116 그림뿐이고 이벤트는 다음 틀에 선다(`isEvaluationEntered`).
        */
        <div style={{ position: 'absolute', inset: 0, zIndex: 50 }}>
          <TitleWindow title={title} onKey={onConfirmTitle} onClose={() => setIsTitlePopupOpen(false)} />
        </div>
      )}
    </RawScreen>
  )
}
