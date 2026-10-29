import { careerMvpCount, hasMvpInSeason } from '@/entities/career/model/titles/otherSlices'
import { isSeasonStart, ROMANCE_EVENT_IDS, type TitleSubject } from '@/entities/career/model/titles/subject'

/** StrNICKNAME[64+i] 의 연차·기준값 */
const NINTH_YEAR = 9
const FINAL_YEAR = 13
/** 소지금은 만원 단위라 60억 = 600,000만 */
const MONEY_SIX_BILLION = 600_000

type SubjectRule = (subject: TitleSubject) => boolean

const hasSeenEvent = (subject: TitleSubject, eventId: number) => subject.seenEventIds.includes(String(eventId))

const romanceCountOf = (subject: TitleSubject) => Object.values(ROMANCE_EVENT_IDS).filter((eventId) => hasSeenEvent(subject, eventId)).length

/** `s8` 로 읽기 — +0x184 는 u8 로 세지만 칭호 30 은 `ldrsb` 로 읽어 128 이상이면 음수가 된다 (0x1a680) */
const signedByteOf = (value: number) => ((value & 0xff) << 24) >> 24

/**
 * 공통 칭호 0~31 (P3 5·6절). 이 판정 함수(0x1a1c0) 밖에서 주는 것:
 *   8  국가 대표  — 국가대항전 순위 화면(상태 134)의 틀 `0x1b92c` 가 준다 → `nationalCupStandingsTitleOf`.
 *   1·9          — 중간평가 화면(0x11e84) → `seasonFlow.midSeasonTitlesOf`.
 */
const COMMON_RULES: Readonly<Record<number, SubjectRule>> = {
  // 0 이름 없는 신인 — 연차idx(+0xb3) == 0 && 경기 수(+0xb2) == 0 (0x1a1e6~0x1a1fc) — 1년차 첫 경기 전 관리 화면에서만
  0: (s) => s.season === 1 && isSeasonStart(s), // 지금부터 시작이다!
  // 2 최고의 루키 — 연차idx 1(2년차 시작) 이고 **1년차 MVP** (0x1a204)
  2: (s) => s.season === 2 && isSeasonStart(s) && hasMvpInSeason(s.mvpSeasonBits, 1),
  // 원본은 연차 인덱스 == 8, 즉 **9년차에만** 본다 (P3 9절). `>=` 면 10년차 이후에도 줘 버린다
  3: (s) => s.season === NINTH_YEAR && s.popularity >= 2000, // 9년차 인기도 2000이상
  4: (s) => s.season === NINTH_YEAR && s.reputation >= 750, // 9년차 평판 750이상
  // 5 우승청부업자 — 우승 5회 (0x1a29a, `s8 +0x7a > 4`)
  5: (s) => s.championships > 4,
  6: (s) => s.popularity >= 2000, // 인기도 2000이상
  7: (s) => s.popularity >= 4000, // 인기도 4000이상
  10: (s) => s.season >= FINAL_YEAR, // 13년차 선수 생활의 마무리
  // 11 야구의 정점 — 통산 MVP 6회 (0x1a32e, `> 5`)
  11: (s) => careerMvpCount(s.mvpSeasonBits) > 5,
  // 12 베이스볼 마스터 — 통산 MVP 10회 (0x1a34e, `> 9`)
  12: (s) => careerMvpCount(s.mvpSeasonBits) > 9,
  // 13 살아있는 전설 — 전설 스킬 보유 (0x1a36e). 그 스킬 조건이 우승 8회 + MVP 7회다 (A 문서)
  13: (s) => s.hasLegendSkill,
  // 14~17 — 연애 이벤트를 **본 적 있는가** (0xb6e80). 이름 순서가 아니라 이벤트 번호가 섞여 있다
  14: (s) => hasSeenEvent(s, ROMANCE_EVENT_IDS.메디카), // 간호사 페티쉬 — 이벤트 300
  15: (s) => hasSeenEvent(s, ROMANCE_EVENT_IDS.로제), // 로리콘은 범죄 — 이벤트 302
  16: (s) => hasSeenEvent(s, ROMANCE_EVENT_IDS.레오니), // 와일드 씽씽이 — 이벤트 301
  17: (s) => hasSeenEvent(s, ROMANCE_EVENT_IDS.발렌타인), // 피할 수 없는 유혹 — 이벤트 303
  18: (s) => romanceCountOf(s) > 1, // 사랑에 빠진 남자 — 여자친구 2명
  19: (s) => romanceCountOf(s) > 2, // 바람둥이 — 3명
  20: (s) => romanceCountOf(s) > 3, // 희대의 풍운아 — 4명
  21: (s) => s.lotteryFirstPrizes >= 5, // 또또복권 1등 5번 당첨
  22: (s) => s.lotteryPurchases >= 100, // 또또복권 100번 구매
  23: (s) => s.trainingTotal >= 200, // 훈련 횟수 200회
  24: (s) => s.trainingTotal >= 100, // 훈련 횟수 100회
  // 25·26 은 **다음 시즌 첫 경기 전**에 지난해 +0x6a 로 본다 (0x1a590·0x1a5d0, P3 9절):
  // `연차idx > 0 && 경기 수 == 0`. 시즌 끝에 보던 웹은 13년차(마지막 해) 외출까지 쳐 줬는데,
  // 원본은 그 해 뒤에 새 시즌이 없어 **13년차 외출은 볼 기회가 없다** — 그 차이까지 그대로 옮긴다.
  25: (s) => s.season > 1 && isSeasonStart(s) && s.outingsLastSeason <= 2, // 1년간 외출 2회 이하
  26: (s) => s.season > 1 && isSeasonStart(s) && s.outingsLastSeason > 19, // 1년간 외출 20회 이상
  27: (s) => s.reputation >= 999, // 평판 999
  28: (s) => s.reputation >= 700, // 평판 700
  29: (s) => s.reputation <= 0, // 평판 0
  // 30 가짜 인간 — `s8 +0x184 > 4` (0x1a670). +0x184 = 평판 0 으로 끝난 경기 뒤 평가 연속 수 (0xa4d08)
  30: (s) => signedByteOf(s.reputationZeroGames) > 4,
  31: (s) => s.money >= MONEY_SIX_BILLION, // 소지금 60억
}

/** 조건을 만족한 칭호 번호 — 원본 판정 순서대로 오름차순이다 */
export function matchedCommonTitleNumbers(subject: TitleSubject): readonly number[] {
  return Object.entries(COMMON_RULES)
    .filter(([, rule]) => rule(subject))
    .map(([index]) => Number(index))
}
