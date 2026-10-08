import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  BigResult, Button, Notice, Panel, PixelScreen, RawScreen, StatGrid, TitleTag,
} from '@/shared/ui'
import { EndBoardRows } from '@/widgets/game-scene/ui/EndBoardRows'
import type { GameEvaluation, StreakNotice } from '@/entities/career/model/gameEvaluation'
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
import type { GameSummary } from '@/entities/game/model/gameSummary'
import { RECORD_NAMES } from '@/entities/game/model/gameRecords'
import { battingAverageOf, formatBattingAverage } from '@/entities/career/model/seasonStats'
import {
  BAND, LOSE_DIM_OPACITY, NO_RECORD_TEXT, RESULT_SPRITES, REWARD_TEXT, TITLE_BAR,
} from '@/pages/game-result/lib/gameResultLayout'
import * as styles from '@/pages/game-result/ui/GameResultScreen.css'
import { BattingStage } from '@/widgets/batting-stage/ui/BattingStage'
import { SettlementEffectCanvas, useSettlementEffectLayers } from '@/widgets/batting-stage/ui/SettlementEffectCanvas'
import { settlementBackdropOffsetAt } from '@/pages/team-game/model/settlementBackdrop'
import { STARTING_ABILITY } from '@/entities/career/model/playerCareer'
import { DEFAULT_PITCHER_ABILITY } from '@/entities/pitching/model/pitch'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'

const GAME_UI_FRAMES = './sprites/game_ui/frames'
const RESULT_FRAMES = './sprites/result/frames'

/** 나리 타자편 — 게임 모드 4 (정산 그리기 0x4a384 는 팀경기와 같은 갈래 0x4a948) */
const BATTER_CAREER_MODE = 4

const frameSrc = (folder: string, frame: number) => `${folder}/${String(frame).padStart(3, '0')}.png`

/**
 * 승패 글자 그림 — ui/result.pzx 합성 프레임 0 "YOU WIN", 1 "YOU LOSE".
 * 무승부 전용 그림이 원본에 없어 무승부도 패배 쪽 프레임이다 (F-7 4 확정).
 */
const resultSpriteOf = (result: GameSummary['result']) =>
  result === '승' ? RESULT_SPRITES.승 : RESULT_SPRITES.패

/**
 * 승·패·세 투수 세 줄의 **이름**.
 *
 * 원본은 경기 상태 state+0x44/0x48(승) · +0x50/0x54(패) · +0x5c/0x60(세) 에
 * "그 순간 마운드에 선 투수" 를 한 점 날 때마다(0xa5c34)·투수 교체 때(0xa60c0) 적어 두고,
 * 경기 끝(0xa7de8)에 셋을 확정한다 (S1-win-loss-save.md 2~4절 확정 — 웹판 판정은
 * `features/play-pitcher-game/model/winLossSave.ts` 가 그대로 갖고 있다).
 *
 * 타자편 `gameFlow` 가 득점·교체마다 그 칸을 세어(`features/play-game/model/gameDecisions`)
 * `GameSummary.pitchersOfRecord` 로 실어 보낸다. 결과 판(0x4fe9c)은 경기 끝 거르기(0xa7de8)를
 * 거치지 않은 칸을 그대로 그리므로 세이브 줄도 후보가 있으면 이름이 나온다.
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
  readonly gamePointReward: number
  readonly newTitles: readonly string[]
  /**
   * 116 경기 뒤 평가 — 감독 글 · 변화 글 · 연속 기록. 국가대항전 경기는 116 을 안 지나(0x4ea0c 4f03a 가 S+0x50 = 2 를 대회가 아닐 때만
   * 쓴다) 없다 — 그때 [자세히]에는 평가 칸이 없다.
   */
  readonly evaluation?: GameEvaluation
  readonly streakNotices?: readonly StreakNotice[]
  /**
   * 116 기록 줄 S+0x1d8 (타수 · 안타 · 타점 · 홈런) — 평가 대사가 이 줄 뒤에 감독 글을 잇는다(`nariRecordLineTextOf`).
   * 포스트시즌 경기 뒤에는 앞 평가 경기의 줄이다. 안 넘기면 감독 글만.
   */
  readonly recordLine?: NariRecordLine
  /** 평가가 반영된 뒤의 선수 — "현재 사기" 등을 보여준다 */
  readonly career: PlayerCareer
  readonly onContinue: () => void
  /**
   * 나리 116 평가 대화(114 · 내장 이벤트 0x8a6fc)의 밑그림. 116 그림 0x11e0c 와 대화창 0x8b5ac 가
   * 공 무늬 · 상태판 0x7d34c(gfx, [이벤트+0xb] = 1 — 메시지줄 경기 번호 −1) · 머리띠를 깐다. 부르는 쪽이 넘긴다.
   * 결과 판(0x18 · 0x19 — 경기 장면)이 아니라 [확인] 뒤 평가 단계에만 깐다.
   */
  readonly underlay?: ReactNode
  /**
   * **경기 정산 0x19 를 지나 왔을 때** (경기 끝 판 OK → 진입 0x4ea0c) — 결과 그림 0x4a384 의 배경 · 정산 효과 재료.
   * `inning` 은 경기 끝 이닝(타석 HUD 와 같은 1 부터 — 전역 경기 상태 +0x6b 의 칸), `random` 은 경기 난수.
   * 이어하기로 116 을 다시 띄울 때(정산 0x4ea0c 를 다시 안 돈다)는 안 넘긴다 — 그때는 배경 · 효과 없이 판만.
   */
  readonly settlement?: { readonly inning: number; readonly random: RandomPort }
}

