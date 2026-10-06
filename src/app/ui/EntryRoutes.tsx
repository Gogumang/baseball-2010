import { useMemo, useState } from 'react'
import type { Screen } from '@/app/model/screen'
import { MessageBox, RawScreen } from '@/shared/ui'
import { HomeRunDerbyScreen } from '@/pages/home-run-derby/ui/HomeRunDerbyScreen'
import { modeBatterOf, modeBatterOfHallOfFame } from '@/app/model/modeBatter'
import { nariBatterOf } from '@/app/model/useCollection'
import { hallOfFameBatterAt } from '@/entities/collection/model/collection'
import type { HallOfFamePlayerPick } from '@/entities/collection/model/collection'
import { createLocalStorageJsonStore } from '@/shared/api/save/localStorageJsonStore'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 홈런더비 최고 비거리 저장 칸 */
const DERBY_BEST_KEY = 'compus-baseball/derby-best'

/** StrMAINMENU[14] 원문 그대로 (`base/extracted/StrMAINMENU.json`) */
const MY_LEAGUE_EDITION_PROMPT = '!C어떤 선수로!N플레이 하시겠습니까?'
/** 선수 목록 결과 코드 1 육성 투수 · 2 육성 타자 → 원본 모드 3 · 4 (H-modes 1절) */
const MY_LEAGUE_EDITIONS = [
  { label: '육성 투수', code: 1 },
  { label: '육성 타자', code: 2 },
] as const
import type { useCareerSession } from '@/app/model/useCareerSession'
import type { useGameSettings } from '@/app/model/useGameSettings'
import type { Collection } from '@/entities/collection/model/collection'
import type { GamePointWalletSession } from '@/entities/wallet/model/useGamePointWallet'
import { HallOfFameScreen, SpecialScreen } from '@/pages/special/ui/SpecialScreen'
import type { HallOfFameDeletion } from '@/pages/special/ui/SpecialScreen'
import { ACE_PHASE, AceSelectScreen } from '@/pages/general-mode'
import { TitleScreen } from '@/pages/title/ui/TitleScreen'
import { MainMenuScreen } from '@/pages/main-menu/ui/MainMenuScreen'
import { CreatePlayerScreen } from '@/pages/create-player/ui/CreatePlayerScreen'
import { TeamSelectScreen } from '@/pages/create-player/ui/TeamSelectScreen'
import { HelpScreen } from '@/pages/help/ui/HelpScreen'
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
}

/** 커리어가 아직 없을 때의 화면 — 타이틀 → 메인 메뉴(도움말) → 선수 등록. */
export function EntryRoutes({
  screen, setScreen, session, gameSettings, collection, random, wallet, aceSelect, hallOfFameDeletion,
}: EntryRoutesProps) {
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
    return <HelpScreen onBack={() => setScreen({ kind: '메인메뉴' })} />
  }

  if (screen.kind === '스페셜') {
    return (
      <SpecialScreen
        collection={collection}
        {...(hallOfFameDeletion === undefined ? {} : { hallOfFameDeletion })}
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
        onBack={() => setScreen({ kind: '메인메뉴' })}
      />
    )
  }

  /**
   * 나만의리그 편 고르기 — 원본 메인 메뉴 **하위 13(0x2464c)** 이다 (H-modes 1절).
   *
   * 예/아니오 팝업이 아니라 **선수 목록 창**(`0x62568` / 항목 채우기 `0x5eae0`)이고,
   * 질문 머리는 **StrMAINMENU[14] `!C어떤 선수로!N플레이 하시겠습니까?`** 다.
   * 결과 코드는 **1 육성 투수 · 2 육성 타자 · 3 명예 투수 · 4 명예 타자** 이고
   * (Q2-mission-rewards 1절 확정), 나만의리그는 그중 **육성 쪽만** 받아 모드 3·4 로 간다.
   *
   * ⚠️ **근사다**: 명예 선수 칸(3·4)은 미션·홈런더비가 쓰는 자리라 여기서는 안 보인다.
   *    원본이 나리에서도 그 두 칸을 그리는지는 `0x5eae0` 속을 안 읽어 확인하지 못했다.
   *
   * 예전에는 `MessageBox` 를 썼는데, 그 상자의 버튼은 글자가 아니라 `popup.pzx` **그림**
   * (프레임 1 "예" · 2 "아니오")이라 `buttons` 로 넘긴 이름이 화면에 안 나오고 늘 예/아니오가 떴다.
   */
  if (screen.kind === '나리편선택') {
    return (
      <RawScreen>
        <MessageBox
          text={MY_LEAGUE_EDITION_PROMPT}
          buttons={MY_LEAGUE_EDITIONS.map((edition) => edition.label)}
          listItems={MY_LEAGUE_EDITIONS.map((edition) => edition.label)}
          onAnswer={(index) => setScreen(index === 0 ? { kind: '투수편' } : { kind: '팀선택' })}
        />
      </RawScreen>
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
          collection={collection}
          mode={{
            kind: '선수고르기', purpose: '홈런더비', nari: { 투수: null, 타자: nariBatterOf(career) },
            onPick: setDerbyPick, onCancel: leave,
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
      onContinue={session.actions.continueSaved}
      onNewGame={() => setScreen({ kind: '나리편선택' })}
      onSelectMode={(mode) => {
        // 시즌모드·일반모드는 팀을 맡는 모드라 육성 선수가 없어도 들어간다
        if (mode === '시즌모드') return setScreen({ kind: '시즌모드' })
        if (mode === '일반모드') return setScreen({ kind: '일반모드' })
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
    />
  )
}
