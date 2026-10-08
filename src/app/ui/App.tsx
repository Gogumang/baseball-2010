import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Screen } from '@/app/model/screen'
import { useAtBatRunner } from '@/app/model/useAtBatRunner'
import { useCareerSession } from '@/app/model/useCareerSession'
import { useMissionSession } from '@/app/model/useMissionSession'
import { CareerRoutes } from '@/app/ui/CareerRoutes'
import { EntryRoutes } from '@/app/ui/EntryRoutes'
import { MissionRoutes, PitcherAceMatchRoute } from '@/app/ui/MissionRoutes'
import { bootSeed, createSeededRandom } from '@/shared/api/random/seededRandom'
import { createLocalStorageSaveGame } from '@/shared/api/save/localStorageSaveGame'
import { createLocalStorageMissionRecord } from '@/shared/api/save/localStorageMissionRecord'
import { createLocalStorageJsonStore } from '@/shared/api/save/localStorageJsonStore'
import { nariBatterOf, nariPitcherOf, useCollection } from '@/app/model/useCollection'
import { EMPTY_COLLECTION, hallOfFameRecordIdOf, pitcherCollectorHiddenIdsOf } from '@/entities/collection/model/collection'
import { hasCareerPlayerInSeasonTeam, isHallOfFameDeleteBlocked } from '@/entities/season-mode/model/playerRecruit'
import { careerResetTargetOf, judgeModeReset } from '@/entities/settings/model/modeReset'
import type { HallOfFameDeletion } from '@/pages/special/ui/SpecialScreen'
import type { Collection } from '@/entities/collection/model/collection'
import { GAME_POINT_USAGE } from '@/entities/collection/model/annalsStats'
import type { AnnalsStatEvent } from '@/entities/collection/model/annalsStats'
import { isEveryMissionCleared } from '@/entities/mission/model/missionGoal'
import { aceMatchMissionOf, matchResultEventOf } from '@/entities/story/model/aceMatch'
import { myBatterIndexOf, nariTeamRecordOf, nariTeamsOf } from '@/entities/career/model/nariTeamRecord'
import { modeBatterOf } from '@/app/model/modeBatter'
import { modePitcherOf } from '@/app/model/modePitcher'
import type { AceMatchStarter } from '@/app/ui/CareerRoutes'
import { useGameSettings } from '@/app/model/useGameSettings'
import { useSceneBgm, useSceneEnterSound, useSound } from '@/app/model/useSound'
import { screenEnterSoundOf, usePitcherLeagueBgm, useScreenBgm, useSeasonMenuBgm } from '@/app/model/screenBgm'
import { useSeasonSession } from '@/app/model/useSeasonSession'
import { SeasonRoute } from '@/app/ui/SeasonRoute'
import { usePitcherLeagueSession } from '@/app/model/usePitcherLeagueSession'
import { PitcherLeagueRoute } from '@/app/ui/PitcherLeagueRoute'
import { GeneralModeScreen, aceOpenPriceOf, generalGameOfSave, useAceOpen } from '@/pages/general-mode'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { useModeSave } from '@/entities/mode-save/model/useModeSave'
import { NEW_SAVE_LAST_PLAYED_MODE } from '@/entities/mode-save/model/modeSave'
import { nariGameMatchOfSave } from '@/pages/management/lib/nariMatchPrepare'
import type { NariGameSavePort } from '@/pages/management/lib/nariMatchPrepare'
import { useGamePointWallet } from '@/entities/wallet/model/useGamePointWallet'
import { createGameStartCursor } from '@/pages/main-menu/model/mainMenu'
import { useAceLevels } from '@/entities/mission/model/useAceLevels'
import type { SeasonAutobotBatInput } from '@/entities/season-mode/model/seasonRewards'
import { judgeSeasonEnding } from '@/entities/season-mode/model/seasonRewards'
import { SEASON_PHASE } from '@/entities/season-mode/model/seasonStateMachine'
import { nariSeasonRecordsOf } from '@/app/model/seasonHallOfFameRecords'
import type { RegularSeasonOtherModes } from '@/entities/career/model/postseasonFlow'
import { useEditedNames } from '@/entities/player-name/model/useEditedNames'

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
 * 마선수 레벨 열 칸 — 원본 전역 기록 `mgr[0x13a..0x143]` (올리는 곳은 레벨업 0x5fb24 하나).
 * 옛 세이브에는 이 칸이 없다 — 없으면 새 저장 기본값(0x9f26c)처럼 모두 0 = Lv1 이다.
 */
const ACE_LEVEL_KEY = 'compus-baseball/ace-level'
/**
 * **G포인트 지갑** — 원본 전역 기록 `mgr[+0x64]` 한 칸이다 (`entities/wallet` 머리글에 디스어셈).
 * 모드와 상관없이 하나라 커리어·시즌 저장과 **따로** 둔다.
 * 옛 세이브에는 이 칸이 없다 — 없으면 `career.gamePoint` 를 그대로 옮겨 온다(이사).
 */
const WALLET_KEY = 'compus-baseball/wallet'
/** 전역기록 +0x145 — 전부 수집 보상 지급 비트 (`game_o.sav` 의 그 바이트, `collectionRewards.ts`). 리그 1위 G 가 쓴다 */
const COLLECTION_REWARD_KEY = 'compus-baseball/collection-rewards'
/**
 * 투수편 G를 지갑으로 옮겼는지 적어 두는 칸 — 옛 투수 저장은 G를 선수 안에 들고 있었다.
 * 이사를 마치면 선수 칸이 지갑의 그림자가 되어 저장만 봐서는 옮겼는지 알 수 없어 표식을 따로 둔다
 * (근거는 `usePitcherLeagueSession` 의 **투수 G 이사** 머리글).
 */
