import { RawScreen } from '@/shared/ui'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { PitcherRun } from '@/entities/mission/model/pitcherRun'
import { STARTING_ABILITY } from '@/entities/career/model/playerCareer'
import { DEFAULT_PITCHER_ABILITY } from '@/entities/pitching/model/pitch'
import { BattingStage } from '@/widgets/batting-stage/ui/BattingStage'
import type { SettlementEffectLayers } from '@/widgets/batting-stage/model/stageRefs'
import * as styles from '@/pages/pitching/ui/PitcherGameScreen.css'
import { MISSION_PITCHER_MODE } from './missionPitching'
import { MissionResultBoard, missionResultLeaveOf, settlementBackdropOffsetAt } from './otherSlices'
import type { PitchingScreenProps } from './pitchingScreenProps'

/** 결과 판 0x4a384(모드 5·6) 의 값 — 번 G [+0x17f4] · 보유 G g[0x64] · 마선수 대결 칸 (없는 칸은 안 넘긴다) */
function resultBoardFieldsOf(resultBoard: PitchingScreenProps['resultBoard']) {
  return {
    earnedGamePoint: resultBoard?.earnedGamePoint ?? 0,
    ...(resultBoard?.heldGamePoint === undefined ? {} : { heldGamePoint: resultBoard.heldGamePoint }),
    ...(resultBoard?.aceMatch === undefined ? {} : { aceMatch: resultBoard.aceMatch }),
  }
}

/**
 * 경기 상태 0x19 — 미션 결과 판 0x4a384(모드 5·6) · 키 0x407f0. 0x4a384 는 HUD(0x373d0 — 그 꼬리가 미션 판 0x36714)를
 * 안 그리므로 목표 판도 없다. 웹 제목줄도 원본에 없다
 */
export function MissionResultView({
  run,
  skyRow,
  random,
  backdropRandom,
  settlementLayers,
  resultBoard,
  onRetry,
  onFinish,
}: {
  readonly run: PitcherRun
  readonly skyRow: number | undefined
  readonly random: RandomPort | undefined
  /** 결과 배경 캔버스의 난수 — 경기 난수에 새지 않게 따로 든 것 */
  readonly backdropRandom: RandomPort
  readonly settlementLayers: SettlementEffectLayers
  readonly resultBoard: PitchingScreenProps['resultBoard']
  readonly onRetry: (() => void) | undefined
  readonly onFinish: () => void
}) {
  // [미션+0xbc] — 0x4ea0c 4ef2a · 0x4a384 4a3ea 의 "이겼나"
  const isSuccess = run.status === '성공'
  return (
    <RawScreen>
      <div className={styles.matchupFrame}>
        {/*
          0x4a384 머리 — 모드를 안 가리고 구름 0x78448 · 배경 0x40ff0(+0x17e2)을 먼저 그린다(선수 · 공 · HUD 없음). 갱신 0x4b100 은
          모드 5·6 이면 r7 = [미션+0xbc] — 성공한 판만 구장이 틱마다 3 씩 가라앉는다. 정산 효과 0x4ea0c 꼬리(4f41a~)는 경기 난수로
        */}
        {random !== undefined && (
          <BattingStage
            skyRow={skyRow}
            // 결과 배경은 선수·공을 안 그려 능력치를 읽지 않는다 — 꼴을 채우는 기본값
            batterAbility={STARTING_ABILITY}
            pitcherAbility={DEFAULT_PITCHER_ABILITY}
            swingMode="일반"
            gameMode={MISSION_PITCHER_MODE}
            isEagleEyeEnabled={false}
            hud={null}
            acePitcher={null}
            isPaused
            isResultBackdrop
            resultBackdropOffsetOf={(tick) => settlementBackdropOffsetAt(tick, isSuccess)}
            random={backdropRandom}
            settlement={{
              isWin: isSuccess,
              // 경기 상태 두 측 점수 0xb69b0 — 허용 실점 · 자동진행 반 이닝 득점이 모두 든 경기 칸(`run.game.scores`). 차이만 쓴다
              side0Score: run.game.scores[0],
              side1Score: run.game.scores[1],
              // 하늘 칸 — 경기 이닝 st[0x6b]
              inning: run.game.inning + 1,
              random,
              layers: settlementLayers,
            }}
            onPitchResolved={() => {}}
          />
        )}
        <MissionResultBoard
          isSuccess={isSuccess}
          {...(random === undefined ? {} : { effectLayers: settlementLayers })}
          {...resultBoardFieldsOf(resultBoard)}
          onExit={(exit) => {
            if (missionResultLeaveOf(exit, resultBoard?.aceMatch !== undefined) === '다시하기' && onRetry !== undefined) onRetry()
            else onFinish()
          }}
        />
      </div>
    </RawScreen>
  )
}