/**
 * 경기 결과 (정산 그리기 0x4a384 + 상태 0x18 결과 판 0x4fe9c — F-7 · R10 5절).
 *
 * 패배면 화면을 단계 8 로 어둡게 하고, y40 반투명 띠 위에 game_ui 프레임 8 막대(y35)를 깔고
 * YOU WIN/LOSE 를 (120,50) 기준으로 얹는다. 그 아래가 점수 두 개와 **승리투수·패전투수·세이브
 * 세 줄**(img_text 388·389·329)이다.
 *
 * **116 경기 뒤 평가**(평가가 있을 때)는 [확인] 뒤에 원본 차례대로 튼다 — 장면 0x106 상태 116 → 114 가 내장 이벤트
 * 0x8a6fc 를 재생: 명령 1 say(기록 줄 + 감독 글) → 명령 2 system sub 2 변화 창(0x86c90, `EvaluationChangeWindow` —
 * 글 [75] 가 아니다) → (있으면) 명령 3 say(연속 기록) → 끝나면 `onContinue`(114 끝). 그림 틀은 투수편과 같은 `EvaluationEventPlayer`.
 * 오늘의 성적 · 보상은 원본 배치가 없어 **[자세히] 칸**에 둔다(원본에 없는 웹 전용 길).
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
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  // ⚠️ 웹 타석 그림이 세울 때 굴리는 하늘 줄 rand(0, 6)(추정 대체)이 경기 난수에 새지 않게 배경은 따로 든 난수로 세운다 (팀경기 · 투수편과 같은 근사)
  const [backdropRandom] = useState(() => createSeededRandom(0))
  /** 정산 효과 층 — 비는 진 판 덮개 위 · 띠 아래, 파티클은 판 맨 위 (원본 그리기 차례 0x4a384) */
  const settlementLayers = useSettlementEffectLayers()
  const [isEvaluating, setIsEvaluating] = useState(false)
  // 결과 판 [확인] — 116 평가가 있으면 평가 이벤트로, 없으면(국가대항전) 곧장 다음
  const confirm = () => (evaluation === undefined ? onContinue() : setIsEvaluating(true))
  const { stats } = summary
  // 진행기가 요약에 실어 보낸 이름이 기본이다 (`gameFlow.pitchersOfRecordOf` — 득점 0xa5c34·교체 0xa60c0 로 센 칸)
  const names = pitcherNames ?? summary.pitchersOfRecord
  const rowNames =
    names === undefined ? EMPTY_PITCHER_NAMES : [names.win, names.loss, names.save]

  if (isEvaluating && evaluation !== undefined) {
    // 0x86531(gfx, S+7, 사기, S+0x4a, 인기도, S+0x64, 평판) — 116 0x12b08~0x12b70 이 넘기는 차례
    const changeValues = {
      changes: [evaluation.moraleChange, evaluation.popularityChange, evaluation.reputationChange],
      currents: [career.morale, career.popularity, career.reputation],
    } as const
    return (
      <RawScreen>
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
      </RawScreen>
    )
  }

  if (isDetailOpen) {
    return (
      <PixelScreen
        title="경기 결과"
        leftKey={{ label: '닫기', onPress: () => setIsDetailOpen(false) }}
        rightKey={{ label: '확인', onPress: confirm }}
      >
        <Panel>
          <BigResult>
            {summary.ourScore} : {summary.opponentScore} {summary.result}
          </BigResult>
        </Panel>


        <Panel heading="오늘의 성적">
          <StatGrid
            entries={[
              { label: '타수', value: stats.atBats },
              { label: '안타', value: stats.hits },
              { label: '홈런', value: stats.homeRuns },
              { label: '타점', value: stats.runsBattedIn },
              { label: '볼넷', value: stats.walks },
              { label: '삼진', value: stats.strikeouts },
            ]}
          />
        </Panel>

        <Panel heading="보상">
          <Notice>
            경기 타율 {formatBattingAverage(battingAverageOf(stats))} · G포인트 +
            {gamePointReward.toLocaleString('ko-KR')}
          </Notice>
          {/* 달성 기록 목록 (0x4ea0c 결과 화면) — 이름 StrGAME[id+8] */}
          {summary.recordIds.length > 0 && <Notice>달성 기록 · {summary.recordIds.map((id) => RECORD_NAMES[id]).join(' · ')}</Notice>}
        </Panel>

        {newTitles.length > 0 && (
          <Panel heading="칭호 획득!">
            {newTitles.map((title) => (
              <TitleTag key={title}>
                {title}
              </TitleTag>
            ))}
          </Panel>
        )}
      </PixelScreen>
    )
  }

  const resultSprite = resultSpriteOf(summary.result)
  // 0x4a350 — 사람 팀이 앞섰나. 비기면 거짓(진 판 · 비)
  const isWin = summary.result === '승'

  return (
    <RawScreen>
      {/*
        0. 정산 그리기 0x4a384 머리 — 구름 0x78448 · 배경 0x40ff0(장면, +0x17e2). 이긴 판만 갱신 0x4b100 이 +0x17e2 를 틱마다 3 씩
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
            random={backdropRandom}
            settlement={{
              isWin,
              // 0xb69b0(st, 0/1) — 차이의 절댓값만 쓴다(비 방울 수). 판과 같이 왼쪽 측 0 = 상대
              side0Score: summary.opponentScore,
              side1Score: summary.ourScore,
              inning: settlement.inning,
              random: settlement.random,
              layers: settlementLayers,
            }}
            onPitchResolved={() => {}}
          />
        </div>
      )}

      {/* 1. 패배(무승부 포함)면 화면 전체를 검정 단계 8 로 어둡게 (0x4a42a — 이기면 그대로) */}
      {summary.result !== '승' && (
        <div className={styles.loseDim} style={{ opacity: LOSE_DIM_OPACITY }} />
      )}

      {/* 1-1. 효과 틱 0x4a452(0x901a0) — 정산 비를 덮개 위 · 띠 아래에 */}
      {settlement !== undefined && <SettlementEffectCanvas canvasRef={settlementLayers.rain} />}

      {/* 2. 띠 fillRect(0, 40, 240, 30, 0x80304EA2) (0x4a466) */}
      <div
        className={styles.band}
        style={{ left: BAND.x, top: BAND.y, width: BAND.width, height: BAND.height, background: BAND.color }}
      />

      {/* 3. game_ui 프레임 8 (171×25) 을 (34, 35) (0x4a48e) */}
      <img
        className={styles.sprite}
        style={{ left: TITLE_BAR.x, top: TITLE_BAR.y }}
        src={frameSrc(GAME_UI_FRAMES, TITLE_BAR.frame)}
        alt=""
      />

      {/* 4. result 프레임 0 "YOU WIN" / 1 "YOU LOSE" 를 기준점 (120, 50) (0x4a4d2·0x4a55c) */}
      <img
        className={styles.sprite}
        style={{ left: resultSprite.x, top: resultSprite.y }}
        src={frameSrc(RESULT_FRAMES, resultSprite.frame)}
        alt={summary.result === '승' ? 'YOU WIN' : 'YOU LOSE'}
      />

      {/* 5·6. 두 팀 점수와 승리투수·패전투수·세이브 세 줄 — 상태 0x18 결과 판(0x4fe9c)과 같은 부품이다.
          왼쪽이 측 0(초 = 상대), 오른쪽이 측 1(말 = 우리) */}
      <EndBoardRows side0Score={summary.opponentScore} side1Score={summary.ourScore} names={rowNames} />

      {/* 7. 보상·기록 글 (F-7 5 유력 — 판 좌표를 못 정해 줄만 둔다) */}
      <div className={styles.rewardText} style={{ left: REWARD_TEXT.x, top: REWARD_TEXT.y, width: REWARD_TEXT.width }}>
        {summary.result === '승' && (
          <div>
            승리 추가 보상 <span className={styles.rewardPoint}>{gamePointReward.toLocaleString('ko-KR')} G포인트</span>
          </div>
        )}
        <div>
          {summary.recordIds.length > 0
            ? summary.recordIds.map((id) => RECORD_NAMES[id]).join(' · ')
            : NO_RECORD_TEXT}
        </div>
        {newTitles.length > 0 && <div>칭호 획득 · {newTitles.join(' · ')}</div>}
      </div>

      {/* 원본에 없는 웹 전용 단추 — 원본은 소프트키가 한다 */}
      <Button variant="corner" className={styles.detailButton} onClick={() => setIsDetailOpen(true)}>
        자세히
      </Button>
      <Button variant="corner" className={styles.continueButton} onClick={confirm}>
        확인
      </Button>

      {/* 프레임 끝 0x6dd69 — 파티클(밤 승리 불꽃)은 판까지 다 그린 뒤 맨 위 (누르기는 밑으로 흘린다) */}
      {settlement !== undefined && <SettlementEffectCanvas canvasRef={settlementLayers.particles} />}
    </RawScreen>
  )
}