const PITCHER_WALLET_MERGE_KEY = 'compus-baseball/pitcher-wallet-merged'
/**
 * **에디트 이름표** — 원본 앱 데이터 save[+0xac]+0x178 (투수 80 · 타자 120 칸, R11 1c). 모드와 상관없는 한 벌이다.
 * 옛 세이브에는 이 칸이 없다 — 없으면 빈 표(모두 원래 이름)다.
 */
const EDITED_NAMES_KEY = 'compus-baseball/edited-names'
/**
 * **모드 저장 칸** — 원본 전역기록 +0x3c(마지막 모드) · +0x4d(일반모드 경기 중간 저장)와 모드 1 저장 블록(`entities/mode-save`).
 * 옛 세이브에는 이 칸이 없다 — 없으면 +0x3c 를 "나리 타자편 커리어가 있으면 4, 없으면 새 저장 기본값 1(생성자 0x9f26c)" 로
 * 읽어 예전 웹 [최근게임](늘 타자편 이어하기)과 같은 길로 이어 준다.
 */
const MODE_SAVE_KEY = 'compus-baseball/mode-save'
/** 나만의리그 타자편 = 원본 모드 4 · 투수편 = 모드 3 (전역기록 +0x4c + 모드 = +0x50 · +0x4f) */
const NARI_BATTER_MODE = 4
const NARI_PITCHER_MODE = 3

const ENTRY_SCREENS: readonly Screen['kind'][] = ['타이틀', '메인메뉴', '도움말', '환경설정', '스페셜', '나리편선택', '팀선택', '선수등록', '홈런더비', '일반모드']

const MISSION_SCREENS: readonly Screen['kind'][] = [
  '마선수대결',
  '미션선택',
  '미션설명',
  '미션진행',
  '투수미션',
]

/** 일반모드 = 원본 모드 1 (0x22c7d 의 획득 GP 칸 0) */
const GENERAL_STAT_MODE = 1
/** 투수 미션 · 타자 미션 = 원본 모드 5 · 6 (0x29a54 → 표 0xcec00) */
const MISSION_PITCHER_MODE = 5
const MISSION_BATTER_MODE = 6

