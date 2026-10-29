import { atom } from 'jotai'
import type { PitcherGameOptions } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type { MatchInfoStadiumState } from '@/widgets/batting-stage/lib/renderScenery'
import type { NariMatchAces } from '@/pages/management/lib/nariMatchPrepare'
import type { NariEntryView } from '@/pages/management/lib/nariEntryView'
import type { EventReward } from '@/entities/story/model/eventReward'
import type { NationalCup, NationalCupMatchup } from '@/entities/national-cup/model/nationalCup'
import type { PitcherAceMatch } from '@/app/model/pitcherLeagueSession/types/scene'

/** 경기 칸 atom — 경기 옵션 · 경기 준비(142 · 143) · 국가대항전 · 마선수 대결처럼 경기를 세우는 칸 */

/** 지금 경기를 세울 옵션. 경기 장면이 아니면 null */
export const gameOptionsAtom = atom<PitcherGameOptions | null>(null)
/** 142 진입 0x1c46c 가 이 장면에서 굴린 마선수 */
export const matchAcesAtom = atom<NariMatchAces | null>(null)
export const matchInfoStageAtom = atom<MatchInfoStadiumState | null>(null)
/** 143 경기 전 엔트리 보기 (진입 0x16af8 · 키 0x1457c) — 142 위에 선다. 없으면 null */
export const entryViewAtom = atom<NariEntryView | null>(null)
/** 109 순위표의 이전 상태가 105(관리)인가 — 취소·바닥 5 가 이것으로 갈린다 (0x105f0 · 0x16928) */
export const nextGameFromManagementAtom = atom(false)
/**
 * 장면+0x288 — 142 의 마선수 넣기를 장면마다 한 번만 (1c566~1c572 · 1c668). 장면 셋업 0xfb7c 가 0 으로 둔다 →
 * 이 세션이 서는 때(이어하기)와 경기 뒤(`finishGame`)에 내린다. (그림에 안 쓰는 칸)
 */
export const matchPreparedAtom = atom(false)
/**
 * 116 → 114 평가 이벤트의 보상 명령 — 이미 준 몫. 0x8c460 이 명령마다 주고 끝(0x8b0e4 · 0x8cd44)에서 저장하므로 첫 몫을 줄 때
 * S+0x50 이 114 진입 값(3 · 0xb — 웹 null)으로 저장된다(타자편 `giveEvaluationRewards`, Q-23). (그림에 안 쓰는 칸)
 */
export const evaluationRewardsAtom = atom<{ readonly rewards: readonly EventReward[]; readonly given: number } | null>(null)
/** 치르는 마선수 대결 (장면 '마선수대결'). 아니면 null */
export const aceMatchAtom = atom<PitcherAceMatch | null>(null)

/** 국가대항전 대회 화면 — `atStandings` 면 135(순위)부터 */
export interface CupView {
  readonly cup: NationalCup
  readonly atStandings: boolean
}
/**
 * 국가대항전 대회 · 142 대진 · 치르는 대회 경기. 대회 칸은 커리어 저장(`nationalCup` — S+0x12c · L+0xa8~)에도 들어 이어하기가
 * 134 로 돌아온다(0x1c154 1c348~1c358).
 */
export const cupViewAtom = atom<CupView | null>(null)
export const cupMatchAtom = atom<{ readonly matchup: NationalCupMatchup; readonly cup: NationalCup } | null>(null)
/** 사람이 치르는 국가대항전 경기의 대회 — 끝나면 이 대회로 하루를 넘긴다 (그림에 안 쓰는 칸) */
export const cupGameAtom = atom<NationalCup | null>(null)
