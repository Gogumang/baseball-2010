import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  applyPitcherGameResult,
  applyPitcherLeagueDay,
  applyPitcherPostseasonProgress,
  applyPitcherSeasonEnd,
  countCompleteGame,
  createPitcherCareer,
  gainPitcherMorale,
  gainPitcherPopularity,
  gainPitcherReputation,
  isPitcherManagementCycleOpen,
  isPitcherSeasonFinished,
  spendPitcherCycleAction,
  startNextPitcherSeason,
} from '@/entities/pitcher-career/model/pitcherCareer'
import {
  enterPitcherYearEndEvent,
  finishPitcherYearEndEvent,
  nextPitcherYearEndStep,
} from '@/entities/pitcher-career/model/pitcherYearEnd'
import { applyPitcherEventRewards, finishPitcherEvent } from '@/entities/pitcher-career/model/pitcherEventReward'
import {
  PITCHER_YEAR_START_EVENT,
  PITCHER_YEAR_START_EVENT_ID,
  pitcherOpeningScanOf,
  pitcherPlaceEventOf,
  scanPitcherEventFrom,
} from '@/entities/pitcher-career/model/pitcherStoryScene'
import { EVENT_TRIGGER } from '@/entities/story/model/storyScene'
import { achievedPitcherGoalCount } from '@/entities/pitcher-career/model/pitcherYearGoals'
import {
  careerNationalTeamEventId,
  isCareerNationalCupYear,
  NATIONAL_CUP_EVENT,
} from '@/entities/national-cup/model/nationalCupFlow'
import {
  MID_SEASON_GAME,
  midSeasonEventId,
  midSeasonTitlesOf,
  RETIREMENT_CHOICE_EVENT_ID,
  salaryOfferOf,
  SALARY_EVENT_ID,
} from '@/entities/career/model/seasonFlow'
import { emptyPlaceEventId, isEmptyPlaceEventId } from '@/entities/career/model/battingOrder'
import { EVENT_REWARD_KIND } from '@/entities/story/model/eventReward'
import type { EventReward } from '@/entities/story/model/eventReward'
import type { StoryCarry } from '@/entities/story/model/aceMatch'
import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import { formatOriginalMoney } from '@/features/shop/model/shopSelection'
import { hiddenOpenTextOf } from '@/entities/career/model/equipment'
import { pitcherHiddenOpenTextOf } from '@/entities/pitcher-career/model/pitcherEquipment'
import {
  applyPitcherEndingBonus,
  canContinueAfterPitcherEnding,
  continueAfterPitcherEnding,
  PITCHER_CONTINUE_COST_GAME_POINT,
  pitcherEndingBonusOf,
  pitcherInjuryEndingOf,
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
import { MAXIMUM_GAME_POINT, rebuildEquippedSkillIds } from '@/entities/career/model/playerCareer'
import { isInfiniteGamePointOn } from '@/shared/lib/dev/devOptions'
import type { GamePointWalletSession } from '@/entities/wallet/model/useGamePointWallet'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { selectPitcherShopItem } from '@/features/shop/model/pitcherShopSelection'
import { BATTER_GP_ITEMS } from '@/entities/career/model/gpItems'
import {
  leagueUsageOf, PITCHER_LEAGUE_MODE, skillEquipStatEventsOf,
} from '@/entities/collection/model/annalsStats'
import type { AnnalsStatEvent } from '@/entities/collection/model/annalsStats'
import type { GpDetailOf } from '@/features/shop/model/shopSelection'
import type { PitcherShopTab } from '@/features/shop/model/pitcherShopSelection'
import { outingBlockReasonOf, outingBlockTextOf, performOuting } from '@/entities/career/model/outing'
import type { OutingResult } from '@/entities/career/model/outing'
import { OUTING_PLACES } from '@/shared/config/outingPlaces'
import type { OutingPlace } from '@/shared/config/outingPlaces'
import { PITCHER_MANAGEMENT_TEXT } from '@/pages/pitcher-league/lib/pitcherManagementMenu'

/**
 * 나만의리그 **투수편**(원본 게임 모드 3, 장면 0x106) 한 판.
 *
 * 타자편 저장(`useCareerSession`)과 **다른 칸**을 쓴다 — 원본도 둘을 따로 두고
 * 환경설정 "모드 초기화" 가 각각 지운다 (StrMAINMENU[210]·[211]).
 */

/**
 * 화면 유니온 — 원본 장면 0x106 의 상태 번호를 괄호에 적는다.
 *   등록(101~104) · 관리(105) · 경기(144) · 시즌종료(136 자리) · 연말(132 — 502 갈림길 화면) · 엔딩(141) ·
 *   상점(111 장비 상점 / 121 장비착용 — 어느 쪽인지는 `shopTab`) · 외출(112 지도 · 113 장소) ·
 *   이벤트(114 이벤트 재생 — 무엇을 틀었는지는 `story`)
 */
export type PitcherScene = '등록' | '관리' | '경기' | '시즌종료' | '연말' | '엔딩' | '상점' | '외출' | '이벤트'

/**
 * 이벤트 재생(상태 114)을 **어디서** 틀었나 — 끝난 뒤 갈 곳(장면+0x24 "뒤 상태")이 이것으로 갈린다.
 *   관리     105 의 자동 발동(0x1cf9c — trigger 0 · 오프닝 451). 뒤 = 105
 *   연초     115 (0x16aac `[다음 114, 뒤 105]`) — 내장 이벤트 `PITCHER_YEAR_START_EVENT`
 *   지도     112 의 자동 발동(trigger 1). 뒤 = 112
 *   중간평가 117 (0x11e84 `[다음 114, 뒤 105]`) — 452~454
 *   연말     136 · 130 · 131 · 132 · 133 사슬 (392 → … → 380/502 → 461/462)
 *   장소     113 [들어가기] (0x16c64 `[다음 114, 뒤 113]`) — 끝 처리 0x1c014 가 빈 장소가 아니면 행동을 쓰고 105 로
 */
export type PitcherStoryContext = '관리' | '연초' | '지도' | '중간평가' | '연말' | '장소'

export interface PitcherStory {
  readonly eventId: number
  readonly context: PitcherStoryContext
  /** 연말 사슬에서 **앞서** 본 이벤트 번호 (이번 재생 것은 재생기가 넘긴다) */
  readonly viewed: readonly number[]
}

export interface PitcherLeagueSession {
  readonly career: PitcherCareer | null
  readonly scene: PitcherScene
  /** 지금 경기를 세울 옵션. 경기 장면이 아니면 null */
  readonly gameOptions: PitcherGameOptions | null
  /** 상점 장면의 창 — '장착' 111 장비 상점 · '착용' 121 장비착용 */
  readonly shopTab: PitcherShopTab
  /** 상점에서 마지막으로 고른 칸의 결과 알림 (막힘·구매 완료·히든 오픈) */
  readonly shopNotice: string
  /** 상점 GP 결과 창 (0x872a1) — 칸 0~4·6 구매 뒤. 닫아도 굴림 없이 상점 그대로 (0x1d649) */
  readonly shopGpDetail: GpDetailOf<PitcherCareer> | null
  /** 외출 지도(112·113)에서 고른 장소 기능의 막힘 알림 (결과는 `outingResult` 팝업) */
  readonly outingNotice: string
  /** 126 효과 팝업(0x15234) 과 이어질 입원 회복 글(0x1575c) — 효과 팝업이 떠 있지 않으면 null */
  readonly outingResult: OutingResult | null
  /** 126 에서 105 로 돌아온 뒤 관리 화면 위에 남는 입원 회복 팝업 글 (0x1575c `0xbbef8(글, 1, 1, 1)`). 없으면 '' */
  readonly outingRecoveryNotice: string
  /** 지금 재생하는 이벤트 (장면 '이벤트'). 아니면 null */
  readonly story: PitcherStory | null
  /** r_event 본문 + 연초 115 내장 이벤트 — 커리어가 생긴 뒤 따로 불러온다(535KB 별도 묶음). 오기 전에는 null */
  readonly storyEvents: readonly OriginalEvent[] | null
  /** 외출 지도 [!] — 장소 이벤트 배정 0x8cdc0 이 이벤트를 넣은 장소 id */
  readonly eventPlaceIds: ReadonlySet<string>
  /** 이벤트 번호별 `%s` 글 — 380 연봉 제시액(0x8bc4c → 금액 서식 0x55cf4). 기본이면 undefined */
  readonly storyReplacementsFor: (eventId: number) => readonly string[] | undefined
  /** 이벤트 재생 뒤 띄울 알림 — 히든 오픈(보상 7) 팝업 글 · 옮기지 않은 갈래. 없으면 '' */
  readonly storyNotice: string
  readonly actions: {
    readonly create: (name: string, profile: PitcherRookieProfile) => void
    /** 바뀐 커리어를 그대로 저장한다 (구질 훈련처럼 화면이 계산해 돌려줄 때) */
    readonly save: (career: PitcherCareer) => void
    readonly goto: (scene: PitcherScene) => void
    readonly beginGame: () => void
    readonly finishGame: (summary: PitcherGameSummary) => void
    /** 시즌 끝 화면 [다음] → 연말 사슬 136 → 130 → 131 → 132 (→ 133) 을 이벤트 392 부터 튼다 */
    readonly beginYearEnd: () => void
    /** 연말 502 "연봉 협상한다" → 이벤트 380 (연봉협상) */
    readonly continueCareer: () => void
    /** 연말 502 "은퇴한다" → 이벤트 496 (→ 503 → 엔딩 화면 141) */
    readonly retire: () => void
    /** 엔딩 141 의 팝업 0x32 — 5000 G포인트로 이어하기. 모자라면 false */
    readonly continueAfterEnding: () => boolean
    /** 엔딩을 다 본 뒤 — 선수를 지운다 (145 틀이 메인 메뉴로 나가는 자리) */
    readonly finishEnding: () => void
    /** 111 장비 상점 · 121 장비착용을 연다 */
    readonly openShop: (tab: PitcherShopTab) => void
    /**
     * 상점·장비착용에서 한 칸을 고른다 (확인을 마친 뒤) — 0x13460 → 0x14a74 / 0x17ad0.
     * `globalOpenedHiddenIds` 는 기록연감의 전역 해금 id (원본 `app+0xc0` 표) — 커리어 것과 합쳐 본다.
     */
    readonly purchase: (itemId: string, globalOpenedHiddenIds?: readonly number[]) => void
    readonly closeShopGpDetail: () => void
    /** 105 커맨드 칸 3 [외출] → 상태 112 외출 지도 (0x126be — 모드 갈림 없음) */
    readonly openOuting: () => void
    /** 113 장소 기능 — 가드 0x16cf0 → 효과 0x15234 (→ 입원 회복 0x1575c). 모드 3·4 공용 (`outing.ts`) */
    readonly runOutingFunction: (functionId: string) => void
    /** 113 칸 0 [들어가기] — 배정된 장소 이벤트(0x8ce58), 없으면 빈 장소 440+장소를 114 로 튼다 */
    readonly enterOutingPlace: (place: OutingPlace) => void
    /** 126 효과 팝업 [확인] → (입원이면 회복 글) → 105 (틀 0x1575c) */
    readonly closeOutingResult: () => void
    /** 105 위 입원 회복 팝업 [확인] */
    readonly dismissOutingRecoveryNotice: () => void
    /** 이벤트 재생이 끝났다 — 지나온 보상과 본 이벤트 번호 (114 틀 0x1c014) */
    readonly completeStory: (rewards: readonly EventReward[], viewedEventIds: readonly number[]) => void
    /** 이벤트가 경기 명령(마선수 대결)에 닿았다 — 투수편 대결은 옮기지 않았다 (미해결) */
    readonly abortStoryAtMatch: (carry: StoryCarry) => void
    readonly dismissStoryNotice: () => void
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
    // 완투 계열 칸(+0x1f0[0..3])은 나중에 생긴 칸이다 — 옛 저장은 0 에서 시작한다
    completeGameCounts: { ...base.completeGameCounts, ...saved.completeGameCounts },
    /*
     * 장착 칸(선수기록 +0x14)은 나중에 생긴 칸이다 — 바탕의 신인 값([0, 8])을 그대로 두면 보유와 어긋난다.
     * 예전 웹엔 장착 창이 없어 장착은 모두 획득 때의 자동 장착(0xa4bd8 → 0xa4b04, 모드 3 도 같다)뿐이었으므로
     * 타자편 저장(`localStorageSaveGame`)과 같이 보유 목록(얻은 차례)을 단계 0 에서 다시 자동 장착해 세운다.
     * 슬롯 단계(+0x1c6)는 바탕의 0 이 그대로 들어간다.
     */
    equippedSkillIds: saved.equippedSkillIds ?? rebuildEquippedSkillIds(saved.skillIds ?? base.skillIds),
  }
}

const NO_STAT = () => {}

/** 보상 종류 7 — 히든 오픈 |v| */
const HIDDEN_OPEN_REWARD_KIND = 7

/**
 * 보상 종류 7 의 알림 글 — 0x8c60e 가 `0x62368(…, |v|, 1)` 을 부른다. 셋째 인자 1 이면 이미 열렸는지(0x61f5c)를
 * 보지 않고 **늘** 팝업(0x74ef5)을 띄운다: StrCOMMON[139] "히든 아이템 오픈!! [%s]" + 쓰는 곳 줄
 * (id ≤ 18 [141] 시즌 · ≤ 34 [142] 투수편 · ≤ 50 [143] 타자편, 0x62420~0x62480). 글은 상점 알림과 같은 함수로 만든다.
 */
function hiddenOpenNoticeOf(rewards: readonly EventReward[]): string {
  return rewards
    .filter((reward) => reward.kind === HIDDEN_OPEN_REWARD_KIND)
    .map((reward) => {
      const id = Math.abs(reward.value)
      return pitcherHiddenOpenTextOf(id) ?? hiddenOpenTextOf(id)
    })
    .filter((text): text is string => text !== null)
    .join('!N')
}

/** 496 "정말로 은퇴하려는 거냐?" — 502 "은퇴한다" 의 gotoEvent (선택지 380 / 503) */
const RETIREMENT_CONFIRM_EVENT_ID = 496
/** 연봉 칸 한 단위(100만원)를 금액 서식(만원 단위)으로 — 0x8bc4c 의 ×100 */
const MONEY_TEXT_SCALE = 100

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
  /**
   * 기록연감 통계 `[mgr+0xc8]` 에 한 건 쌓는다 (GP 아이템 0x22e35 · G 사용처 0x22c29 · 획득 GP 0x22c7d · 켠 스킬 0xb663c, 모드 3).
   * 안 넘기면 아무것도 안 쌓는다.
   */
  recordStat: (event: AnnalsStatEvent) => void = NO_STAT,
): PitcherLeagueSession {
  const loaded = useRef<PitcherCareer | null>(null)
  if (loaded.current === null) loaded.current = normalizePitcherCareer(store.load())
  /** 띄울 때 저장에 들어 있던 G — 다리가 갈아 끼우기 전의 값이라 첫 렌더에서 떠 둔다 */
  const legacyGamePoint = useRef<number | null>(null)
  if (legacyGamePoint.current === null) legacyGamePoint.current = loaded.current?.gamePoint ?? 0

  const [career, setCareer] = useState<PitcherCareer | null>(loaded.current)

  /**
   * **켠 스킬 통계** (`0xb663c` → `[mgr+0xc8]+0xf8`, 모드 3) — 장착 0xa4b04 가 새로 켤 때마다 비트를 OR 한다.
   * 켜는 길(스킬 창 0x147b0 · 획득 자동 장착 0xa4bd8)이 어디든 앞뒤 장착 목록을 견줘 새로 켜진 것만 적는다.
   * 불러오기·새 선수(앞이 없거나 다른 선수)는 견주지 않는다.
   */
  const equippedBeforeRef = useRef<{ name: string; ids: readonly number[] } | null>(null)
  useEffect(() => {
    const before = equippedBeforeRef.current
    if (career === null) {
      equippedBeforeRef.current = null
      return
    }
    equippedBeforeRef.current = { name: career.name, ids: career.equippedSkillIds }
    if (before === null || before.name !== career.name || before.ids === career.equippedSkillIds) return
    skillEquipStatEventsOf(PITCHER_LEAGUE_MODE, before.ids, career.equippedSkillIds).forEach(recordStat)
  }, [career, recordStat])
  const [scene, setScene] = useState<PitcherScene>(career === null ? '등록' : '관리')
  const [gameOptions, setGameOptions] = useState<PitcherGameOptions | null>(null)
  const [story, setStory] = useState<PitcherStory | null>(null)
  const [storyNotice, setStoryNotice] = useState('')

  /** 이벤트 재생(114)으로 — 뒤 상태는 `story.context` 가 정한다 */
  const openStory = useCallback((next: PitcherStory) => {
    setStory(next)
    setScene('이벤트')
  }, [])

  /**
   * r_event 본문(events.ts, 535KB)은 첫 화면에 필요 없어 커리어가 생긴 뒤 따로 불러온다 — 타자편
   * `useStorySchedule` 과 같은 방식(번들러가 별도 청크로 자른다). 오기 전에는 장소 이벤트가 없는 것으로 본다.
   */
  const [fileEvents, setFileEvents] = useState<readonly OriginalEvent[] | null>(null)
  useEffect(() => {
    if (career === null || fileEvents !== null) return
    let isActive = true
    void import('@/shared/config/original/events').then((module) => {
      if (isActive) setFileEvents(module.ORIGINAL_EVENTS)
    })
    return () => {
      isActive = false
    }
  }, [career, fileEvents])
  /** 재생기에 넘기는 목록 — 파일 이벤트 뒤에 연초 115 내장 이벤트를 붙인다 (훑기·배정은 파일 것만 본다) */
  const storyEvents = useMemo(
    () => (fileEvents === null ? null : [...fileEvents, PITCHER_YEAR_START_EVENT]),
    [fileEvents],
  )

  /**
   * 이벤트 레코드 커서 (0xadc70 의 reader+0x28) — 105·112 자동 발동이 함께 쓴다.
   * ⚠️ 근사: 원본 reader 는 장면이 들고 저장에 없다 — 웹은 세션 동안만 든다 (타자편 `useStorySchedule` 과 같다).
   */
  const cursorRef = useRef(0)
  /** 새 선수 플래그 (장면+0x165) — 등록(104)에서 100 으로 왔을 때 켜진다 (0x1c3be). 오프닝 451 을 부른다 */
  const newPlayerRef = useRef(false)

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
   * 자동 발동 한 번 — 0x8be80 → 0xadc70 (커서에서 이어 훑기). 끝까지 없으면 커서가 0 으로 되감기고 그 호출은 "없음" 이라
   * 원본은 **다음 틀**에 처음부터 다시 훑는다 — 웹은 그 두 번째 틀까지 한 번에 본다(커서가 0 이 아니었을 때만).
   */
  const scanAuto = useCallback(
    (current: PitcherCareer, events: readonly OriginalEvent[], trigger: number, rolling: RandomPort | undefined) => {
      const from = cursorRef.current
      let scan = scanPitcherEventFrom(current, events, trigger, from, rolling)
      if (scan.event === null && from > 0) scan = scanPitcherEventFrom(current, events, trigger, 0, rolling)
      cursorRef.current = scan.cursor
      return scan.event
    },
    [],
  )

  /**
   * **관리 화면(105)의 이벤트** — 원본은 한 틀 안에서 두 자리가 차례로 돈다 (R9 2절 · A 3절):
   *
   * 1. **진입 0x11910 의 곁가지**(0x11b24~0x11c1c) — 부상 엔딩 → 미션 복귀 140 → **연초 115**(S+0x1b7 == 0) →
   *    **중간평가 117**(경기 수 22 · 그 해 비트 꺼짐) 중 하나를 다음 상태로 예약한다 (투수편엔 138 타순이 없다).
   * 2. **자동 발동 0x1cf9c** — 현재 상태가 105 면 **매 틀**:
   *    ```
   *      1cfa6: 장면+0x165(새 선수) ≠ 0 → 0x8bde0(모드 3 → 451) · [다음 114, 뒤 105] · 플래그 지움   ; 예약을 덮는다
   *      1cfdc: 다음 상태 ∈ {114, 115} 면 건너뜀                                                  ; 115 는 막고 117 은 안 막는다
   *      1cfe4: 전역 +0x11f · +0x176 이 서 있으면 건너뜀
   *      1d02c: 0x8be80(…, 화면코드 105) 찾으면 [다음 114, 뒤 105]                                ; 117 예약을 덮는다
   *    ```
   *    그래서 한 번 들어올 때의 차례는 **451 → 115 → (trigger 0 이벤트들) → 117** 이다 — 덮인 예약은 이벤트에서
   *    105 로 돌아와 진입이 다시 돌 때 또 선다. 판정은 모드 3(대상 1·3, `isPitcherEventEligible`)이고, 히든 변화구 30~33
   *    (대상 3 · 능력치 조건)도 이 훑기 안에서 나온다.
   *
   * 부상 엔딩은 `finishGame` 이 이미 보았다. 117 은 S+0xb2 == 22 && 0xa4280 == 0 (아래), 그 비트는 보상 실행기 끝(0x8cbaa)이 켠다.
   *
   * ⚠️ 근사 — 원본은 105 에 머무는 **매 틀** 훑고, 조건 22(질병 490)는 틀마다 rand 를 굴린다. 웹은 105 에 **들어올 때**
   *    (경기·이벤트·다른 화면에서 돌아올 때) 한 번 굴려 훑고, 105 에 머문 채 커리어가 바뀌면(훈련·아이템) 굴림 없이 다시
   *    훑는다 — 타자편(`useCareerSession` 의 '무작위포함'/'고정')과 같은 꼴이다. 틀 수를 따라 굴리지 않으므로 질병이 원본보다 드물다.
   */
  const wasIdleAtManagementRef = useRef(false)
  useEffect(() => {
    const isIdle = career !== null && scene === '관리' && story === null && fileEvents !== null
    if (!isIdle) {
      wasIdleAtManagementRef.current = false
      return
    }
    const isArrival = !wasIdleAtManagementRef.current
    wasIdleAtManagementRef.current = true
    if (!isArrival) {
      const event = scanAuto(career, fileEvents, EVENT_TRIGGER.관리, undefined)
      if (event !== null) openStory({ eventId: event.id, context: '관리', viewed: [] })
      return
    }
    if (newPlayerRef.current) {
      newPlayerRef.current = false
      const opening = pitcherOpeningScanOf(fileEvents, cursorRef.current)
      cursorRef.current = opening.cursor
      if (opening.event !== null) return openStory({ eventId: opening.event.id, context: '관리', viewed: [] })
    }
    if (!career.hasSeenYearGoalWindow) {
      // 115 진입 0x16aac: 0x8a681 로 내장 이벤트를 세우고 `0xa4ee9(S)` — 마이너스 스킬 해제 기록 +0x1d0~+0x1d7 을 지운다
      commitWith((current) => (current.removedMinusSkillIds.length === 0 ? current : { ...current, removedMinusSkillIds: [] }))
      return openStory({ eventId: PITCHER_YEAR_START_EVENT_ID, context: '연초', viewed: [] })
    }
    const event = scanAuto(career, fileEvents, EVENT_TRIGGER.관리, random)
    if (event !== null) return openStory({ eventId: event.id, context: '관리', viewed: [] })
    if (career.gamesPlayed === MID_SEASON_GAME && !career.midSeasonEvaluatedYears.includes(career.season - 1)) {
      /*
       * 117 진입 0x11e84: k = 0xa3de9(S, 1) (투수 갈래 — 방어율 칸 그대로, 나머지 넷 >>1) →
       * k ∈ {4,5} 452 · k ≤ 1 454 · 그 밖 453. 칭호 1(1년차·k > 4) · 9(2년차~·지난 k ≤ 1·k > 4) 를
       * +0x270 에 넣고(0x11ee6~0x11f4a, 공통 칭호라 두 편 같다) 끝에 +0x1cc = k (0x11f5a).
       */
      const achieved = achievedPitcherGoalCount(career, '중간')
      // 직전 값을 받아 고친다 — 같은 프레임의 칭호·지갑 고리가 고친 것을 덮지 않게 (`commitWith` 머리글)
      commitWith((current) => {
        const titles = midSeasonTitlesOf(current, achieved).filter((title) => !current.titleIds.includes(title))
        return { ...awardPitcherTitles(current, titles), lastMidSeasonGoalCount: achieved }
      })
      openStory({ eventId: midSeasonEventId(achieved), context: '중간평가', viewed: [] })
    }
  }, [career, commitWith, fileEvents, openStory, random, scanAuto, scene, story])

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
      // 등록 104 → 100 진입 끝(0x1c3be)이 이전 상태 104 를 보고 새 선수 플래그를 켠다 → 105 첫 틀에 오프닝 451
      newPlayerRef.current = true
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
      // 경기 끝 0x4ea0c: 기록 달성 G 를 저장 G 에 더한 뒤 0x4ec82 `0x22c7d(액수, 모드 3)` 로 획득 GP 통계에 적는다
      recordStat({ kind: 'G획득', mode: PITCHER_LEAGUE_MODE, amount: outcome.gamePointReward })
      const day = applyPitcherLeagueDay(recorded, random)
      const seasoned = applyPitcherPostseasonProgress(applyPitcherSeasonEnd(day), random)
      /*
       * 경기 뒤 평가 0xa719c(인기도 0xa690c → 평판 0xa6218 → 사기)는 **정규시즌 경기만** 탄다. 유일한 호출지
       * 0x4ea0c 안 0x4f274 앞에서 0x4f216(L+0xac 국가대항전)·0x4f268(L+0x34 포스트시즌)이 0x4f29a(하루 끝)로
       * 건너뛰고, 이 갈래에는 모드 갈림이 없다(0x4f1a2 의 모드 2 곁가지 뒤 0x4f216 으로 합류) → 모드 3 도 같다.
       * 포스트시즌 표시는 45번째 경기의 하루 끝(0xb818c → 0xb80a8)에야 서므로 그 경기는 평가된다 —
       * 경기 전 커리어(`career.postseason`)로 가른다. (웹 투수편엔 국가대항전이 없다.)
       */
      const isEvaluated = career.postseason === null
      const evaluated = isEvaluated
        ? gainPitcherMorale(
            gainPitcherReputation(
              gainPitcherPopularity(seasoned, summary.evaluation.popularityChange),
              summary.evaluation.reputationChange,
            ),
            summary.evaluation.moraleChange,
          )
        : seasoned
      // 선발형 승리 완투 계열 → +0x1e0/+0x1f0 (0xa690c 안이라 평가가 도는 정규시즌 경기만)
      const counted = isEvaluated ? countCompleteGame(evaluated, summary.evaluation.countedCompleteGame) : evaluated
      setGameOptions(null)

      // 경기 뒤 평가 116 의 끝 — 정규시즌이 닫혔으면 시즌 끝 사슬(136→…→132)로 간다.
      // 45경기를 다 치렀는지는 `isPitcherSeasonFinished`(0xb818c) 가 본다.
      if (isPitcherSeasonFinished(counted)) {
        commit(counted)
        return setScene('시즌종료')
      }
      /*
       * **2경기 주기** — 상태 116 의 끝(0x12b74~0x12bb2)이 `S+0xb2`(경기 수)의 **비트0** 을 본다:
       * ```
       *   12b98: ldrb r3,[r2]        ; r2 = S+0xb2 = 경기 수 g
       *   12b9a: movs r1,#0
       *   12b9c: lsls r5,r3,#0x1f    ; 비트0 을 부호 자리로
       *   12b9e: bmi  0x12ba2        ; 홀수면 건너뜀
       *   12ba0: movs r1,#1          ; 짝수
       *   12ba8: cmp  r1,#0 ; beq 0x12bb0
       *   12bac: movs r1,#0x69       ; 105 관리 화면
       *   12bb0: movs r1,#0x6d       ; 109 순위표
       * ```
       * 이 함수에는 **모드 갈림이 없다** — 장면 0x106 은 모드 3(투수편)·4(타자편)가 함께 쓰므로
       * 투수편도 타자편과 **똑같이 2경기 주기**다 (재진입 분기 0x1c38e~0x1c3b8 도 같은 판정).
       * 웹에는 109 순위표 화면이 없어 타자편(`useCareerSession.confirmGameResult`)과 같이 곧바로
       * 다음 경기로 간다 (원본 109 → 142 → 144 → 경기 장면).
       *
       * ⚠️ **부상 엔딩 판정보다 앞에 둔다** — 부상 엔딩은 관리 화면 **진입**(105, 0x11910 → 0x11b32)의
       *    첫 줄이라, 홀수 경기 뒤에는 105 에 들르지 않아 원본에서도 굴러가지 않는다.
       */
      if (!isPitcherManagementCycleOpen(counted)) {
        commit(counted)
        setGameOptions(pitcherGameOptionsOf(counted, { gaugeSettingOn, throwModeManual }))
        return setScene('경기')
      }
      // 관리 화면 진입 105(0x11910 → 0x11b32)의 첫 줄 — 부상 누적 20경기면 이벤트 500 → 엔딩 141 (B-7)
      const injury = pitcherInjuryEndingOf(counted)
      if (injury !== null) {
        commit({ ...counted, endingIndex: injury })
        return setScene('엔딩')
      }
      commit(counted)
      setScene('관리')
    },
    [career, commit, gameOptions, gaugeSettingOn, random, recordStat, throwModeManual],
  )

  /** 새 시즌 처리 0x1b768 → 137 "N년차" 표지 → 105 관리 화면 (웹은 표지를 건너뛴다) */
  const startNewSeason = useCallback(
    (finished: PitcherCareer) => {
      commit(startNextPitcherSeason(finished))
      setScene('관리')
    },
    [commit],
  )

  /** 엔딩 141 로 — 보너스는 엔딩을 띄울 때 준다 (0x1220c). 부상·방출은 0 이다 */
  const enterEnding = useCallback(
    (finished: PitcherCareer, endingIndex: number) => {
      commit(applyPitcherEndingBonus({ ...finished, endingIndex }, endingIndex))
      // 보너스 팝업이 닫힐 때 0x1bc4a `0x22c7d(보너스, 모드 3)` — 웹은 보너스를 이 자리에서 준다
      recordStat({ kind: 'G획득', mode: PITCHER_LEAGUE_MODE, amount: pitcherEndingBonusOf(endingIndex) })
      setScene('엔딩')
    },
    [commit, recordStat],
  )

  /** 연말 사슬의 이벤트 하나를 튼다 — 들어가기 전에 상태 함수가 하는 일(375 앞 MVP 판정 131)을 먼저 */
  const openYearEndEvent = useCallback(
    (current: PitcherCareer, eventId: number, viewed: readonly number[]) => {
      commit(enterPitcherYearEndEvent(current, eventId))
      openStory({ eventId, context: '연말', viewed })
    },
    [commit, openStory],
  )

  /**
   * 연말 사슬의 다음 걸음 — 이번 연말에 본 이벤트 전부(`viewed`)로 고른다 (`nextPitcherYearEndStep`).
   *
   * ```
   *   136 392 → 393~396 · 130 370 → 371~374 · 131 375 → 376/377 · (128 포스트시즌 — 아래 ⚠️)
   *   132 501(방출)/504(은퇴식) → 141 · 502 → 380/496 · 380 → 381/382 → 384~391 / 383
   *       줄 [114 → 133] — 연차idx 짝수(1·3·5·7·9·11년차)면 0x10cec 가 133 을 뒤 상태로 넣는다
   *   133 0x1a090: 0xa3de9(S, 3) > 3 → 461(선발) → 463 출전 / 464 거절 · 아니면 462(탈락)
   *   114 끝 0x1c014: 뒤 == 132 → 새 시즌 0x1b768 → 137 → 105
   * ```
   * 국가대표 판정의 목표 단계 3 은 투수 갈래(0xa3e56 표 그대로)다 — `achievedPitcherGoalCount(_, '국가대표')`.
   *
   * ⚠️ 미해결·근사 (타자편 `useCareerSession.continueSeason` 과 같은 자리):
   *   - 463 출전 → 134 국가대항전 순위 화면 → 142 → 투수 경기: 투수편 국가대항전은 옮기지 않았다.
   *     알림을 띄우고 새 시즌으로 넘긴다 (대회 보상·히든 팀 오픈 없음).
   *   - 462 탈락: 원본은 뒤 = 105 로만 적혀 있고 새 시즌 처리가 안 보인다 — 타자편과 같이 새 시즌으로 넘긴다.
   *   - 128 (131 뒤 포스트시즌 대진 · 정규시즌 우승 StrMODE[191] 인기도+10/소지금+500만 · 한국시리즈 우승 [190]
   *     인기도+15/평판+25/소지금+1000만, 틀 0x15984): 투수편 웹은 45경기 뒤 곧장 시즌종료로 와서 포스트시즌을
   *     사람이 치르지 않는다 — 128 없이 131 에서 132 로 간다.
   */
  const continueYearEnd = useCallback(
    (current: PitcherCareer, viewed: readonly number[]) => {
      if (viewed.includes(NATIONAL_CUP_EVENT.출전)) {
        setStoryNotice(PITCHER_MANAGEMENT_TEXT.notPorted)
        return startNewSeason(current)
      }
      // 464 거절은 S+0x12c = 0 으로 곧 새 시즌 (P5) · 462 탈락은 근사 (위 머리글)
      if (viewed.includes(NATIONAL_CUP_EVENT.거절) || viewed.includes(NATIONAL_CUP_EVENT.탈락)) {
        return startNewSeason(current)
      }
      const step = nextPitcherYearEndStep(current, viewed)
      if (step.kind === '이벤트') return openYearEndEvent(current, step.eventId, viewed)
      if (step.kind === '엔딩') return enterEnding(current, step.endingIndex)
      // 연차idx 는 **끝난 해**의 것이라 새 시즌을 올리기 전에 본다 (0x10ce6~0x10cf8)
      if (isCareerNationalCupYear(current.season - 1)) {
        const eventId = careerNationalTeamEventId(achievedPitcherGoalCount(current, '국가대표'))
        return openYearEndEvent(current, eventId, viewed)
      }
      startNewSeason(current)
    },
    [enterEnding, openYearEndEvent, startNewSeason],
  )

  /** 시즌 끝 화면 [다음] → 136 의 이벤트 392 "올해의 목표" 부터 연말 사슬을 튼다 */
  const beginYearEnd = useCallback(() => {
    if (career === null) return
    continueYearEnd(career, [])
  }, [career, continueYearEnd])

  /** 502 "연봉 협상한다 (다음연차 진행)" → 380 (502 의 선택지 gotoEvent) */
  const continueCareer = useCallback(() => {
    if (career === null) return
    openYearEndEvent(career, SALARY_EVENT_ID, [RETIREMENT_CHOICE_EVENT_ID])
  }, [career, openYearEndEvent])

  /** 502 "은퇴한다" → 496 "정말로 은퇴하려는 거냐?" (→ 503 → 엔딩 141 / → 380) */
  const retire = useCallback(() => {
    if (career === null) return
    openYearEndEvent(career, RETIREMENT_CONFIRM_EVENT_ID, [RETIREMENT_CHOICE_EVENT_ID])
  }, [career, openYearEndEvent])

  /** 엔딩 141 의 팝업 0x32 — 5000 G포인트로 이어하기 */
  const continueAfterEnding = useCallback(() => {
    if (career === null || career.endingIndex === null) return false
    if (!canContinueAfterPitcherEnding(career, career.endingIndex)) return false
    commit(continueAfterPitcherEnding(career))
    // 팝업 0x32 예 → 0x1bdc6 `0x22c29(모드 3 → 2, 5000)`
    recordStat({ kind: 'G사용', usage: leagueUsageOf(PITCHER_LEAGUE_MODE), amount: PITCHER_CONTINUE_COST_GAME_POINT })
    setScene('관리')
    return true
  }, [career, commit, recordStat])

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

  const [shopTab, setShopTab] = useState<PitcherShopTab>('장착')
  const [shopNotice, setShopNotice] = useState('')
  const [shopGpDetail, setShopGpDetail] = useState<GpDetailOf<PitcherCareer> | null>(null)
  const closeShopGpDetail = useCallback(() => setShopGpDetail(null), [])

  /** [아이템] → 110 → 111 장비 상점 · [선수정보] → 121 장비착용. 취소는 `goto('관리')` (원본 111 → 110 → 105) */
  const openShop = useCallback((tab: PitcherShopTab) => {
    setShopTab(tab)
    setShopNotice('')
    setShopGpDetail(null)
    setScene('상점')
  }, [])

  /**
   * 장비·서브·GP 구매와 장비 착용. 바뀐 칸이 커리어에 들어가고 곧바로 저장한다
   * (원본 0x14a74 도 `0x22755(app, 1)` 로 바로 저장한다).
   * 해금표는 원본에서 전역이라 기록연감 것을 커리어 것에 얹어 판정하고, 얹은 채로 저장한다
   * (타자편 `syncOpenedHidden` 과 같은 방식).
   *
   * GP 아이템은 G 를 쓰고(전역 `mgr+0x64`) 또또상품권은 난수를 굴리므로 **한 번만** 고른다 —
   * 보이는 커리어(`shown`, G = 지갑 값)로 고르고 그 결과를 그대로 저장하면, 바뀐 G 는 지갑 다리가 지갑으로 옮긴다
   * (구질 훈련·마구 훈련이 G 를 쓰는 길과 같다).
   */
  const purchase = useCallback(
    (itemId: string, globalOpenedHiddenIds: readonly number[] = []) => {
      if (career === null || shown === null) return
      const missing = globalOpenedHiddenIds.filter((id) => !shown.openedHiddenIds.includes(id))
      const merged = missing.length === 0 ? shown : { ...shown, openedHiddenIds: [...shown.openedHiddenIds, ...missing] }
      const selection = selectPitcherShopItem(merged, itemId, random)
      setShopNotice(selection.notice)
      setShopGpDetail(selection.detail ?? null)
      if (selection.career === merged) return
      // G 를 안 쓴 칸(장비·서브·착용)은 저장의 G 칸을 건드리지 않는다 — `?무한G` 의 99999 가 저장에 새지 않게
      const spentGamePoint = selection.career.gamePoint !== merged.gamePoint
      commit(spentGamePoint ? selection.career : { ...selection.career, gamePoint: career.gamePoint })
      // GP 칸 구매 확정 — 0x14ffe `0x22e35(모드 3, 칸)` → 0x1501e `0x22c29(2, 가격)` (가격 표는 두 편 공용)
      const [tab, first] = itemId.split(':')
      if (tab === 'GP' && spentGamePoint) {
        const index = Number(first)
        recordStat({ kind: 'GP아이템구매', mode: PITCHER_LEAGUE_MODE, index, price: BATTER_GP_ITEMS[index].price })
      }
    },
    [career, commit, random, recordStat, shown],
  )

  /**
   * 관리 화면(구질 훈련 창 포함)이 계산해 돌려준 커리어를 저장한다 — `actions.save`.
   *
   * 이 길로 G 가 줄어드는 것은 세 가지뿐이고, 원본은 셋 다 G 를 뺀 뒤 `0x22c29(모드 3 → 2, 비용)` 로 투수편 소모 GP 에 적는다:
   * 슬롯 확장(0x148d8) · 마구 훈련(훈련 적용 0xa3bac 종류 4 → 0xa3cac) · 구질 훈련(종류 5 → 0xa3d76).
   * 화면 쪽(관리 메뉴·구질 훈련 창)은 다른 작업 구역이라 여기서 보이는 G 와 견줘 줄어든 만큼을 적는다
   * (세 길 모두 G 가 모자라면 막혀 0 으로 잘리는 일이 없어 줄어든 값 = 비용).
   */
  const saveFromScreen = useCallback(
    (next: PitcherCareer) => {
      const spent = shown === null ? 0 : shown.gamePoint - next.gamePoint
      commit(next)
      if (spent > 0) recordStat({ kind: 'G사용', usage: leagueUsageOf(PITCHER_LEAGUE_MODE), amount: spent })
    },
    [commit, recordStat, shown],
  )

  /**
   * **외출 (상태 112 지도 → 113 장소 → 126 기능)** — 원본 모드 3 은 타자편과 같은 상태·같은 코드를 돈다
   * (105 칸 3 = 0x126be → 0x70, 진입 0x118e4 · 키 0x13ba4 · 0x16c64 · 효과 0x15234 · 입원 회복 0x1575c 에 모드 갈림 없음).
   * 그래서 지도·장소·효과 표·굴림 차례(인기도 → 평판 → 사기 → 입원이면 질병·부상)를 타자편 `runOuting` 그대로 쓴다.
   * 서브 아이템 5~9(`기록[0x5d+장소]`) 보정도 거기서 붙는다.
   *
   * 외출은 G 를 쓰지 않으므로 지갑 그림자(`shown`)가 아닌 저장 쪽 커리어로 돌리고 그대로 저장한다.
   * 126 흐름은 원본 그대로다 (두 편 같은 코드): 진입 0x11da8 → 연출 0x85074 (60 갱신, 확인 키 0x105c8 로 건너뜀)
   * → 연출 끝(0x84e58)에 효과 0x15234 가 굴리고 **효과 팝업**(StrMODE[22]·[23]·[25]·[24] 줄 + 서브 아이템 [195])을
   * 지도 위에 띄운다 → 팝업이 닫히면 틀 0x1575c 가 입원이면 회복을 굴려 **회복 글 팝업**을 띄우고 **105** 로 간다.
   * 그 사이 다른 굴림이 없어 웹은 고를 때 한 번에 굴린다 (차례 같음).
   * ⚠️ 미해결: 연출 그림(0x84ea0 — event_ani 애니 [1,0,2,4,3][장소] · event_char_1 +30 · event_char_0 +0x5d)은 아직 옮기지 않았다.
   */
  const [outingNotice, setOutingNotice] = useState('')
  const [outingResult, setOutingResult] = useState<OutingResult | null>(null)
  const [outingRecoveryNotice, setOutingRecoveryNotice] = useState('')
  const openOuting = useCallback(() => {
    setOutingNotice('')
    setOutingResult(null)
    setScene('외출')
  }, [])
  const runOutingFunction = useCallback(
    (functionId: string) => {
      if (career === null) return
      const outingFunction = OUTING_PLACES.flatMap((place) => place.functions).find(
        (candidate) => candidate.id === functionId,
      )
      if (outingFunction === undefined) return
      const reason = outingBlockReasonOf(career, outingFunction)
      if (reason !== null) return setOutingNotice(outingBlockTextOf(reason, outingFunction))
      const outcome = performOuting(career, outingFunction, random)
      commit(outcome.career)
      setOutingNotice('')
      setOutingResult({ effectText: outcome.effectText, recoveryText: outcome.recoveryText })
    },
    [career, commit, random],
  )
  const closeOutingResult = useCallback(() => {
    if (outingResult === null) return
    setOutingResult(null)
    setOutingRecoveryNotice(outingResult.recoveryText)
    setScene('관리')
  }, [outingResult])
  const dismissOutingRecoveryNotice = useCallback(() => setOutingRecoveryNotice(''), [])
  /**
   * 외출 지도 [!] — 지도 진입 0x118e4 → 0x8cdc0 이 장소마다 파일 순서 첫 이벤트(대상 1·3, trigger 2~6)를 넣는다.
   * 모드 갈림이 없는 코드라 판정만 투수 갈래(`pitcherStoryScene`)로 본다. 무작위는 굴리지 않는다.
   */
  const eventPlaceIds = useMemo(() => {
    if (career === null || fileEvents === null) return new Set<string>()
    return new Set(
      OUTING_PLACES.filter((place) => pitcherPlaceEventOf(career, fileEvents, place.frame) !== null).map(
        (place) => place.id,
      ),
    )
  }, [career, fileEvents])

  /**
   * **외출 지도(112)의 자동 발동** — 0x1cf9c 는 현재 상태가 112 일 때도 같은 훑기를 화면코드 112 로 돈다
   * (trigger 1: 10 "병원이…?" · 401 인기도 3000). 찾으면 `[다음 114, 뒤 112]` — 끝나면 지도로 돌아온다.
   * 웹의 '외출' 장면은 112 지도와 113 장소를 함께 그려, 효과 팝업이 떠 있지 않을 때를 112 로 본다.
   * 굴림은 105 와 같은 근사(들어올 때만 rand 를 넘긴다 — trigger 1 이벤트엔 무작위 조건이 없다).
   */
  const wasIdleAtMapRef = useRef(false)
  useEffect(() => {
    const isIdle =
      career !== null && scene === '외출' && story === null && outingResult === null && fileEvents !== null
    if (!isIdle) {
      wasIdleAtMapRef.current = false
      return
    }
    const isArrival = !wasIdleAtMapRef.current
    wasIdleAtMapRef.current = true
    const event = scanAuto(career, fileEvents, EVENT_TRIGGER.외출, isArrival ? random : undefined)
    if (event !== null) openStory({ eventId: event.id, context: '지도', viewed: [] })
  }, [career, fileEvents, openStory, outingResult, random, scanAuto, scene, story])

  /**
   * 113 칸 0 [들어가기] (키 0x16c64): `0x8ce59` 가 배정된 이벤트를 부르고, 없으면 이벤트 440+장소
   * (`0x8bdc9(0x1b8 + [+0xe0]+0x184)`)를 부르며 +0x167 = 1(빈 장소). 그리고 `[다음 114, 뒤 113]`.
   * 이 칸에는 행동·인기도 가드가 없다 (가드 0x16cf0 은 칸 1 장소 기능 쪽이다).
   */
  const enterOutingPlace = useCallback(
    (place: OutingPlace) => {
      if (career === null || fileEvents === null) return
      setOutingNotice('')
      const event = pitcherPlaceEventOf(career, fileEvents, place.frame)
      openStory({ eventId: event?.id ?? emptyPlaceEventId(place.frame), context: '장소', viewed: [] })
    },
    [career, fileEvents, openStory],
  )

  /** 380 "올해 네 연봉은 %s만 상승해서 %s만이다" — 0x8bc4c 가 상승분·새 연봉을 ×100 해서 금액 서식 0x55cf4 로 */
  const storyReplacementsFor = useCallback(
    (eventId: number): readonly string[] | undefined => {
      if (career === null || eventId !== SALARY_EVENT_ID) return undefined
      const offer = salaryOfferOf(career)
      return [formatOriginalMoney(offer.raise * MONEY_TEXT_SCALE), formatOriginalMoney(offer.salary * MONEY_TEXT_SCALE)]
    },
    [career],
  )

  /**
   * 이벤트 재생(114)이 끝났다 — 틀 0x1c014.
   * 보상은 재생기가 지나온 보상 명령(0x8c460, 모드 3 갈래 `applyPitcherEventRewards`)이고, 본 이벤트는 모두
   * 본 표시를 남긴다. 그 뒤 갈 곳은 뒤 상태(`story.context`)로 갈린다:
   *   장소     +0x167 == 0 → S+4 = 1(행동함) · S+0x6a(외출 수)++ → 105 / 빈 장소(440~444) → 113 (행동 안 씀)
   *   연말     다음 사슬 (`continueYearEnd`)
   *   그 밖    뒤 = 105
   * G 보상(종류 10)은 한 줄마다 0x8c6e2 `0x22c7d(값, 모드 3)` 로 획득 GP 통계에 적는다.
   */
  const completeStory = useCallback(
    (rewards: readonly EventReward[], viewedEventIds: readonly number[]) => {
      if (career === null || story === null) return
      const rewarded =
        story.context === '연말'
          ? finishPitcherYearEndEvent(career, story.eventId, rewards)
          : applyPitcherEventRewards(career, rewards, random, story.eventId)
      const viewed = finishPitcherEvent(rewarded, viewedEventIds)
      rewards
        .filter((reward) => reward.kind === EVENT_REWARD_KIND.G포인트)
        .forEach((reward) => recordStat({ kind: 'G획득', mode: PITCHER_LEAGUE_MODE, amount: reward.value }))
      const hiddenNotice = hiddenOpenNoticeOf(rewards)
      if (hiddenNotice !== '') setStoryNotice(hiddenNotice)
      setStory(null)
      if (story.context === '연말') return continueYearEnd(viewed, [...story.viewed, ...viewedEventIds])
      if (story.context === '연초') {
        // 내장 이벤트라 본 표시는 없다. 목표 창이 닫히면 0x7fe90 이 S+0x1b7 = 1 (해마다 한 번)
        commit({ ...rewarded, hasSeenYearGoalWindow: true })
        return setScene('관리')
      }
      if (story.context === '지도') {
        commit(viewed)
        return setScene('외출')
      }
      if (story.context === '장소') {
        if (isEmptyPlaceEventId(story.eventId)) {
          commit(viewed)
          return setScene('외출')
        }
        commit(spendPitcherCycleAction({ ...viewed, outingsThisSeason: viewed.outingsThisSeason + 1 }))
        return setScene('관리')
      }
      commit(viewed)
      setScene('관리')
    },
    [career, commit, continueYearEnd, random, recordStat, story],
  )

  /**
   * ⚠️ **미해결**: 경기 명령(r_event `match`) — 투수편 장소 이벤트 113·123·127·150·153·192·196·207·211·217·221·225·229
   * (대상 3)는 마선수 대결로 나간다 (원본은 미션 장면 → 돌아와 105 진입이 +0x176 을 보고 140 결과 이벤트).
   * 투수편 대결은 옮기지 않았다 — 그때까지 지나온 보상·본 이벤트만 남기고 알림과 함께 105 로 돌아간다
   * (행동·외출 수는 쓰지 않는다). 결과 이벤트로 이어지는 뒷 이벤트는 그래서 열리지 않는다.
   */
  const abortStoryAtMatch = useCallback(
    (carry: StoryCarry) => {
      if (career === null || story === null) return
      const rewarded = applyPitcherEventRewards(career, carry.rewards, random, story.eventId)
      commit(finishPitcherEvent(rewarded, carry.viewedEventIds))
      setStory(null)
      setStoryNotice(PITCHER_MANAGEMENT_TEXT.notPorted)
      setScene('관리')
    },
    [career, commit, random, story],
  )
  const dismissStoryNotice = useCallback(() => setStoryNotice(''), [])

  const reset = useCallback(() => {
    setCareer(null)
    setGameOptions(null)
    setStory(null)
    setScene('등록')
  }, [])

  return {
    career: shown,
    scene,
    gameOptions,
    shopTab,
    shopNotice,
    shopGpDetail,
    outingNotice,
    outingResult,
    outingRecoveryNotice,
    story,
    storyEvents,
    eventPlaceIds,
    storyReplacementsFor,
    storyNotice,
    actions: {
      create,
      save: saveFromScreen,
      goto,
      beginGame,
      finishGame,
      beginYearEnd,
      continueCareer,
      retire,
      continueAfterEnding,
      finishEnding,
      openShop,
      purchase,
      closeShopGpDetail,
      openOuting,
      runOutingFunction,
      enterOutingPlace,
      closeOutingResult,
      dismissOutingRecoveryNotice,
      completeStory,
      abortStoryAtMatch,
      dismissStoryNotice,
      reset,
    },
  }
}
