import { useEffect } from 'react'
import { NO_LAST_EVALUATION, startNextPitcherSeason } from '@/entities/pitcher-career/model/pitcherCareer'
import { savedCareerOf } from '@/entities/career/model/seasonFlow'
import { activeSound, playSoundIds } from '@/shared/api/audio/soundPort'
import { type PitcherScope, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { careerAtom, isSaveErasedAtom, resumedAtom, resumePointAtom } from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'
import { replayedEvaluationAtom, resumedNewSeasonAtom, resumedYearEndAtom } from '@/app/model/pitcherLeagueSession/atoms/resumeAtoms'
import { pitcherEvaluationJingleIdOf } from '@/app/model/pitcherLeagueSession/save/evaluationJingle'

/**
 * **이어하기의 새 시즌 처리** — 원본은 투수편에 들어서야(장면 0x106 → 상태 100 진입 0x1c154) 1c25e 가 S+0x50 == 0x11 을 보고
 * 새 시즌 0x1b768 을 부른다. 그 안 1b86c 의 CPU 장비 굴림 0x665e8 이 난수를 쓰고, 1b894~1b8a4 `0x1fded · 0x22755([0x1400054], 1)`
 * 가 **곧바로 저장한다**(직접 떴다). 웹 세션은 앱을 띄울 때(메인 메뉴 앞) 서므로, 예전 웹은 그때 새 시즌을 처리해 굴림이 다른 화면의
 * 난수보다 앞섰고 투수편에 안 들어가도 저장이 새 해로 바뀌었다 — 이제 투수편 화면이 섰을 때(`isOnScreen`) 한 번 돈다.
 * 반복 이벤트 지우기(셋업 0xf684, 아래 고리)보다 먼저 값을 넣고, 그 지우기는 함수 꼴로 그 위에 얹힌다 — 105 도착 고리는
 * 지우기가 끝난 다음 렌더에서야 돌므로 새 해 커리어를 본다.
 */
export function useResumedNewSeason({ atoms, isOnScreen, random, store }: PitcherScope): void {
  const career = usePitcherValue(atoms, careerAtom)
  const resumePoint = usePitcherValue(atoms, resumePointAtom)
  useEffect(() => {
    if (!isOnScreen || atoms.get(resumedNewSeasonAtom) || resumePoint.kind !== '새시즌' || career === null) return
    atoms.set(resumedNewSeasonAtom, true)
    // 0x1b768 의 1b86c — CPU 장비 굴림 0x665e8 이 여기서 난수를 쓴다 (`nariCpuEquipment`)
    const started = startNextPitcherSeason(career, random)
    atoms.set(careerAtom, started)
    if (!atoms.get(isSaveErasedAtom)) store.save(savedCareerOf(started))
  }, [atoms, career, isOnScreen, random, resumePoint, store])
}

/** 이어하기로 116 을 다시 띄웠으면(`resumePoint` '경기결과') 진입 끝처럼 저장(12c84)하고 평가 징글을 다시 낸다 — 한 번만 */
export function useReplayedEvaluation({ atoms, store }: PitcherScope): void {
  const resumePoint = usePitcherValue(atoms, resumePointAtom)
  useEffect(() => {
    if (atoms.get(replayedEvaluationAtom) || resumePoint.kind !== '경기결과') return
    atoms.set(replayedEvaluationAtom, true)
    const replayed = atoms.get(resumedAtom)?.career
    if (replayed === null || replayed === undefined) return
    store.save(replayed)
    playSoundIds(activeSound(), [pitcherEvaluationJingleIdOf((replayed.lastEvaluation ?? NO_LAST_EVALUATION).popularityChange)])
  }, [atoms, resumePoint, store])
}

/**
 * 이어하기가 시즌 끝 사슬의 상태(136 · 130 · 131 · 132)로 들어갔으면 그 진입처럼 저장한다 — 한 번만. 136 진입 0x10bb0 은
 * S+0x50 = 0xb 뒤 `0x1fded · 0x22755(…, 1)` 로 곧바로 저장한다(10bb8~10bce). 경기 뒤(S+0x50 == 2)에 끊긴 옛 저장이 116 끝처럼
 * g == 0 으로 136 에 들어온 때(`pitcherResumePointOf`)만 저장 칸이 실제로 바뀐다 — 나머지는 같은 값을 다시 쓴다.
 */
export function useResumedYearEnd({ atoms, store }: PitcherScope): void {
  const resumePoint = usePitcherValue(atoms, resumePointAtom)
  useEffect(() => {
    if (atoms.get(resumedYearEndAtom) || resumePoint.kind !== '이벤트') return
    atoms.set(resumedYearEndAtom, true)
    const entered = atoms.get(resumedAtom)?.career
    if (entered === null || entered === undefined || atoms.get(isSaveErasedAtom)) return
    store.save(savedCareerOf(entered))
  }, [atoms, resumePoint, store])
}
