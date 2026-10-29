import { startNextSeason, type PlayerCareer } from '@/entities/career/model/playerCareer'
import { regularSeasonPopupOnEnter } from '@/entities/career/model/postseasonFlow'
import { GOAL_INTRO_EVENT_ID, yearEndEventId } from '@/entities/career/model/seasonFlow'
import { enterSeasonEvent } from '@/app/model/seasonEvents'
import type { GameEvaluationScreenData } from '@/app/model/screen'
import { playSoundIds } from '@/app/model/useSound'
import type { CareerScope } from '@/app/model/careerSession/atoms/careerScope'
import { rawCareerAtom } from '@/app/model/careerSession/atoms/careerAtoms'
import { isYearCoverHeldAtom } from '@/app/model/careerSession/atoms/sceneAtoms'
import { evaluationRewardsAtom } from '@/app/model/careerSession/atoms/uiAtoms'
import { evaluationJingleIdOf } from '@/app/model/careerSession/settlement/gameEvaluation'

/** 새 시즌 처리를 부른 자리 */
export interface NewSeasonCaller {
  /** 이어하기 100 진입 1c25e(S+0x50 == 0x11) · 1c308(0xa 갈래) */
  readonly fromResume?: boolean
  /** 134 · 141 — 0x1b768 뒤에도 제 그리기를 돌며 효과기 끝을 기다린다 */
  readonly holdsPrevious?: boolean
  /** 방출 141 의 이어하기(1be26) — 그 해 132 꼬리를 안 지났다 (`seasonStartCountersOf`, B-128) */
  readonly afterRelease?: boolean
}

