import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  recordPitcherSeasonMvp,
} from '@/entities/pitcher-career/model/pitcherSeasonFlow'
import {
  awardPitcherTitles,
  evaluateNewPitcherTitles,
} from '@/entities/pitcher-career/model/pitcherTitles'
import type { PitcherRookieProfile } from '@/entities/pitcher-career/model/pitcherRegistration'
import {
  pitcherGameOptionsOf,
  pitcherGameOutcomeOf,
} from '@/pages/pitcher-league/model/pitcherGameOptions'
import type { PitcherGameOptions, PitcherGameSummary } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { recordGamePointsOf } from '@/entities/game/model/gameRecords'
import { MAXIMUM_GAME_POINT } from '@/entities/career/model/playerCareer'
import { isInfiniteGamePointOn } from '@/shared/lib/dev/devOptions'
import type { GamePointWalletSession } from '@/entities/wallet/model/useGamePointWallet'
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
 *
 * ⚠️ 겉만 덮어쓰면 **한 겹 안쪽 칸**은 못 메운다. 리그 선수 기록표에 투수 줄(`pitchers`)이
 * 새로 생겼는데 옛 저장에는 `{ batters }` 뿐이라, 그대로 두면 `pitchers` 가 `undefined` 인 채
 * 돌아다닌다. 저장 형식 번호는 올리지 않는다 — 올리면 옛 저장이 통째로 버려져 선수가 사라진다.
 */
function normalizePitcherCareer(raw: unknown): PitcherCareer | null {
  if (raw === null || typeof raw !== 'object') return null
  const saved = raw as Partial<PitcherCareer>
  if (typeof saved.name !== 'string') return null
  const base = createPitcherCareer(saved.name)
  return {
    ...base,
    ...saved,
    stats: { ...base.stats, ...saved.stats },
    careerStats: { ...base.careerStats, ...saved.careerStats },
    leaguePlayerStats: { ...base.leaguePlayerStats, ...saved.leaguePlayerStats },
  }
}

