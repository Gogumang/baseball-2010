import { useEffect, useMemo, useRef } from 'react'
import { useRenderMachine } from '@/shared/lib/renderMachine/useRenderMachine'
import { sceneFieldPaletteOf } from '@/features/play-team-game/model/sceneStadium'
import { DEFENSE_SCENE_START } from '@/pages/defense/lib/defenseHomeRunEffects'
import type { DefenseSceneMemory } from '@/pages/defense/lib/defenseHomeRunEffects'
import { useSceneScopedRef } from '@/pages/defense/model/useSceneScopedRef'
import { createRunnerAnimationClock } from '@/widgets/batting-stage/lib/baseRunners'
import { createSkillPanelScene } from '@/widgets/batting-stage/lib/skillPanel'
import { useWarmFieldBackgrounds } from '@/pages/defense/model/useWarmFieldBackgrounds'
import { useShownReplay } from '@/pages/defense/model/useShownReplay'
import { useBurstObjectTicksReset } from '@/widgets/burst-mission/model/useBurstObjectTicksReset'
import {
  castOfAces,
  castOfCareer,
  castOfTeamRecordEquipment,
  defensePreloadsOf,
  gameEntryCastPreloadsOf,
  stageSpritePreloadsOf,
} from '@/app/model/gameSpritePreload'
import { useAfterGameEventPreload } from '@/app/model/afterGameEventPreload'
import { mergeSpritePreloads } from '@/shared/lib/sprite/spritePreload'
import { preloadSprites } from '@/shared/lib/sprite/scenePreload'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'
import type { GameRouteProps } from '@/app/ui/gameRoute/gameRouteProps'

/** 경기 장면 0x104 번호 — 로딩 팁이 새로 선 그림마다 하나 오른다(그 그림 안에서 바로 본다) */
function advanceSceneSerial(previous: { readonly serial: number; readonly wasLoading: boolean } | null, isLoading: boolean) {
  const serial = previous?.serial ?? 0
  const isNewScene = isLoading && !(previous?.wasLoading ?? false)
  return { serial: isNewScene ? serial + 1 : serial, wasLoading: isLoading }
}

/**
 * 경기 장면 0x104 를 세운다 — 선수 그림 미리 받기 · 세션에 재생 판 붙이기 · 장면 번호와 장면이 사는 동안 남는 칸들
 */
export function useGameSceneSetup({ session, progress, career }: Pick<GameRouteProps, 'session' | 'progress' | 'career'>) {
  useBurstObjectTicksReset() // 경기 장면 생성 0x48658 — 돌발 객체 [+0x224] = 0
  // 이 경기 두 팀의 선수 그림 — 로딩 판 동안 타석 선수(마선수 · 내 선수 장비 · 몸통 폼)를, 경기 장면 동안 수비 그림을 받는다(안 기다린다)
  const { battingTypeIndex, battingSide, equipmentLevels } = career
  const gameCast = useMemo(
    () => [
      castOfAces(progress.aces),
      castOfCareer({ battingTypeIndex, battingSide, equipmentLevels }),
      // 상대 팀 레코드의 굴린 장비(나리 새 시즌 0x665e8) — 타석 교대 0x47cc8 이 마운드 투수 · 타자에 싣는다
      castOfTeamRecordEquipment(progress.opponentTeamId, progress.opponentEquipment),
    ],
    [progress.aces, battingTypeIndex, battingSide, equipmentLevels, progress.opponentTeamId, progress.opponentEquipment],
  )
  const stagePreloads = useMemo(() => mergeSpritePreloads(gameEntryCastPreloadsOf(), stageSpritePreloadsOf(...gameCast)), [gameCast])
  useEffect(() => {
    preloadSprites(defensePreloadsOf(...gameCast), 'idle')
  }, [gameCast])
  // 경기 뒤 관리 화면의 이야기 이벤트 · 평가 감독 초상 — 이벤트 데이터에서 계산해 유휴로 (안 기다린다, r134)
  useAfterGameEventPreload(career)
  const play = progress.lastDefensePlay
  // 세션 액션은 그릴 때마다 새 함수라 붙이기는 처음 한 번 — 떼기 · 알리기는 세션 ref 로 늘 지금 것을 부른다
  const sessionActionsRef = useRef(session.actions)
  useMirrorRef(sessionActionsRef, session.actions)
  // 재생 판으로 경기가 끝나면 세션이 정산을 재생 뒤로 미룬다 — 이 화면이 붙어 있는 동안만 (`attachReplayHost`)
  useEffect(() => sessionActionsRef.current.attachReplayHost(), [])
  /** 이미 다 보여 준 플레이 — 같은 플레이를 두 번 재생하지 않는다. 다 그리면 세션에 알린다(팀 경기 · 투수편과 같은 `useShownReplay`) */
  const { shownPlay, finishPlayback } = useShownReplay(play, (shown) => sessionActionsRef.current.finishReplay(shown))
  /**
   * 경기 장면 0x104 하나 — 경기를 세울 때(`startGame` → 적재 상태 8, 웹은 로딩 팁) 새로 만든다. 로딩 팁이 새로 설 때마다 하나 오른다.
   * 그 장면이 사는 동안 아래 칸들이 판 · 타석 · 이닝을 건너 남는다(`useSceneScopedRef`)
   */
  const isLoading = session.loadingTip !== null
  const sceneSerial = useRenderMachine(advanceSceneSerial, isLoading).serial
  /** 경기 장면 동안 남는 HOMERUN 글자 칸 · 표시 비거리 +0x36 — 수비 판 홈런 연출이 판마다 이어 쓴다 (`defenseHomeRunEffects`) */
  const defenseSceneRef = useSceneScopedRef<DefenseSceneMemory>(DEFENSE_SCENE_START, sceneSerial)
  /** 장면 +0xfdc — 사람 타석의 번트 · 스윙 키가 쓴다. 키 없는 공은 0(0x11 진입의 memset — `BattingStage.sceneBuntKind`) */
  const sceneBuntKindRef = useSceneScopedRef(0, sceneSerial)
  /** 장면 +0xf24 의 루상 주자 애니 0~2 — 장면이 사는 동안 0x35b94 가 부를 때마다 돈다 (`RunnerAnimationClock`) */
  const runnerAnimationClockRef = useSceneScopedRef(createRunnerAnimationClock(), sceneSerial)
  /** 경기 스킬 표시 판의 함성 비트 칸 skin+0x44c — 경기 장면 초기화 0x3301c 가 0x3ff 로 채운다 · 애니 7 · 8 (`skillPanel`) */
  const skillPanelSceneRef = useSceneScopedRef(createSkillPanelScene(), sceneSerial)
  /** 수비 재생 · 중계 바탕 0x35218 의 팔레트 줄 — 수비 구장 +0xc(0x39fdc 모드 4 의 0x788f8, 0~9 는 타석 줄과 같다) */
  const grassPalette = sceneFieldPaletteOf(session.sceneStadium)
  // 타석 바닥 · 수비 바탕을 미리 칠한다 — 원본은 구장 객체 적재 때 팔레트를 갈아 끼운다
  useWarmFieldBackgrounds(grassPalette)
  return {
    stagePreloads,
    play,
    sessionActionsRef,
    shownPlay,
    finishPlayback,
    sceneSerial,
    defenseSceneRef,
    sceneBuntKindRef,
    runnerAnimationClockRef,
    skillPanelSceneRef,
    grassPalette,
  }
}
