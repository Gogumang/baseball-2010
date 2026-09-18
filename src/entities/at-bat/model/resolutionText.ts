import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'

/** 공 하나의 판정을 화면 배너 문구로 바꾼다. */
export function describePitchResolution(resolution: PitchResolution): string {
  switch (resolution.kind) {
    case '볼':
      return '볼'
    case '파울':
      return '파울'
    case '스트라이크':
      return resolution.isSwinging ? '헛스윙' : '스트라이크'
    case '타구':
      return describeBanner(resolution.outcome.kind)
  }
}

/** 원본 기록달성 이름 StrGAME[9]~[12] — 누상 주자 수 순서 */
const HOME_RUN_NAMES = ['솔로 홈런', '2점 홈런', '3점 홈런', '만루 홈런']
/** StrGAME[8] */
const TRIPLE_NAME = '3루타'

/** 타석 결과 배너. 홈런·3루타는 원본 기록달성 이름을 쓴다. */
export function describeOutcomeBanner(outcome: AtBatOutcome, runnersOnBase: number): string {
  if (outcome.kind === '홈런') {
    return HOME_RUN_NAMES[Math.min(Math.max(0, runnersOnBase), HOME_RUN_NAMES.length - 1)]
  }
  if (outcome.kind === '안타' && outcome.bases === 3) return TRIPLE_NAME
  return describeBanner(outcome.kind)
}

/** 타석이 끝났을 때 크게 띄우는 문구. */
export function describeBanner(outcomeKind: string): string {
  switch (outcomeKind) {
    case '홈런':
      return '홈런!!'
    case '안타':
      return '안타!'
    case '볼넷':
      return '볼넷'
    case '삼진':
      return '삼진…'
    default:
      return '아웃'
  }
}