/** 화면 분기만 한다. 상태와 규칙은 model의 훅 세 개가 나눠 갖는다. */
export function App() {
  const saveGame = useMemo(() => createLocalStorageSaveGame(), [])
  const missionRecord = useMemo(() => createLocalStorageMissionRecord(), [])
  const settingsStore = useMemo(() => createLocalStorageJsonStore(SETTINGS_KEY), [])
  const collectionStore = useMemo(() => createLocalStorageJsonStore(COLLECTION_KEY), [])
  const seasonStore = useMemo(() => createLocalStorageJsonStore(SEASON_KEY), [])
  const pitcherStore = useMemo(() => createLocalStorageJsonStore(PITCHER_KEY), [])
  const aceOpenStore = useMemo(() => createLocalStorageJsonStore(ACE_OPEN_KEY), [])
  const aceLevelStore = useMemo(() => createLocalStorageJsonStore(ACE_LEVEL_KEY), [])
  const walletStore = useMemo(() => createLocalStorageJsonStore(WALLET_KEY), [])
  const collectionRewardStore = useMemo(() => createLocalStorageJsonStore(COLLECTION_REWARD_KEY), [])
  const pitcherWalletMergeStore = useMemo(() => createLocalStorageJsonStore(PITCHER_WALLET_MERGE_KEY), [])
  const editedNamesStore = useMemo(() => createLocalStorageJsonStore(EDITED_NAMES_KEY), [])
  const modeSaveStore = useMemo(() => createLocalStorageJsonStore(MODE_SAVE_KEY), [])
  // 에디트 이름표 — 서자마자 공용 이름 함수(0xb62c0)가 이 표를 본다. 경기·기록 화면의 선수 이름이 다 여길 거친다
  const editedNames = useEditedNames(editedNamesStore)
  /** 옛 세이브 이사거리 — 지갑 칸이 없던 시절 G는 나만의리그 선수 안에 들어 있었다 */
  const legacyGamePoint = useMemo(() => saveGame.load()?.gamePoint ?? null, [saveGame])
  // 전역기록 +0x3c · +0x4d · 모드 1 저장 블록 — 옛 세이브면 타자편 커리어 유무로 +0x3c 를 정한다
  const legacyLastPlayedMode = useMemo(
    () => (saveGame.load() === null ? NEW_SAVE_LAST_PLAYED_MODE : NARI_BATTER_MODE),
    [saveGame],
  )
  const modeSave = useModeSave(modeSaveStore, legacyLastPlayedMode)
  const { setLastPlayedMode, startNariGame, clearNariGame, aceMatchPendingPorts, aceMatchHoldPort } = modeSave
  // 전역기록 +0x4f · +0x50 손잡이 — 나리 두 편 세션이 142 확인·등록·정산·지우기에서 쓴다
  const pitcherNariGameSave = useMemo<NariGameSavePort>(() => ({
    start: (match) => startNariGame(NARI_PITCHER_MODE, match),
    clear: () => clearNariGame(NARI_PITCHER_MODE),
  }), [startNariGame, clearNariGame])
  const batterNariGameSave = useMemo<NariGameSavePort>(() => ({
    start: (match) => startNariGame(NARI_BATTER_MODE, match),
    clear: () => clearNariGame(NARI_BATTER_MODE),
  }), [startNariGame, clearNariGame])
  const gameSettings = useGameSettings(settingsStore)
  // 소리 통로 하나 — 환경설정 칸(0~4) × 25 가 원본 소리 크기다 (옵션 +0x2e)
  const sound = useSound(gameSettings.settings.soundLevel)
  // 부팅 씨앗 — 원본 0x2ed8 은 밀리초 시계의 아래 32비트 (저장 · 읽기 때 다시 세우기는 옮기지 않았다 — seededRandom 머리 주석)
  const random = useMemo(() => createSeededRandom(bootSeed()), [])
  const [screen, setScreen] = useState<Screen>({ kind: '타이틀' })
  /** 게임시작 목록 커서 전역 [0x1552d24] — 장면 0x103 이 내려가도 남는다(관리 메뉴 취소로 하위 5 에 바로 서면 그 칸) */
  const gameStartCursor = useRef(createGameStartCursor()).current
  /** 일반모드 진입 창 [13] 에서 빠른실행을 골랐는가 (원본 메인 메뉴 this+0x14c) */
  const [isGeneralQuickStart, setGeneralQuickStart] = useState(false)
  /** 일반모드 이어하기로 올린 진행 — 있으면 준비 화면 없이 경기 장면으로 (0x213c0(앱, 1, 0) → 0x104) */
  const [generalResume, setGeneralResume] = useState<TeamGameProgress | null>(null)
  // 화면에 들어설 때 한 번 나는 소리 — 타이틀의 로고 음성 0 (0x69400)
  useSceneEnterSound(sound, screen.kind, screenEnterSoundOf(screen))

  const runner = useAtBatRunner()
  // 마선수 오픈 플래그 — 원본 전역 기록 `mgr[0x30..0x39]`
  const aceOpen = useAceOpen(aceOpenStore)
  // 마선수 레벨 — 원본 전역 기록 `mgr[0x13a..0x143]`. 미션 마선수 배율(0xb6414)이 이 값을 본다
  const aceLevels = useAceLevels(aceLevelStore)
  // 전역 G 지갑 — 원본 `mgr[+0x64]`. 마선수 구매·미션·홈런더비가 다 이 한 칸을 본다
  const wallet = useGamePointWallet(walletStore, legacyGamePoint)
  /**
   * 기록연감 통계 한 건 쌓기 (0x22e35 · 0x22c29 · 0x22c7d · 0xb663c) — 기록연감 훅은 세션 커리어를 받아 세션보다 늦게 서므로
   * 세션들에는 이 고정 콜백을 넘기고 기록연감이 선 뒤 진짜 함수를 꽂는다.
   */
  const recordStatRef = useRef<(event: AnnalsStatEvent) => void>(() => {})
  /** 미션 선수 고르기가 읽는 명예의 전당 — 기록연감 훅이 선 뒤 아래에서 채운다 (`recordStatRef` 와 같은 까닭) */
  const hallOfFameForMissionRef = useRef<Collection>(EMPTY_COLLECTION)
  const recordStat = useCallback((event: AnnalsStatEvent) => recordStatRef.current(event), [])
  /** 시즌 팀 경기가 영입한 명전 선수를 그 기록으로 세울 때 읽는 명전 칸 — 위 ref 와 같은 값 */
  const readHallOfFame = useCallback(() => hallOfFameForMissionRef.current, [])
  /**
   * 시즌 결산 0x6900 의 0x29 "오토봇 배트" 검사가 읽는 것 — 나리 투수편·타자편 저장의 +0x7a 와 전역 해금표 `app+0xc0`.
   * 기록연감·투수편 세션은 시즌 세션보다 늦게 서므로 아래에서 채우고 시즌 세션은 결산에 들어갈 때 읽는다.
   */
  const autobotBatInputRef = useRef<SeasonAutobotBatInput | undefined>(undefined)
  const readAutobotBatInput = useCallback(() => autobotBatInputRef.current, [])
  /**
   * 나리 두 편 정규시즌 우승 팝업 0xb 닫힘(0x15b84~0x15c52)의 같은 0x29 검사 — 다른 편 저장 +0x7a · 시즌 기록 +0x7a ·
   * 전역 해금표. 세션들이 다 선 뒤 아래에서 채우고 팝업을 닫을 때 읽는다.
   */
  const otherModesRef = useRef<{ batter?: RegularSeasonOtherModes; pitcher?: RegularSeasonOtherModes }>({})
  const readBatterOtherModes = useCallback(() => otherModesRef.current.batter, [])
  const readPitcherOtherModes = useCallback(() => otherModesRef.current.pitcher, [])
  const seasonSession = useSeasonSession(
    seasonStore, random, wallet, aceLevels.levels, recordStat, readAutobotBatInput, collectionRewardStore, readHallOfFame,
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
  )
  // 화면이 바뀌면 그 화면의 배경음으로 갈아탄다 (`screenBgm.ts` 의 표). 투수편은 안쪽 장면(128 이어하기 4)을 본다
  const pitcherBgm = usePitcherLeagueBgm(
    screen.kind === '투수편', pitcherSession.scene, pitcherSession.career?.endingIndex ?? null, pitcherSession.story?.context ?? null,
  )
  // 메인 메뉴는 환경설정에서 돌아올 때(0x24a40) · 게임시작 목록으로 새로 설 때(0x25b88) 1 을 처음부터 다시 튼다
  const screenBgm = useScreenBgm(screen)
  useSceneBgm(sound, screen.kind === '투수편' ? pitcherBgm : screenBgm.bgm, screenBgm.restartSerial)
  // 시즌 관리 메뉴 0xc9 의 틀 0x73b8 — 이전 상태가 목록에 들면 배경음 4 (위 화면 표 뒤에 돌아야 이긴다)
  useSeasonMenuBgm(sound, screen.kind === '시즌모드', seasonSession.scene)
  const careerSession = useCareerSession({
    runner, random, saveGame, screen, setScreen, sound, wallet,
    // 환경설정 "주루" (설정 +0xbd) — 나리 타자편은 사람이 늘 공격이라 그대로 먹는다 (0xae690)
    runningModeManual: gameSettings.settings.runningMode === '수동',
    recordStat,
    // 같은 날 CPU 끼리 경기·포스트시즌 CPU 경기의 마선수 배율(0xd88aa)도 전역 레벨 칸을 본다
    aceLevels: aceLevels.levels,
    readRegularSeasonOtherModes: readBatterOtherModes,
    openedAces: nariOpenedAces,
    nariGameSave: batterNariGameSave,
    // 나간 마선수 대결 대기 — 전역기록 g[0xec] · g[0xee] · g[0x11f] · g[0x144] (선수를 새로 만들어도 남는다)
    aceMatchPending: aceMatchPendingPorts[NARI_BATTER_MODE],
  })
  const pitcherMissionPitcher = useMemo(() => modePitcherOf(pitcherSession.career), [pitcherSession.career])
  // 타자 미션(모드 6)은 0x213c0 이 6→4 로 나리 타자편 저장을 올린다 — 마투수 투구 소모(0xa5e14)의 압도 22 가 이 타자를 본다
  const missionBatterCareer = careerSession.career ?? careerSession.savedCareer
  const missionBatterSkillIds = missionBatterCareer?.equippedSkillIds
  const missionBatterRecordSlot = missionBatterCareer === null || missionBatterCareer === undefined
    ? -1
    : myBatterIndexOf(nariTeamRecordOf(nariTeamsOf(missionBatterCareer), missionBatterCareer.teamId))
  // 미션 보상 G (0x4ef72) — 지갑으로 들어간다. 육성 선수가 없어도 사라지지 않는다
  const mission = useMissionSession({
    runner, random, missionRecord, screen, setScreen, sound,
    onGamePointReward: careerSession.actions.gainGamePoint,
    // 환경설정 "송구" (설정 +0xf4) — 투수편 미션은 사람이 늘 수비라 그대로 먹는다 (0xae6c8)
    throwModeManual: gameSettings.settings.throwMode === '수동',
    // 환경설정 진동 (저장 +0x3b) — 투수 미션·투수편 마선수 대결의 사람 공 삼진 진동(0x4d0d6)이 본다
    isVibrationOn: gameSettings.settings.isVibrationOn,
    aceLevels: aceLevels.levels,
    // 투수 미션(모드 5)은 0x213c0 이 5→3 으로 나리 투수편 저장을 올리고 0x1fbd0 이 그 투수(또는 명예 투수)를 준다.
    // 투수편 세션은 시작할 때 저장을 올려 두므로 `career` 가 곧 저장된 투수다 (`modePitcherOf`)
    pitcher: pitcherMissionPitcher,
    ...(missionBatterSkillIds === undefined ? {} : { batterSkillIds: missionBatterSkillIds }),
    // 선수 고르기에서 명예 선수(+0xa5/+0xa6 ≥ 0)를 고르면 0x1fbd0 · 0x1fc20 이 이 기록을 준다.
    // 기록연감 훅은 미션 세션보다 늦게 서므로(올 클리어를 본다) 지난 그림의 값을 넘긴다 — 명전은 미션 중에 안 바뀐다
    hallOfFame: hallOfFameForMissionRef.current,
    // 마선수 대결의 사람 칸 팀 (0xaa57c aa6dc~aa728) — g[0xf6] 모드 저장 레코드 +1 = 그 편 나리 저장의 팀
    nariTeamIds: {
      ...(missionBatterCareer === null || missionBatterCareer === undefined ? {} : { batter: missionBatterCareer.teamId }),
      ...(pitcherSession.career === null || pitcherSession.career === undefined ? {} : { pitcher: pitcherSession.career.teamId }),
    },
    // 타자 미션 0xb53f0 의 k = 나리 타자편 저장 선수 +0xa & 0x1f — 자기 나리 팀 레코드의 내 줄 첨자 (홈런더비 타순과 같은 칸)
    ...(missionBatterRecordSlot < 0 ? {} : { nariBatterRecordSlot: missionBatterRecordSlot }),
    // 나간 마선수 대결 대기(g[0x11f] · g[0x176] · g[0xf6]) — 서 있으면 보통 미션도 대결 꼴이다
    aceMatchHold: aceMatchHoldPort,
    // 대기 중 미션 결과 판을 닫으면 g[0xf6] 편의 장면 0x106 으로(0x4b100 4b344~4b376) — 100 → 0x1c154 이어하기 → 105 진입이 140 을 띄운다
    onReturnToNari: (mode) => {
      if (mode === NARI_PITCHER_MODE) return setScreen({ kind: '투수편' })
      if (careerSession.savedCareer !== null) return careerSession.actions.continueSaved()
      setScreen({ kind: '팀선택' })
    },
  })
  // 투수편이 연 히든(장비 컬렉터 20·24·28·32)도 같은 전역 표 `app+0xc0` 에 모은다 (0x62368)
  // 시즌 결산이 연 전역 해금(0x29)도 같은 전역 표에 모은다
  // 컬렉터는 0x14a74 구매가 쓴 칸 — 옛 투수편 커리어는 비어 있을 수 있어 보유에서 다시 센다 (`pitcherCollectorHiddenIdsOf`)
  const pitcherCareerForHidden = pitcherSession.career
  const seasonOpenedHiddenIds = seasonSession.openedHiddenIds
  const sharedOpenedHiddenIds = useMemo(
    () => [
      ...(pitcherCareerForHidden?.openedHiddenIds ?? []),
      ...(pitcherCareerForHidden === null || pitcherCareerForHidden === undefined ? [] : pitcherCollectorHiddenIdsOf(pitcherCareerForHidden)),
      ...seasonOpenedHiddenIds,
    ],
    [pitcherCareerForHidden, seasonOpenedHiddenIds],
  )
  // 시즌 엔딩 — 새 해 0x6e0c 가 판정 0xa3084 ≥ 0 으로 phase 6(엔딩)을 세우는 그 자리에서 전역기록 +0xa0+e = 1
  const seasonRecord = seasonSession.state?.record ?? null
  const seasonEndingIndex = seasonRecord !== null && seasonRecord.phase === SEASON_PHASE.엔딩
    ? judgeSeasonEnding(seasonRecord)
    : null
  const everyMissionCleared = isEveryMissionCleared(mission.clearedKeys)
  const collection = useCollection(
    collectionStore,
    careerSession.career,
    everyMissionCleared,
    sharedOpenedHiddenIds,
    // 엔딩 적재 0x87c7c 는 두 편 공용 — 투수편 엔딩·연애 엔딩도 기록연감 칸에 켠다
    pitcherSession.career,
    // 투수편 칭호도 기록연감 칭호 칸(투수편 비트 +0xec)에 켠다 (0xa40e0)
    pitcherSession.career?.titleIds,
    seasonEndingIndex,
  )
  const { recordStat: recordCollectionStat } = collection
  hallOfFameForMissionRef.current = collection.collection
  const pitcherEditionFirsts = pitcherSession.career?.regularSeasonFirstCount ?? 0
  const batterEditionFirsts = (careerSession.career ?? careerSession.savedCareer)?.regularSeasonFirstCount ?? 0
  const seasonModeFirstCount = seasonSession.state?.record.regularSeasonFirsts ?? 0
  autobotBatInputRef.current = {
    pitcherEditionFirsts,
    batterEditionFirsts,
    globalOpenedHiddenIds: collection.collection.openedHiddenIds,
  }
  otherModesRef.current = {
    batter: {
      otherLeagueFirstCount: pitcherEditionFirsts,
      seasonModeFirstCount,
      globalOpenedHiddenIds: collection.collection.openedHiddenIds,
    },
    pitcher: {
      otherLeagueFirstCount: batterEditionFirsts,
      seasonModeFirstCount,
      globalOpenedHiddenIds: collection.collection.openedHiddenIds,
    },
  }
  useEffect(() => {
    recordStatRef.current = recordCollectionStat
  }, [recordCollectionStat])
  // 히든 오픈은 원본에서 전역 저장이라 선수에게도 알려 준다 (상점이 선수 기록으로 판정한다)
  const { syncOpenedHidden } = careerSession.actions
  const openedHiddenIds = collection.collection.openedHiddenIds
  useEffect(() => syncOpenedHidden(openedHiddenIds), [syncOpenedHidden, openedHiddenIds])

  // 스페셜 명예의 전당 "슬롯에서 삭제" (0x2ac00 · 0x62994) — 시즌 명단 정리 0x221dc 와 칸 비우기를 한 번에
  const seasonRoster = seasonSession.state === null ? null : seasonSession.roster
  const hallOfFameDeletion: HallOfFameDeletion = {
    // 0x2ae0e — 그 명전 선수가 내 시즌 팀에 있고 && 전역기록 +0x4e(시즌모드 경기 중간 저장, 시즌 저장의 `isGameInProgress`)
    isBlocked: (side, slot) => isHallOfFameDeleteBlocked(
      seasonRoster, hallOfFameRecordIdOf(side, slot), side === '투수', seasonSession.isGameInProgress,
    ),
    onDelete: (side, slot) => {
      seasonSession.actions.removeHallOfFamer(hallOfFameRecordIdOf(side, slot), side === '투수')
      collection.deleteHallOfFamer(side, slot)
    },
  }

  // 마선수 오픈(0xa3e2 · 0xa3f6)·레벨업(0x5fbee · 0x5fc0a) — 모자람 판정은 화면이 이미 했다.
  // `spend` 의 자르기 [0, 99999] 가 원본 clamp 와 같다. 일반모드(상태 21)·스페셜(상태 28)이 같이 쓴다
  const aceSelect = {
    openedAcePitcherIds: aceOpen.openedAcePitcherIds,
    openedAceBatterIds: aceOpen.openedAceBatterIds,
    levels: aceLevels.levels,
    // 0xa41a · 0x5fc1a — 저장 뒤 0x22c29(mgr, 0 마선수, 값) 로 사용처 통계에 적는다
    onOpenAce: (cell: number) => {
      wallet.spend(aceOpenPriceOf(cell))
      aceOpen.open(cell)
      collection.recordStat({ kind: 'G사용', usage: GAME_POINT_USAGE.ace, amount: aceOpenPriceOf(cell) })
    },
    onLevelUp: (cell: number, cost: number) => {
      wallet.spend(cost)
      aceLevels.levelUp(cell)
      collection.recordStat({ kind: 'G사용', usage: GAME_POINT_USAGE.ace, amount: cost })
    },
  }

  /**
   * 이벤트 match → 공략 레코드 대결. 레코드가 없는 team 은 없지만, 만나면 패배 결과로 넘긴다 (추정).
   * 장소 이벤트였다면 match 가 돌려준 "끝남" 으로 0x1c014 의 장소 끝 처리(행동 · 외출 수)가 **나가는 자리에서** 돈다.
   * 결과 이벤트는 어디서 나갔든 140 `[다음 114, 뒤 105]` — 맥락 `대결결과`.
   */
  const startAceMatch: AceMatchStarter = (command, carried, context) => {
    if (context === '장소') careerSession.actions.settlePlaceForAceMatch()
    const target = aceMatchMissionOf(command.team)
    if (target === null) {
      setScreen({ kind: '이벤트', eventId: matchResultEventOf(command.resultEvents, false), context: '대결결과', carried })
      return
    }
    // SYS 8 — 결과 이벤트 · 플래그를 적고 저장한다(나가도 남아 다음 105 진입이 띄운다)
    careerSession.actions.holdAceMatch(command.resultEvents, carried.viewedEventIds)
    mission.actions.beginAceMatch(target, { resultEvents: command.resultEvents, context: '대결결과', carried })
  }

  // 미션 모드는 메인 메뉴에서 들어가 선수 고르기(하위 17)부터 띄운다 — 육성·명예 선수가 다 없으면 원본대로
  // 고르기 창에서 막힌다(StrCOMMON[38]·[39]). 고른 선수의 편이 투수(모드 5)/타자(모드 6) 미션을 정한다.
  if (MISSION_SCREENS.includes(screen.kind)) {
    // 미션 선수 고르기(하위 17) 0x29a54 의 답 → this+0x13c = 5(투수)|6(타자) → 상태 0x27 → 0x327b8 이 +0x3c 에 적는다.
    // 마선수 대결(나리 이벤트)은 이 고르기를 안 지나 +0x3c 를 안 건드린다
    const missionFromMenu = {
      ...mission,
      actions: {
        ...mission.actions,
        choosePlayer: (pick: Parameters<typeof mission.actions.choosePlayer>[0]) => {
          setLastPlayedMode(pick.side === '투수' ? MISSION_PITCHER_MODE : MISSION_BATTER_MODE)
          mission.actions.choosePlayer(pick)
        },
      },
    }
    return (
      <MissionRoutes
        screen={screen}
        setScreen={setScreen}
        session={missionFromMenu}
        runner={runner}
        random={random}
        // 미션(모드 6)은 0x213c0(앱, 4, 0) 으로 나리 타자편 저장을 올린다 — 진행 중 커리어가 없으면
        // 저장된 선수다. 능력치는 0xb6414(장비·스킬)까지만: 0xb570c 의 질병·부상·사기 감소는 모드 3·4 갈래라
        // 미션에서는 안 먹는다 (`modeBatterOf`). 마선수 대결(이벤트)도 같은 화면이다.
        batter={modeBatterOf(careerSession.career ?? careerSession.savedCareer)}
        // 선수 고르기 창(하위 17) — 칸 0·5 나리 투수·타자는 두 편 저장(0x213c0(…, 3|4, 1))이다
        hallOfFame={collection.collection}
        nari={{
          투수: nariPitcherOf(pitcherSession.career),
          타자: nariBatterOf(careerSession.career ?? careerSession.savedCareer),
        }}
        pitchControl={gameSettings.settings.pitchControl}
        gameSettings={gameSettings}
        // 하위 17 머리띠 0x54d95(skin, 11, 5) 는 제목이 −1 이 아니라 G포인트도 그린다 (29261d0)
        gamePoint={wallet.balance}
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
        // 관리 메뉴 0xc9 취소(0x8f5a)는 [0x140006c] = 5 — 게임시작 목록으로 바로 연다. 그 밖의 나감은 처음 단
        onExit={(openTier) => setScreen(openTier === undefined ? { kind: '메인메뉴' } : { kind: '메인메뉴', openTier })}
        aceSelect={aceSelect}
        // 선수영입 후보의 명예의 전당 칸 (0x1f62c · 0x1f640)
        hallOfFame={collection.collection}
        // 시즌 장비 창에서 명예 선수가 장비를 사면 명전 기록에도 (0x2328c)
        onHallOfFameEquipment={collection.syncSeasonHallOfFameEquipment}
        // 영입 목록(종류 0) 나리 칸 0·5 — 나리 투수편·타자편 저장 (미션 선수 고르기와 같은 값)
        nari={{
          투수: nariPitcherOf(pitcherSession.career),
          타자: nariBatterOf(careerSession.career ?? careerSession.savedCareer),
        }}
        // 나리 칸을 고르면 영입할 기록 (0x22168 · 0x220ec — 같은 두 저장의 내 선수)
        nariRecords={nariSeasonRecordsOf(pitcherSession.career, careerSession.career ?? careerSession.savedCareer)}
      />
    )
  }

  // 일반모드 — 준비 다섯 화면부터 경기까지 한 화면이 돌고 메인 메뉴로 돌아간다. 경기는 경기정보 OK·반 이닝마다
  // 모드 1 저장 블록에 남고(+0x4d), 경기 중 "나가기"로 나가도 남아 [13]/[최근게임] 의 이어하기로 그 자리에서 다시 선다
  if (screen.kind === '일반모드') {
    const leaveGeneralMode = () => {
      setGeneralResume(null)
      setScreen({ kind: '메인메뉴' })
    }
    return (
      <GeneralModeScreen
        random={random}
        {...(generalResume === null ? {} : { resumeGame: generalResume })}
        // 경기정보 OK 0x3136e — +0x3c = 1 · +0x4d = 1 · 블록 = 새 경기
        onGameStart={modeSave.startGeneralGame}
        // 반 이닝 자동 저장 0x4f928 → 0x22754 — 블록만
        onGameSave={modeSave.saveGeneralGame}
        // 정산 진입 0x4ea0c — 한 판 치고 끝이라 선수 정산은 없지만, 모드 1 에서도 기록 달성 G 합을 전역 G(+0x64)에
        // 더하고(4ec5a, 99999 상한) 0x4ec82 `0x22c7d(합, 모드 1)` 로 획득 GP 통계(칸 0 일반)에 적는다 (fc7f196).
        // 이어서 0x4ec8a `0x22e10` — 이번 경기 기록달성 횟수(0x1fce0, 모드 1)를 통계 [mgr+0xc8]+4+n 누계에 더한다.
        // 같은 진입 끝 0x4f3d6 이 +0x4d = 0. 결과 화면 확인(onFinish) 앞이라 그 사이에 창을 닫아도 정산은 남는다
        onSettlementEnter={(summary) => {
          const earned = summary.gamePoints ?? 0
          if (earned !== 0) wallet.gain(earned)
          recordStat({ kind: 'G획득', mode: GENERAL_STAT_MODE, amount: earned })
          recordStat({ kind: '기록달성', recordIds: summary.recordIds ?? [] })
          modeSave.finishGeneralGame()
        }}
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
        // "예" → G를 빼고 플래그를 세운다 (0xa3e2 · 0xa3f6). 모자람 판정은 화면이 이미 했다.
        // `spend` 의 자르기 [0, 99999] 와 "모자라면 한 푼도 안 깎는다" 가 원본 0xa3dc~0xa3f4 와 같다.
        onOpenAce={aceSelect.onOpenAce}
        gaugeSettingOn={gameSettings.settings.pitchControl === '게이지'}
        runningModeManual={gameSettings.settings.runningMode === '수동'}
        // 환경설정 "송구" (설정 +0xf4) — 팀 경기는 사람이 **수비하는 타석**에서만 먹는다 (0xae6c8)
        throwModeManual={gameSettings.settings.throwMode === '수동'}
        // 결과 화면 확인 — 정산은 위 정산 진입(0x4ea0c)이 이미 했다
        onFinish={leaveGeneralMode}
        onExit={leaveGeneralMode}
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
        // 명예의 전당 등록 (나리 상태 145, 모드 3) — 칸 5 나리 타자는 타자편 저장이 있으면
        hallOfFame={{
          collection: collection.collection,
          nariBatter: nariBatterOf(careerSession.career ?? careerSession.savedCareer),
          register: (target, slot) => collection.registerPitcher(target, wallet, slot),
          // 등록 목록(상태 145) 머리띠 0x54d95(skin, 9 "나만의리그 투수편", 5) 가 전역 G 를 그린다
          gamePoint: wallet.balance,
        }}
        // 105 취소(0x126e6)는 [0x140006c] = 5 — 게임시작 목록으로 바로 연다. 그 밖의 나감은 처음 단
        onExit={(openTier) => setScreen(openTier === undefined ? { kind: '메인메뉴' } : { kind: '메인메뉴', openTier })}
        // 마선수 대결 (SYS 8 → 투수 미션 team − 1) — 미션 세션이 투수편 내 투수(`pitcherMissionPitcher`)로 던지고
        // 이겼나를 돌려주면 투수편 세션이 140 → resultEvents[이김 ? 0 : 1] → 105 로 잇는다
        renderAceMatch={(match, onFinish) => (
          <PitcherAceMatchRoute
            mission={match.mission}
            session={mission}
            runner={runner}
            pitchControl={gameSettings.settings.pitchControl}
            gameSettings={gameSettings}
            onFinish={onFinish}
            onQuit={pitcherSession.actions.quitAceMatch}
            // 첫 0x18 판 PITCHER(0x420dc) — 0x1fbd0 은 g[0x176](투수편 대결)이면 늘 투수편 저장 [저장+0x3c] 선수다
            pitcherName={pitcherSession.career?.name ?? null}
          />
        )}
      />
    )
  }

  if (ENTRY_SCREENS.includes(screen.kind) || careerSession.career === null) {
    return (
      <EntryRoutes
        screen={screen} setScreen={setScreen} session={careerSession} gameSettings={gameSettings}
        collection={collection.collection} random={random} wallet={wallet} aceSelect={aceSelect}
        gameStartCursor={gameStartCursor}
        hallOfFameDeletion={hallOfFameDeletion}
        recordStat={recordStat}
        // 홈런더비 타자 게터 0x1fc20 — 타자편 대결 대기(g[0x11f])면 명예 타자 대신 나리 타자
        aceMatchHold={aceMatchHoldPort}
        onRenamePlayer={editedNames.rename}
        onResetEditedNames={editedNames.clear}
        // 모드 초기화 나리 칸 — 0x224ec(mgr, 4 타자 / 3 투수): 그 편 저장(game_br/pr.sav)·+0x40+m·+0x4c+m 지움 → 0x223a8 이
        // 시즌 내 팀에서 그 편 나리 선수를 빼고 시즌 저장
        onResetCareerEdition={(edition) => {
          if (edition === '타자편') {
            careerSession.actions.resetCareer()
          } else {
            // 투수편 세션의 reset 은 상태와 +0x4f 만 지운다 — 파일 지우기는 엔딩 끝(finishEnding)처럼 빈 덩어리로 덮는다
            pitcherStore.save({})
            pitcherSession.actions.reset()
          }
          seasonSession.actions.removeCareerPlayer(edition === '투수편')
        }}
        // 하위 1 막기 — 0xb5054(내 시즌 팀, 편) && +0x4e (0x2c880 · 0x2c900). 투수편 글은 [213](원본 버그)
        careerResetBlockOf={(edition) => judgeModeReset(careerResetTargetOf(edition), {
          isSeasonGameInProgress: seasonSession.isGameInProgress,
          isCareerPlayerInSeasonTeam: hasCareerPlayerInSeasonTeam(seasonRoster, edition === '투수편'),
        }).blockText}
        // 시즌모드 초기화 0x224ec(mgr, 2) — 시즌 저장(+0x42)·+0x4e
        onResetSeason={seasonSession.actions.resetSeason}
        // 일반모드 진입 창 [13] — 빠른실행이면 경기정보(상태 22)부터 (0x299f8 this+0x14c = 1)
        onStartGeneralMode={(isQuickStart) => {
          setGeneralQuickStart(isQuickStart)
          setGeneralResume(null)
          setScreen({ kind: '일반모드' })
        }}
        // 전역기록 +0x4d · +0x3c — 메인 메뉴 [13] 처음 커서·[15] 확인·이어하기, [최근게임] 갈래가 본다
        isGeneralGameInProgress={modeSave.save.isGeneralGameInProgress}
        lastPlayedMode={modeSave.save.lastPlayedMode}
        onLastPlayedMode={setLastPlayedMode}
        // [13]/[최근게임] 이어하기 — 상태 0x27 → 0x327b8(this, 1): +0x3c = 1 → 0x213c0(앱, 1, 0) 로 블록을 올려 장면 0x104 → +0x4d = 1
        onResumeGeneralGame={() => {
          const saved = generalGameOfSave(modeSave.save.generalGame)
          setGeneralQuickStart(false)
          if (saved === null) {
            // ⚠️ 웹 전용: 블록을 경기로 못 읽으면(옛 꼴) 저장이 없는 것으로 보고 새로하기(상태 18)로 간다
            modeSave.finishGeneralGame()
            setGeneralResume(null)
          } else {
            modeSave.resumeGeneralGame()
            setGeneralResume(saved)
          }
          setScreen({ kind: '일반모드' })
        }}
        // [14]·[최근게임] 의 0x327b8 모드 3·4 갈래 — 그 편 커리어(+0x40+m) && 경기 중간 저장(+0x4c+m)이면 곧장 경기
        nariGameReady={{
          투수편: pitcherSession.career !== null && modeSave.save.nariGames[NARI_PITCHER_MODE].isInProgress,
          타자편: careerSession.savedCareer !== null && modeSave.save.nariGames[NARI_BATTER_MODE].isInProgress,
        }}
        // 0x213c0(앱, m, 0) 으로 그 편 저장을 올려 장면 0x104 — 경기 셋업 0x39fdc 모드 3·4 갈래가 그 저장으로 경기를 새로 세운다
        onResumeNariGame={(edition) => {
          if (edition === '투수편') {
            pitcherSession.actions.resumeInterruptedGame(
              nariGameMatchOfSave(modeSave.save.nariGames[NARI_PITCHER_MODE].match),
            )
            return setScreen({ kind: '투수편' })
          }
          careerSession.actions.resumeInterruptedGame(nariGameMatchOfSave(modeSave.save.nariGames[NARI_BATTER_MODE].match))
        }}
        // 메인 메뉴 처음 단(하위 4)의 전부 수집 보상 판정 0x28e98 → 팝업 0x292f8
        claimCollectionReward={() => collection.claimCollectionReward(collectionRewardStore, everyMissionCleared, wallet)}
      />
    )
  }

  return (
    <CareerRoutes
      screen={screen}
      setScreen={setScreen}
      session={careerSession}
      runner={runner}
      random={random}
      career={careerSession.career}
      // 명예의 전당 등록 (나리 상태 145) — G 20000 은 전역 지갑에서 (0x62dc4)
      hallOfFame={{
        collection: collection.collection,
        nariPitcher: nariPitcherOf(pitcherSession.career),
        register: (target, slot) => collection.register(target, wallet, slot),
        // 등록 목록(상태 145) 머리띠 0x54d95(skin, 8 "나만의리그 타자편", 5) 가 전역 G 를 그린다
        gamePoint: wallet.balance,
      }}
      onAceMatch={startAceMatch}
      gameSettings={gameSettings}
      // 마선수 대결의 상대 마투수도 전역 레벨 칸을 본다 (0xb6414 배율 · 0xaebe4 마구 횟수)
      aceLevels={aceLevels.levels}
    />
  )
}