export function usePitcherLeagueSession(
  store: JsonStorePort,
  random: RandomPort,
  gaugeSettingOn: boolean,
  /**
   * 전역 G 지갑 (원본 `mgr[+0x64]`). 넘기면 **G의 주인이 지갑**이 되고 커리어 칸은 따라간다.
   * 안 넘기면 예전처럼 커리어 칸 하나로만 돈다 — 테스트는 그대로 두면 된다.
   */
  wallet: GamePointWalletSession | null = null,
  /** 옛 투수 G를 지갑으로 옮겼는지 적어 두는 칸 — 아래 **투수 G 이사** 참고 */
  mergeStore: JsonStorePort | null = null,
  /**
   * 환경설정 "송구" 가 수동인가 (설정 +0xf4). 투수편은 사람이 언제나 수비라 이 값 하나가
   * `0xae6c8` 의 답이 된다. **원본 기본값은 수동** 이라 안 넘기면 수동이다.
   * (자리가 끝에 붙은 것은 앞의 인자 차례를 바꾸지 않으려는 것뿐이다.)
   */
  throwModeManual: boolean = true,
): PitcherLeagueSession {
  const loaded = useRef<PitcherCareer | null>(null)
  if (loaded.current === null) loaded.current = normalizePitcherCareer(store.load())
  /** 띄울 때 저장에 들어 있던 G — 다리가 갈아 끼우기 전의 값이라 첫 렌더에서 떠 둔다 */
  const legacyGamePoint = useRef<number | null>(null)
  if (legacyGamePoint.current === null) legacyGamePoint.current = loaded.current?.gamePoint ?? 0

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

  /**
   * **직전 값을 받아** 고쳐 넣는 저장 (`commit` 의 함수 꼴).
   *
   * 같은 프레임에 커리어를 고치는 자리가 둘(칭호 부여·지갑 다리)이라, 둘 다 자기가 본 옛 커리어를
   * 통째로 덮어쓰면 **나중에 붙은 쪽이 앞의 결과를 지운다.** 실제로 `StrictMode`(main.tsx)가
   * 고리를 다시 붙일 때 칭호 쪽이 옛 G를 되살려, 지갑 1000 + 투수 1500 이 2500 이 아니라 1500 이 됐다.
   *
   * ⚠️ 저장을 고치는 함수 안에서 하므로 `StrictMode` 에서는 **같은 값을 두 번 쓴다** — 값이 같아
   *    문제는 없다.
   */
  const commitWith = useCallback(
    (update: (current: PitcherCareer) => PitcherCareer) => {
      setCareer((current) => {
        if (current === null) return current
        const next = update(current)
        if (next === current) return current
        store.save(next)
        return next
      })
    },
    [store],
  )

  /**
   * **투수 G 이사** — 옛 투수 저장은 G를 `career.gamePoint` 안에 들고 있었다(시즌모드와 달리
   * 저장에 실제로 들어 있다). 원본은 G가 전역 한 칸(`mgr[+0x64]`)이라 투수편만의 G가 애초에
   * 있을 수 없다 — 웹이 나눠 둔 탓에 생긴 주머니라, 지갑으로 합칠 때 **타자편 몫에 더한다.**
   *
   * ⚠️ **왜 더하나** (타자편 이사와 겹치는 자리):
   *   두 주머니 다 신인 지급분이 0 에서 시작한다 (`BALANCE.rookie.gamePoint === 0`). 그러니
   *   타자편 B = (번 것 − 쓴 것), 투수편 P = (번 것 − 쓴 것) 이고, 원본처럼 한 칸이었다면
   *   그 칸 값은 정확히 **B + P** 다. 어느 한쪽을 이기게 하면 다른 쪽에서 번 G가 통째로 사라진다.
   *   (원본에 두 값이 따로 있던 적이 없으므로 "어느 쪽이 진짜냐"는 물음 자체가 웹의 사정이다.)
   *
   * 표식 칸(`mergeStore`)을 따로 두는 까닭: 이사를 마치면 커리어 칸은 지갑의 그림자라
   * 저장만 봐서는 이미 옮겼는지 알 수 없다. 저장 형식 번호는 **올리지 않는다.**
   *
   * ⚠️ `?무한G` 면 지갑이 쓰기를 안 받는다 — 그대로 진행하면 표식만 서고 G가 사라지므로 **미룬다.**
   */
  const merged = useRef(false)
  useEffect(() => {
    if (wallet === null || mergeStore === null || merged.current) return
    if (isInfiniteGamePointOn()) return
    const done = (mergeStore.load() as { merged?: boolean } | null)?.merged === true
    merged.current = true
    if (done) return
    // 표식을 먼저 적는다 — 중간에 다시 띄워도 두 번 더해지지 않는다
    mergeStore.save({ merged: true })
    const carried = legacyGamePoint.current ?? 0
    if (carried !== 0) wallet.gain(carried)
  }, [mergeStore, wallet])

  /**
   * 칭호 판정 — 원본은 **관리 화면(105)에 들어올 때마다** 0x1a1c0 이 번호 순서로 검사한다 (P3 4절).
   * 맞는 것을 주면서 곧바로 장착까지 한다 (0x1b214 `선수+0x1c4 = i`).
   *
   * ⚠️ 원본은 **처음 맞는 하나만** 팝업으로 주고 확인하면 다음 프레임에 다시 판정하는데,
   * 웹은 타자편(`useCareerSession`)과 마찬가지로 팝업 없이 **한꺼번에** 붙인다 (P3 9절 "부여 방식 차이").
   * 번호 오름차순으로 이어 주므로 마지막에 남는 장착값은 원본과 같다.
   */
  useEffect(() => {
    if (career === null || scene !== '관리') return
    if (evaluateNewPitcherTitles(career).length === 0) return
    // 직전 값을 받아 붙인다 — 지갑 다리가 맞춰 둔 G를 옛 값으로 되돌리지 않는다 (`commitWith` 머리글)
    commitWith((current) => {
      const earned = evaluateNewPitcherTitles(current)
      return earned.length === 0 ? current : awardPitcherTitles(current, earned)
    })
  }, [career, commitWith, scene])

  /**
   * **커리어 칸 ↔ 지갑 다리** — 타자편(`useCareerSession`)과 같은 모양이다.
   *
   * 원본은 G가 전역 한 칸이라 다리가 필요 없지만, 웹은 구질 훈련·지옥훈련·엔딩 보너스가 전부
   * `PitcherCareer` 를 통째로 갈아 끼우는 식이라 커리어 칸을 아직 못 없앴다. 그래서 **나중에
   * 바뀐 쪽이 이기게** 이어 둔다 — 지갑이 주인이고, 커리어 칸은 저장 호환용 그림자다.
   *
   * - 커리어 쪽 G가 움직였으면(훈련 비용·기록 달성 보상·엔딩 보너스) 그 값을 지갑으로 옮긴다.
   * - 그 밖에 둘이 어긋나면 **지갑이 이긴다.** 선수를 불러온 참에 저장에 남은 옛 값이 지갑을
   *   되돌리는 것을 막는다 (이사는 위 고리가 딱 한 번만 한다).
   *
   * ⚠️ **칭호 부여 고리 뒤에 둔다.** 둘이 같은 프레임에 커리어를 갈아 끼우는데, 칭호 쪽은 통째로
   *    덮어쓰는 꼴이라 앞에 두면 다리가 맞춰 둔 G가 옛 값으로 되돌아간다. 뒤에 두고 **직전 값을
   *    받아** 고치면(`setCareer(current => …)`) 칭호도 G도 둘 다 남는다.
   *
   * ⚠️ **같은 짝을 두 번 보면 아무것도 안 한다** (`lastSeen`). `StrictMode` 는 고리를 붙였다 떼고
   *    다시 붙이는데(개발 빌드), 그때 두 번째 바퀴가 **옛 커리어 값**을 들고 돌아 "선수 쪽이
   *    움직였다" 로 잘못 읽는다 — 실제로 지갑 1000 + 투수 1500 이 2500 이 아니라 1500 이 됐다.
   */
  const walletBalance = wallet?.balance ?? 0
  const setWalletBalance = wallet?.setBalance
  const bridge = useRef<{ career: number | null; wallet: number }>({
    career: career?.gamePoint ?? null,
    wallet: walletBalance,
  })
  /** 고리가 마지막으로 **본** 짝 (커리어 G, 지갑 G) — 같은 짝이면 한 번 더 돌지 않는다 */
  const lastSeen = useRef<{ career: number | null; wallet: number } | null>(null)
  useEffect(() => {
    if (setWalletBalance === undefined) return
    // ⚠️ `?무한G` 면 다리를 놓지 않는다 — 지갑이 늘 99999 라 그대로 두면 저장에 99999 가 적혀
    //    스위치를 끈 뒤에도 값이 안 돌아온다 (devOptions: "저장에는 손대지 않는다").
    //    보여 주는 값은 아래 `overriddenGamePoint` 가 이미 지갑 값으로 맞춘다.
    if (isInfiniteGamePointOn()) return
    const careerPoint = career === null ? null : career.gamePoint
    const seen = lastSeen.current
    if (seen !== null && seen.career === careerPoint && seen.wallet === walletBalance) return
    lastSeen.current = { career: careerPoint, wallet: walletBalance }
    const previous = bridge.current
    if (career !== null && previous.career !== null && careerPoint !== previous.career) {
      bridge.current = { career: career.gamePoint, wallet: career.gamePoint }
      setWalletBalance(career.gamePoint)
      return
    }
    if (career !== null && career.gamePoint !== walletBalance) {
      bridge.current = { career: walletBalance, wallet: walletBalance }
      commitWith((current) => ({ ...current, gamePoint: walletBalance }))
      return
    }
    bridge.current = { career: careerPoint, wallet: walletBalance }
  }, [career, commitWith, setWalletBalance, walletBalance])

  const create = useCallback(
    (name: string, profile: PitcherRookieProfile) => {
      commit(createPitcherCareer(name, profile))
      setScene('관리')
    },
    [commit],
  )

  const beginGame = useCallback(() => {
    if (career === null) return
    setGameOptions(pitcherGameOptionsOf(career, { gaugeSettingOn, throwModeManual }))
    setScene('경기')
  }, [career, gaugeSettingOn, throwModeManual])

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

  /**
   * 시즌 끝 화면 [다음] → 연말 상태 132 의 분기.
   *
   * 그 앞에 **상태 130(타이틀 0x8dad4) · 131(MVP 0x8dd60)** 이 있다 — 웹은 발표 화면(370·375)이
   * 아직 없어 **판정만** 하고 지나간다. `recordPitcherSeasonMvp` 가 리그 투수 순위표에서 다승
   * (마무리면 세이브)·탈삼진·방어율 1위를 가려 MVP 면 `career+0x1ca` 비트를 남긴다.
   * 발표 화면과 보상(372~374 소지금 +3/+6/+10 · 377 인기도+20 평판+30 소지금+10)은
   * 화면이 생기면 이 자리에 끼우면 된다.
   */
  const beginYearEnd = useCallback(() => {
    if (career === null) return
    // 130 → 131 (MVP 비트) → 132 순서다. 연말 분기는 인기도·평판만 보므로 시상이 앞서도 값은 같다
    const awarded = recordPitcherSeasonMvp(career)
    const step = pitcherYearEndStepOf(awarded)
    if (step.kind === '엔딩') {
      // 엔딩 보너스는 엔딩을 띄울 때 준다 (0x1220c). 부상·방출은 0 이다
      commit(applyPitcherEndingBonus({ ...awarded, endingIndex: step.endingIndex }, step.endingIndex))
      return setScene('엔딩')
    }
    if (step.kind === '은퇴선택') {
      commit(awarded)
      return setScene('연말')
    }
    startNewSeason(awarded)
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
   * 내보이는 커리어의 G 는 **지갑 값**이다 (원본 `mgr[+0x64]` 한 칸). 관리 화면 뱃지·구질 훈련
   * 가격 판정·지옥훈련 가드가 다 이 `career.gamePoint` 를 읽으므로, 여기서 한 번 갈아 끼우면
   * **보여 주는 값과 판정이 같은 값**을 본다.
   *
   * ⚠️ **테스트용** — `?무한G` 는 지갑 쪽에서 처리한다 (`useGamePointWallet`): `balance` 가 늘
   *    99999 이고 쓰기는 먹히지 않는다. 지갑을 안 받은 자리(테스트)는 예전처럼 여기서 올린다.
   *    저장은 그대로라 스위치를 끄면 원래 값으로 돌아온다.
   *
   * ⚠️ **값이 같으면 `career` 를 그대로 돌려준다** — 타자편 `useCareerSession` 과 같은 이유다.
   *    G가 어긋나 갈아 끼울 때 매 렌더 **새 객체**를 만들면, 이 값을 프로프로 받는 화면이
   *    아무것도 안 바뀌었는데도 계속 새 객체를 보게 된다. `useCareerSession` 에서는 그 새 객체가
   *    저장 고리를 다시 돌려 **무한 렌더**까지 갔다 — 여기 고리들은 `career`(상태) 쪽을 보므로
   *    지금은 안 돌지만, 같은 모양을 남겨 둘 까닭이 없다.
   */
  const overriddenGamePoint = wallet?.balance ?? (isInfiniteGamePointOn() ? MAXIMUM_GAME_POINT : null)
  const shown = useMemo(
    () =>
      career === null || overriddenGamePoint === null || career.gamePoint === overriddenGamePoint
        ? career
        : { ...career, gamePoint: overriddenGamePoint },
    [career, overriddenGamePoint],
  )

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
