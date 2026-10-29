import type { ReactNode } from 'react'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { ACE_PHASE } from '@/pages/general-mode/lib/generalModeSetup'
import {
  HelpScreen,
  SettingsScreen,
  MyLeagueTeamSelectScreen,
  CreatePlayerScreen,
  SpecialScreen,
  AceSelectScreen,
  SpecialEditScreen,
} from '@/app/ui/entryRoutes/lazyScreens'
import type { EntryRouteView } from '@/app/ui/entryRoutes/useEntryRouteState'
import type { ScreenOf } from '@/app/ui/entryRoutes/entryRoutesProps'

export function helpScreenOf(view: EntryRouteView, screen: ScreenOf<'도움말'>): ReactNode {
  const { setScreen, wallet } = view
  // 도움말(상태 7)·게임문의(상태 10) 그리기 0x2fc8c: 판 0x58371 · 뷰어 0x639a5 · 머리띠 0x54d95(skin, 0, 5) — 제목 0 이라 G 도.
  // 게임문의 진입 0x2668c 는 뷰어를 장 6 쪽 보기로 열고 [뷰어+0x45c] = 1 로 장 이동을 잠근다 — 서버 없이 도는 화면이다
  return screen.isInquiry === true ? (
    <HelpScreen chapter={6} isChapterLocked gamePoint={wallet.balance} onBack={() => setScreen({ kind: '메인메뉴' })} />
  ) : (
    <HelpScreen gamePoint={wallet.balance} onBack={() => setScreen({ kind: '메인메뉴' })} />
  )
}

export function specialScreenOf(view: EntryRouteView): ReactNode {
  const { setScreen, collection, wallet, aceSelect, hallOfFameDeletion, onRenamePlayer, annalsSecretCode, setAnnalsSecretCode } = view
  return (
    <SpecialScreen
      collection={collection}
      {...(hallOfFameDeletion === undefined ? {} : { hallOfFameDeletion })}
      // 머리띠 0x54d95 는 제목이 있으면 전역 G(mgr+0x64)를 같이 그린다 — 스페셜 목록(제목 0)·명예의 전당(제목 16)
      gamePoint={wallet.balance}
      annalsSecretCode={annalsSecretCode}
      onAnnalsSecretCodeChange={setAnnalsSecretCode}
      // 상태 28 = 공용 목록 k 11 + 레벨업 창 0x5f395 — OK·`0` 이 오픈/레벨업, CLR 이 상태 6 으로 (0x2af20)
      {...(aceSelect === undefined
        ? {}
        : {
            renderAceSelect: (onBack: () => void) => (
              <AceSelectScreen
                mode="레벨업"
                phase={ACE_PHASE.마투수}
                openedAcePitcherIds={aceSelect.openedAcePitcherIds}
                openedAceBatterIds={aceSelect.openedAceBatterIds}
                levels={aceSelect.levels}
                gamePoint={wallet.balance}
                onOpenAce={aceSelect.onOpenAce}
                onLevelUp={aceSelect.onLevelUp}
                onSelect={() => undefined}
                onCancel={onBack}
                // 하위 28 그리기 0x2df78 도 맨 앞(0x2df8e)에 메뉴 바탕 0x58371(skin, [this+0x90], 0) 을 깐다
                underlay={<SkinBackdrop kind="메뉴바탕" />}
              />
            ),
          })}
      // 상태 29 = 에디트 — 팀 고르기(목록 k 9) → 기본 명단 보기 → 이름 입력, CLR 이 상태 6 으로 (0x2b2e0)
      {...(onRenamePlayer === undefined
        ? {}
        : {
            renderEdit: (onBack: () => void) => <SpecialEditScreen gamePoint={wallet.balance} onRename={onRenamePlayer} onBack={onBack} />,
          })}
      onBack={() => setScreen({ kind: '메인메뉴' })}
    />
  )
}

export function settingsScreenOf(view: EntryRouteView): ReactNode {
  const { setScreen, session, gameSettings, wallet, onResetEditedNames, onResetCareerEdition, careerResetBlockOf, onResetSeason } = view
  return (
    <SettingsScreen
      settings={gameSettings.settings}
      // 값은 메모리만 고치고 첫 화면을 나갈 때(0x295e2) 한 번 0x1f1b9 로 쓴다
      onChange={gameSettings.changeSettings}
      onSave={gameSettings.saveSettings}
      onResetCareer={onResetCareerEdition ?? (() => session.actions.resetCareer())}
      {...(onResetEditedNames === undefined ? {} : { onResetEditedNames })}
      {...(careerResetBlockOf === undefined ? {} : { careerResetBlockOf })}
      {...(onResetSeason === undefined ? {} : { onResetSeason })}
      mainMenu={{ gamePoint: wallet.balance }}
      onBack={() => setScreen({ kind: '메인메뉴' })}
    />
  )
}

// 원본 흐름은 0x65 팀 고르기 → 0x66 등록 → 0x67 확인이다 (C-6)
export function teamSelectScreenOf(view: EntryRouteView): ReactNode {
  const { setScreen, collection, wallet } = view
  return (
    // 히든 줄은 열렸어도 못 고르고 힌트 팝업만 뜬다 (0x14114 — `MyLeagueTeamSelectScreen`)
    <MyLeagueTeamSelectScreen
      side="타자편"
      title="나만의리그타자편"
      // 머리띠 G — 전역 G(+0x64). 안 넘기면 0 으로 찍혔다
      gamePoint={wallet.balance}
      // 히든 팀 열림은 커리어가 아니라 전역 기록 +0x70 + idx 다 — 투수편(App 의 PitcherCreateFlow)과 같은 출처
      openedHiddenIds={collection.openedHiddenIds}
      onSelect={(teamId) => setScreen({ kind: '선수등록', teamId })}
      // 101 취소 0x14114 1424c~14264: 0x375d · 장면 0x103 · [0x140006c] = 5(게임시작 목록으로 바로) · [0x1552d14] = 1(전역 모드를
      // 일반으로 — 메인 메뉴 생성자 0x237fa 가 [0x1552d10] 에 옮긴다. 다음 모드 진입 0x327b8 이 다시 적으니 웹은 들 칸이 없다)
      onCancel={() => setScreen({ kind: '메인메뉴', openTier: 5 })}
    />
  )
}

export function createPlayerScreenOf(view: EntryRouteView, screen: ScreenOf<'선수등록'>): ReactNode {
  const { setScreen, session, wallet } = view
  return (
    <CreatePlayerScreen
      teamId={screen.teamId}
      // 머리띠 G — 전역 G(+0x64)
      gamePoint={wallet.balance}
      onCreate={session.actions.startNewCareer}
      // 등록에서 물러나면 팀 고르기로 돌아간다 (원본도 한 단계씩 뒤로 간다)
      onCancel={() => setScreen({ kind: '팀선택' })}
    />
  )
}
