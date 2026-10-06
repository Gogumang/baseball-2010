import { useMemo, useState } from 'react'
import type { Screen } from '@/app/model/screen'
import { MessageBox } from '@/shared/ui'
import { HomeRunDerbyScreen } from '@/pages/home-run-derby/ui/HomeRunDerbyScreen'
import { modeBatterOf, modeBatterOfHallOfFame } from '@/app/model/modeBatter'
import { nariBatterOf } from '@/app/model/useCollection'
import { hallOfFameBatterAt } from '@/entities/collection/model/collection'
import type { HallOfFamePlayerPick } from '@/entities/collection/model/collection'
import { createLocalStorageJsonStore } from '@/shared/api/save/localStorageJsonStore'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 홈런더비 최고 비거리 저장 칸 */
const DERBY_BEST_KEY = 'compus-baseball/derby-best'

import type { useCareerSession } from '@/app/model/useCareerSession'
import type { useGameSettings } from '@/app/model/useGameSettings'
import type { Collection } from '@/entities/collection/model/collection'
import type { GamePointWalletSession } from '@/entities/wallet/model/useGamePointWallet'
import { HallOfFameScreen, SpecialScreen } from '@/pages/special/ui/SpecialScreen'
import type { HallOfFameDeletion } from '@/pages/special/ui/SpecialScreen'
import { ACE_PHASE, AceSelectScreen } from '@/pages/general-mode'
import { TitleScreen } from '@/pages/title/ui/TitleScreen'
import { MainMenuScreen } from '@/pages/main-menu/ui/MainMenuScreen'
import type { NariGameReady } from '@/pages/main-menu/model/mainMenu'
import { CreatePlayerScreen } from '@/pages/create-player/ui/CreatePlayerScreen'
import { TeamSelectScreen } from '@/pages/create-player/ui/TeamSelectScreen'
import { HelpScreen } from '@/pages/help/ui/HelpScreen'
import { SpecialEditScreen } from '@/pages/special-edit/ui/SpecialEditScreen'
import { SettingsScreen } from '@/pages/settings/ui/SettingsScreen'

interface EntryRoutesProps {
  readonly screen: Screen
  readonly setScreen: (screen: Screen) => void
  readonly session: ReturnType<typeof useCareerSession>
  readonly gameSettings: ReturnType<typeof useGameSettings>
  readonly collection: Collection
  readonly random: RandomPort
  /** 전역 G 지갑 (원본 `mgr[+0x64]`) — 홈런더비 결과창의 "보유 G" 가 이 값이다 (0x461f2) */
  readonly wallet: GamePointWalletSession
  /** 스페셜 마선수 선택(상태 28)이 쓰는 마선수 오픈·레벨 저장과 두 동작 (앱이 일반모드와 같이 쓴다) */
  readonly aceSelect?: {
    readonly openedAcePitcherIds: readonly number[]
    readonly openedAceBatterIds: readonly number[]
    readonly levels: Readonly<Record<number, number>>
    readonly onOpenAce: (cell: number) => void
    readonly onLevelUp: (cell: number, cost: number) => void
  }
  /** 스페셜 명예의 전당 "슬롯에서 삭제" — 앱이 기록연감·시즌 명단 정리를 묶어 넘긴다 */
  readonly hallOfFameDeletion?: HallOfFameDeletion
  /**
   * 전부 수집 보상 판정·지급(0x28e98 → 0x292f8) — 줄 것이 있으면 지급까지 마치고 팝업 글을, 없으면 null.
   * 메인 메뉴 처음 단 열 번째 갱신에 부르고, 팝업을 닫으면 곧바로 다시 부른다([this+0x2c] = 9 → 다음 갱신 10).
   */
  readonly claimCollectionReward?: () => string | null
  /** 스페셜 에디트(상태 29)의 이름 저장 0xaa4ad + 파일 저장 0x1f1b9 — 앱의 에디트 이름표 고리. 안 넘기면 에디트 칸이 안 열린다 */
  readonly onRenamePlayer?: (id: number, isPitcher: boolean, name: string) => void
  /** 환경설정 → 모드 초기화 → 에디트 초기화 0x204c1 (이름표 memset) — 앱의 에디트 이름표 고리 */
  readonly onResetEditedNames?: () => void
  /**
   * 일반모드 진입 창 [13](하위 12 0x296f0)에서 새로하기(상태 18) · 빠른실행(this+0x14c = 1 → 상태 22)을 골랐다.
   * 앱이 빠른실행 여부를 일반모드 화면에 넘긴다. 안 넘기면 새로하기처럼 들어간다.
   */
  readonly onStartGeneralMode?: (isQuickStart: boolean) => void
  /** 전역기록 +0x4d — 일반모드 경기 중간 저장 있음 (메인 메뉴 [13]·[15]·[최근게임]) */
  readonly isGeneralGameInProgress?: boolean
  /** 전역기록 +0x3c — 마지막 모드 ([최근게임] 0x28d54) */
  readonly lastPlayedMode?: number
  /** 모드를 시작했다 — 0x327b8 머리의 +0x3c = 모드 (나리 [14] 3·4 · 시즌 2 · 홈런더비 고르기 7) */
  readonly onLastPlayedMode?: (mode: number) => void
  /** 일반모드 이어하기 — 상태 0x27 → 0x327b8(this, 1) → 0x213c0(앱, 1, 0) → 장면 0x104 */
  readonly onResumeGeneralGame?: () => void
  /** 나리 두 편의 `전역기록 +0x40+m && +0x4c+m` (+0x4f · +0x50) — [14]·[최근게임] 의 모드 3·4 갈래 */
  readonly nariGameReady?: NariGameReady
  /** 그 갈래의 곧장 경기 — 0x213c0(앱, m, 0) 으로 그 편 저장을 올려 장면 0x104 */
  readonly onResumeNariGame?: (edition: '타자편' | '투수편') => void
}