/** 시즌 흐름의 갈림 — 새 시즌 · 116 · 연말 사슬 · 포스트시즌 · 엔딩으로 들어선다 (그림마다 새 함수 — 옛 꼴 그대로) */
export function seasonFlowOf({ atoms, audio, random, setScreen }: CareerScope) {
  /**
   * 새 시즌 처리 `0x1b768` → 137 "N년차" → 105 관리 화면.
   * MVP 비트(career+0x1ca)는 여기서가 아니라 상태 131 이 375 를 틀기 전에 남긴다 (`enterSeasonEvent`).
   * 0x1b768 꼬리가 효과기 종류 1 · 장면+0x289 = 1 을 세우고, 부른 상태(114 · 134 · 141)의 틀이 효과기 끝에 137 을 예약한다
   * (`pages/management/lib/nariYearCover`). 난수는 1b86c 의 CPU 장비 굴림 하나뿐이고 137 은 난수를 안 쓴다.
   * `fromResume` 은 0x1b768 뒤 1c3be 로 빠져 137 을 바로 예약하지 않지만, 100 → 1 → 100 → 1 → 105 → 115 → 114 로 가는 사이 남은
   * +0x289 를 연초 114 의 틀 0x1c014(1c0dc — 재생 중에도 매 틀)가 효과기 끝(0x1b768 의 틀부터 9 틀째)에 받아 137 을 띄운다(r156 직접 뜸 —
   * `nariYearCover` 의 이어하기 길).
   */
  const startNewSeason = (finished: PlayerCareer, caller: NewSeasonCaller = {}) => {
    // 0x1b768 의 1b86c — CPU 장비 굴림 0x665e8 이 여기서 난수를 쓴다 (`nariCpuEquipment`)
    atoms.set(rawCareerAtom, startNextSeason(finished, random, caller.afterRelease ?? false))
    // 134(0x1b92c 1bb30~1bb64) · 141(0x1bbc4 1beb4~1beea)은 0x1b768 뒤에도 제 그리기를 돌며 효과기 끝을 기다린다 — 그 화면을 그대로 둔다
    if (caller.holdsPrevious === true) return atoms.set(isYearCoverHeldAtom, true)
    setScreen(caller.fromResume === true ? { kind: '연차표지', fromResume: true } : { kind: '연차표지' })
  }

  /**
   * **116 경기 뒤 평가에 들어선다** — 진입 0x1278c 의 12c96~12cc6 이 +0x4a(평가 경기 인기도 변화)로 평가 징글 36 · 37 · 38 을
   * 낸다(`evaluationJingleIdOf`). 경기 뒤(정산 판을 나간 0x3f3 → 장면 0x106 → 100 → 116)와 이어하기(1c26a) 두 길 모두.
   * 승패 징글 31 · 32 는 경기 장면의 정산 0x19 진입이 따로 냈다 — 두 상태가 따로 서 소리도 따로다
   */
  const enterGameEvaluationScreen = (data: GameEvaluationScreenData) => {
    atoms.set(evaluationRewardsAtom, null)
    playSoundIds(audio, [evaluationJingleIdOf(data.evaluation.popularityChange)])
    setScreen({ kind: '경기평가', ...data })
  }

  /**
   * 시즌 끝 사슬 136 으로 — 116 끝(12b74~12bbe)이 S+0xb4 ≠ 0 이고 S+0xb2(g) == 0 이면 `0xbcb49(0x88)` · `0xbcb49(0x72)` 로
   * [114 → 136] 을 곧장 예약한다(45번째 경기 뒤 · 내 시리즈가 끝난 경기 뒤). 사이에 시즌 요약 화면은 없다 — 예전 웹 전용
   * '시즌종료' 화면(r71 에서 걷음)은 원본에 없었다. 136 진입 0x10bb0 = S+0x50 = 0xb · 0x1fded · 저장 0x22755 ·
   * 0x8bdc9(392 올해의 목표) · [114 → 130] (10bb0~10bf6). 그 해 성적은 원본에서 124 기록실 · 128 대진표 · 116 평가 창이 보인다.
   */
  const enterYearEndChain = (current: PlayerCareer) => {
    atoms.set(rawCareerAtom, enterSeasonEvent(current, GOAL_INTRO_EVENT_ID))
    setScreen({ kind: '이벤트', eventId: GOAL_INTRO_EVENT_ID, context: '시즌' })
  }

  /**
   * 포스트시즌 대진 128 로 — 진입 0x120a4 가 정규시즌 우승 팝업(0xb)을 띄울지 정한다.
   * 원본은 131(MVP) 뒤와, 포스트시즌 경기 뒤(100 → 116 → 114 → 128)에 여기로 온다.
   */
  const enterPostseason = (current: PlayerCareer, fromReentry = false) => {
    // 진입 0x120a4 — S+0x50 = 0xf · 저장 (이어하기는 S+0xb4 갈래로 128 에 돌아온다)
    atoms.set(rawCareerAtom, current.seasonEndState === 128 ? current : { ...current, seasonEndState: 128 })
    // 이어하기(100 → 1 → 128)면 이전 상태가 1 이라 배경음 4 (`screenBgmOf`)
    setScreen({ kind: '포스트시즌', popup: regularSeasonPopupOnEnter(current), fromReentry })
  }

  /**
   * 128 이 끝났다 (팝업 7 · 8 닫힘 → 132 연말) — 연말 0x10c54 의 이벤트(501/504/502/380)를 튼다.
   * 132 진입이 S+0x50 = 9 · 저장(0x10c60) — 팝업 8 보상과 **같은 커리어 갱신**으로 적어 이어하기가 보상을 다시 주지 않는다.
   */
  const finishPostseason = (finished: PlayerCareer) => {
    atoms.set(rawCareerAtom, { ...finished, seasonEndState: 132 })
    setScreen({ kind: '이벤트', eventId: yearEndEventId(finished), context: '시즌' })
  }

  /**
   * 엔딩 141 로 — 번호는 141 진입 0x12300 의 `0xa3a85(S)` 판정이다. 진입은 S+0x50 = 6 을 메모리에만 쓰고 커리어를 저장하지 않는다
   * (저장은 엔딩 칸을 비운 채 — `savedCareerOf`). 보너스는 팝업 0x2b 를 닫을 때 준다(`receiveEndingBonus`)
   */
  const enterEnding = (viewed: PlayerCareer, endingIndex: number) => {
    atoms.set(rawCareerAtom, { ...viewed, endingIndex })
    setScreen({ kind: '엔딩', endingIndex })
  }

  return { startNewSeason, enterGameEvaluationScreen, enterYearEndChain, enterPostseason, finishPostseason, enterEnding }
}
