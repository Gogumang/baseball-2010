import { isBugFixed } from '@/shared/config/bugfixes'
import type { NationalCup } from '@/entities/national-cup/model/nationalCup'
import type { PlayerCareer } from '@/entities/career/model/playerCareer/types/playerCareer'

/**
 * 국가대항전 플래그를 내린다 — 원본 `S+0x12c = 0`(대회 끝 0x1b9ea · 0x1bae6 · 새 시즌 0x1b768 의 1b774). 대회 칸(L+0xa8~)은
 * 지우지 않지만 플래그가 꺼지면 아무도 안 읽으므로 웹은 칸째 뺀다. 대표팀 칸 두 개(`nariCupTeams`)는 남긴다(원본도 안 지운다).
 */
export function endNationalCup<T extends { readonly nationalCup?: NationalCup }>(career: T): T {
  if (career.nationalCup === undefined) return career
  const next = { ...career }
  delete (next as { nationalCup?: NationalCup }).nationalCup
  return next
}

/** 나리 장면 셋업 0xf684 fb92~fba8 의 외출 칸 지우기 — 경기 수(S+0xb2)가 2 일 때만 +0x6a = 0. 투수편도 같은 꼴(`PitcherCareer`) */
export const NARI_OUTING_RESET_GAMES = 2

export function withNariSceneSetupOutings<T extends Pick<PlayerCareer, 'gamesPlayed' | 'outingsThisSeason' | 'outingsLastSeason'>>(
  career: T,
  previousGames?: number | null,
): T {
  if (career.gamesPlayed !== NARI_OUTING_RESET_GAMES) return career
  // B-84 고친 길 — 원본은 g == 2 인 셋업마다(이어하기 · 마선수 대결 뒤도) 지워 g == 2 창에서 한 외출이 사라진다. 2경기째가 막 끝난
  // 셋업(앞서 본 경기 수 1)에서만 지운다. 굴림 없음
  if (isBugFixed('B-84') && previousGames !== NARI_OUTING_RESET_GAMES - 1) return career
  if (career.outingsThisSeason === 0 && career.outingsLastSeason === 0) return career
  return { ...career, outingsThisSeason: 0, outingsLastSeason: 0 }
}

/** 연말 132 의 꼬리가 쓰는 두 칸 (`seasonStartCountersOf`) — 타자편 · 투수편 커리어 둘 다 이 모양이다 */
export interface SeasonStartCounters {
  readonly seasonStartTrainingCounts: Readonly<Record<string, number>>
  readonly seasonPopularityGain: number
}

/**
 * **새 시즌의 +0x6b+i(시즌 시작 훈련 수 사본) · +0x1c2(이번 시즌 인기도 변화 합)** — 타자편 · 투수편 공용(장면 0x106 모드 3·4).
 * 원본은 이 두 칸을 새 시즌 0x1b768 이 아니라 **연말 132 진입 0x10c54 의 꼬리**에서 쓴다(직접 떴다):
 * ```
 * 10c84  0xa3a85(S) == 1 → 501 · 10c9c 연차idx == 12 → 504   ; [114 → 141] — 10cc8 에서 꼬리를 건너뛴다
 * 10cca  그 밖 380 / 502 → (짝수 idx 면 133) · 114
 * 10d08  strh 0 → S+0x1c2                                     ; 이번 시즌 인기도 변화 합
 * 10d14  i = 0..4: S+0x6b+i = S+0x4b+i                         ; 통산 훈련 수 사본
 * ```
 * 0x1b768 (· 그 안 0xa39a8)은 두 칸을 안 건드린다. 132 와 0x1b768 사이(133 · 134 · 연봉 이벤트)엔 훈련도 경기 뒤 평가도 없어
 * 132 를 거친 새 시즌은 여기서 써도 같은 값이다. 다른 길은 **방출 501 → 141 → 5000 G 이어하기 → 0x1b768(1be26)** 하나 —
 * 그 해 132 는 501 갈래라 꼬리를 안 지나, 원본은 사본이 그 앞 해 132 것 · 인기도 합이 그 해 합 그대로 다음 해로 넘어간다.
 * ⚠️ 원본 버그(B-128): 이어한 해의 몹쓸몸 · 유리몸 · 스킬 18~20(이번 시즌 훈련 수) · 먹튀(인기도 합 — g == 14 · 32 판정)가
 * 두 해치를 본다. 고침(bugfixes.json B-128, 기본 켬): 그 길도 다른 길처럼 새로 뜬다. 굴림 없음(스킬 조건 판정만 바뀐다)
 */
export function seasonStartCountersOf(
  career: Pick<PlayerCareer, 'trainingCounts' | 'seasonStartTrainingCounts' | 'seasonPopularityGain'>,
  afterRelease: boolean,
): SeasonStartCounters {
  if (afterRelease && !isBugFixed('B-128')) {
    return { seasonStartTrainingCounts: career.seasonStartTrainingCounts, seasonPopularityGain: career.seasonPopularityGain }
  }
  return { seasonStartTrainingCounts: { ...career.trainingCounts }, seasonPopularityGain: 0 }
}
