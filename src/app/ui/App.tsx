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
import { ROOKIE_BATTER_ABILITY } from '@/entities/batting/model/batter'

const SETTINGS_KEY = 'compus-baseball/settings'
const COLLECTION_KEY = 'compus-baseball/collection'

const ENTRY_SCREENS: readonly Screen['kind'][] = ['타이틀', '메인메뉴', '도움말', '환경설정', '스페셜', '선수등록']

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
  const gameSettings = useGameSettings(settingsStore)
  const random = useMemo(() => createSeededRandom(Date.now() & 0x7fffffff), [])
  const [screen, setScreen] = useState<Screen>({ kind: '타이틀' })

  const runner = useAtBatRunner()
  const careerSession = useCareerSession({ runner, random, saveGame, screen, setScreen })
  const mission = useMissionSession({ runner, random, missionRecord, screen, setScreen })
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
        ability={careerSession.career === null ? ROOKIE_BATTER_ABILITY : effectiveAbilityOf(careerSession.career)}
        pitchControl={gameSettings.settings.pitchControl}
      />
    )
  }

  if (ENTRY_SCREENS.includes(screen.kind) || careerSession.career === null) {
    return <EntryRoutes screen={screen} setScreen={setScreen} session={careerSession} gameSettings={gameSettings} collection={collection.collection} />
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
    />
  )
}
