import { useEffect, useMemo, useState } from 'react'
import type { Screen } from '@/app/model/screen'
import { useAtBatRunner } from '@/app/model/useAtBatRunner'
import { useCareerSession } from '@/app/model/useCareerSession'
import { useMissionSession } from '@/app/model/useMissionSession'
import { CareerRoutes } from '@/app/ui/CareerRoutes'
import { EntryRoutes } from '@/app/ui/EntryRoutes'
import { MissionRoutes } from '@/app/ui/MissionRoutes'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { createLocalStorageSaveGame } from '@/shared/api/save/localStorageSaveGame'
import { createLocalStorageMissionRecord } from '@/shared/api/save/localStorageMissionRecord'
import { createLocalStorageJsonStore } from '@/shared/api/save/localStorageJsonStore'
import { useCollection } from '@/app/model/useCollection'
import { isEveryMissionCleared } from '@/entities/mission/model/missionGoal'
import { aceMatchMissionOf, matchResultEventOf } from '@/entities/story/model/aceMatch'
import { effectiveAbilityOf } from '@/entities/career/model/condition'
import type { AceMatchStarter } from '@/app/ui/CareerRoutes'
import { useGameSettings } from '@/app/model/useGameSettings'
import { useSceneBgm, useSceneEnterSound, useSound } from '@/app/model/useSound'
import { screenBgmOf, screenEnterSoundOf } from '@/app/model/screenBgm'
import { useSeasonSession } from '@/app/model/useSeasonSession'
import { SeasonRoute } from '@/app/ui/SeasonRoute'
import { usePitcherLeagueSession } from '@/app/model/usePitcherLeagueSession'
import { PitcherLeagueRoute } from '@/app/ui/PitcherLeagueRoute'
import { GeneralModeScreen, aceOpenPriceOf, useAceOpen } from '@/pages/general-mode'
import { useGamePointWallet } from '@/entities/wallet/model/useGamePointWallet'
import { ROOKIE_BATTER_ABILITY } from '@/entities/batting/model/batter'

const SETTINGS_KEY = 'compus-baseball/settings'
const COLLECTION_KEY = 'compus-baseball/collection'
/** 시즌모드 저장 — 원본은 나만의리그와 **다른 칸**에 담는다 (0x22755) */
const SEASON_KEY = 'compus-baseball/season'
/** 투수편 저장 — 원본도 타자편과 **다른 칸**이다 (StrMAINMENU[210]·[211] 모드 초기화가 따로 지운다) */
const PITCHER_KEY = 'compus-baseball/pitcher-league'
/**
 * 마선수 오픈 플래그 10칸 — 원본은 전역 기록 `mgr[0x30..0x39]` 다 (0xa3f6).
 * 옛 세이브에는 이 칸이 아예 없다 — 없으면 정규화가 기본 개방 둘(싸이커·메디카)만 켠다.
 */
const ACE_OPEN_KEY = 'compus-baseball/ace-open'
/**
 * **G포인트 지갑** — 원본 전역 기록 `mgr[+0x64]` 한 칸이다 (`entities/wallet` 머리글에 디스어셈).
 * 모드와 상관없이 하나라 커리어·시즌 저장과 **따로** 둔다.
 * 옛 세이브에는 이 칸이 없다 — 없으면 `career.gamePoint` 를 그대로 옮겨 온다(이사).
 */
const WALLET_KEY = 'compus-baseball/wallet'

const ENTRY_SCREENS: readonly Screen['kind'][] = ['타이틀', '메인메뉴', '도움말', '환경설정', '스페셜', '나리편선택', '팀선택', '선수등록', '홈런더비', '일반모드']

const MISSION_SCREENS: readonly Screen['kind'][] = [
  '마선수대결',
  '미션선택',
  '미션설명',
  '미션진행',
  '투수미션',
]

