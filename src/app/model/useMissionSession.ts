import { useMemo } from 'react'
import { createSilentSound } from '@/shared/api/audio/soundPort'
import { modePitcherOf } from '@/app/model/modePitcher'
import { type MissionSessionInput, missionSessionArgsOf } from '@/app/model/missionSession/hook/sessionInput'
import { useMissionAtoms, useMissionValue } from '@/app/model/missionSession/atoms/missionScope'
import { clearCountsAtom } from '@/app/model/missionSession/atoms/recordAtoms'
import { usePlayerPick } from '@/app/model/missionSession/pick/usePlayerPick'
import { usePickMirrors } from '@/app/model/missionSession/pick/specialRunners'
import { useMissionClock, useResultEntryCleanup } from '@/app/model/missionSession/clock/useMissionClock'
import { usePitchSelectionEntry, usePitchSelectionSceneMirror } from '@/app/model/missionSession/scene/usePitchSelectionEntry'
import { useAskPitchSelection } from '@/app/model/missionSession/scene/useAskPitchSelection'
import { useSceneFlowActions } from '@/app/model/missionSession/scene/useSceneFlowActions'
import { useSettlement } from '@/app/model/missionSession/result/useSettlement'
import { resultEarnedGamePointOf } from '@/app/model/missionSession/result/leaveResult'
import { useHandleMissionPitch } from '@/app/model/missionSession/batter/useHandleMissionPitch'
import { usePreRollContact } from '@/app/model/missionSession/batter/useBatterKeyActions'
import { useHandleThrow } from '@/app/model/missionSession/pitcher/useHandleThrow'
import { usePitcherKeyActions } from '@/app/model/missionSession/pitcher/usePitcherKeyActions'
import { useStepAutoRelay } from '@/app/model/missionSession/autoRelay/useStepAutoRelay'
import { useMissionActions } from '@/app/model/missionSession/hook/useMissionActions'
import { useMissionView } from '@/app/model/missionSession/hook/useMissionView'

export { missionBatterSpecialSwingRemainingOf, missionOpponentSpecialSwingOf } from '@/app/model/missionSession/opponent/specialSwing'
export {
  missionMoundOpponent,
  missionMoundPitcherAbility,
  missionOpponentAbility,
  missionPitcherAbility,
} from '@/app/model/missionSession/opponent/missionOpponent'
export { missionCpuMagicStateOf, missionOpponentStaminaAfterPitch } from '@/app/model/missionSession/opponent/opponentStamina'
export { missionStageBatterOf } from '@/app/model/missionSession/lineup/humanBatter'
export { missionPitchingSkillPanelOf } from '@/app/model/missionSession/lineup/cpuBatter'
export { withPitcherNotOut } from '@/app/model/missionSession/runnerPlay/pitcherRunnerPlay'

/**
 * 미션 모드 한 판 — 타자편(MissionRun)과 투수편(PitcherRun)을 함께 다룬다.
 *
 * 세션 상태는 이 세션의 atom store 에 있다(`missionSession/atoms`) — 하위 훅은 store 와 매개변수만 받아 필요한 atom 을 직접
 * 읽고 쓴다. effect 차례(0x12 진입 틀 시계 거두기 → 제한 시간 → 0xf 진입 · layout 정산)는 옛 훅 차례 그대로다.
 */
