import { useRef } from 'react'
import type { TeamGameOptions } from '@/features/play-team-game/model/teamGameFlow'
import { TeamGameScreen, XLS_ROW_MATCHUP_RECORDS } from './otherSlices'
import type { GeneralModeScreenProps } from './generalModeScreenProps'

/** 경기정보 OK 뒤 경기 장면 0x104 — 첫 저장은 경기정보 OK 몫(0x3136e)이고 그 뒤는 반 이닝 저장(0x4f928)이다 */
export function GeneralModePlaying({ props, options }: { readonly props: GeneralModeScreenProps; readonly options: TeamGameOptions }) {
  const { random, gamePoint, onSpendGamePoint, settings, onSettingsChange, onFinish, onExit, onGameStart, onGameSave, onSettlementEnter } = props
  /** 이 경기의 첫 저장인가 */
  const isFirstSaveRef = useRef(true)
  return (
    <TeamGameScreen
      options={options}
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
      onHalfInningSave={(save) => {
        if (isFirstSaveRef.current) {
          isFirstSaveRef.current = false
          onGameStart?.(save)
          return
        }
        onGameSave?.(save)
      }}
      {...(onSettlementEnter === undefined ? {} : { onSettlementEnter })}
    />
  )
}