/** 화면 분기만 한다. 상태와 규칙은 model의 훅 세 개가 나눠 갖는다. */
export function App() {
  const saveGame = useMemo(() => createLocalStorageSaveGame(), [])
  const missionRecord = useMemo(() => createLocalStorageMissionRecord(), [])
  const settingsStore = useMemo(() => createLocalStorageJsonStore(SETTINGS_KEY), [])
  const collectionStore = useMemo(() => createLocalStorageJsonStore(COLLECTION_KEY), [])
  const seasonStore = useMemo(() => createLocalStorageJsonStore(SEASON_KEY), [])
  const pitcherStore = useMemo(() => createLocalStorageJsonStore(PITCHER_KEY), [])
  const aceOpenStore = useMemo(() => createLocalStorageJsonStore(ACE_OPEN_KEY), [])
  const walletStore = useMemo(() => createLocalStorageJsonStore(WALLET_KEY), [])
  /** 옛 세이브 이사거리 — 지갑 칸이 없던 시절 G는 나만의리그 선수 안에 들어 있었다 */
  const legacyGamePoint = useMemo(() => saveGame.load()?.gamePoint ?? null, [saveGame])
  const gameSettings = useGameSettings(settingsStore)
  // 소리 통로 하나 — 환경설정 칸(0~4) × 25 가 원본 소리 크기다 (옵션 +0x2e)
  const sound = useSound(gameSettings.settings.soundLevel)
  const random = useMemo(() => createSeededRandom(Date.now() & 0x7fffffff), [])
  const [screen, setScreen] = useState<Screen>({ kind: '타이틀' })
  // 화면이 바뀌면 그 화면의 배경음으로 갈아탄다 (`screenBgm.ts` 의 표)
  useSceneBgm(sound, screenBgmOf(screen))
  // 화면에 들어설 때 한 번 나는 소리 — 타이틀의 로고 음성 0 (0x69400)
  useSceneEnterSound(sound, screen.kind, screenEnterSoundOf(screen))

  const runner = useAtBatRunner()
  // 마선수 오픈 플래그 — 원본 전역 기록 `mgr[0x30..0x39]`
  const aceOpen = useAceOpen(aceOpenStore)
  // 전역 G 지갑 — 원본 `mgr[+0x64]`. 마선수 구매·미션·홈런더비가 다 이 한 칸을 본다
  const wallet = useGamePointWallet(walletStore, legacyGamePoint)
  const seasonSession = useSeasonSession(seasonStore, random, wallet)
  const pitcherSession = usePitcherLeagueSession(pitcherStore, random, gameSettings.settings.pitchControl === '게이지')
  const careerSession = useCareerSession({ runner, random, saveGame, screen, setScreen, sound, wallet })
  // 미션 보상 G (0x4ef72) — 지갑으로 들어간다. 육성 선수가 없어도 사라지지 않는다
  const mission = useMissionSession({
    runner, random, missionRecord, screen, setScreen, sound,
    onGamePointReward: careerSession.actions.gainGamePoint,
  })
  const collection = useCollection(collectionStore, careerSession.career, isEveryMissionCleared(mission.clearedKeys))
  // 히든 오픈은 원본에서 전역 저장이라 선수에게도 알려 준다 (상점이 선수 기록으로 판정한다)
  const { syncOpenedHidden } = careerSession.actions
  const openedHiddenIds = collection.collection.openedHiddenIds
  useEffect(() => syncOpenedHidden(openedHiddenIds), [syncOpenedHidden, openedHiddenIds])

  /** 이벤트 match → 공략 레코드 대결. 레코드가 없는 team 은 없지만, 만나면 패배 결과로 넘긴다 (추정) */
  const startAceMatch: AceMatchStarter = (command, carried, context) => {
    const target = aceMatchMissionOf(command.team)
    if (target === null) {
      setScreen({ kind: '이벤트', eventId: matchResultEventOf(command.resultEvents, false), context, carried })
      return
    }
    mission.actions.beginAceMatch(target, { resultEvents: command.resultEvents, context, carried })
  }

  // 미션 모드는 메인 메뉴에서 바로 들어간다. 육성 선수가 없으면 신인 능력치로 한다
  // (예전에는 커리어가 없으면 진입 화면으로 되돌려 미션 모드에 들어갈 수 없었다).
  if (MISSION_SCREENS.includes(screen.kind)) {
    return (
      <MissionRoutes
        screen={screen}
        setScreen={setScreen}
        session={mission}
        runner={runner}
        random={random}
        // 마선수 대결은 육성 선수의 경기용 능력치(장비·스킬·부상 반영)로 친다
        // 미션 진입을 육성 선수가 있을 때만 열어 두므로(EntryRoutes, Q2 3-1) 여기 신인 능력치는
        // 저장을 불러오는 중 같은 짧은 순간에만 쓰인다 — 원본에는 신인 대체가 없다
        ability={careerSession.career === null ? ROOKIE_BATTER_ABILITY : effectiveAbilityOf(careerSession.career)}
        pitchControl={gameSettings.settings.pitchControl}
        gameSettings={gameSettings}
      />
    )
  }

  // 시즌모드는 나만의리그 커리어와 아예 다른 저장·흐름이다 (원본 장면 0x105)
  if (screen.kind === '시즌모드') {
    return (
      <SeasonRoute
        session={seasonSession}
        random={random}
        gameSettings={gameSettings}
        onExit={() => setScreen({ kind: '메인메뉴' })}
      />
    )
  }

  // 일반모드는 저장이 없다 — 준비 다섯 화면부터 경기까지 한 화면이 돌고 메인 메뉴로 돌아간다
  if (screen.kind === '일반모드') {
    return (
      <GeneralModeScreen
        random={random}
        openedHiddenTeamIds={collection.collection.openedHiddenIds}
        // 마선수 오픈 플래그(mgr[0x30+idx]) — 이제 저장에서 읽는다. 새 저장이면 기본 개방분
        // (싸이커·메디카) 둘만 켜져 있다 (K-bursts-special.md K-3 3-3)
        openedAcePitcherIds={aceOpen.openedAcePitcherIds}
        openedAceBatterIds={aceOpen.openedAceBatterIds}
        // 원본 G포인트는 전역 기록(`mgr+0x64`)이라 모드와 상관없이 하나다 — 지갑을 그대로 본다.
        // 육성 선수가 없어도 값이 있고, 육성 선수가 있으면 그쪽 화면과 같은 값이다.
        gamePoint={wallet.balance}
        // "예" → G를 빼고 플래그를 세운다 (0xa3e2 · 0xa3f6). 모자람 판정은 화면이 이미 했다.
        // `spend` 의 자르기 [0, 99999] 와 "모자라면 한 푼도 안 깎는다" 가 원본 0xa3dc~0xa3f4 와 같다.
        onOpenAce={(cell) => {
          wallet.spend(aceOpenPriceOf(cell))
          aceOpen.open(cell)
        }}
        gaugeSettingOn={gameSettings.settings.pitchControl === '게이지'}
        // 한 판 치고 끝이라 정산할 곳이 없다 — 원본도 모드 1 은 저장에 아무것도 안 남긴다
        onFinish={() => setScreen({ kind: '메인메뉴' })}
        onExit={() => setScreen({ kind: '메인메뉴' })}
      />
    )
  }

  // 나만의리그 투수편은 타자편 커리어와 다른 저장·흐름이다 (원본 모드 3, 장면 0x106)
  if (screen.kind === '투수편') {
    return (
      <PitcherLeagueRoute
        session={pitcherSession}
        random={random}
        openedHiddenIds={collection.collection.openedHiddenIds}
        gameSettings={gameSettings}
        onExit={() => setScreen({ kind: '메인메뉴' })}
      />
    )
  }

  if (ENTRY_SCREENS.includes(screen.kind) || careerSession.career === null) {
    return <EntryRoutes screen={screen} setScreen={setScreen} session={careerSession} gameSettings={gameSettings} collection={collection.collection} random={random} wallet={wallet} />
  }

  return (
    <CareerRoutes
      screen={screen}
      setScreen={setScreen}
      session={careerSession}
      runner={runner}
      random={random}
      career={careerSession.career}
      onRegisterHallOfFame={collection.register}
      onAceMatch={startAceMatch}
      gameSettings={gameSettings}
    />
  )
}
