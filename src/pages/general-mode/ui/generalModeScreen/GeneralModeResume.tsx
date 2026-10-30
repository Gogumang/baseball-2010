import { useState } from 'react'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { TeamGameScreen, XLS_ROW_MATCHUP_RECORDS } from './otherSlices'
import type { GeneralModeScreenProps } from './generalModeScreenProps'

/**
 * **이어하기 경기** — 저장 블록의 진행에서 장면 0x104 를 다시 세운다. 환경설정(투구 게이지·주루·송구)과 마선수 레벨,
 * 경기진행 설정(전역기록 +0x12c+0 계열 — 0xc1e04 가 타석마다 읽는다)은 원본이 경기 중에 전역 칸에서 그때그때 읽으므로
 * 지금 값으로 바꿔 끼운다.
 */
export function GeneralModeResume(props: GeneralModeScreenProps & { readonly resumeGame: TeamGameProgress }) {
  const {
    random,
    resumeGame,
    aceLevels,
    gaugeSettingOn,
    runningModeManual,
    throwModeManual,
    gamePoint,
    initialSettings,
    onSpendGamePoint,
    settings,
    onSettingsChange,
    onFinish,
    onExit,
    onGameSave,
    onSettlementEnter,
  } = props
  const [resumeFrom] = useState<TeamGameProgress>(() => ({
    ...resumeGame,
    options: {
      ...resumeGame.options,
      ...(initialSettings === undefined ? {} : { settings: initialSettings }),
      ...(gaugeSettingOn === undefined ? {} : { gaugeSettingOn }),
      ...(runningModeManual === undefined ? {} : { runningModeManual }),
      ...(throwModeManual === undefined ? {} : { throwModeManual }),
      ...(aceLevels === undefined ? {} : { aceLevels }),
    },
  }))
  return (
    <TeamGameScreen
      options={resumeFrom.options}
      resumeFrom={resumeFrom}
      random={random}
      onFinish={onFinish}
      // 경기 중 나가기 0x40140 — 메인 메뉴 처음 단
      onQuit={() => onExit()}
      // 소개 판 0x44944 · 교체 창 줄 — 모드 1 레코드는 Xls 행 사본이라 표의 줄(게이트 거짓)
      matchupRecords={XLS_ROW_MATCHUP_RECORDS}
      // 정산 판의 보유 GP · 자동진행 비용 판정(0x3c802) — 자동진행 [예] 는 G 만 뺀다(모드 1 은 소모 통계 없음, 0x3c850)
      {...(gamePoint === undefined ? {} : { gamePoint })}
      {...(onSpendGamePoint === undefined ? {} : { onSpendGamePoint })}
      {...(settings === undefined ? {} : { settings })}
      {...(onSettingsChange === undefined ? {} : { onSettingsChange })}
      {...(onGameSave === undefined ? {} : { onHalfInningSave: onGameSave })}
      {...(onSettlementEnter === undefined ? {} : { onSettlementEnter })}
    />
  )
}
