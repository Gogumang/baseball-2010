import { useState } from 'react'
import {
  BigResult, Button, DialogueBox, MarkupText, Notice, Panel, PixelScreen, RawScreen, SpriteNumber,
  StatGrid, TitleTag,
} from '@/shared/ui'
import { glyphsWidthOf, numberGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'
import type { GameEvaluation, StreakNotice } from '@/entities/career/model/gameEvaluation'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { ORIGINAL_USER_EVENTS } from '@/shared/config/original/userEvents'
import type { GameSummary } from '@/entities/game/model/gameSummary'
import { RECORD_NAMES } from '@/entities/game/model/gameRecords'
import { battingAverageOf, formatBattingAverage } from '@/entities/career/model/seasonStats'
import {
  BAND, LOSE_DIM_OPACITY, NO_RECORD_TEXT, PITCHER_LABELS, PITCHER_ROWS, PITCHER_ROW_X,
  RESULT_SPRITES, REWARD_TEXT, SCORE_GLYPH_HEIGHT, SCORE_SLOTS, TITLE_BAR,
  pitcherLabelPositionOf, pitcherNameBoxOf, pitcherRowTopOf,
} from '@/pages/game-result/lib/gameResultLayout'
import * as styles from '@/pages/game-result/ui/GameResultScreen.css'

const GAME_UI_FRAMES = './sprites/game_ui/frames'
const IMG_TEXT_FRAMES = './sprites/img_text/frames'
const RESULT_FRAMES = './sprites/result/frames'

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
 * ⚠️ **값이 없어 못 채우는 칸**: 이 화면을 쓰는 타자편(`app/ui/CareerRoutes.tsx`)의
 * `gameFlow.ts` 는 투수를 팀 하나로 뭉뚱그려 돌려 **마운드에 누가 섰는지를 기록하지 않는다**.
 * `GameSummary` 에도 그 칸이 없다. 그래서 여기서는 **받을 자리(`pitcherNames`)만 열어 두고**
 * 안 넘기면 원본의 "측 == 2 = 없음" 과 같이 이름 칸을 비운다 (R10 5절).
 * 투수편(마운드 교체)이 타자편에 들어오면 `gameEndDecisionOf(...)` 의 셋을 이름으로 바꿔
 * 이 prop 으로 넘기면 된다.
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
   * 승리투수·패전투수·세이브 이름. 타자편은 마운드 투수를 기록하지 않아 아직 넘길 값이 없다 —
   * 안 넘기면 세 줄 모두 빈 칸이다 (원본도 "없음" 이면 비운다).
   */
  readonly pitcherNames?: PitcherOfRecordNames
  readonly gamePointReward: number
  readonly newTitles: readonly string[]
  readonly evaluation: GameEvaluation
  readonly streakNotices: readonly StreakNotice[]
  /** 평가가 반영된 뒤의 선수 — "현재 사기" 등을 보여준다 */
  readonly career: PlayerCareer
  readonly onContinue: () => void
}

/** StrUSER_EVT[75] "사기 변화: %d / 현재 사기: %d / … 평판" */
const EVALUATION_POPUP_INDEX = 75

const fillNumbers = (raw: string, values: readonly number[]) => {
  let index = 0
  return raw.replace(/%d/g, () => String(values[index++] ?? ''))
}

/**
 * 경기 결과 (정산 그리기 0x4a384 + 상태 0x18 결과 판 0x4fe9c — F-7 · R10 5절).
 *
 * 패배면 화면을 단계 8 로 어둡게 하고, y40 반투명 띠 위에 game_ui 프레임 8 막대(y35)를 깔고
 * YOU WIN/LOSE 를 (120,50) 기준으로 얹는다. 그 아래가 점수 두 개와 **승리투수·패전투수·세이브
 * 세 줄**(img_text 388·389·329)이다.
 *
 * 감독 평가·오늘의 성적은 원본에서 이 화면이 아니라 팝업(StrUSER_EVT[75])·다른 화면 몫이라
 * 여기 배치가 없다. 웹에서 이미 보여 주던 것이라 지우지 않고 **[자세히] 칸**으로 옮겼다
 * (원본에 없는 웹 전용 길).
 */
