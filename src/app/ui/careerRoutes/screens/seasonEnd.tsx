import type { ReactNode } from 'react'
import { PostseasonScreen } from '@/pages/season-end/ui/PostseasonScreen'
import { NationalCupScreen } from '@/pages/national-cup/ui/NationalCupScreen'
import { EndingScreen } from '@/pages/ending/ui/EndingScreen'
import { nariBatterOf } from '@/app/model/useCollection'
import { endingBonusOf, isContinuableEnding } from '@/entities/career/model/seasonFlow'
import { nationalCupStandingsTitleOf } from '@/entities/career/model/titles'
import type { CareerScreenInput, ScreenOf } from '@/app/ui/careerRoutes/careerScreenInput'

export function postseasonScreenOf(input: CareerScreenInput, screen: ScreenOf<'포스트시즌'>): ReactNode {
  const { career, actions } = input
  return (
    <PostseasonScreen
      series={career.postseason}
      edition="타자편"
      gamePoint={career.gamePoint}
      popup={screen.popup}
      onConfirm={actions.pressPostseason}
      onClosePopup={actions.closePostseasonPopup}
    />
  )
}

export function nationalCupScreenOf(input: CareerScreenInput, screen: ScreenOf<'국가대항전'>): ReactNode {
  const { random, career, actions } = input
  return (
    <NationalCupScreen
      mode="나만의리그"
      cup={screen.cup}
      // 제 n 회 = (연차 idx >> 1) + 1 (`0x85e6c`). 대회는 **끝난 해**의 연말에 치르고
      // 새 시즌은 대회가 끝난 뒤에야 오르므로(`0x1b768`), 연차 idx 는 지금 시즌 − 1 이다
      yearIndex={career.season - 1}
      gamePoint={career.gamePoint}
      random={random}
      onStartGame={actions.startCupGame}
      onFinish={actions.finishCup}
      // 142 취소로 돌아오면 135(순위표)부터
      initialStep={screen.atStandings === true ? '순위' : '대진'}
      // 134 진입 0x19f30 — 처음 열리는 히든 팀(대한민국 · 우승이면 결승 상대)마다 StrCOMMON[138] 팝업 0x22 · 전역 해금
      openedHiddenIds={career.openedHiddenIds}
      onOpenHiddenTeams={actions.syncOpenedHidden}
      // 134 첫 틀 0x1b92c 머리 — 비트 8 이 없으면 칭호 8 "국가 대표" 팝업 0x78, 확인 0x1b1e4 가 주고 장착
      entryTitle={nationalCupStandingsTitleOf(career.titleIds)}
      onConfirmEntryTitle={actions.confirmCupTitle}
    />
  )
}

export function endingScreenOf(input: CareerScreenInput, screen: ScreenOf<'엔딩'>): ReactNode {
  const { career, hallOfFame, actions } = input
  return (
    <EndingScreen
      playerName={career.name}
      endingIndex={screen.endingIndex}
      seenEventIds={career.seenEventIds}
      isResumed={screen.fromResume === true}
      // 선수 생김새 +0xb — 타입(bit5~7)·손(bit4)·피부(bit2~3). 걸어 들어오는 그림·제작진 선수 애니와 팔레트 (0x63a5c)
      walkInLook={{ mode: 4, typeIndex: career.battingTypeIndex, handIndex: career.battingSide, skinIndex: career.skinIndex }}
      bonusGamePoint={endingBonusOf(screen.endingIndex)}
      isContinuable={isContinuableEnding(screen.endingIndex)}
      // S+0x7b — 141 로 이어하기한 엔딩은 보너스를 이미 받았다. 팝업 0x2b 를 닫을 때 보너스 · S+0x7b · 저장 (1bbf4~1bc70)
      isBonusReceived={career.endingBonusReceived === true}
      onBonusReceived={actions.receiveEndingBonus}
      hallOfFame={{
        collection: hallOfFame.collection,
        edition: '타자',
        nari: {
          투수: hallOfFame.nariPitcher,
          타자: nariBatterOf(career),
        },
        // 등록이 된 그 순간 0x62dbe 가 모드 저장을 지운다(0x224ec) — 완료 창을 닫기 전이다
        onRegister: (slot) => {
          const result = hallOfFame.register(career, slot)
          if (result === '등록') actions.eraseSaveForHallOfFame()
          return result
        },
        ...(hallOfFame.gamePoint === undefined ? {} : { gamePoint: hallOfFame.gamePoint }),
        ...(hallOfFame.openRegisteredHidden === undefined ? {} : { openRegisteredHidden: hallOfFame.openRegisteredHidden }),
      }}
      onContinue={actions.continueAfterEnding}
      onFinish={actions.finishEnding}
    />
  )
}