/** 원본 모드 번호 — 0x327b8 이 +0x3c 에 적는 값 */
const SEASON_MODE = 2
const NARI_PITCHER_MODE = 3
const NARI_BATTER_MODE = 4
const HOME_RUN_DERBY_MODE = 7

/** 커리어가 아직 없을 때의 화면 — 타이틀 → 메인 메뉴(도움말) → 선수 등록. */
export function EntryRoutes({
  screen, setScreen, session, gameSettings, collection, random, wallet, aceSelect, hallOfFameDeletion, claimCollectionReward,
  onRenamePlayer, onResetEditedNames, onStartGeneralMode,
  isGeneralGameInProgress = false, lastPlayedMode = 1, onLastPlayedMode, onResumeGeneralGame,
  nariGameReady, onResumeNariGame,
}: EntryRoutesProps) {
  /** 전부 수집 보상 팝업 글 (0x292f8 의 `0xbbef9(글, 1, −1, 1)`) — 메뉴 위에 뜬다 */
  const [collectionRewardText, setCollectionRewardText] = useState<string | null>(null)
  const claimReward = () => setCollectionRewardText(claimCollectionReward?.() ?? null)
  /**
   * 홈런더비 선수 고르기 결과 (하위 16 0x29ac8 — 코드 2 나리 타자 · 4 명예 타자, 전역기록 +0xa6).
   * null 이면 아직 안 골랐다 — 들어올 때마다 0x25e6c → 0x5eb8c 가 +0xa6 을 −1 로 되돌리고 다시 고르게 한다.
   */
  const [derbyPick, setDerbyPick] = useState<HallOfFamePlayerPick | null>(null)
  /** 홈런더비 최고 비거리 (저장 +0x5c) — 원본은 게임 전체 저장에 두므로 커리어와 따로 둔다 */
  const derbyStore = useMemo(() => createLocalStorageJsonStore(DERBY_BEST_KEY), [])
  const [derbyBest, setDerbyBest] = useState(() => {
    const saved = derbyStore.load()
    const value = (saved as { bestDistance?: unknown } | null)?.bestDistance
    return typeof value === 'number' && Number.isFinite(value) ? value : 0
  })

  if (screen.kind === '타이틀') {
    return <TitleScreen onStart={() => setScreen({ kind: '메인메뉴' })} />
  }

  if (screen.kind === '도움말') {
    // 도움말(상태 7) 그리기 0x2fc8c: 판 0x58371 · 뷰어 0x639a5 · 머리띠 0x54d95(skin, 0, 5) — 제목 0 이라 G 도 그린다
    return <HelpScreen gamePoint={wallet.balance} onBack={() => setScreen({ kind: '메인메뉴' })} />
  }

  if (screen.kind === '스페셜') {
    return (
      <SpecialScreen
        collection={collection}
        {...(hallOfFameDeletion === undefined ? {} : { hallOfFameDeletion })}
        // 머리띠 0x54d95 는 제목이 있으면 전역 G(mgr+0x64)를 같이 그린다 — 스페셜 목록(제목 0)·명예의 전당(제목 16)
        gamePoint={wallet.balance}
        // 상태 28 = 공용 목록 k 11 + 레벨업 창 0x5f395 — OK·`0` 이 오픈/레벨업, CLR 이 상태 6 으로 (0x2af20)
        {...(aceSelect === undefined ? {} : {
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
            />
          ),
        })}
        // 상태 29 = 에디트 — 팀 고르기(목록 k 9) → 기본 명단 보기 → 이름 입력, CLR 이 상태 6 으로 (0x2b2e0)
        {...(onRenamePlayer === undefined ? {} : {
          renderEdit: (onBack: () => void) => (
            <SpecialEditScreen gamePoint={wallet.balance} onRename={onRenamePlayer} onBack={onBack} />
          ),
        })}
        onBack={() => setScreen({ kind: '메인메뉴' })}
      />
    )
  }

  if (screen.kind === '환경설정') {
    return (
      <SettingsScreen
        settings={gameSettings.settings}
        hasSavedCareer={session.savedCareer !== null}
        onChange={gameSettings.setSettings}
        onResetCareer={session.actions.resetCareer}
        {...(onResetEditedNames === undefined ? {} : { onResetEditedNames })}
        mainMenu={{ gamePoint: wallet.balance }}
        onBack={() => setScreen({ kind: '메인메뉴' })}
      />
    )
  }

  // 원본 흐름은 0x65 팀 고르기 → 0x66 등록 → 0x67 확인이다 (C-6)
  if (screen.kind === '팀선택') {
    return (
      <TeamSelectScreen
        title="나만의리그타자편"
        openedHiddenIds={session.savedCareer?.openedHiddenIds}
        onSelect={(teamId) => setScreen({ kind: '선수등록', teamId })}
        onCancel={() => setScreen({ kind: '메인메뉴' })}
      />
    )
  }

  if (screen.kind === '선수등록') {
    return (
      <CreatePlayerScreen
        teamId={screen.teamId}
        onCreate={session.actions.startNewCareer}
        // 등록에서 물러나면 팀 고르기로 돌아간다 (원본도 한 단계씩 뒤로 간다)
        onCancel={() => setScreen({ kind: '팀선택' })}
      />
    )
  }

  if (screen.kind === '홈런더비') {
    const career = session.career ?? session.savedCareer
    const leave = () => {
      setDerbyPick(null)
      setScreen({ kind: '메인메뉴' })
    }
    // 하위 16 선수 고르기 — 결과 0(되돌아가기)은 하위 5 모드 목록(웹은 메인 메뉴), 2·4 → 모드 7 (0x29ac8).
    // 육성·명예 타자가 다 없으면 코드 5·6 팝업만 떠서 들어갈 수 없다 (신인 대체 없음, Q2 3-1)
    if (derbyPick === null) {
      return (
        <HallOfFameScreen
          // 하위 16 그리기 0x2df20: 배경 0x58371 · 목록 k 7 · 머리띠 0x54d95(skin, 14 "홈런더비", 5) — G포인트도 그린다
          frame={{ title: '홈런더비', gamePoint: wallet.balance }}
          collection={collection}
          mode={{
            kind: '선수고르기', purpose: '홈런더비', nari: { 투수: null, 타자: nariBatterOf(career) },
            // 하위 16 의 답 2·4 → this+0x13c = 7 → 상태 0x27 → 0x327b8(this, 7) 이 +0x3c = 7
            onPick: (pick) => {
              onLastPlayedMode?.(HOME_RUN_DERBY_MODE)
              setDerbyPick(pick)
            },
            onCancel: leave,
          }}
          onBack={leave}
        />
      )
    }
    // 선수 게터 0x1fc20: 모드 7 · +0x11f == 0 · +0xa6 ≥ 0 → 명전 기록 0x1f640, 그 밖은 나리 타자편 저장(0x213c0(앱,4,0))
    const famer = derbyPick.hallOfFameIndex === null ? null : hallOfFameBatterAt(collection, derbyPick.hallOfFameIndex)
    if (famer === null && career === null) return null
    const derbyBatter = famer === null ? modeBatterOf(career) : modeBatterOfHallOfFame(famer)
    // 겉모습도 그 기록의 생김새(+0xb: 폼 = 2×타입 + 손 · 피부)와 장비 니블이다 — 옛 명전 기록에 없으면 기본 그림
    const look = famer === null
      ? career === null
        ? null
        : { form: career.battingTypeIndex * 2 + career.battingSide, skinIndex: career.skinIndex, equipmentLevels: career.equipmentLevels }
      : {
          form: famer.look === undefined ? undefined : famer.look.typeIndex * 2 + famer.look.handIndex,
          skinIndex: famer.look?.skinIndex,
          equipmentLevels: famer.equipmentLevels,
        }
    return (
      <HomeRunDerbyScreen
        // 원본은 모드 7 로 들어갈 때 0x213c0(앱,4,0) 으로 나만의리그 타자편 저장을 올린다.
        // 능력치는 0xb6414 까지 — 0xb570c 의 질병·부상·사기 감소는 모드 3·4 갈래라 안 먹는다 (`modeBatterOf`)
        ability={derbyBatter.ability}
        batterSkillIds={derbyBatter.skillIds}
        // 같은 저장(또는 명전 기록)을 올리니 겉모습도 그 선수 것이다 — 폼(몸통·손)·피부·장비
        {...(look?.form === undefined ? {} : { batterForm: look.form })}
        {...(look?.skinIndex === undefined ? {} : { batterSkinIndex: look.skinIndex })}
        {...(look?.equipmentLevels === undefined ? {} : { batterEquipmentLevels: look.equipmentLevels })}
        // 단계 1~4 난입 마투수도 전역 마선수 레벨을 본다 — 0xb6414 는 모드 7 도 가리지 않는다
        aceLevels={aceSelect?.levels}
        random={random}
        bestDistance={derbyBest}
        // 보유 G 는 전역 기록 `mgr[+0x64]` 다 (0x461f2) — 선수 칸이 아니라 지갑을 본다
        gamePoint={wallet.balance}
        onFinish={(result) => {
          if (result.bestDistance > derbyBest) {
            setDerbyBest(result.bestDistance)
            derbyStore.save({ bestDistance: result.bestDistance })
          }
          // 결과 보상도 전역 +0x64 에 쌓는다 (0x4f6cc, 상한 99999) — 지갑으로 들어간다
          session.actions.gainGamePoint(result.gainedGamePoint)
        }}
        settings={gameSettings.settings}
        onSettingsChange={gameSettings.setSettings}
        onExit={leave}
      />
    )
  }

  return (
    <MainMenuScreen
      hasSavedGame={session.savedCareer !== null}
      isGeneralGameInProgress={isGeneralGameInProgress}
      lastPlayedMode={lastPlayedMode}
      {...(nariGameReady === undefined ? {} : { nariGameReady })}
      // 0x327b8 모드 3·4 갈래의 곧장 경기(0x328b4) — 머리 327e8 이 먼저 +0x3c = m 을 적는다
      {...(onResumeNariGame === undefined ? {} : {
        onResumeNariGame: (edition: '타자편' | '투수편') => {
          onLastPlayedMode?.(edition === '투수편' ? NARI_PITCHER_MODE : NARI_BATTER_MODE)
          onResumeNariGame(edition)
        },
      })}
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
      onSelectMode={(mode) => {
        // 시즌모드·일반모드는 팀을 맡는 모드라 육성 선수가 없어도 들어간다
        if (mode === '시즌모드') {
          // 하위 14 → this+0x13c = 2 → 상태 0x27 → 0x327b8(this, 2) — +0x3c = 2. 그 모드 2 갈래(+0x42 && +0x4e 면 곧장 경기
          // 0x104, 아니면 장면 0x105)는 `SeasonRoute` 가 들어오는 순간에 가른다 ([최근게임] 모드 2 도 이 길이다)
          onLastPlayedMode?.(SEASON_MODE)
          return setScreen({ kind: '시즌모드' })
        }
        if (mode === '일반모드경기이어하기') return onResumeGeneralGame?.()
        if (mode === '일반모드' || mode === '일반모드빠른실행') {
          const isQuickStart = mode === '일반모드빠른실행'
          return onStartGeneralMode === undefined ? setScreen({ kind: '일반모드' }) : onStartGeneralMode(isQuickStart)
        }
        // 미션(하위 17)·홈런더비(하위 16)는 곧바로 선수 고르기 창으로 간다 — 고를 선수가 없을 때 막는 것도 그 창이다
        // (코드 5 StrCOMMON[38] · 6 [39], Q2 3-1). 메인 메뉴에서 미리 막는 길은 원본에 없다.
        if (mode === '홈런더비') {
          setDerbyPick(null)
          return setScreen({ kind: '홈런더비' })
        }
        if (mode !== '미션') return
        setScreen({ kind: '미션선택' })
      }}
      onBack={() => setScreen({ kind: '타이틀' })}
      onHelp={() => setScreen({ kind: '도움말' })}
      onSettings={() => setScreen({ kind: '환경설정' })}
      onSpecial={() => setScreen({ kind: '스페셜' })}
      onTopMenuTenthTick={claimReward}
      // 하위 4·5 그리기 0x2866c · 0x2863c 끝의 머리띠 0x54d95(skin, 0, 1|5) — 제목 0 이라 전역 G(mgr+0x64)도 그린다
      gamePoint={wallet.balance}
      overlay={collectionRewardText !== null && (
        <MessageBox text={collectionRewardText} buttons={['OK']} onAnswer={claimReward} />
      )}
    />
  )
}
