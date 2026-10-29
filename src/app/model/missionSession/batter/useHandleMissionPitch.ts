import { useCallback } from 'react'
import type { PitchResolvedReply } from '@/widgets/batting-stage/lib/stageText'
import { isAtBatFinished, type AtBatState } from '@/entities/at-bat/model/atBatState'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import { runnerCountOf } from '@/entities/game/model/baseState'
import { isMissionPlayOutcome, type MissionRun } from '@/entities/mission/model/missionRun'
import { arrivesUnhit, clearsPitchJudgement, runOpenedPitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import { sceneResultCodeAfterPitch } from '@/features/defense-play/model/sceneResultCode'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { MissionAtoms, MissionPlayScope } from '@/app/model/missionSession/atoms/missionScope'
import { missionRunAtom } from '@/app/model/missionSession/atoms/runAtoms'
import { missionSceneAtom, sceneResultCodeAtom } from '@/app/model/missionSession/atoms/fieldAtoms'
import { missionCpuAfterThrow } from '@/app/model/missionSession/opponent/opponentStamina'
import { takeStealingFrom } from '@/app/model/missionSession/scene/sceneSteps'
import { type BatterPitchHands, openBatterArrival, startBatterFoulPlay } from '@/app/model/missionSession/batter/batterPitchSteps'
import { type BatterPitch, holdLiveBatterArrival, settleBatterArrival } from '@/app/model/missionSession/batter/batterArrivalRoute'

/** 쏜 공(`foulContact`)이 실린 파울 각 공인가 — 판이 진행 중이면 이 공은 판을 돈다 */
function isFoulContact(
  detail: PitchOutcomeDetail,
): detail is PitchOutcomeDetail & { readonly foulContact: NonNullable<PitchOutcomeDetail['foulContact']> } {
  return detail.resolution.kind === '파울' && detail.foulContact !== undefined
}

/** 판이 진행 중인가 */
const isRunning = (run: MissionRun | null): run is MissionRun => run !== null && run.status === '진행중'

/**
 * 공이 손을 떠날 때 — 경기 +0xfd4 는 이 공의 0x11 진입이 지우고 휘두른 공이면 스윙 판정이 덮는다. 견제는 공이 아니라 구질이 오지
 * 않는다 (`PitchOutcomeDetail.pitchTypeNumber`). 0xa5e14 — state[0xd] · state[0xe] 내림 · 마운드 투수 투구 수 · 스태미나
 * (`missionCpuAfterPitch`). 마투수면 그 레코드 +0x2c 를 세션 셈(`missionOpponentStaminaAfterPitch`)으로 깎아 마운드에 든다 —
 * 내려가면 마스터 줄 소모를 CPU 팀이 든다
 */
function chargePitch(
  atoms: MissionAtoms,
  current: MissionRun | null,
  detail: PitchOutcomeDetail,
  batter: { readonly batterSkillIds: readonly number[]; readonly aceLevels: Readonly<Record<number, number>> | undefined },
): void {
  atoms.set(sceneResultCodeAtom, sceneResultCodeAfterPitch(detail.resolution, detail.resultCode))
  const pitchTypeNumber = detail.pitchTypeNumber
  if (current === null || pitchTypeNumber === undefined) return
  atoms.set(missionRunAtom, (previous) =>
    previous === null ? previous : { ...previous, cpu: missionCpuAfterThrow(previous, pitchTypeNumber, batter.batterSkillIds, batter.aceLevels) },
  )
}

/** 판정한 공을 타석에 먹인다 — 끝난 타석 결과와 공 앞 루상 주자 수(결과 띠) */
function judgedPitchOf({ runner }: BatterPitchHands, current: MissionRun | null, detail: PitchOutcomeDetail): BatterPitch {
  const nextAtBat = runner.applyPitch(detail.resolution)
  const outcome = isAtBatFinished(nextAtBat) ? nextAtBat.outcome : null
  return { detail, nextAtBat, outcome, current, runnersOnBase: current === null ? 0 : runnerCountOf(current.bases) }
}

/** 맞은 공(쏜 패턴이 묶인 안타·아웃·홈런)이면 수비 화면(상태 0x17)이 먼저 돈다 — 결과·콜은 그 뒤다 */
const isPlayOutcomeOf = (outcome: BatterPitch['outcome']) => outcome !== null && isMissionPlayOutcome(outcome)

/** 진행 중인 판의 못 맞힌 공이면 공 도착 판을 연다(판 시작까지) — 연 판과 그 판 */
function openArrivalOf(
  hands: BatterPitchHands,
  current: MissionRun | null,
  detail: PitchOutcomeDetail,
  nextAtBat: AtBatState,
  arrival: { readonly stealing: readonly StealBase[]; readonly buntKind: number },
) {
  if (!isRunning(current) || !arrivesUnhit(detail.resolution)) return null
  const opened = openBatterArrival(hands, current, detail, nextAtBat, arrival)
  return opened === null ? null : { run: current, opened }
}

/** 판정한 공을 타석에 먹이고 공 도착 판을 연다 — 붙드는 판이면 붙들고, 아니면 미리 돌린 판 뒤의 길로 */
function resolveBatterPitch(
  hands: BatterPitchHands,
  current: MissionRun | null,
  detail: PitchOutcomeDetail,
  extra: { readonly isUncatchable: boolean; readonly buntKind: number },
): PitchResolvedReply {
  const { atoms } = hands
  const pitch = judgedPitchOf(hands, current, detail)
  const stealing = takeStealingFrom(atoms)
  const arrival = openArrivalOf(hands, current, detail, pitch.nextAtBat, { stealing, buntKind: extra.buntKind })
  // 0x3dfac 낫아웃 갈래(3e0aa)가 판정 칸을 지웠나 — 타석 화면이 0x12 틱 0 의 판정 글자 · 삼진 파티클을 고른다
  const reply: PitchResolvedReply = { judgementCleared: clearsPitchJudgement(arrival?.opened ?? null) }
  if (arrival !== null && arrival.opened.kind !== 2) {
    holdLiveBatterArrival(hands, pitch, arrival.run, arrival.opened)
    return reply
  }
  const play = arrival === null ? null : runOpenedPitchArrivalPlay(arrival.opened)
  // 판이 남긴 수비 장면 칸은 다음 판으로
  if (play !== null) atoms.set(missionSceneAtom, play.result.scene)
  settleBatterArrival(hands, pitch, play, { ...extra, stealing, isPlayOutcome: isPlayOutcomeOf(pitch.outcome) })
  return reply
}

/**
 * 타자 미션의 공 하나 (`handleMissionPitch`).
 *
 * 공이 손을 떠날 때(0x3dec6) 상대 마투수 투구 소모 0xa5e14 가 돈다 — 모드 갈래가 없어(0x3de10~0x3dec8 ·
 * 0xa5e14~0xa5f62) 미션(모드 6)에서도 깎인다(`missionOpponentStaminaAfterPitch`). 깎인 체력%(0xaebb0)는 다음 공의
 * CPU 제구 등급·피로(0xb58e6)와 스윙 판정 0xab214 가 본다 (`missionPitcherAbility` 셋째 인자).
 *
 * 공을 받기 전 판(지난 그림의 판)을 한 번 읽어 이 공 내내 쓴다 — 아래 마투수 소모가 판을 고쳐도 판 입력은 받기 전 판이다.
 */
export function useHandleMissionPitch(scope: MissionPlayScope) {
  const { atoms, aceLevels, audio, batterRunningMode, random, runner, pick } = scope
  const batterSkillIds = pick.batterSkillIds
  return useCallback(
    (
      detail: PitchOutcomeDetail,
      /** 필살타법이 성공한 타구인가 (0x517e6 → 0x51800) — 야수가 쥐지 못한다. `BattingStage` 의 셋째 인자 */
      isUncatchable = false,
      /** 이 공의 번트 종류 장면 +0xfdc (`BattingStage` 의 넷째 인자) — 타구 판 리드(0x3d7b8)가 본다 */
      buntKind = 0,
    ): PitchResolvedReply | undefined => {
      const hands: BatterPitchHands = { atoms, runner, random, audio, batterRunningMode }
      const current = atoms.get(missionRunAtom)
      chargePitch(atoms, current, detail, { batterSkillIds, aceLevels })
      if (isFoulContact(detail) && isRunning(current)) {
        startBatterFoulPlay(hands, detail, current, buntKind)
        return undefined
      }
      return resolveBatterPitch(hands, current, detail, { isUncatchable, buntKind })
    },
    [aceLevels, atoms, audio, batterRunningMode, batterSkillIds, random, runner],
  )
}
