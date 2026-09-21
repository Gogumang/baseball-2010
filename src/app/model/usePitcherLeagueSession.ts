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
  isPitcherSeasonFinished,
  startNextPitcherSeason,
} from '@/entities/pitcher-career/model/pitcherCareer'
import {
  applyPitcherEndingBonus,
  canContinueAfterPitcherEnding,
  continueAfterPitcherEnding,
  pitcherInjuryEndingOf,
  pitcherRetirementEndingOf,
  pitcherYearEndStepOf,
} from '@/entities/pitcher-career/model/pitcherSeasonFlow'
import type { PitcherRookieProfile } from '@/entities/pitcher-career/model/pitcherRegistration'
import {
  pitcherGameOptionsOf,
  pitcherGameOutcomeOf,
} from '@/pages/pitcher-league/model/pitcherGameOptions'
import type { PitcherGameOptions, PitcherGameSummary } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { recordGamePointsOf } from '@/entities/game/model/gameRecords'
import { MAXIMUM_GAME_POINT } from '@/entities/career/model/playerCareer'
import { isInfiniteGamePointOn } from '@/shared/lib/dev/devOptions'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 나만의리그 **투수편**(원본 게임 모드 3, 장면 0x106) 한 판.
 *
 * 타자편 저장(`useCareerSession`)과 **다른 칸**을 쓴다 — 원본도 둘을 따로 두고
 * 환경설정 "모드 초기화" 가 각각 지운다 (StrMAINMENU[210]·[211]).
 */

/**
 * 화면 유니온 — 원본 장면 0x106 의 상태 번호를 괄호에 적는다.
 *   등록(101~104) · 관리(105) · 경기(144) · 시즌종료(136 자리) · 연말(132) · 엔딩(141)
 */
export type PitcherScene = '등록' | '관리' | '경기' | '시즌종료' | '연말' | '엔딩'

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
    /** 시즌 끝 화면 [다음] → 연말 분기 132 (엔딩 · 은퇴 선택 · 새 시즌) */
    readonly beginYearEnd: () => void
    /** 연말 502 "연봉 협상한다" → 새 시즌 처리 0x1b768 → 137 → 105 */
    readonly continueCareer: () => void
    /** 연말 502 "은퇴한다" → 496 → 503 → 엔딩 화면 141 */
    readonly retire: () => void
    /** 엔딩 141 의 팝업 0x32 — 5000 G포인트로 이어하기. 모자라면 false */
    readonly continueAfterEnding: () => boolean
    /** 엔딩을 다 본 뒤 — 선수를 지운다 (145 틀이 메인 메뉴로 나가는 자리) */
    readonly finishEnding: () => void
    readonly reset: () => void
  }
}

/**
 * 저장을 불러올 때 **빠진 칸을 기본값으로 메운다**.
 *
 * 커리어에 칸을 더할 때마다 옛 저장에는 그 칸이 없어 `undefined` 가 된다 — 그대로 캐스팅하면
 * 화면이 조용히 어긋난다(예: 마구 고른 번호가 없어 "사용 중" 표시가 안 된다).
 * 새 커리어 한 벌을 바탕에 깔고 저장을 덮어쓰는 것으로 한 번에 막는다.
 */
function normalizePitcherCareer(raw: unknown): PitcherCareer | null {
  if (raw === null || typeof raw !== 'object') return null
  const saved = raw as Partial<PitcherCareer>
  if (typeof saved.name !== 'string') return null
  return { ...createPitcherCareer(saved.name), ...saved }
}

