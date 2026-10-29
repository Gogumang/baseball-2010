import type { ReactNode } from 'react'
import { EntryRoutes } from '@/app/ui/EntryRoutes'
import { hasCareerPlayerInSeasonTeam } from '@/entities/season-mode/model/playerRecruit'
import { careerResetTargetOf, judgeModeReset } from '@/entities/settings/model/modeReset'
import { generalGameOfSave } from '@/pages/general-mode/lib/generalModeResume'
import { nariGameMatchOfSave } from '@/pages/management/lib/nariMatchPrepare'
import { NARI_BATTER_MODE, NARI_PITCHER_MODE } from '@/app/ui/app/appConstants'
import { withHiddenOpenNotice } from '@/app/ui/app/appOverlay'
import type { AppScope } from '@/app/ui/app/appScope'

/** 메인 메뉴 일반모드 진입 창 [13] 의 답 — 빠른실행이면 경기정보(상태 22)부터 (0x299f8 this+0x14c = 1) */
export function startGeneralMode(app: AppScope, isQuickStart: boolean): void {
  const { setGeneralQuickStart, setGeneralResume, setScreen } = app
  setGeneralQuickStart(isQuickStart)
  setGeneralResume(null)
  setScreen({ kind: '일반모드' })
}

export function entryRoutesOf(app: AppScope): ReactNode {
  const {
    pitcherStore,
    collectionRewardStore,
    editedNames,
    modeSave,
    setLastPlayedMode,
    aceMatchHoldPort,
    gameSettings,
    sound,
    random,
    screen,
    setScreen,
    gameStartCursor,
    setGeneralQuickStart,
    setGeneralResume,
    wallet,
    recordStat,
    openHidden,
    seasonSession,
    pitcherSession,
    careerSession,
    everyMissionCleared,
    collection,
    seasonRoster,
    hallOfFameDeletion,
    aceSelect,
  } = app
  return withHiddenOpenNotice(
    app,
    <EntryRoutes
      screen={screen}
      setScreen={setScreen}
      session={careerSession}
      gameSettings={gameSettings}
      collection={collection.collection}
      random={random}
      wallet={wallet}
      aceSelect={aceSelect}
      gameStartCursor={gameStartCursor}
      // 켤 때 로고 객체 상태 2 끝의 0x6ea6d(소리, 0, −1, 0)
      onLogoVoice={() => sound.play(0)}
      hallOfFameDeletion={hallOfFameDeletion}
      recordStat={recordStat}
      openHidden={openHidden}
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
      careerResetBlockOf={(edition) =>
        judgeModeReset(careerResetTargetOf(edition), {
          isSeasonGameInProgress: seasonSession.isGameInProgress,
          isCareerPlayerInSeasonTeam: hasCareerPlayerInSeasonTeam(seasonRoster, edition === '투수편'),
        }).blockText
      }
      // 시즌모드 초기화 0x224ec(mgr, 2) — 시즌 저장(+0x42)·+0x4e
      onResetSeason={seasonSession.actions.resetSeason}
      // 일반모드 진입 창 [13] — 빠른실행이면 경기정보(상태 22)부터 (0x299f8 this+0x14c = 1)
      onStartGeneralMode={(isQuickStart) => startGeneralMode(app, isQuickStart)}
      // 전역기록 +0x4d · +0x3c — 메인 메뉴 [13] 처음 커서·[15] 확인·이어하기, [최근게임] 갈래가 본다
      isGeneralGameInProgress={modeSave.save.isGeneralGameInProgress}
      lastPlayedMode={modeSave.save.lastPlayedMode}
      onLastPlayedMode={setLastPlayedMode}
      // [13]/[최근게임] 이어하기 — 상태 0x27 → 0x327b8(this, 1): +0x3c = 1 → 0x213c0(앱, 1, 0) 로 블록을 올려 장면 0x104 → +0x4d = 1
      onResumeGeneralGame={() => {
        const saved = generalGameOfSave(modeSave.save.generalGame)
        setGeneralQuickStart(false)
        if (saved === null) {
          // ⚠️ 웹 전용(남김 — 옛 저장 호환, Q-13): 블록을 경기로 못 읽으면(옛 웹 판이 쓴 꼴) 저장이 없는 것으로 보고 새로하기(상태 18)로
          // 간다. 모드 저장은 블록을 꼴 검사 없이 들고 있어 읽을 때 거를 곳이 여기뿐이다 — r325 계측에서 앱 길은 안 지났다
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
          pitcherSession.actions.resumeInterruptedGame(nariGameMatchOfSave(modeSave.save.nariGames[NARI_PITCHER_MODE].match))
          return setScreen({ kind: '투수편' })
        }
        careerSession.actions.resumeInterruptedGame(nariGameMatchOfSave(modeSave.save.nariGames[NARI_BATTER_MODE].match))
      }}
      // 메인 메뉴 처음 단(하위 4)의 전부 수집 보상 판정 0x28e98 → 팝업 0x292f8
      claimCollectionReward={() => collection.claimCollectionReward(collectionRewardStore, everyMissionCleared, wallet)}
    />,
  )
}
