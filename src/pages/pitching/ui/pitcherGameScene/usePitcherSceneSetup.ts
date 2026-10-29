import { useState } from 'react'
import { activeSound } from '@/shared/api/audio/soundPort'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { hasGameIntro } from '@/widgets/game-scene/lib/introSchedule'
import { useSettlementEffectLayers } from '@/widgets/batting-stage/model/useSettlementEffectLayers'
import { useWarmStageCast } from '@/widgets/batting-stage/model/useWarmStageCast'
import { createSkillPanelScene } from '@/widgets/batting-stage/lib/skillPanel'
import { useSkillCheerRestore } from '@/widgets/batting-stage/model/useSkillCheerRestore'
import { DEFENSE_SCENE_START, type DefenseSceneMemory, summaryAfterReplay, useSceneScopedRef, useShownReplay } from './otherSlices'
import { PITCHER_CAREER_MODE, type PitcherGameSceneProps } from './pitcherGameSceneProps'
import { pitcherGameWarmCastOf } from './pitcherStageCast'

/** 판(인트로 0xc · 교대 판 0x18 · 경기 끝 판 0x18)의 닫힘 칸 */
function useSceneBoardsClosed() {
  /** 경기 시작 인트로(상태 0xc)가 끝났는가 — 모드 3 은 인트로가 선다 (`hasGameIntro`) */
  const [isIntroDone, setIntroDone] = useState(!hasGameIntro(PITCHER_CAREER_MODE))
  /** OK 로 닫은 마지막 공수 교대 판(상태 0x18 교대 가지)의 번호 */
  const [closedBoardSerial, setClosedBoardSerial] = useState(0)
  /** 경기 끝 결과 판(0x18)에서 OK 를 눌러 정산(0x19)으로 넘어갔는가 */
  const [isEndBoardClosed, setEndBoardClosed] = useState(false)
  return { isIntroDone, setIntroDone, closedBoardSerial, setClosedBoardSerial, isEndBoardClosed, setEndBoardClosed }
}

/** 장면 머리 — 요약 · 재생 칸 · 판 닫힘 · 정산 배경 · 칠하기 · 장면 수명 칸 */
export function usePitcherSceneSetup({ options, session, pitcherEquipmentLevels, pitcherSkinIndex = 0 }: PitcherGameSceneProps) {
  const { progress, summary: progressSummary } = session
  /**
   * 재생 칸의 판 — 경기를 끝낸 재생 판도 0x17 로 다 그린 뒤에야 0xd → 경기 끝 판 0x18 · 정산 0x19 다(판정 B 0xae3e8). 그 그리기
   * 0x43278 의 실책 +0x2e 가 요약에 들도록 재생이 남은 동안은 요약을 안 낸다(`useShownReplay`, r248)
   */
  const play = progress.lastDefensePlay
  const { shownPlay, finishPlayback, isReplayPending } = useShownReplay(play)
  /**
   * **돌발 결과 창 뒤의 경기 끝** (r317 — 타자편 r315 의 짝) — 0x12 끝(4e7ca) · 0x17 끝(52a8e)의 돌발 판정 0x8f414 가 참이면 0x1d · 0x1c
   * (결과 창, 진입 보상 0x3b04c · 0x3b068 → 0x8e34c)를 먼저 거친 뒤 +0x1b6c 로 간다 — 그 다음이 경기 끝 0x18 · 0x19 여도 같다(R9 18-2 ·
   * R10). 경기 끝 판 갈래가 타석 장면(창이 얹히는 자리)보다 앞이라 판정이 남아 있는 동안은 요약을 안 낸다 — 창을 닫으면(`closeBurst`)
   * 남은 중계(0x21) 뒤 경기 끝 판 0x18 · 정산 0x19 가 선다. 보상은 판정 때 `burstRewardDeltas` 에 쌓여 정산 앞에 커리어에 얹히므로 그대로다
   */
  const summary = progress.lastBurstResolution !== null ? null : summaryAfterReplay(progressSummary, isReplayPending)
  const audio = activeSound()
  const closed = useSceneBoardsClosed()
  /** 정산 배경 전용 난수 — 경기 난수를 건드리지 않는다 (팀경기 `TeamGameScreen` 정산 갈래와 같다) */
  const [backdropRandom] = useState(() => createSeededRandom(0))
  /** 정산 효과 층(비 · 파티클) — 타석 배경과 정산 판이 같이 쓴다 (원본 그리기 차례 0x4a384) */
  const settlementLayers = useSettlementEffectLayers()
  // 상대 타자 명단 · 내 투수의 칠하기를 미리 건다 — 원본은 타석 교대 0x47cc8 의 적재 때 칠해 첫 그림부터 제 색이다
  const stageWarmCast = pitcherGameWarmCastOf(progress, pitcherEquipmentLevels, pitcherSkinIndex)
  useWarmStageCast(stageWarmCast)
  /** 경기 장면 동안 남는 HOMERUN 글자 칸 · 표시 비거리 +0x36 — 수비 판 홈런 연출이 판마다 이어 쓴다 (`defenseHomeRunEffects`) */
  const defenseSceneRef = useSceneScopedRef<DefenseSceneMemory>(DEFENSE_SCENE_START, options)
  /** 경기 스킬 표시 판의 함성 비트 칸 skin+0x44c(0x3301c 가 두 측 0x3ff) · 애니 7 · 8 — 경기 장면 수명 (`skillPanel`) */
  const skillPanelSceneRef = useSceneScopedRef(createSkillPanelScene(), options)
  // 교체 연출 0x16 진입 0x3d458 의 CPU 대타 가지 0x668cc (`SubstitutionScene.cheerRestore`)
  useSkillCheerRestore(progress.substitutionScene, skillPanelSceneRef)
  const board = progress.halfInningBoard
  const isHalfInningBoardOpen = board !== null && board.serial !== closed.closedBoardSerial && summary === null
  return {
    ...{ play, shownPlay, finishPlayback, summary, audio, closed, backdropRandom, settlementLayers, stageWarmCast },
    ...{ defenseSceneRef, skillPanelSceneRef, board, isHalfInningBoardOpen },
  }
}