export function GameResultScreen({
  summary,
  pitcherNames,
  gamePointReward,
  newTitles,
  evaluation,
  streakNotices,
  career,
  onContinue,
}: GameResultScreenProps) {
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const { stats } = summary
  const rowNames =
    pitcherNames === undefined
      ? EMPTY_PITCHER_NAMES
      : [pitcherNames.win, pitcherNames.loss, pitcherNames.save]

  if (isDetailOpen) {
    return (
      <PixelScreen
        title="경기 결과"
        leftKey={{ label: '닫기', onPress: () => setIsDetailOpen(false) }}
        rightKey={{ label: '확인', onPress: onContinue }}
      >
        <Panel>
          <BigResult>
            {summary.ourScore} : {summary.opponentScore} {summary.result}
          </BigResult>
        </Panel>

        <Panel heading="감독 평가">
          <DialogueBox>
            <MarkupText raw={ORIGINAL_USER_EVENTS[evaluation.commentIndex] ?? ''} />
          </DialogueBox>
          <MarkupText
            raw={fillNumbers(ORIGINAL_USER_EVENTS[EVALUATION_POPUP_INDEX] ?? '', [
              evaluation.moraleChange,
              career.morale,
              evaluation.popularityChange,
              career.popularity,
              evaluation.reputationChange,
              career.reputation,
            ])}
          />
          {streakNotices.map((notice) => (
            <Notice key={notice.labelIndex}>
              {notice.count}{ORIGINAL_USER_EVENTS[notice.labelIndex]} · {ORIGINAL_USER_EVENTS[notice.commentIndex]} (평판{' '}
              {notice.reputationChange > 0 ? '+' : ''}
              {notice.reputationChange})
            </Notice>
          ))}
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
  const awayGlyphs = numberGlyphsOf(summary.opponentScore)
  const homeGlyphs = numberGlyphsOf(summary.ourScore)

  return (
    <RawScreen>
      {/* 1. 패배(무승부 포함)면 화면 전체를 검정 단계 8 로 어둡게 (0x4a42a — 이기면 그대로) */}
      {summary.result !== '승' && (
        <div className={styles.loseDim} style={{ opacity: LOSE_DIM_OPACITY }} />
      )}

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

      {/* 5. 두 팀 점수 — 왼쪽이 측 0(초 = 상대), 오른쪽이 측 1(말 = 우리) (0x4fe9c) */}
      {/* 기준점은 가로 가운데로 본다 (0x585ac 의 마지막 인자 2 = 가로 가운데 정렬) */}
      <SpriteNumber
        glyphs={awayGlyphs}
        right={SCORE_SLOTS.away.x + Math.round(glyphsWidthOf(awayGlyphs) / 2)}
        boxTop={SCORE_SLOTS.away.y}
        boxHeight={SCORE_GLYPH_HEIGHT}
      />
      <SpriteNumber
        glyphs={homeGlyphs}
        right={SCORE_SLOTS.home.x + Math.round(glyphsWidthOf(homeGlyphs) / 2)}
        boxTop={SCORE_SLOTS.home.y}
        boxHeight={SCORE_GLYPH_HEIGHT}
      />

      {/* 6. 승리투수·패전투수·세이브 세 줄 (표 0xd0470 = img_text 388·389·329) */}
      {PITCHER_LABELS.map((label, row) => {
        const labelPosition = pitcherLabelPositionOf(row)
        const nameBox = pitcherNameBoxOf(row)
        const name = rowNames[row]
        return (
          <div key={label.frame}>
            <img
              className={styles.sprite}
              style={{ left: PITCHER_ROW_X, top: pitcherRowTopOf(row) }}
              src={frameSrc(GAME_UI_FRAMES, PITCHER_ROWS.labelPlate.frame)}
              alt=""
            />
            <img
              className={styles.sprite}
              style={{ left: nameBox.x, top: nameBox.y }}
              src={frameSrc(GAME_UI_FRAMES, PITCHER_ROWS.namePlate.frame)}
              alt=""
            />
            <img
              className={styles.sprite}
              style={{ left: labelPosition.x, top: labelPosition.y }}
              src={frameSrc(IMG_TEXT_FRAMES, label.frame)}
              alt={label.name}
            />
            <div
              className={styles.pitcherName}
              style={{ left: nameBox.x, top: nameBox.y, width: nameBox.width, height: nameBox.height }}
            >
              {name ?? ''}
            </div>
          </div>
        )
      })}

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
      <Button variant="corner" className={styles.continueButton} onClick={onContinue}>
        확인
      </Button>
    </RawScreen>
  )
}
