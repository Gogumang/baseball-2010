import { useMemo } from 'react'
import { useCareerSession } from '@/app/model/useCareerSession'
import { useMissionSession } from '@/app/model/useMissionSession'
import { modeBatterOf } from '@/app/model/modeBatter'
import { modePitcherOf } from '@/app/model/modePitcher'
import { NARI_BATTER_MODE, NARI_PITCHER_MODE } from '@/app/ui/app/appConstants'
import type { AfterLeagueSessions } from '@/app/ui/app/useAppLeagueSessions'
import { missionBatterRecordSlotOf, missionNariTeamIdsOf } from '@/app/ui/app/appDerivations'

/** 나리 타자편 세션과 미션 세션 */
export function useAppCareerAndMission(
  app: Pick<
    AfterLeagueSessions,
    | 'saveGame'
    | 'missionRecord'
    | 'batterNariGameSave'
    | 'aceMatchPendingPorts'
    | 'aceMatchHoldPort'
    | 'gameSettings'
    | 'sound'
    | 'random'
    | 'screen'
    | 'setScreen'
    | 'runner'
    | 'aceLevels'
    | 'wallet'
    | 'hiddenOpenNotice'
    | 'hallOfFameForMissionRef'
    | 'recordStat'
    | 'openHidden'
    | 'readBatterOtherModes'
    | 'nariOpenedAces'
    | 'pitcherSession'
    | 'bumpBatterManagementBgmRestart'
  >,
) {
  const {
    saveGame,
    missionRecord,
    batterNariGameSave,
    aceMatchPendingPorts,
    aceMatchHoldPort,
    gameSettings,
    sound,
    random,
    screen,
    setScreen,
    runner,
    aceLevels,
    wallet,
    hiddenOpenNotice,
    hallOfFameForMissionRef,
    recordStat,
    openHidden,
    readBatterOtherModes,
    nariOpenedAces,
    pitcherSession,
    bumpBatterManagementBgmRestart,
  } = app
  const careerSession = useCareerSession({
    runner,
    random,
    saveGame,
    screen,
    setScreen,
    sound,
    wallet,
    // 환경설정 "주루" (설정 +0xbd) — 나리 타자편은 사람이 늘 공격이라 그대로 먹는다 (0xae690)
    runningModeManual: gameSettings.settings.runningMode === '수동',
    recordStat,
    // 같은 날 CPU 끼리 경기·포스트시즌 CPU 경기의 마선수 배율(0xd88aa)도 전역 레벨 칸을 본다
    aceLevels: aceLevels.levels,
    readRegularSeasonOtherModes: readBatterOtherModes,
    // 정규시즌 우승 팝업 0xb 닫힘의 0x62369(0x29 · 0x22) 알림 창
    announceHiddenOpen: hiddenOpenNotice.announce,
    openedAces: nariOpenedAces,
    nariGameSave: batterNariGameSave,
    // 나간 마선수 대결 대기 — 전역기록 g[0xec] · g[0xee] · g[0x11f] · g[0x144] (선수를 새로 만들어도 남는다)
    aceMatchPending: aceMatchPendingPorts[NARI_BATTER_MODE],
    // 자동 훑기 0x1cf9c 의 대결 대기 가드(1cfe4~1d008) — 두 편 칸을 다 본다 (B-124)
    aceMatchHold: aceMatchHoldPort,
    onManagementBgmRestart: bumpBatterManagementBgmRestart,
  })
  const pitcherMissionPitcher = useMemo(() => modePitcherOf(pitcherSession.career), [pitcherSession.career])
  // 타자 미션(모드 6)은 0x213c0 이 6→4 로 나리 타자편 저장을 올린다 — 마투수 투구 소모(0xa5e14)의 압도 22 가 이 타자를 본다
  const missionBatterCareer = careerSession.career ?? careerSession.savedCareer
  const missionBatterSkillIds = missionBatterCareer?.equippedSkillIds
  const missionBatterRecordSlot = missionBatterRecordSlotOf(missionBatterCareer)
  // 미션 보상 G (0x4ef72) — 지갑으로 들어간다. 육성 선수가 없어도 사라지지 않는다
  const mission = useMissionSession({
    runner,
    random,
    missionRecord,
    screen,
    setScreen,
    sound,
    onGamePointReward: careerSession.actions.gainGamePoint,
    // 정산 4ef86 — 편별 올클리어면 히든 37 · 21 을 열고 알림 창 (0x62368)
    openHidden,
    // 정산 끝 0x4e8b0 — 모드 5 · 6 플레이 시간 (칸 +0x54)
    recordStat,
    // 환경설정 "송구" (설정 +0xf4) — 투수편 미션은 사람이 늘 수비라 그대로 먹는다 (0xae6c8)
    throwModeManual: gameSettings.settings.throwMode === '수동',
    // 환경설정 "주루" (설정 +0xbd) — 타자편 미션은 사람이 늘 공격이라 그대로 먹는다 (0xae690, 0x46418)
    runningModeManual: gameSettings.settings.runningMode === '수동',
    // 환경설정 진동 (저장 +0x3b) — 투수 미션·투수편 마선수 대결의 사람 공 삼진 진동(0x4d0d6)이 본다
    isVibrationOn: gameSettings.settings.isVibrationOn,
    aceLevels: aceLevels.levels,
    // 투수 미션(모드 5)은 0x213c0 이 5→3 으로 나리 투수편 저장을 올리고 0x1fbd0 이 그 투수(또는 명예 투수)를 준다.
    // 투수편 세션은 시작할 때 저장을 올려 두므로 `career` 가 곧 저장된 투수다 (`modePitcherOf`)
    pitcher: pitcherMissionPitcher,
    ...(missionBatterSkillIds === undefined ? {} : { batterSkillIds: missionBatterSkillIds }),
    // 루에 선 미션 타자의 주력 (0xb570d(ctx, 3, 나, 1, 90, 1)) — 라우트가 치는 타자로 넘기는 `modeBatterOf` 와 같은 값
    batterRunAbility: modeBatterOf(missionBatterCareer ?? null).ability.run,
    // 선수 고르기에서 명예 선수(+0xa5/+0xa6 ≥ 0)를 고르면 0x1fbd0 · 0x1fc20 이 이 기록을 준다.
    // 기록연감 훅은 미션 세션보다 늦게 서므로(올 클리어를 본다) 지난 그림의 값을 넘긴다 — 명전은 미션 중에 안 바뀐다
    // oxlint-disable-next-line react/refs -- 지난 그림의 기록연감: 기록연감 훅이 미션 세션의 올 클리어를 보고 서서(아래) 이 그림 값은 아직 없다
    hallOfFame: hallOfFameForMissionRef.current,
    // 마선수 대결의 사람 칸 팀 (0xaa57c aa6dc~aa728) — g[0xf6] 모드 저장 레코드 +1 = 그 편 나리 저장의 팀
    nariTeamIds: missionNariTeamIdsOf(missionBatterCareer, pitcherSession.career),
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
  return { careerSession, pitcherMissionPitcher, missionBatterCareer, missionBatterSkillIds, missionBatterRecordSlot, mission }
}

/** 이 훅까지 선 앱 칸 */
export type AfterCareerAndMission = AfterLeagueSessions & ReturnType<typeof useAppCareerAndMission>
