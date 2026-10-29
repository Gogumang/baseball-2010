import type { ComponentProps, ReactNode } from 'react'
import { MessageBox } from '@/shared/ui'
import { MainMenuScreen } from '@/pages/main-menu/ui/MainMenuScreen'
import { SEASON_MODE, NARI_PITCHER_MODE, NARI_BATTER_MODE } from '@/app/ui/entryRoutes/entryModes'
import type { EntryRouteView } from '@/app/ui/entryRoutes/useEntryRouteState'

type MainMenuMode = Parameters<ComponentProps<typeof MainMenuScreen>['onSelectMode']>[0]

/** 시즌모드 — 팀을 맡는 모드라 육성 선수가 없어도 들어간다 */
function enterSeasonMode({ setScreen, onLastPlayedMode }: EntryRouteView) {
  // 하위 14 → this+0x13c = 2 → 상태 0x27 → 0x327b8(this, 2) — +0x3c = 2. 그 모드 2 갈래(+0x42 && +0x4e 면 곧장 경기
  // 0x104, 아니면 장면 0x105)는 `SeasonRoute` 가 들어오는 순간에 가른다 ([최근게임] 모드 2 도 이 길이다)
  onLastPlayedMode?.(SEASON_MODE)
  return setScreen({ kind: '시즌모드' })
}

/** 일반모드 · 빠른실행 — 팀을 맡는 모드라 육성 선수가 없어도 들어간다 */
function enterGeneralMode({ setScreen, onStartGeneralMode }: EntryRouteView, mode: MainMenuMode) {
  const isQuickStart = mode === '일반모드빠른실행'
  return onStartGeneralMode === undefined ? setScreen({ kind: '일반모드' }) : onStartGeneralMode(isQuickStart)
}

// 미션(하위 17)·홈런더비(하위 16)는 곧바로 선수 고르기 창으로 간다 — 고를 선수가 없을 때 막는 것도 그 창이다
// (코드 5 StrCOMMON[38] · 6 [39], Q2 3-1). 메인 메뉴에서 미리 막는 길은 원본에 없다.
function enterHomeRunDerby({ setScreen, setDerbyPick }: EntryRouteView) {
  setDerbyPick(null)
  return setScreen({ kind: '홈런더비' })
}

/** 게임시작 목록에서 고른 모드로 */
function selectMode(view: EntryRouteView, mode: MainMenuMode) {
  if (mode === '시즌모드') return enterSeasonMode(view)
  if (mode === '일반모드경기이어하기') return view.onResumeGeneralGame?.()
  if (mode === '일반모드' || mode === '일반모드빠른실행') return enterGeneralMode(view, mode)
  if (mode === '홈런더비') return enterHomeRunDerby(view)
  if (mode !== '미션') return
  view.setScreen({ kind: '미션선택' })
}

/** 장면 0x103 생성자 0x234d4 의 [0x140006c] 와 띠 · 머리띠 연출 — 메인 메뉴 화면 칸에서 */
function menuEntryPropsOf(screen: EntryRouteView['screen']) {
  if (screen.kind !== '메인메뉴') return {}
  return {
    // 관리 메뉴 취소(5)면 게임시작 목록으로 바로 연다
    ...(screen.openTier !== undefined ? { openTier: screen.openTier } : {}),
    ...(screen.isBandGrown === true ? { isBandGrown: true } : {}),
    // 머리띠 미끄러짐 [skin+0x84] — 타이틀 갱신 0x245f8 에서 왔을 때만
    ...(screen.isFromTitle === true ? { headerSlides: true } : {}),
  }
}

/** 0x327b8 모드 3·4 갈래의 곧장 경기(0x328b4) — 머리 327e8 이 먼저 +0x3c = m 을 적는다 */
function resumeNariGamePropsOf({ onLastPlayedMode, onResumeNariGame }: EntryRouteView) {
  if (onResumeNariGame === undefined) return {}
  return {
    onResumeNariGame: (edition: '타자편' | '투수편') => {
      onLastPlayedMode?.(edition === '투수편' ? NARI_PITCHER_MODE : NARI_BATTER_MODE)
      onResumeNariGame(edition)
    },
  }
}

export function mainMenuScreenOf(view: EntryRouteView): ReactNode {
  const {
    screen,
    setScreen,
    session,
    wallet,
    isGeneralGameInProgress,
    lastPlayedMode,
    onLastPlayedMode,
    nariGameReady,
    gameStartCursor,
    collectionRewardText,
    claimReward,
    topMenuCursor,
  } = view
  return (
    <MainMenuScreen
      {...menuEntryPropsOf(screen)}
      {...(gameStartCursor === undefined ? {} : { gameStartCursor })}
      topMenuCursor={topMenuCursor}
      hasSavedGame={session.savedCareer !== null}
      isGeneralGameInProgress={isGeneralGameInProgress}
      lastPlayedMode={lastPlayedMode}
      {...(nariGameReady === undefined ? {} : { nariGameReady })}
      {...resumeNariGamePropsOf(view)}
      // 나만의리그 편 고르기 창 [14](하위 13)은 메인 메뉴 위에 뜬다. 고른 편 → 0x327b8(모드 4|3) → 장면 0x106 셋업 0xf684:
      // 그 편 커리어(전역기록 +0x40 + 모드)가 있으면 이어하기(100), 없으면 팀 고르기(101). 지울지 묻는 창은 없다.
      // 투수편은 PitcherLeagueRoute 가 커리어 유무로 등록/관리를 가른다.
      onNewGame={(edition) => {
        // [14] 답 → this+0x13c = 4|3 → 상태 0x27 → 0x327b8 이 +0x3c 에 적는다 ([최근게임] 의 3·4 갈래도 같은 길)
        onLastPlayedMode?.(edition === '투수편' ? NARI_PITCHER_MODE : NARI_BATTER_MODE)
        if (edition === '투수편') return setScreen({ kind: '투수편' })
        if (session.savedCareer !== null) return session.actions.continueSaved()
        setScreen({ kind: '팀선택' })
      }}
      onSelectMode={(mode) => selectMode(view, mode)}
      onHelp={() => setScreen({ kind: '도움말' })}
      onInquiry={() => setScreen({ kind: '도움말', isInquiry: true })}
      onSettings={() => setScreen({ kind: '환경설정' })}
      onSpecial={() => setScreen({ kind: '스페셜' })}
      onTopMenuTenthTick={claimReward}
      // 하위 4·5 그리기 0x2866c · 0x2863c 끝의 머리띠 0x54d95(skin, 0, 1|5) — 제목 0 이라 전역 G(mgr+0x64)도 그린다
      gamePoint={wallet.balance}
      overlay={collectionRewardText !== null && <MessageBox text={collectionRewardText} buttons={['OK']} onAnswer={claimReward} />}
    />
  )
}