export function usePitcherLeagueSession(
  store: JsonStorePort,
  random: RandomPort,
  gaugeSettingOn: boolean,
): PitcherLeagueSession {
  const loaded = useRef<PitcherCareer | null>(null)
  if (loaded.current === null) loaded.current = normalizePitcherCareer(store.load())

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
      // 기록 달성 G 는 요약이 들고 온다 (0xa77f0 → 0x4ea0c). 강판당한 경기는 원본이 전면 차단해 0 이다
      const outcome = pitcherGameOutcomeOf(summary, gameOptions, {
        entered: summary.hasEntered,
        gamePointReward: recordGamePointsOf(summary.recordIds),
      })
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
      setGameOptions(null)

      // 경기 뒤 평가 116 의 끝 — 정규시즌이 닫혔으면 시즌 끝 사슬(136→…→132)로 간다.
      // 45경기를 다 치렀는지는 `isPitcherSeasonFinished`(0xb818c) 가 본다.
      if (isPitcherSeasonFinished(evaluated)) {
        commit(evaluated)
        return setScene('시즌종료')
      }
      // 관리 화면 진입 105(0x11910 → 0x11b32)의 첫 줄 — 부상 누적 20경기면 이벤트 500 → 엔딩 141 (B-7)
      const injury = pitcherInjuryEndingOf(evaluated)
      if (injury !== null) {
        commit({ ...evaluated, endingIndex: injury })
        return setScene('엔딩')
      }
      commit(evaluated)
      setScene('관리')
    },
    [career, commit, gameOptions, random],
  )

  /** 새 시즌 처리 0x1b768 → 137 "N년차" 표지 → 105 관리 화면 (웹은 표지를 건너뛴다) */
  const startNewSeason = useCallback(
    (finished: PitcherCareer) => {
      commit(startNextPitcherSeason(finished))
      setScene('관리')
    },
    [commit],
  )

  /** 시즌 끝 화면 [다음] → 연말 상태 132 의 분기 */
  const beginYearEnd = useCallback(() => {
    if (career === null) return
    const step = pitcherYearEndStepOf(career)
    if (step.kind === '엔딩') {
      // 엔딩 보너스는 엔딩을 띄울 때 준다 (0x1220c). 부상·방출은 0 이다
      commit(applyPitcherEndingBonus({ ...career, endingIndex: step.endingIndex }, step.endingIndex))
      return setScene('엔딩')
    }
    if (step.kind === '은퇴선택') return setScene('연말')
    startNewSeason(career)
  }, [career, commit, startNewSeason])

  /** 502 "연봉 협상한다" — 연봉협상 이벤트가 아직 없어 곧바로 새 시즌이다 (pitcherSeasonFlow 머리글) */
  const continueCareer = useCallback(() => {
    if (career === null) return
    startNewSeason(career)
  }, [career, startNewSeason])

  /** 502 "은퇴한다" → 496 → 503 → 엔딩 141 */
  const retire = useCallback(() => {
    if (career === null) return
    const endingIndex = pitcherRetirementEndingOf(career)
    commit(applyPitcherEndingBonus({ ...career, endingIndex }, endingIndex))
    setScene('엔딩')
  }, [career, commit])

  /** 엔딩 141 의 팝업 0x32 — 5000 G포인트로 이어하기 */
  const continueAfterEnding = useCallback(() => {
    if (career === null || career.endingIndex === null) return false
    if (!canContinueAfterPitcherEnding(career, career.endingIndex)) return false
    commit(continueAfterPitcherEnding(career))
    setScene('관리')
    return true
  }, [career, commit])

  /**
   * 엔딩을 다 본 뒤 — 선수를 지운다 (145 틀이 `+0x278` 을 켜고 메인 메뉴 장면 0x103 으로 나가는 자리).
   * 저장소에 `clear` 가 없어 **이름 없는 빈 덩어리**를 덮어쓴다 — `normalizePitcherCareer` 가 null 로 읽는다.
   */
  const finishEnding = useCallback(() => {
    store.save({})
    setCareer(null)
    setGameOptions(null)
    setScene('등록')
  }, [store])

  const goto = useCallback((next: PitcherScene) => setScene(next), [])

  const reset = useCallback(() => {
    setCareer(null)
    setGameOptions(null)
    setScene('등록')
  }, [])

  /**
   * ⚠️ **테스트용** — `?무한G` 면 보여 주는 G 만 최대로 올린다 (`devOptions.ts`).
   * 저장은 그대로라 스위치를 끄면 원래 값으로 돌아온다.
   */
  const shown = career !== null && isInfiniteGamePointOn()
    ? { ...career, gamePoint: MAXIMUM_GAME_POINT }
    : career

  return {
    career: shown,
    scene,
    gameOptions,
    actions: {
      create,
      save: commit,
      goto,
      beginGame,
      finishGame,
      beginYearEnd,
      continueCareer,
      retire,
      continueAfterEnding,
      finishEnding,
      reset,
    },
  }
}
