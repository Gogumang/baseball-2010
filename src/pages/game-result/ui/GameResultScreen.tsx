import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button, MessageBox, RawScreen } from '@/shared/ui'
import { GameEndBoard } from '@/widgets/game-scene/ui/GameEndBoard'
import type { GameEvaluation, StreakNotice } from '@/entities/career/model/gameEvaluation'
import { nariRecordLineTextOf } from '@/entities/career/model/playerCareer'
import type { NariRecordLine, PlayerCareer } from '@/entities/career/model/playerCareer'
import { conditionTextOf } from '@/entities/career/model/titles'
import { ORIGINAL_USER_EVENTS } from '@/shared/config/original/userEvents'
import { EvaluationEventPlayer } from '@/pages/story/ui/EvaluationEventPlayer'
import { evaluationGaugeDivisorOf } from '@/pages/story/lib/evaluationGauge'
import { batterEvaluationExpressionOf, streakSayExpressionOf } from '@/pages/story/lib/evaluationDialogue'
import { hasHitlessStreak, nariStreakSayOf } from '@/pages/game-result/lib/nariStreakSay'
import { yearGoalWindowValuesOf } from '@/entities/career/model/seasonFlow'
import { leagueDayCounterOf } from '@/entities/career/model/leagueGameSetup'
import { messageGameNumberOf } from '@/pages/management/lib/managementLayout'
import type { GameSummary } from '@/entities/game/model/gameSummary'
import type { PlayerSide } from '@/entities/game/model/gameState'
import * as styles from '@/pages/game-result/ui/GameResultScreen.css'
import { BattingStage } from '@/widgets/batting-stage/ui/BattingStage'
import { useSettlementEffectLayers } from '@/widgets/batting-stage/ui/SettlementEffectCanvas'
import { settlementBackdropOffsetAt } from '@/pages/team-game/model/settlementBackdrop'
import { SettlementBoard } from '@/pages/team-game/ui/SettlementBoard'
import { humanVsComputerSidesOf } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import { STARTING_ABILITY } from '@/entities/career/model/playerCareer'
import { DEFAULT_PITCHER_ABILITY } from '@/entities/pitching/model/pitch'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 나리 타자편 — 게임 모드 4 (정산 그리기 0x4a384 는 팀경기와 같은 갈래 0x4a948) */
const BATTER_CAREER_MODE = 4

/**
 * 승·패·세 투수 세 줄의 **이름** — 상태 0x18 결과 판(0x4fe9c)이 그린다.
 *
 * 원본은 경기 상태 state+0x44/0x48(승) · +0x50/0x54(패) · +0x5c/0x60(세) 에
 * "그 순간 마운드에 선 투수" 를 한 점 날 때마다(0xa5c34)·투수 교체 때(0xa60c0) 적어 두고,
 * 경기 끝(0xa7de8)에 셋을 확정한다 (S1-win-loss-save.md 2~4절 확정).
 * 타자편 `gameFlow` 가 득점·교체마다 그 칸을 세어 `GameSummary.pitchersOfRecord` 로 실어 보낸다.
 * `pitcherNames` 를 넘기면 그것이 먼저다. 둘 다 없으면 원본 "측 == 2 = 없음" 처럼 비운다 (R10 5절).
 */
const EMPTY_PITCHER_NAMES: readonly (string | null)[] = [null, null, null]

/** 승·패·세 세 줄에 들어갈 투수 이름. 없으면(측 2 = 없음) 그 줄을 비운다 — R10 5절 */
export interface PitcherOfRecordNames {
  readonly win: string | null
  readonly loss: string | null
  readonly save: string | null
}

