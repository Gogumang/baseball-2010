import type { RandomPort } from '@/shared/api/random/randomPort'
import { lineupSlotOf } from '@/entities/game/model/quickLineup'
import { cpuSideOf, humanSideOf, missionTeamIdsOf } from '@/entities/mission/model/missionGame'
import type { MissionRun } from '@/entities/mission/model/missionRun'
import { acePitcherFramesOf } from '@/widgets/batting-stage/model/stageRefs'
import type { SettlementEffectLayers } from '@/widgets/batting-stage/model/stageRefs'
import { batterSideOfForm } from '@/widgets/batting-stage/lib/stageLayout'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import type { MissionPlayScreenProps } from './missionPlayProps'

/** `team_logo_ini` 작은 로고 — 팀 경기 · 타자편 화면과 같은 경로 */
const smallLogoUrlOf = (teamId: number) => assetUrl(`./sprites/team_logo_ini/${String(teamId).padStart(3, '0')}.png`)

/** 치는 선수 — 능력 · 장착 스킬 · 레코드 칸 · 오늘 타석 결과 링 · 그림 · 필살 칸 */
export function missionBatterPropsOf(props: MissionPlayScreenProps) {
  const { run, batterLook } = props
  // 타자 그림 · 손 — 레코드 +0xb (사람 칸에 마타자는 없어 손 = 폼 & 1, 0xb63c0)
  const form = batterLook?.form ?? 0
  return {
    batterAbility: props.ability,
    batterSkillIds: props.batterSkillIds,
    batterRecordSlot: props.batterRecordSlot,
    // 그 타순 칸의 오늘 타석 결과 링 — 공격(사람 칸) 팀 + 타순(팀+0x32)×0x18 + 0x34 (0x445cc 4477a~4478c · 0xab214 aba8e~abaac).
    // 스윙 판정의 16 상승세 · 17 하락세와 스킬 판 비트 16 · 17 이 같은 링을 읽는다 (사람 타석 결과는 `afterHumanPlateAppearance` 가 넣는다)
    recentAtBatCodes: run.game.humanBatting.lineup.records[lineupSlotOf(run.game.humanBatting.order)]?.results ?? [],
    batterForm: form,
    batterSkinIndex: batterLook?.skinIndex ?? 0,
    batterHand: batterSideOfForm(form),
    specialSwingNumber: props.specialSwingNumber,
    specialSwingRemaining: props.specialSwingRemaining,
    onSpecialSwingUsed: props.onSpecialSwingUsed,
    sceneBuntKind: props.sceneBuntKind,
  }
}

/** 장면 수명 칸 — 하늘 줄 · 루상 주자 애니 시계 · 경기 스킬 판 · 환경설정 · 주자 마선수 */
export function missionSceneSlotsOf(props: MissionPlayScreenProps) {
  const { runnerAnimationClock, skillPanelScene, settings, runnerAces } = props
  return {
    skyRow: props.skyRow,
    ...(runnerAnimationClock === undefined ? {} : { runnerAnimationClock }),
    // 경기 스킬 표시 판(0xd 진입 48fa4 · 0x4b5b4) — 0xd 진입마다 새 0xe 대기 객체 · 사람이 앉은 측이 공격 측(st[9])
    skillPanel: {
      entryKey: props.sceneConfirm ?? null,
      attackSide: humanSideOf(props.run.mission),
      ...(skillPanelScene === undefined ? {} : { scene: skillPanelScene }),
    },
    // 환경설정 전광판(저장 +0x3a) — OFF 면 흐르는 글자를 안 그린다 (0x77726) · 진동(저장 +0x3b) — 맞은 공·사구 진동 (0x3a44)
    isScoreboardOn: settings?.isScoreboardOn,
    isVibrationOn: settings?.isVibrationOn,
    ...(runnerAces === undefined ? {} : { runnerAces }),
  }
}