export function useMissionSession(input: MissionSessionInput) {
  const pitcherInput = input.pitcher
  const nariPitcher = useMemo(() => pitcherInput ?? modePitcherOf(null), [pitcherInput])
  // 통로를 안 받으면 조용한 포트로 — 하위 훅이 `sound` 가 있는지 매번 보지 않게 한다
  const silent = useMemo(() => createSilentSound(), [])
  const args = missionSessionArgsOf(input, silent, nariPitcher)
  const atoms = useMissionAtoms(args)
  const scope = { ...args, atoms }
  const pick = usePlayerPick(scope)
  const playScope = { ...scope, pick }
  usePickMirrors(playScope)
  usePitchSelectionSceneMirror(scope)
  useResultEntryCleanup(atoms)
  useMissionClock(scope)
  usePitchSelectionEntry(scope)
  const settledEarned = useSettlement(scope)
  const { aimTick } = usePitcherKeyActions(scope)
  const askPitchSelection = useAskPitchSelection(scope)
  const { confirmScene, finishSubstitutionScene } = useSceneFlowActions(scope)
  const view = useMissionView(playScope)
  const handleMissionPitch = useHandleMissionPitch(playScope)
  const preRollContact = usePreRollContact(scope)
  const handleThrow = useHandleThrow(playScope)
  const actions = useMissionActions(playScope)
  const clearCounts = useMissionValue(atoms, clearCountsAtom)
  const stepAutoRelay = useStepAutoRelay(scope)
  return {
    missionRun: view.missionRun,
    pitcherRun: view.pitcherRun,
    pitcherAceMatchMission: view.pitcherAceMatchMission,
    clearedKeys: view.clearedKeys,
    clearCounts: view.clearCounts,
    lastSide: view.lastSide,
    aceLevels: args.aceLevels,
    pitcher: pick.pitcher,
    /** 지금 대기 칸 (g[0x11f] · g[0x176] · g[0xf6]) — 결과 판이 대결 꼴인지 본다 */
    aceMatchHold: args.hold,
    player: pick.player,
    hallOfFameBatter: pick.hallOfFameBatter,
    missionConditionCode: view.missionConditionCode,
    pendingDefensePlay: view.pendingDefensePlay,
    pendingBenchClearing: view.pendingBenchClearing,
    pickoffReplay: view.pickoffReplay,
    pendingRunnerPlay: view.pendingRunnerPlay,
    handleMissionPitch,
    preRollContact,
    handleThrow,
    actions,
    lastPitchJudgementCleared: view.lastPitchJudgementCleared,
    /** 투수 미션의 마지막 공 — 타석 장면이 그림으로만 다시 날린다 */
    lastPitcherThrow: view.lastPitcherThrow,
    /** 조준(0x10)의 틱 하나 0x39c5c — 화면 `AimCursor` 의 onTick (투수 미션 흔들림은 경기 난수) */
    aimTick,
    /** 조준(0x10)의 CLR — 0xf 로 돌아가 0xf 진입 0x3d954 가 CPU 대타를 다시 묻는다 */
    returnToPitchSelection: () => askPitchSelection('same'),
    batterSpecialSwingStored: view.batterSpecialSwingStored,
    pitcherMagicRemaining: view.pitcherMagicRemaining,
    stealableBases: view.stealableBases,
    resultEarnedGamePointOf: resultEarnedGamePointOf(settledEarned, clearCounts),
    /** 타자 미션: 이번 공에 출발한 주자의 루 (st[0x14 + 루]) — 타석 화면이 그 주자를 루에 안 그린다 */
    stealingFrom: view.stealingFrom,
    /**
     * 투수 미션: CPU 가 이번 공에 출발시킨 주자의 루 (st[0x14 + 루]) — 투구 화면이 그 주자를 루에 안 그린다.
     * `selectionEntered` 면 0xf 진입이 이미 지웠다 — 화면은 공이 날거나 0x12 인 동안만 숨긴다 (`pitcherStealDisplayAtom`)
     */
    pitcherStealDisplay: view.pitcherStealDisplay,
    /**
     * 타자 미션 타석 화면 HUD 의 루별 주자 주력 — 0x35b94 상태 0xe 주루 칸(35f74 `0xb570d(ctx, 3, 주자, 1, 90, 1)`).
     * 루에 선 주자의 신원(사람 칸 팀 타순 칸)대로다 (`missionRunnerRunAbilitiesOf`)
     */
    missionRunnerRunAbilities: view.missionRunnerRunAbilities,
    /**
     * 타자 미션 타석 화면의 타자 · 루 주자 마선수 번호 — 루상 주자 0x35b94 가 주자 +0x9c ≠ −1 이면 타석 교대 0x483a0 이 +0x1c 에 실은
     * ace/defender 그림으로 그린다. 수비 판(`playAbilitiesOf` 의 `runnerAces`)과 같은 값이다 (`missionRunnerAcesOf`)
     */
    missionRunnerAces: view.missionRunnerAces,
    /** 상태 0xe 의 OK 대기 — 화면이 `useSceneConfirm` 에 넘긴다 (새 타석이면 메시지 0xbc1 의 타석 등장음을 실었다) */
    sceneConfirm: view.sceneConfirm,
    /** 경기 장면 로딩 판의 팁 글(StrTIP[1 + rand(0, 73)]) — 서 있으면 라우트가 로딩 판을 그리고 끝나면 `actions.finishLoading` */
    loadingTip: view.loadingTip,
    /** 미션 시작의 첫 0x18 판 — 서 있으면 라우트가 공수 교대 판을 그리고 OK 를 `actions.confirmHalfInningBoard` 로 */
    halfInningBoard: view.halfInningBoard,
    /** 0xe 의 OK 하나 — 화면이 `useSceneConfirm` 셋째 인자로 넘긴다 (새 타석이면 0xf 진입이 CPU 교체를 묻는다) */
    confirmScene,
    /** 교체 연출 0x16 — 서 있으면 화면이 "CHANGE" 애니를 그리고 0xe 대기를 세지 않는다 */
    substitutionScene: view.substitutionScene,
    /** 화면이 교체 연출을 다 그렸다 */
    finishSubstitutionScene,
    /** 이 미션 장면의 하늘 줄 (구장 +0x10 — 장면을 세울 때 한 번 굴린 rand(0, 6)) — 타석 · 정산 결과 배경이 같이 쓴다 */
    skyRow: view.skyRow,
    /** 경기 난수 — 결과 판 0x4a384 의 정산 효과가 쓴다 (투수편 마선수 대결 화면 `PitcherAceMatchRoute`) */
    random: args.random,
    /** 타자 미션 상대 마투수의 체력% `0xaebb0` = trunc(+0x2c / 100) — `missionPitcherAbility` 셋째 인자 */
    opponentStaminaPercent: view.opponentStaminaPercent,
    /** 투수 미션 사람 투수의 지금 +0x2c (공마다 0xa5e14 가 깎는다 — `pitcherStaminaStored`) */
    pitcherStamina: view.pitcherStamina,
    /**
     * 타자 미션 마운드 투수가 이 구질을 던져 **깎은 뒤**의 체력% — `PitcherAbility.staminaPercentAfterPitch` 로 타석 화면에 넘긴다.
     * 원본은 공이 손을 떠나는 0x11 진입(0x3dec6 → 0xa5e14)에서 깎고 놓기 0x4dc78 · 스윙 0xab214 가 그 뒤 체력을 본다.
     * 마운드가 비면(CPU 팀 없음) 10000 이다
     */
    opponentStaminaPercentAfterPitch: view.opponentStaminaPercentAfterPitch,
    /** 자동진행 0x21 의 마지막 중계 칸 — 중계 화면이 그린다 (`stepAutoRelay`) */
    autoRelayStep: view.autoRelayStep,
    /** 자동진행 0x21 의 틱 하나를 굴린다 — 중계 화면이 틱마다 부른다 */
    stepAutoRelay,
  }
}