interface GameResultScreenProps {
  readonly summary: GameSummary
  /**
   * 승리투수·패전투수·세이브 이름. 안 넘기면 `summary.pitchersOfRecord` 를 쓰고, 그것도 없으면
   * 세 줄 모두 빈 칸이다 (원본도 "없음" 이면 비운다).
   */
  readonly pitcherNames?: PitcherOfRecordNames
  /** [+0x17f4] 이번 경기에 번 G — 정산 진입 0x4ea0c 4ebaa~4ec7c 가 기록 달성 횟수로 센 값 */
  readonly gamePointReward: number
  /**
   * 116 진입 0x1278c 가 직접 주는 칭호(39 다이너마이트 배트 — 1299e~129c8) — 칭호 팝업 0x1274c(종류 0x78)로 띄운다.
   */
  readonly newTitles: readonly string[]
  /**
   * 116 경기 뒤 평가 — 감독 글 · 변화 글 · 연속 기록. 국가대항전 경기는 116 을 안 지나(0x4ea0c 4f03a 가 S+0x50 = 2 를
   * 대회가 아닐 때만 쓴다) 없다 — 그때는 정산 판 [OK] 가 곧장 다음(134 대진판)이다.
   */
  readonly evaluation?: GameEvaluation
  readonly streakNotices?: readonly StreakNotice[]
  /**
   * 116 기록 줄 S+0x1d8 (타수 · 안타 · 타점 · 홈런) — 평가 대사가 이 줄 뒤에 감독 글을 잇는다(`nariRecordLineTextOf`).
   * 포스트시즌 경기 뒤에는 앞 평가 경기의 줄이다. 안 넘기면 감독 글만.
   */
  readonly recordLine?: NariRecordLine
  /** 평가 · 정산이 반영된 뒤의 선수 — 변화 창의 "현재" 값과 정산 판의 보유 G(전역 +0x64, 4ec5a 가 먼저 더한 값) */
  readonly career: PlayerCareer
  readonly onContinue: () => void
  /**
   * 나리 116 평가 대화(114 · 내장 이벤트 0x8a6fc)의 밑그림. 116 그림 0x11e0c 와 대화창 0x8b5ac 가
   * 공 무늬 · 상태판 0x7d34c(gfx, [이벤트+0xb] = 1 — 메시지줄 경기 번호 −1) · 머리띠를 깐다. 부르는 쪽이 넘긴다.
   * 결과 판(0x18 · 0x19 — 경기 장면)이 아니라 평가 단계에만 깐다.
   */
  readonly underlay?: ReactNode
  /**
   * **경기 장면 끝(0x18 → 0x19)을 지나 왔을 때** — 경기 끝 판 0x4fe9c 와 정산 그림 0x4a384 의 재료.
   * `inning` 은 경기 끝 이닝(타석 HUD 와 같은 1 부터 — 전역 경기 상태 +0x6b 의 칸), `playerSide` 는 사람 팀의 측
   * (점수 · 점수판 틀 두 측이 측 0 = 선공부터), `random` 은 경기 난수.
   * 이어하기로 116 을 다시 띄울 때(1c26a → 0x1278c — 경기 장면도 정산 0x4ea0c 도 다시 안 돈다)는 안 넘긴다 — 곧장 평가다.
   */
  readonly settlement?: {
    readonly inning: number
    readonly playerSide: PlayerSide
    readonly random: RandomPort
    /** 그 경기 구장의 하늘 줄 +0x10(0x783b0) — 경기 중 타석 화면과 같은 줄. 안 주면 배경 난수로 굴린다(옛 근사) */
    readonly skyRow?: number
  }
}

/** 화면 단계 — 경기 끝 판(0x18) → 정산(0x19 · 그림 0x4a384) → 116 평가(114 내장 이벤트) */
type Phase = '끝판' | '정산' | '평가'

/**
 * 나리 타자편 경기 결과 — 원본 차례 그대로:
 *
 * 1. **경기 끝 판** 상태 0x18(그리기 0x4fe9c — `GameEndBoard`): 점수판 틀 · 두 점수 · 승리/패전/세이브 투수. OK → 0x19.
 * 2. **정산** 상태 0x19(진입 0x4ea0c · 그림 0x4a384): 모드 4 는 팀경기 · 투수편과 같은 갈래 4a948 이다(0x4a384 머리
 *    4a562 — 모드 5·6 만 미션 판) — 진 판 덮개 · 띠 · YOU WIN/LOSE · 점수판 틀 0x41440 · 점수 · 기본 화면(0:INFO · 번 G) /
 *    '0' 기록 판, 키 0x407f0(`SettlementBoard`). 밑에 결과 배경(구름 0x78448 · 0x40ff0(+0x17e2) — 이긴 판만 가라앉음)과
 *    정산 효과(밤 승리 불꽃 · 패배 비, 경기 난수)가 깔린다. '0' 이 아닌 키 → 메시지 0x3f3 → 나리 장면 100.
 * 3. **116 경기 뒤 평가**(평가가 있을 때) — 장면 0x106 상태 116 → 114 가 내장 이벤트 0x8a6fc 를 재생: 명령 1 say(기록 줄 +
 *    감독 글) → 명령 2 system sub 2 변화 창(0x86c90) → (있으면) 명령 3 say(연속 기록) → 끝나면 `onContinue`.
 *    칭호 39 를 막 받았으면 116 진입이 칭호 팝업 0x1274c 를 띄운다.
 * 국가대항전 경기는 116 이 없어 정산 판을 나가면 곧장 `onContinue`(134 대진판)다.
 */
