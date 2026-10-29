import { useCallback, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { INJURY_FOLLOW_UP_NOTICE, rollTrainingInjury } from '@/entities/career/model/condition'
import {
  magicTrainingLinesOf,
  pitcherAbilityTrainingLinesOf,
  pitchTypeTrainingLinesOf,
  runPitchTypeTraining,
  runPitcherTraining,
} from '@/entities/pitcher-career/model/pitcherManagement'
import type { PitcherTrainingMenu } from '@/entities/pitcher-career/model/pitcherManagement'
import { PITCHER_MAGIC_TRAINING_SLOT } from '@/pages/pitcher-league/lib/pitcherTrainingPresentation'
import { pitcherTrainingDetailRowsOf } from '@/pages/pitcher-league/lib/pitcherDetailPopup'
import type { PitcherMenuDetail, PitcherMenuKind, PitcherMenuWindow } from './menuTypes'
import { TRAINING_RESULT_STATE } from './menuText'
import type { ShowNoticeThen } from './useResultNotice'

/** 상태 125 — 칸(107 메뉴 커서, 108 에서 와도 4)과 연출이 도는 중인지 */
export interface PitcherTrainingRun {
  readonly slot: number
  readonly isPlaying: boolean
}

/**
 * 상태 **125** 훈련 — 진입 0x11744 가 연출을 세우고, 틀 0x18dd8 이 게이지 끝(0x84e58)을 본 틀에 훈련 0x17f5c(굴림 · 결과 창)를
 * 부른다 — 굴림은 연출 **뒤**다. 결과 창이 닫히면 105.
 *
 * 돌려주는 차례: [125 칸, 능력치 훈련 시작(칸, 메뉴), 마구 훈련 시작(메뉴), 구질 훈련(행, 열), 게이지 끝]
 */
export function useTrainingRuns(
  career: PitcherCareer,
  random: RandomPort,
  onSave: (career: PitcherCareer) => void,
  onReenter: (from?: number) => void,
  setKind: Dispatch<SetStateAction<PitcherMenuKind>>,
  setIsResultWindowOpen: Dispatch<SetStateAction<boolean>>,
  showNoticeThen: ShowNoticeThen,
  setDetail: Dispatch<SetStateAction<PitcherMenuDetail | null>>,
  setSubWindow: Dispatch<SetStateAction<PitcherMenuWindow>>,
) {
  const [training, setTraining] = useState<PitcherTrainingRun | null>(null)
  const trainingRunRef = useRef<(() => void) | null>(null)

  /** 125 진입 — 연출을 틀고, 끝나면 할 훈련(0x17f5c 갈래)을 들고 있는다. 그동안 105 가 아니다 */
  const startTraining = useCallback(
    (slot: number, run: () => void) => {
      if (trainingRunRef.current !== null) return
      trainingRunRef.current = run
      setIsResultWindowOpen(true)
      setTraining({ slot, isPlaying: true })
    },
    [setIsResultWindowOpen],
  )

  /** 0x84e58 참 → 0x17f5c. 같은 연출이 두 번 끝났다고 알려도 한 번만 굴린다 */
  const finishTraining = useCallback(() => {
    const run = trainingRunRef.current
    if (run === null) return
    trainingRunRef.current = null
    setTraining((current) => (current === null ? null : { ...current, isPlaying: false }))
    run()
  }, [])

  /**
   * 125 → 105 (`0xbcb49(0x69)` — 0x18dd8 · 0x1b5b8). 커맨드 줄도 이때 관리 6칸으로 — 125 진입(0x1cdec 1ce1e → 0x7e84c(0x7d))은
   * 107 과 같은 다섯 칸 표를 세우고(7e8a4 → 7e8ec) 결과 창 · 알림 창이 닫힐 때까지 그대로 둔다. 105 진입이 0x7e84c(0x69) 로 바꾼다
   */
  const leaveTrainingResult = useCallback(() => {
    setKind('관리')
    setTraining(null)
    onReenter(TRAINING_RESULT_STATE)
  }, [onReenter, setKind])

  /** 능력치 훈련 한 칸 (107 칸 0~3 → 연출 뒤 105) */
  const runAbilityTraining = useCallback(
    (menu: PitcherTrainingMenu) => {
      const outcome = runPitcherTraining(career, menu, random)
      onSave(outcome.career)
      // 125 — 결과 창이 닫힐 때까지 105 가 아니다
      setIsResultWindowOpen(true)
      // 결과 창 글 — 0x17f5c 186c4~18a58 의 보정 줄만(타입 · 서브 아이템 · 자동안마기 · 병아리 · 몹쓸몸). 상승 수치 줄은 원본에 없다
      const lines = pitcherAbilityTrainingLinesOf(outcome, career.typeIndex)
      const rows = pitcherTrainingDetailRowsOf(outcome)
      // 알림 창이 닫히면 125 → 105
      if (rows === null) return showNoticeThen(lines.join('!N'), leaveTrainingResult)
      /*
       * 칸 0~3 은 타자편과 같은 상세 결과 창(0x872a1)을 띄운다 — 0x17f5c 가 모드 공용이다.
       * 창을 닫으면 콜백 0x1d63c → **부상 판정 0x1b4c4** (모드 갈림 없음, 마구가 아니라 일반 열).
       */
      return setDetail({
        rows,
        messages: lines,
        afterClose: () => {
          const injury = rollTrainingInjury(outcome.career, false, random)
          if (injury.career !== outcome.career) onSave(injury.career)
          // 부상 알림은 그 알림이 닫힐 때까지 칭호 팝업을 막는다(타자편 `CareerRoutes` 의 알림 · 상세 창 검사와 같다)
          // 0x28 을 닫으면 105 틀 0x1aec4(1af3c~1af7e)가 곧바로 0x29 StrMODE[212] 를 띄운다 — 그동안 칭호 팝업도 막는다
          if (injury.notice === null) setIsResultWindowOpen(false)
          else showNoticeThen(injury.notice, () => showInjuryFollowUp(showNoticeThen, setIsResultWindowOpen))
          // 창이 닫히면 125 → 105 (0x1b5b8 `0xbcb49(0x69)`)
          leaveTrainingResult()
        },
      })
    },
    [career, leaveTrainingResult, onSave, random, setDetail, setIsResultWindowOpen, showNoticeThen],
  )

  /**
   * 마구 훈련 (108 → 팝업 [66] → 125 → 105). 125 → 0x17f5c 칸 4 갈래(0x18bd8 `[sp+0x40] == 4`) — 결과 글 [sp+0xfc] 를 알림 창
   * 0xbbef8(글, 1, 코드 4, 1) 에 띄우고, 창이 닫히면 125 틀 0x18dd8 이 105 로 간다(타자편 필살타법과 같은 길). 글은 마구 이름
   * StrCOMMON[0x1e + n] 으로 [87] "훈련 완료" 또는 [86] "[이름] %d/%d회 훈련", 그 뒤 "!N" + StrMODE[24] "사기" … (0x18116~0x181c6)
   */
  const runMagicTraining = useCallback(
    (menu: PitcherTrainingMenu) => {
      const outcome = runPitcherTraining(career, menu, random)
      onSave(outcome.career)
      const magic = outcome.magic
      if (magic === null) {
        setIsResultWindowOpen(false)
        return leaveTrainingResult()
      }
      setIsResultWindowOpen(true)
      return showNoticeThen(magicTrainingLinesOf(magic, outcome).join('!N'), leaveTrainingResult)
    },
    [career, leaveTrainingResult, onSave, random, setIsResultWindowOpen, showNoticeThen],
  )

  /**
   * 108 탭 2 확인 [예] → 125 → 0x17f5c(탭 2 갈래 0x1836a — `runPitchTypeTraining`) → 알림 창(코드 4) → 닫히면 125 틀 0x18dd8 이
   * **105** 로. 알림은 관리 화면 위에 띄운다. 105 진입은 알림이 닫힐 때 친다(`dismissNotice`).
   */
  const runPitchTraining = useCallback(
    (row: number, column: number) => {
      const outcome = runPitchTypeTraining(career, row, column, random)
      onSave(outcome.career)
      setIsResultWindowOpen(true)
      showNoticeThen(pitchTypeTrainingLinesOf(outcome).join('!N'), leaveTrainingResult)
    },
    [career, leaveTrainingResult, onSave, random, setIsResultWindowOpen, showNoticeThen],
  )

  // [85] 예 → 125 — 연출(칸 = 107 커서) 뒤에 훈련 0x17f5c 를 굴린다
  const startAbilityTraining = useCallback(
    (slot: number, menu: PitcherTrainingMenu) => startTraining(slot, () => runAbilityTraining(menu)),
    [runAbilityTraining, startTraining],
  )
  // 108 [66] 예 · 탭 2 확인 → 125 — 연출(칸 4) 뒤에 0x17f5c 칸 4 갈래
  const startMagicTraining = useCallback(
    (menu: PitcherTrainingMenu) => startTraining(PITCHER_MAGIC_TRAINING_SLOT, () => runMagicTraining(menu)),
    [runMagicTraining, startTraining],
  )
  /** 108 탭 2 확인 [예] — 108 을 떠나 125 연출(칸 4)을 튼다. 굴림은 연출이 끝난 뒤 `runPitchTraining` */
  const trainPitch = useCallback(
    (row: number, column: number) => {
      setSubWindow(null)
      startTraining(PITCHER_MAGIC_TRAINING_SLOT, () => runPitchTraining(row, column))
    },
    [runPitchTraining, setSubWindow, startTraining],
  )

  return [training, startAbilityTraining, startMagicTraining, trainPitch, finishTraining] as const
}

/** 부상 알림(0x28) 다음 StrMODE[212] 알림(0x29) — 그동안 결과 창으로 친다 */
function showInjuryFollowUp(showNoticeThen: ShowNoticeThen, setIsResultWindowOpen: Dispatch<SetStateAction<boolean>>) {
  showNoticeThen(INJURY_FOLLOW_UP_NOTICE, null)
  setIsResultWindowOpen(true)
}
