import { isBugFixed } from '@/shared/config/bugfixes'
import { enterPitcherGameEvaluation, NO_LAST_EVALUATION, type PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { reliefNeverEnteredOf } from '@/entities/pitcher-career/model/pitcherRotation'
import { managerCommentIndexOf } from '@/features/play-pitcher-game/model/pitcherGameEvaluation'
import { enterPitcherYearEndEvent, pitcherResumePointOf, type PitcherResumePoint } from '@/entities/pitcher-career/model/pitcherYearEnd'
import { regularSeasonPopupOnEnter, type PostseasonPopup } from '@/entities/career/model/postseasonFlow'
import { liveGameInningIndex } from '@/shared/lib/liveGameState/liveGameState'
import type { PitcherScene, PitcherStory } from '@/app/model/pitcherLeagueSession/types/scene'
import type { CupView } from '@/app/model/pitcherLeagueSession/atoms/gameAtoms'

/**
 * 이어하기 116 다시 돌기의 감독 글 — 0x1278c 는 저장의 S+0x4a(지난 평가 인기도 변화) · S+0x62(지금 평판) · 포지션 코드
 * (0xb6395, 내 투수 레코드)와 **전역 경기 상태**(위) · S+0x1d8[6] 으로 **다시 고른다**(12822~12afe). 저장해 둔 글 번호를 쓰지 않는다.
 */
function resumedPitcherLastGameOf(career: PitcherCareer): PitcherCareer {
  const { lastGame } = career
  if (lastGame === undefined) return career
  const neverEntered =
    career.role !== PITCHER_ROLE.starter &&
    // 전역 경기 상태 +0x6b 의 지금 값 — 앱을 새로 켰으면 0, 아니면 마지막으로 돈 경기(모드 불문)의 이닝 (`liveGameState`)
    reliefNeverEnteredOf(liveGameInningIndex()) &&
    ((lastGame.pitches ?? 0) & 0xff) === 0
  const managerCommentIndex = managerCommentIndexOf(
    { role: career.role, neverEntered, reputation: career.reputation, positionCode: career.positionCode },
    (career.lastEvaluation ?? NO_LAST_EVALUATION).popularityChange,
  )
  return { ...career, lastGame: { ...lastGame, managerCommentIndex } }
}

/** 이어하기 — 저장에서 고른 이어할 자리와 그 자리에 들어서며 고친 커리어 (상태 100 진입 0x1c154) */
export interface PitcherResume {
  readonly career: PitcherCareer | null
  readonly point: PitcherResumePoint
}

/**
 * S+0x50 == 2 → 116 진입 0x1278c 다시 — 원본은 경기 뒤 카운터를 한 번 더 쓴다(겹쳐 쌓임, B-28). 정산(0x4ea0c)은 다시 안 돈다.
 * 고친 길(기본)은 첫 진입이 센 저장 그대로 — 감독 글(`resumedPitcherLastGameOf`)만 다시 고른다
 */
function reenteredEvaluationOf(saved: PitcherCareer): PitcherCareer {
  return isBugFixed('B-28') ? resumedPitcherLastGameOf(saved) : enterPitcherGameEvaluation(resumedPitcherLastGameOf(saved))
}

/**
 * 이어할 자리에 들어서며 고친 커리어.
 * - 1c25e — S+0x50 == 0x11(464 거절 보상 뒤 끊김) → 새 시즌 처리 0x1b768 → 137(연초 114 틀이 남은 +0x289 를 받는다 —
 *   `nariYearCover` 의 이어하기 길)은 **투수편에 들어설 때** 돈다(`useResumedNewSeason`) — 띄울 때는 저장 그대로다
 * - 국가대항전(134)은 저장 그대로 — 첫 틀 0x1b92c 의 칭호 8 팝업 · 진입 0x19f30 의 히든 팀 열기는 화면 몫이다
 */
function resumedCareerOf(saved: PitcherCareer | null, point: PitcherResumePoint): PitcherCareer | null {
  if (saved === null) return saved
  if (point.kind === '이벤트') return enterPitcherYearEndEvent(saved, point.eventId)
  if (point.kind === '경기결과') return reenteredEvaluationOf(saved)
  return saved
}

export function pitcherResumeOf(saved: PitcherCareer | null): PitcherResume {
  const point: PitcherResumePoint = saved === null ? { kind: '관리' } : pitcherResumePointOf(saved)
  return { career: resumedCareerOf(saved, point), point }
}

/**
 * 이어할 자리의 화면.
 * - 109 — 이전 상태가 1(자원 적재)이라 `nextGameFromManagement` 는 거짓 그대로다
 * - 0x1c154 그 밖 갈래 S+0x12c → 134 — 저장의 대회로 대진판부터
 * - 1c24e S+0x50 == 6 → 141 — 보너스를 받은 저장(S+0x7b)이라 키 0x1220c 가 등록 팝업 0x2d 로 간다
 * - 1c25e S+0x50 == 0x11 → 0x1b768 → (100 · 1 · 105 · 115 · 114 를 지나며) 연초 114 틀이 남은 +0x289 로 137 — `nariYearCover`
 */
const SCENE_OF_RESUME: Readonly<Record<PitcherResumePoint['kind'], PitcherScene>> = {
  관리: '관리',
  이벤트: '이벤트',
  포스트시즌: '포스트시즌',
  다음경기순위: '다음경기순위',
  경기결과: '경기결과',
  국가대항전: '국가대항전',
  엔딩: '엔딩',
  새시즌: '연차표지',
}

export function pitcherSceneOfResume(career: PitcherCareer | null, resumePoint: PitcherResumePoint): PitcherScene {
  if (career === null) return '등록'
  return SCENE_OF_RESUME[resumePoint.kind]
}

export function pitcherStoryOfResume(resumePoint: PitcherResumePoint): PitcherStory | null {
  return resumePoint.kind === '이벤트' ? { eventId: resumePoint.eventId, context: '연말', viewed: [] } : null
}

export function postseasonPopupOfResume(career: PitcherCareer | null, resumePoint: PitcherResumePoint): PostseasonPopup | null {
  // 128 진입 0x120a4 를 다시 밟는다 — 정규시즌 우승 보상을 아직 안 받았고 1위면 팝업 0xb
  return career !== null && resumePoint.kind === '포스트시즌' ? regularSeasonPopupOnEnter(career) : null
}

export function cupViewOfResume(resumePoint: PitcherResumePoint): CupView | null {
  return resumePoint.kind === '국가대항전' ? { cup: resumePoint.cup, atStandings: false } : null
}