export function GameResultScreen({
  summary,
  pitcherNames,
  gamePointReward,
  newTitles,
  evaluation,
  streakNotices = [],
  recordLine,
  career,
  onContinue,
  underlay,
  settlement,
}: GameResultScreenProps) {
  const [phase, setPhase] = useState<Phase>(() =>
    settlement !== undefined ? '끝판' : evaluation !== undefined ? '평가' : '정산')
  const [isTitlePopupOpen, setIsTitlePopupOpen] = useState(newTitles.length > 0)
  // 결과 배경의 하늘 줄은 경기를 세울 때 고른 구장 +0x10(`settlement.skyRow`, 0x783b0 모드 4 — 굴림 없음)이다. 원본은 경기 내내 같은
  // 구장객체라 정산 그림도 그 줄이다. 배경 난수는 줄을 안 받았을 때(옛 호출)만 쓰여 경기 난수에 새지 않게 따로 든다
  const [backdropRandom] = useState(() => createSeededRandom(0))
  /** 정산 효과 층 — 비는 진 판 덮개 위 · 띠 아래, 파티클은 판 맨 위 (원본 그리기 차례 0x4a384) */
  const settlementLayers = useSettlementEffectLayers()
  // 정산 판을 나간다(메시지 0x3f3) — 116 평가가 있으면 평가로, 없으면(국가대항전) 곧장 다음
  const leaveSettlement = () => (evaluation === undefined ? onContinue() : setPhase('평가'))
  // 진행기가 요약에 실어 보낸 이름이 기본이다 (`gameFlow.pitchersOfRecordOf` — 득점 0xa5c34·교체 0xa60c0 로 센 칸)
  const names = pitcherNames ?? summary.pitchersOfRecord
  const rowNames =
    names === undefined ? EMPTY_PITCHER_NAMES : [names.win, names.loss, names.save]
  // 0x4a350 — 사람 팀이 앞섰나. 비기면 거짓(진 판 · 비)
  const isWin = summary.result === '승'
  // 0xb69b0(st, 0/1) — 측 0(선공)이 왼쪽. 사람 팀은 `playerSide` 측 (이어하기처럼 재료가 없으면 원래 웹 배치대로 측 1)
  const playerSide = settlement?.playerSide ?? 1
  const side0Score = playerSide === 0 ? summary.ourScore : summary.opponentScore
  const side1Score = playerSide === 1 ? summary.ourScore : summary.opponentScore
  // 점수판 틀 0x41440 의 두 측 — 내 팀 PLAYER · 상대 COM
  const scoreboardSides = humanVsComputerSidesOf(playerSide, summary.ourTeamId, summary.opponentTeamId)

  if (phase === '평가' && evaluation !== undefined) {
    // 0x86531(gfx, S+7, 사기, S+0x4a, 인기도, S+0x64, 평판) — 116 0x12b08~0x12b70 이 넘기는 차례
    const changeValues = {
      changes: [evaluation.moraleChange, evaluation.popularityChange, evaluation.reputationChange],
      currents: [career.morale, career.popularity, career.reputation],
    } as const
    const title = newTitles[0]
    return (
      <RawScreen>
        {isTitlePopupOpen && title !== undefined ? (
          <>
            {underlay}
            {/*
              116 진입 1299e~129c8 — 칭호 39 를 막 받았으면 칭호 팝업 0x1274c(종류 0x78)를 띄운다. 그림 0x1afe8 은 이름
              StrNICKNAME[i] 와 조건 문구 [i+64] 다. ⚠️ 근사: 팝업 틀 배치는 관리 화면 칭호 팝업과 같은 알림 상자 —
              팝업이 떠 있는 동안 밑의 평가 이벤트가 어디까지 도는지는 미해결이라 팝업을 닫은 뒤 이벤트를 튼다
            */}
            <MessageBox
              text={`!C${title}!N${conditionTextOf(title) ?? ''}`}
              buttons={['확인']}
              onAnswer={() => setIsTitlePopupOpen(false)}
            />
          </>
        ) : (
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
            onDone={onContinue}
          />
        )}
      </RawScreen>
    )
  }

  if (phase === '끝판') {
    // 경기 끝 판(상태 0x18 경기 끝 가지 0x4fe9c) — 10틱 뒤 OK → 정산 0x19 진입 0x4ea0c
    return (
      <GameEndBoard
        side0Score={side0Score}
        side1Score={side1Score}
        names={rowNames}
        scoreboardSides={scoreboardSides}
        // 503d8 — 이닝별 점수판 0x41c18 을 (14, 252) 에 (작은 로고는 측 0 · 측 1 팀)
        lineScore={
          summary.lineScore === undefined
            ? undefined
            : {
                ...summary.lineScore,
                sideTeams: playerSide === 0 ? [summary.ourTeamId, summary.opponentTeamId] : [summary.opponentTeamId, summary.ourTeamId],
              }
        }
        onConfirm={() => setPhase('정산')}
      />
    )
  }

  return (
    <RawScreen>
      {/*
        정산 그리기 0x4a384 머리 — 구름 0x78448 · 배경 0x40ff0(장면, +0x17e2). 이긴 판만 갱신 0x4b100 이 +0x17e2 를 틱마다 3 씩
        150 까지 올려 구장이 가라앉는다. 정산 효과 0x4ea0c(밤 승리 불꽃 · 패배 비)와 그림마다 효과 · 파티클 틱은 경기 난수로 돈다
      */}
      {settlement !== undefined && (
        <div className={styles.backdrop}>
          <BattingStage
            // 결과 배경은 선수·공을 안 그려 능력치를 읽지 않는다 — 꼴을 채우는 기본값
            batterAbility={STARTING_ABILITY}
            pitcherAbility={DEFAULT_PITCHER_ABILITY}
            swingMode="일반"
            gameMode={BATTER_CAREER_MODE}
            isEagleEyeEnabled={false}
            hud={null}
            acePitcher={null}
            isPaused
            isResultBackdrop
            resultBackdropOffsetOf={(tick) => settlementBackdropOffsetAt(tick, isWin)}
            {...(settlement.skyRow === undefined ? {} : { skyRow: settlement.skyRow })}
            random={backdropRandom}
            settlement={{
              isWin,
              // 0xb69b0(st, 0/1) — 차이의 절댓값만 쓴다(비 방울 수)
              side0Score,
              side1Score,
              inning: settlement.inning,
              random: settlement.random,
              layers: settlementLayers,
            }}
            onPitchResolved={() => {}}
          />
        </div>
      )}

      {/* 4a404 진 판 덮개 · 4a448 띠 · 승패 그림 · 4a948 점수판 틀 · 점수 · 기본 화면 / '0' 기록 판 · 키 0x407f0 */}
      <SettlementBoard
        mode={BATTER_CAREER_MODE}
        isWin={isWin}
        side0Score={side0Score}
        side1Score={side1Score}
        scoreboardSides={scoreboardSides}
        recordIds={summary.recordIds}
        gamePoints={gamePointReward}
        // [app+0x64] 보유 G — 정산 진입 4ec5a 가 번 G 를 먼저 더한 값(선수 정산이 이미 더해 두었다)
        heldGamePoints={career.gamePoint}
        onExit={leaveSettlement}
        {...(settlement === undefined ? {} : { effectLayers: settlementLayers })}
      />

      {/* 원본에 없는 웹 전용 단추 — 원본은 '0' 이 아닌 키(소프트키 포함)가 정산을 나간다 */}
      <Button variant="corner" className={styles.continueButton} onClick={leaveSettlement}>
        확인
      </Button>
    </RawScreen>
  )
}
