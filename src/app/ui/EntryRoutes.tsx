import { useMemo, useState } from 'react'
import type { Screen } from '@/app/model/screen'
import { MessageBox, RawScreen } from '@/shared/ui'
import { HomeRunDerbyScreen } from '@/pages/home-run-derby/ui/HomeRunDerbyScreen'
import { effectiveAbilityOf } from '@/entities/career/model/condition'
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
import { SpecialScreen } from '@/pages/special/ui/SpecialScreen'
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
}

/** 커리어가 아직 없을 때의 화면 — 타이틀 → 메인 메뉴(도움말) → 선수 등록. */
export function EntryRoutes({ screen, setScreen, session, gameSettings, collection, random }: EntryRoutesProps) {
  const [isMissionBlocked, setMissionBlocked] = useState(false)
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
    return <SpecialScreen collection={collection} onBack={() => setScreen({ kind: '메인메뉴' })} />
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
    if (career === null) return null
    return (
      <HomeRunDerbyScreen
        // 원본은 모드 7 로 들어갈 때 0x213c0(앱,4,0) 으로 나만의리그 타자편 저장을 올린다
        ability={effectiveAbilityOf(career)}
        // 같은 저장을 올리니 겉모습도 그 선수 것이다 — 폼(몸통·손)·피부·장비
        batterForm={career.battingTypeIndex * 2 + career.battingSide}
        batterSkinIndex={career.skinIndex}
        batterEquipmentLevels={career.equipmentLevels}
        random={random}
        bestDistance={derbyBest}
        gamePoint={career.gamePoint}
        onFinish={(result) => {
          if (result.bestDistance > derbyBest) {
            setDerbyBest(result.bestDistance)
            derbyStore.save({ bestDistance: result.bestDistance })
          }
          session.actions.gainGamePoint(result.gainedGamePoint)
        }}
        settings={gameSettings.settings}
        onSettingsChange={gameSettings.setSettings}
        onExit={() => setScreen({ kind: '메인메뉴' })}
      />
    )
  }

  if (isMissionBlocked) {
    return (
      <MessageBox
        text="나만의리그 선수를 먼저 등록해야합니다"
        buttons={['확인']}
        onAnswer={() => setMissionBlocked(false)}
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
        // 홈런더비도 미션과 같은 선수 고르기 창을 쓴다 — 결과 2 = 육성 타자 · 4 = 명예 타자 (H-2 · Q2)
        if (session.career === null && session.savedCareer === null) {
          return setMissionBlocked(true)
        }
        if (mode === '홈런더비') return setScreen({ kind: '홈런더비' })
        if (mode !== '미션') return
        // 원본은 **육성 선수도 명예의 전당 선수도 없으면 미션에 못 들어간다** (Q2 3-1 확정).
        // 코드 5 → StrCOMMON[38] 팝업만 띄우고 되돌아간다. 신인 능력치로 대신 넣어 주는 길은 없다.
        // 웹에는 아직 명예의 전당이 없으니 육성 선수만 본다.
        if (session.career === null && session.savedCareer === null) {
          return setMissionBlocked(true)
        }
        setScreen({ kind: '미션선택' })
      }}
      onBack={() => setScreen({ kind: '타이틀' })}
      onHelp={() => setScreen({ kind: '도움말' })}
      onSettings={() => setScreen({ kind: '환경설정' })}
      onSpecial={() => setScreen({ kind: '스페셜' })}
    />
  )
}
