import { useCallback, useRef, useState } from 'react'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  applyPitcherGameResult,
  applyPitcherLeagueDay,
  applyPitcherPostseasonProgress,
  applyPitcherSeasonEnd,
  createPitcherCareer,
  gainPitcherMorale,
  gainPitcherPopularity,
  gainPitcherReputation,
} from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherRookieProfile } from '@/entities/pitcher-career/model/pitcherRegistration'
import {
  pitcherGameOptionsOf,
  pitcherGameOutcomeOf,
} from '@/pages/pitcher-league/model/pitcherGameOptions'
import type { PitcherGameOptions, PitcherGameSummary } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 나만의리그 **투수편**(원본 게임 모드 3, 장면 0x106) 한 판.
 *
 * 타자편 저장(`useCareerSession`)과 **다른 칸**을 쓴다 — 원본도 둘을 따로 두고
 * 환경설정 "모드 초기화" 가 각각 지운다 (StrMAINMENU[210]·[211]).
 */

export type PitcherScene = '등록' | '관리' | '경기'

export interface PitcherLeagueSession {
  readonly career: PitcherCareer | null
  readonly scene: PitcherScene
  /** 지금 경기를 세울 옵션. 경기 장면이 아니면 null */
  readonly gameOptions: PitcherGameOptions | null
  readonly actions: {
    readonly create: (name: string, profile: PitcherRookieProfile) => void
    /** 바뀐 커리어를 그대로 저장한다 (구질 훈련처럼 화면이 계산해 돌려줄 때) */
    readonly save: (career: PitcherCareer) => void
    readonly goto: (scene: PitcherScene) => void
    readonly beginGame: () => void
    readonly finishGame: (summary: PitcherGameSummary) => void
    readonly reset: () => void
  }
}

export function usePitcherLeagueSession(
  store: JsonStorePort,
  random: RandomPort,
  gaugeSettingOn: boolean,
): PitcherLeagueSession {
  const loaded = useRef<PitcherCareer | null>(null)
  if (loaded.current === null) loaded.current = (store.load() as PitcherCareer | null) ?? null

  const [career, setCareer] = useState<PitcherCareer | null>(loaded.current)
  const [scene, setScene] = useState<PitcherScene>(career === null ? '등록' : '관리')
  const [gameOptions, setGameOptions] = useState<PitcherGameOptions | null>(null)

  const commit = useCallback(
    (next: PitcherCareer) => {
      setCareer(next)
      store.save(next)
    },
    [store],
  )

  const create = useCallback(
    (name: string, profile: PitcherRookieProfile) => {
      commit(createPitcherCareer(name, profile))
      setScene('관리')
    },
    [commit],
  )

  const beginGame = useCallback(() => {
    if (career === null) return
    setGameOptions(pitcherGameOptionsOf(career, { gaugeSettingOn }))
    setScene('경기')
  }, [career, gaugeSettingOn])

  /**
   * 경기 뒤 정산 — 성적·스태미나·전적을 넣고, 같은 날 나머지 네 경기를 돌린 뒤
   * 정규시즌·포스트시즌을 넘긴다 (타자편 `finishGame` 과 같은 차례다).
   */
  const finishGame = useCallback(
    (summary: PitcherGameSummary) => {
      if (career === null || gameOptions === null) return
      const outcome = pitcherGameOutcomeOf(summary, gameOptions)
      const recorded = applyPitcherGameResult(career, outcome)
      const day = applyPitcherLeagueDay(recorded, random)
      const seasoned = applyPitcherPostseasonProgress(applyPitcherSeasonEnd(day), random)
      const evaluated = gainPitcherMorale(
        gainPitcherReputation(
          gainPitcherPopularity(seasoned, summary.evaluation.popularityChange),
          summary.evaluation.reputationChange,
        ),
        summary.evaluation.moraleChange,
      )
      commit(evaluated)
      setGameOptions(null)
      setScene('관리')
    },
    [career, commit, gameOptions, random],
  )

  const goto = useCallback((next: PitcherScene) => setScene(next), [])

  const reset = useCallback(() => {
    setCareer(null)
    setGameOptions(null)
    setScene('등록')
  }, [])

  return { career, scene, gameOptions, actions: { create, save: commit, goto, beginGame, finishGame, reset } }
}