/** 마운드 — 투수 능력 · 장비 겹 · 바탕 벌 · 지친 눈 · 마투수 그림 · 마구 칸 */
export function missionMoundPropsOf(props: MissionPlayScreenProps) {
  const { opponent, cpuMagic } = props
  return {
    pitcherAbility: props.pitcherAbility,
    // 마운드 투수 장비 겹 — 타석 교대 0x47cc8 의 48138~4816a (모드 6 도 같다)
    pitcherEquipmentNibbles: opponent === null ? props.pitcherEquipmentNibbles : undefined,
    // 마운드 바탕 벌 = 피부 × 15 + 수비 팀(hud CPU 칸 팀) — 482c0~482fc → 0x793b0 의 794c2
    pitcherSkinIndex: props.pitcherSkinIndex ?? 0,
    pitcherStaminaPercent: props.pitcherStaminaPercent ?? null,
    acePitcher: opponent === null ? null : acePitcherFramesOf(opponent),
    aceLevels: props.aceLevels,
    ...(cpuMagic === undefined ? {} : { cpuMagic }),
  }
}

/** 경기 칸(이닝 st[0x6b] · 공격 측 st[9] · 점수 0xb69b0 · 팀 st[0x28 + 칸])을 HUD 에 보인다 */
export function missionStageHudOf(props: MissionPlayScreenProps) {
  const { run, atBat, runnerRunAbilities, stealingFrom } = props
  const teamIds = missionTeamIdsOf(run)
  return {
    inning: run.game.inning + 1,
    half: run.game.offenseSide === 0 ? ('초' as const) : ('말' as const),
    ourScore: run.game.scores[humanSideOf(run.mission)],
    opponentScore: run.game.scores[cpuSideOf(run.mission)],
    balls: atBat.balls,
    strikes: atBat.strikes,
    outs: run.outs,
    bases: run.bases,
    ...(runnerRunAbilities === undefined ? {} : { runnerRunAbilities }),
    ...(stealingFrom === undefined ? {} : { hiddenRunnerBases: stealingFrom }),
    // 경기[0x28 + 칸] 팀의 작은 로고 (0x48658 48a38~48a74 → 장면+0x1054 · +0x1058) — 사람 칸 · CPU 칸 (`missionTeamIdsOf`)
    ourLogoUrl: smallLogoUrlOf(teamIds.human),
    opponentLogoUrl: smallLogoUrlOf(teamIds.cpu),
    // 루상 주자 팔레트(0x35b94 — 주자 +0xac 팀) · 펜스 아이콘(0x77974 — 모드 5 · 6 은 77ae4~77af0 에서 늘 11)
    ourTeamId: teamIds.human,
    opponentTeamId: teamIds.cpu,
    // 위 줄 = 측 0(선공) · 아래 줄 = 측 1 (0x373d0 — 점수 0xb69b1(st, 0) · (st, 1)). 사람은 미션의 측에 앉는다
    playerSide: humanSideOf(run.mission),
  }
}

/**
 * 경기 상태 0x19 — 정산 진입 0x4ea0c 꼬리(4f41a~)는 모드를 안 가린다 — 성공(4ef36 [sp+0x50] = 1)이면 밤하늘일 때 불꽃, 실패(4efb4 = 0)면
 * 비(|0xb69b0(0) − (1)| × 30). 효과 · 파티클 틱은 경기 난수로 그림마다 돈다
 */
export function missionSettlementPropsOf(isOver: boolean, isSuccess: boolean, run: MissionRun, random: RandomPort, layers: SettlementEffectLayers) {
  if (!isOver) return {}
  return {
    settlement: {
      isWin: isSuccess,
      // 경기 상태 두 측 점수 0xb69b0 — 위 HUD 와 같은 점수판(`run.game.scores`, 견제 · 도루 · 폭투 판 득점도 든다). 차이의 절댓값만 쓴다
      side0Score: run.game.scores[0],
      side1Score: run.game.scores[1],
      // 하늘 칸 — 경기 이닝 st[0x6b]
      inning: run.game.inning + 1,
      random,
      layers,
    },
  }
}
