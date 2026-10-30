import { useCallback, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { derbyResultOf } from '@/entities/home-run-derby/model/derbyRun'
import type { DerbyResult, DerbyRun } from '@/entities/home-run-derby/model/derbyRun'
import { LOSE_SOUND, WIN_SOUND } from '@/features/play-game/model/gameSounds'
import { playSoundIds, type SoundPort } from '@/shared/api/audio/soundPort'
import { SKY_ROW_COUNT } from '@/widgets/batting-stage/lib/stageScenery'
import type { HomeRunDerbyOptions } from './homeRunDerbyTypes'

/** **결과 창(상태 0x1a) 진입 0x4f574** — 10구(+보너스)가 다 끝났을 때. 판이 끝났으면 결과, 아니면 null */
export function useDerbyResultEntry(
  optionsRef: RefObject<HomeRunDerbyOptions>,
  audioRef: RefObject<SoundPort>,
  setSkyRow: Dispatch<SetStateAction<number | undefined>>,
) {
  const [result, setResult] = useState<DerbyResult | null>(null)

  const showResult = useCallback(
    (run: DerbyRun) => {
      const finished = derbyResultOf(run, optionsRef.current.bestDistance)
      setResult(finished)
      // 4f6b0 — 구장 준비 0x352e8 을 다시 불러 하늘 줄 rand(0, 6) 을 한 번 더 굴린다(결과 배경이 이 줄)
      const random = optionsRef.current.random
      if (random !== undefined) setSkyRow(random.rand(0, SKY_ROW_COUNT))
      // 누적 > 저장 +0x5c 면 신기록 0x1f(31), 아니면 0x20(32) 을 예약한다 (R14 1-2 · L 1-F). 승패 징글과 **같은 번호를 나눠 쓰는 자리**다
      playSoundIds(audioRef.current, [finished.isNewRecord ? WIN_SOUND : LOSE_SOUND])
      // 결과에는 기록달성 목록이 없다: 0x4f710 `0x22e10` 은 나리 타자편 버퍼(0x328c8 0x213c0(mgr, 4, 0))의 이번 경기 칸을
      // 더하는데, 더비 중엔 a780a(state[1] = 7)가 기록을 막고 game_br.sav 의 그 칸은 늘 0 이라 0 마흔이다 (annalsStats 머리말)
      optionsRef.current.onFinish?.(finished)
    },
    [audioRef, optionsRef, setSkyRow],
  )

  const clearResult = useCallback(() => setResult(null), [])
  return [result, showResult, clearResult] as const
}
