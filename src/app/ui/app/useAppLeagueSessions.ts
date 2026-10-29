import { useMemo, useReducer } from 'react'
import { useSceneBgm } from '@/app/model/useSound'
import { usePitcherLeagueBgm, usePitcherLeagueBgmRestart, useResumeCoverStop, useScreenBgm, useSeasonMenuBgm } from '@/app/model/screenBgm'
import { useSeasonSession } from '@/app/model/useSeasonSession'
import { usePitcherLeagueSession } from '@/app/model/usePitcherLeagueSession'
import { NARI_PITCHER_MODE } from '@/app/ui/app/appConstants'
import type { AfterLateBindings } from '@/app/ui/app/useAppLateBindings'
import { pitcherEndingIndexOf, pitcherStoryContextOf, sceneBgmOf, isResumeCoverOf } from '@/app/ui/app/appDerivations'

/** 시즌 · 투수편 세션과 화면 배경음 — 배경음 훅은 세션 뒤 이 차례 그대로 돈다 */
export function useAppLeagueSessions(
  app: Pick<
    AfterLateBindings,
    | 'seasonStore'
    | 'pitcherStore'
    | 'collectionRewardStore'
    | 'pitcherWalletMergeStore'
    | 'modeSave'
    | 'pitcherNariGameSave'
    | 'aceMatchPendingPorts'
    | 'aceMatchHoldPort'
    | 'gameSettings'
    | 'sound'
    | 'random'
    | 'screen'
    | 'aceOpen'
    | 'aceLevels'
    | 'wallet'
    | 'hiddenOpenNotice'
    | 'recordStat'
    | 'recordSeasonRegularWin'
    | 'readHallOfFame'
    | 'readAutobotBatInput'
    | 'readPitcherOtherModes'
    | 'seasonGameSettingsNow'
  >,
) {
  const {
    seasonStore,
    pitcherStore,
    collectionRewardStore,
    pitcherWalletMergeStore,
    modeSave,
    pitcherNariGameSave,
    aceMatchPendingPorts,
    aceMatchHoldPort,
    gameSettings,
    sound,
    random,
    screen,
    aceOpen,
    aceLevels,
    wallet,
    hiddenOpenNotice,
    recordStat,
    recordSeasonRegularWin,
    readHallOfFame,
    readAutobotBatInput,
    readPitcherOtherModes,
    seasonGameSettingsNow,
  } = app
  const seasonSession = useSeasonSession(
    seasonStore,
    random,
    wallet,
    aceLevels.levels,
    recordStat,
    readAutobotBatInput,
    collectionRewardStore,
    readHallOfFame,
    // 전역기록 +0x11e — 0xdd 진입 0x6548 과 일반 22 진입 0x3163c 가 같은 칸을 본다
    modeSave.matchSettingsSeenPort,
    // 정산 0x4ea0c 의 정규시즌 승리 수 +0xbf → 100 이면 히든 45 (0x9f6f0 · 0x62368)
    recordSeasonRegularWin,
    // 환경설정 투구 게이지(+0x2d, 0x3f500) · 주루(+0xbd, 0xae690) · 송구(+0xf4, 0xae6c8) — 원본은 모드를 안 가린다.
    // 일반모드(아래 `GeneralModeScreen`)와 같이 경기를 세울 때 싣는다
    seasonGameSettingsNow,
  )
  // 142 경기 준비 0x1c46c 가 내 마타자·마투수를 열린 것 중에서 굴린다 (0x9f604 · 0x9f650, 825865d)
  const nariOpenedAces = useMemo(
    () => ({ pitcherIds: aceOpen.openedAcePitcherIds, batterIds: aceOpen.openedAceBatterIds }),
    [aceOpen.openedAcePitcherIds, aceOpen.openedAceBatterIds],
  )
  // 투수편 G도 같은 지갑 한 칸이다 — 옛 투수 저장에 남은 G는 표식 칸을 보고 딱 한 번 옮겨 온다
  const pitcherSession = usePitcherLeagueSession(
    pitcherStore,
    random,
    gameSettings.settings.pitchControl === '게이지',
    wallet,
    pitcherWalletMergeStore,
    // 환경설정 "송구" (설정 +0xf4) — 투수편은 사람이 늘 수비라 여기서만 이 설정이 먹는다 (0xae6c8)
    gameSettings.settings.throwMode === '수동',
    recordStat,
    // 같은 날 CPU 끼리 경기·포스트시즌 CPU 경기의 마선수 배율(0xd88aa)도 전역 레벨 칸을 본다
    aceLevels.levels,
    readPitcherOtherModes,
    nariOpenedAces,
    pitcherNariGameSave,
    // 나간 마선수 대결 대기 — 전역기록 g[0x170] · g[0x172] · g[0x176] · g[0x177] (선수를 새로 만들어도 남는다)
    aceMatchPendingPorts[NARI_PITCHER_MODE],
    // 장면 0x106 은 떠나면 헐린다 — 투수편 화면이 서 있을 때만 105 도착 고리가 돈다
    screen.kind === '투수편',
    // 정규시즌 우승 팝업 0xb 닫힘의 0x62369(0x29 · 0x32) 알림 창
    hiddenOpenNotice.announce,
    // 자동 훑기 0x1cf9c 의 대결 대기 가드(1cfe4~1d008) — 두 편 칸을 다 본다 (B-124)
    aceMatchHoldPort,
  )
  // 화면이 바뀌면 그 화면의 배경음으로 갈아탄다 (`screenBgm.ts` 의 표). 투수편은 안쪽 장면(128 이어하기 4)을 본다
  const pitcherBgm = usePitcherLeagueBgm(
    screen.kind === '투수편',
    pitcherSession.scene,
    pitcherEndingIndexOf(pitcherSession),
    pitcherStoryContextOf(pitcherSession),
    pitcherSession.managementBgmRestart,
  )
  // 메인 메뉴는 환경설정에서 돌아올 때(0x24a40) · 게임시작 목록으로 새로 설 때(0x25b88) 1 을, 관리 화면은 외출 지도에서
  // 돌아올 때(0x1aec4) 4 를 처음부터 다시 튼다
  // 화면이 '관리' 인 채 125 → 105 로 다시 들어오면(훈련 결과 창 · 훈련 알림을 닫을 때) 0x1aec4 가 4 를 처음부터 — 타자편 세션이 올린다
  const [batterManagementBgmRestart, bumpBatterManagementBgmRestart] = useReducer((count: number) => count + 1, 0)
  const screenBgm = useScreenBgm(screen, batterManagementBgmRestart)
  const pitcherBgmRestart = usePitcherLeagueBgmRestart(screen.kind === '투수편', pitcherSession.scene, pitcherSession.managementBgmRestart)
  useSceneBgm(sound, sceneBgmOf(screen, pitcherBgm, screenBgm.bgm), screenBgm.restartSerial + pitcherBgmRestart)
  // 시즌 관리 메뉴 0xc9 의 틀 0x73b8 — 이전 상태가 목록에 들면 배경음 4 (위 화면 표 뒤에 돌아야 이긴다)
  useSeasonMenuBgm(sound, screen.kind === '시즌모드', seasonSession.scene, seasonSession.trainingResult !== null)
  // 이어하기 길의 137 — 100 진입 1c15e 의 stopBgm (`useResumeCoverStop`)
  useResumeCoverStop(sound, isResumeCoverOf(screen, pitcherSession))
  return {
    seasonSession,
    nariOpenedAces,
    pitcherSession,
    pitcherBgm,
    screenBgm,
    pitcherBgmRestart,
    batterManagementBgmRestart,
    bumpBatterManagementBgmRestart,
  }
}

/** 이 훅까지 선 앱 칸 */
export type AfterLeagueSessions = AfterLateBindings & ReturnType<typeof useAppLeagueSessions>
