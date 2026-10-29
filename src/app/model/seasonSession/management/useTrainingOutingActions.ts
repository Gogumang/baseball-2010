import { useCallback } from 'react'
import { rollSeasonTraining, applySeasonTraining, seasonTrainingResultOf } from '@/widgets/season/lib/seasonTrainingResult'
import { HELL_TRAINING_INDEX, HELL_TRAINING_GAME_POINT } from '@/widgets/season/lib/seasonTraining'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { rollSeasonOuting } from '@/widgets/season/lib/seasonOuting'
import type { PostseasonActionsContext } from '@/app/model/seasonSession/postseason/usePostseasonActions'

/** `useSeasonSession` 몸통 문장 116~120 을 그대로 옮겼다 (r346) — 부르는 차례 · 훅 차례는 `useSeasonSession` 그대로 */
export function useTrainingOutingActions(ctx: PostseasonActionsContext) {
  const { save, random, commit, spendGamePoint, setTrainingResult, setScene, setOutingResultText, setOutingPlace } = ctx
  /**
   * 팀 트레이닝 — 0xde 연출이 끝난 틀에 굴림 `0xc074` 한 번 (`rollSeasonTraining` — 난수 차례 원본 그대로:
   * 칸 0~3 은 상승 → 감소, **지옥훈련은 감소 → 상승 넷**) → 적용 `0xa2f24` → 결과 팝업(0x741a0, 상태는 0xde 그대로).
   * 서브 아이템은 해당 칸 +2, 자동안마기는 사기 감소 −1 이다. 상승은 999 로 자른다.
   */
  const runTraining = useCallback(
    (slot: number) => {
      if (save === null) return
      const { record, teamAbilities, teamMorale } = save.state
      const myTeam = record.teamId
      const roll = rollSeasonTraining(random, slot, record)
      const applied = applySeasonTraining(teamAbilities[myTeam] ?? [], teamMorale, roll)

      commit({
        ...save,
        state: {
          ...save.state,
          teamAbilities: teamAbilities.map((row, team) => (team === myTeam ? applied.abilities : row)),
          teamMorale: applied.teamMorale,
          // SR+4 = 1 — 적용 0xa2f24 끝 a3000~a3006 (`strb #1, [SR, #4]`) 뒤 0x1fded · 0x22755 · 0x1f1b9 로 저장한다 (직접 떴다)
          record: { ...record, acted: true },
        },
      })
      // 지옥훈련이면 G −= 500 (0xa2fca 리터럴, 0..99999 로 자른다 — J 4-6).
      // 예전에는 시즌 G 칸이 늘 0 이라 이 차감이 통째로 빠져 있었다
      if (slot === HELL_TRAINING_INDEX) spendGamePoint(HELL_TRAINING_GAME_POINT)
      // 결과 팝업 — 현재값은 적용 뒤 팀 레코드를 다시 읽는다(0xc290). 닫을 때 0xc9 로 간다(`closeTrainingResult`)
      setTrainingResult(seasonTrainingResultOf(slot, record, roll, applied))
    },
    [commit, random, save, spendGamePoint, setTrainingResult],
  )
  /** 결과 팝업 키 0xf2c8 — 확인 · 취소면 0x742a9(닫기) · 상태 0xc9 */
  const closeTrainingResult = useCallback(() => {
    setTrainingResult(null)
    setScene(SEASON_SCENE_STATE.관리메뉴)
  }, [setScene, setTrainingResult])
  /** 0x4a94 — 확인 팝업 0x16 에 "예": [gfx+0x184] = 장소 · 0xe3 (진입 0x5184 → 0x85074 연출) */
  const enterOuting = useCallback(
    (place: number) => {
      setOutingResultText(null)
      setOutingPlace(place)
      setScene(SEASON_SCENE_STATE.외출연출)
    },
    [setOutingPlace, setOutingResultText, setScene],
  )
  /**
   * 외출 결과 `0xc81c` (`rollSeasonOuting`) — 0xce0c 가 연출 끝(0x84e58)을 본 틀에 부른다.
   * 사기 난수는 [a, b) 이고 **친선경기(0)·야구교실(3)은 부호를 뒤집는다**(0xc8b0).
   * 서브 아이템(SR+0x5d+p)이 있으면 점프표 0xcbe6c 의 보정을 부호 뒤집기 뒤에 더한다.
   * 끝(0xcd76~0xcda2)에서 결과 팝업 0x17 을 열고 SR+4 = 1 · 저장(0x1fded · 0x22755) — 상태는 0xe3 그대로다.
   */
  const runOuting = useCallback(
    (place: number) => {
      if (save === null) return
      const { record, teamMorale } = save.state
      const outcome = rollSeasonOuting(record, teamMorale, place, random)
      if (outcome === null) return
      commit({
        ...save,
        state: { ...save.state, teamMorale: outcome.teamMorale, record: { ...outcome.record, acted: true } },
      })
      setOutingPlace(place)
      setOutingResultText(outcome.text)
    },
    [commit, random, save, setOutingPlace, setOutingResultText],
  )
  /** 0xce0c — 팝업 0x17 이 닫히면(답 0 · 0x14) SR+4 = 1 · 0xc9. SR+4 는 0xc81c 가 이미 켜 두었다 */
  const closeOutingResult = useCallback(() => {
    setOutingResultText(null)
    setOutingPlace(null)
    setScene(SEASON_SCENE_STATE.관리메뉴)
  }, [setOutingPlace, setOutingResultText, setScene])
  return { runTraining, closeTrainingResult, enterOuting, runOuting, closeOutingResult }
}

/** `useTrainingOutingActions` 까지 선 값 */
export type TrainingOutingActionsContext = PostseasonActionsContext & ReturnType<typeof useTrainingOutingActions>
