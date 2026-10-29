import type { ReactNode } from 'react'
import { lapPlayClock } from '@/entities/collection/model/playClock'
import { GeneralModeScreen } from '@/app/ui/app/lazyRoutes'
import { GENERAL_STAT_MODE } from '@/app/ui/app/appConstants'
import { withHiddenOpenNotice } from '@/app/ui/app/appOverlay'
import type { AppScope } from '@/app/ui/app/appScope'

// 일반모드 — 준비 다섯 화면부터 경기까지 한 화면이 돌고 메인 메뉴로 돌아간다. 경기는 경기정보 OK·반 이닝마다
// 모드 1 저장 블록에 남고(+0x4d), 경기 중 "나가기"로 나가도 남아 [13]/[최근게임] 의 이어하기로 그 자리에서 다시 선다
export function generalModeOf(app: AppScope): ReactNode {
  const {
    modeSave,
    gameSettings,
    random,
    setScreen,
    isGeneralQuickStart,
    generalResume,
    setGeneralResume,
    wallet,
    recordStat,
    collection,
    aceSelect,
  } = app
  // 준비 단계 취소(18 · 빠른실행 22 의 CLR)만 openTier 5 — 게임시작 목록으로 바로. 경기 중 나가기 0x40140 · 결과 확인은 처음 단
  const leaveGeneralMode = (openTier?: 5) => {
    setGeneralResume(null)
    setScreen(openTier === undefined ? { kind: '메인메뉴' } : { kind: '메인메뉴', openTier })
  }
  return withHiddenOpenNotice(
    app,
    <GeneralModeScreen
      random={random}
      {...(generalResume === null ? {} : { resumeGame: generalResume })}
      // 경기정보 OK 0x3136e — +0x3c = 1 · +0x4d = 1 · 블록 = 새 경기
      onGameStart={modeSave.startGeneralGame}
      // 반 이닝 자동 저장 0x4f928 → 0x22754 — 블록만
      onGameSave={(game) => {
        // 0x4f928 의 0x4fa9e `0x4e8b0` — 반 이닝 자동 저장(0x22754)마다 지난 시간을 칸 0(일반) 플레이 시간에
        recordStat({ kind: '플레이시간', mode: GENERAL_STAT_MODE, elapsed: lapPlayClock() })
        modeSave.saveGeneralGame(game)
      }}
      // 정산 진입 0x4ea0c — 한 판 치고 끝이라 선수 정산은 없지만, 모드 1 에서도 기록 달성 G 합을 전역 G(+0x64)에
      // 더하고(4ec5a, 99999 상한) 0x4ec82 `0x22c7d(합, 모드 1)` 로 획득 GP 통계(칸 0 일반)에 적는다 (fc7f196).
      // 이어서 0x4ec8a `0x22e10` — 이번 경기 기록달성 횟수(0x1fce0, 모드 1)를 통계 [mgr+0xc8]+4+n 누계에 더한다.
      // 같은 진입 끝 0x4f3d6 이 +0x4d = 0. 결과 화면 확인(onFinish) 앞이라 그 사이에 창을 닫아도 정산은 남는다
      onSettlementEnter={(summary) => {
        const earned = summary.gamePoints ?? 0
        if (earned !== 0) wallet.gain(earned)
        recordStat({ kind: 'G획득', mode: GENERAL_STAT_MODE, amount: earned })
        recordStat({ kind: '기록달성', recordIds: summary.recordIds ?? [] })
        // 0x4ea0c 끝 0x4f54a `0x4e8b0` — 지난 시간을 칸 0(일반) 플레이 시간에 (0x22efc)
        recordStat({ kind: '플레이시간', mode: GENERAL_STAT_MODE, elapsed: lapPlayClock() })
        modeSave.finishGeneralGame()
      }}
      // 경기진행 설정 전역 m = 0 칸 — 창을 열 때 읽고(0x5fef4) 확인 0x60376 이 되써 0x1f1b9 로 남긴다. 이어하기 경기도 이 값
      initialSettings={modeSave.save.generalMatchSettings}
      onMatchSettingsConfirm={modeSave.setGeneralMatchSettings}
      // 전역기록 +0x11e — 22 에 처음 들어오면 설정 창을 저절로 연다. 시즌 0xdd 와 같은 칸
      matchSettingsSeen={modeSave.matchSettingsSeenPort}
      // 진입 창 [13] 의 빠른실행 (this+0x14c) — 1~6 단계를 건너뛰고 경기정보로
      isQuickStart={isGeneralQuickStart}
      openedHiddenTeamIds={collection.collection.openedHiddenIds}
      // 마선수 오픈 플래그(mgr[0x30+idx]) — 이제 저장에서 읽는다. 새 저장이면 기본 개방분
      // (싸이커·메디카) 둘만 켜져 있다 (K-bursts-special.md K-3 3-3)
      openedAcePitcherIds={aceSelect.openedAcePitcherIds}
      openedAceBatterIds={aceSelect.openedAceBatterIds}
      // 마선수 레벨(mgr[0x13a+칸]) — 이름 막대 LV·`0` 키 레벨업 창, 그리고 경기 속 마선수
      // 능력치 배율(0xb6414)·상대 마투수 마구 횟수(0xaebe4)가 같은 칸을 본다
      aceLevels={aceSelect.levels}
      onLevelUpAce={aceSelect.onLevelUp}
      // 원본 G포인트는 전역 기록(`mgr+0x64`)이라 모드와 상관없이 하나다 — 지갑을 그대로 본다.
      // 육성 선수가 없어도 값이 있고, 육성 선수가 있으면 그쪽 화면과 같은 값이다.
      gamePoint={wallet.balance}
      // 경기 중 자동진행 [예] 0x3c83a~0x3c84e — 전역 G 에서 30 을 뺀다. 모드 1 은 소모 통계(0x22c29)에 적지 않는다
      // (0x3c850: 모드 2 → k3 · 8·9 → k4 만). 무한G 스위치가 켜져 있으면 지갑이 쓰기를 무시한다
      onSpendGamePoint={wallet.spend}
      // 경기 중 메뉴 하위 4 환경설정 — 시즌 경기와 같은 전역 설정
      settings={gameSettings.settings}
      onSettingsChange={gameSettings.setSettings}
      // "예" → G를 빼고 플래그를 세운다 (0xa3e2 · 0xa3f6). 모자람 판정은 화면이 이미 했다.
      // `spend` 의 자르기 [0, 99999] 와 "모자라면 한 푼도 안 깎는다" 가 원본 0xa3dc~0xa3f4 와 같다.
      onOpenAce={aceSelect.onOpenAce}
      onAllAcesOpen={aceSelect.onAllAcesOpen}
      gaugeSettingOn={gameSettings.settings.pitchControl === '게이지'}
      runningModeManual={gameSettings.settings.runningMode === '수동'}
      // 환경설정 "송구" (설정 +0xf4) — 팀 경기는 사람이 **수비하는 타석**에서만 먹는다 (0xae6c8)
      throwModeManual={gameSettings.settings.throwMode === '수동'}
      // 결과 화면 확인 — 정산은 위 정산 진입(0x4ea0c)이 이미 했다
      onFinish={() => leaveGeneralMode()}
      onExit={leaveGeneralMode}
    />,
  )
}
