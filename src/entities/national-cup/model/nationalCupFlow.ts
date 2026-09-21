import type { RandomPort } from '@/shared/api/random/randomPort'
import { NATIONAL_CUP_RUNNER_UP_TEXT_MONEY, nationalCupRewardOf } from '@/entities/season-mode/model/seasonRewards'
import type { SeasonReward } from '@/entities/season-mode/model/seasonRewards'
import type { EventReward } from '@/entities/story/model/eventReward'
import {
  KOREA_TEAM_ID,
  UNDECIDED_TEAM,
  coinFlipChampion,
  isKoreaInFinal,
  isNationalCupFinalDay,
  isNationalCupOver,
} from '@/entities/national-cup/model/nationalCup'
import type { NationalCup } from '@/entities/national-cup/model/nationalCup'

/**
 * 국가대항전 흐름 — 순위 화면 키 처리(`0x19fdc` 나리 / `0xe6f8` 시즌), 결과 문구(`0x85e6c`),
 * 보상(`0x1b92c` 나리 / `0x896c` 시즌), 히든 팀 열기(`0x19f30`/`0xe684`).
 *
 * 근거: `docs/re/_raw/notes/P5-national-match.md` 1a·1b·3·4·5 절 (확정).
 */

/** 두 모드가 대회를 치르는 방식이 조금씩 달라 갈라 쓴다 */
export type NationalCupMode = '나만의리그' | '시즌모드'

/**
 * 대회가 도는 상태 번호 (원본 값 그대로).
 *
 * 나만의리그(장면 `0x106`)
 * ```
 * 133 국가대표 선발 판정(0x1a090) → 114 이벤트 461 → 134
 * 134 순위 화면(들어옴 0x19f30, 키 0x19fdc) → 135
 * 135 매치업(키 0x10680)              → 142
 * 142 경기 준비(0x1c46c) → 사람 경기 → 101 재진입(0x1c154) → 134
 * ```
 * 시즌모드(장면 `0x105`)
 * ```
 * 242 안내(0xe5f8, S+0x12c = 1 · 이벤트 461) → 211 → 243
 * 243 순위 화면(들어옴 0xe684, 키 0xe6f8)    → 244
 * 244 매치업(키 0x4a18)                      → 221 경기 → 0x4b50 재진입 → 243
 * ```
 */
export const NATIONAL_CUP_STATE = {
  나만의리그: { 선발판정: 133, 이벤트: 114, 순위: 134, 매치업: 135, 경기준비: 142, 재진입: 101 },
  시즌모드: { 안내: 242, 이벤트: 211, 순위: 243, 매치업: 244, 경기: 221, 재진입: 0xcb },
} as const

/** 대회 참가 이벤트 번호 — 461 선발 · 462 탈락 · 463 출전 · 464 거절 */
export const NATIONAL_CUP_EVENT = { 선발: 461, 탈락: 462, 출전: 463, 거절: 464 } as const

/**
 * 나만의리그 선발 판정 (상태 133, `0x1a090`): `0xa3de8(S, 3) > 3` — **올해 목표를 4개 이상** 이뤘으면
 * 이벤트 461(선발), 아니면 462(탈락)다. "홀수 년차 연말" 이라는 조건은 이 상태로 들어오는 쪽이 건다.
 */
export function isCareerNationalCupCallUp(achievedGoalCount: number): boolean {
  return achievedGoalCount > 3
}

/**
 * 나만의리그가 국가대표 선발 판정(상태 133)을 하는 해.
 *
 * 연말 상태 132(`0x10c54`)가 연차 idx(`career+0xb3`)의 **bit0 이 0** 이면(1·3·5·7·9·11년차)
 * 상태 133 을 줄에 넣는다 (`0x10cec` 의 `lsls r0,r3,#31; bmi` → 건너뜀).
 * 13년차 은퇴식(504)·방출(501) 경로는 이 검사 **앞에서** 빠지므로 국가대표가 없다.
 *
 * 근거: `docs/re/B-season-awards.md` 3절 "국가대표 (461~464)" (확정) ·
 *       `docs/re/R9-myleague-states.md` 2b 절 (연차idx 짝수 → 133, 홀수 → 새 시즌).
 * 식은 시즌모드 `isSeasonNationalCupYear` 와 같다 — 둘 다 "2년에 한번"(이벤트 461 대사)이다.
 */
export function isCareerNationalCupYear(yearIndex: number): boolean {
  return (yearIndex & 1) === 0
}

/** 상태 133(`0x1a090`)이 예약하는 이벤트 — 올해 목표 4개 이상이면 선발 461, 아니면 탈락 462 */
export function careerNationalTeamEventId(achievedGoalCount: number): number {
  return isCareerNationalCupCallUp(achievedGoalCount) ? NATIONAL_CUP_EVENT.선발 : NATIONAL_CUP_EVENT.탈락
}

/**
 * 시즌모드 출전 판정 (`0x87b4`): 연차 idx 가 **짝수**(1·3·5·7·9년차)면 무조건 출전이다.
 * 선발 판정도 거절도 없다. 같은 판정이 `seasonStateMachine.ts` 의 `afterKoreanSeries` 에도 있다.
 */
export function isSeasonNationalCupYear(yearIndex: number): boolean {
  return (yearIndex & 1) === 0
}

/** **제 n 회** — `0x85e6c` 의 `n = (S+0xb3 연차idx >> 1) + 1`. 1·3·5…년차가 1·2·3…회다 */
export function nationalCupEditionOf(yearIndex: number): number {
  return (yearIndex >> 1) + 1
}

/** 순위 화면에서 확인을 눌렀을 때 벌어지는 일 */
export type NationalCupConfirm =
  /** 아직 경기가 남았다 — 매치업 화면(135 / 244)으로 */
  | { readonly kind: '다음경기'; readonly cup: NationalCup }
  /** 결과 화면(`0x85e6c`) — 팝업으로 우승/탈락 문구를 띄운다 */
  | { readonly kind: '결과'; readonly cup: NationalCup; readonly isKoreaChampion: boolean }

/**
 * 순위 화면 확인 키 `0x19fdc`(나리) · `0xe6f8`(시즌) — 두 함수의 판정이 같다.
 *
 * ```
 * if L+0xad == 1 and 0xb8565(L) == 0:      ; 결승 날인데 대한민국이 결승에 없다
 *     0xb858d(L)                           ; ⚠️ 결승을 치르지 않고 동전 던지기로 우승 결정
 *     0x85e6d(UI, 0)                       ; 결과 화면 (대한민국 우승 아님)
 * elif L+0xad == 0:                        ; 대회 끝
 *     0x85e6d(UI, L+0xc4 == 10)
 * else:
 *     next 135 / 244                       ; 다음 경기로
 * ```
 */
export function confirmNationalCupStandings(cup: NationalCup, random: RandomPort): NationalCupConfirm {
  if (isNationalCupFinalDay(cup) && !isKoreaInFinal(cup)) {
    // ⚠️ 원본 그대로 — 결승 경기는 아예 없고 rand(0,2) 로 우승국이 정해진다
    return { kind: '결과', cup: coinFlipChampion(cup, random), isKoreaChampion: false }
  }
  if (isNationalCupOver(cup)) {
    return { kind: '결과', cup, isKoreaChampion: cup.champion === KOREA_TEAM_ID }
  }
  return { kind: '다음경기', cup }
}

/**
 * 결과 화면 문구 `0x85e6c(UI, 우승?)` — 팝업 버퍼 `0x1552af4` 에 채우는 글이다.
 *
 * - 우승: StrMODE[144] `"[대한민국] 대표팀 제%d회 국가대항전 우승!!"`
 * - 그 밖: StrMODE[143] `"[대한민국] 대표팀 탈락!! [%s] 대표팀 제%d회 국가대항전 우승!!"`
 *
 * ⚠️ **원본 버그 그대로**: 결승까지 올라가 **져도** 문구는 "대표팀 탈락!!" 이다. 준우승이라는 말이 없다.
 */
export const NATIONAL_CUP_CHAMPION_MESSAGE_ID = 144
export const NATIONAL_CUP_ELIMINATED_MESSAGE_ID = 143

export function nationalCupResultText(edition: number, isKoreaChampion: boolean, championName: string): string {
  if (isKoreaChampion) return `[대한민국] 대표팀 제${edition}회 국가대항전 우승!!`
  return `[대한민국] 대표팀 탈락!! [${championName}] 대표팀 제${edition}회 국가대항전 우승!!`
}

const NOTHING: SeasonReward = { popularity: 0, reputation: 0, money: 0, gamePoint: 0, messageId: 0 }

/**
 * 나만의리그 보상 `0x1b92c` (팝업 `0x25` 결과 → `0x26` 보상).
 *
 * ```
 * S+0x144 == 10 (우승): sprintf(StrMODE[199], 20, 30, 2000, 1000)
 *   인기도 +20 · 평판 +30 · 소지금 +20(2000만) · G +1000
 * 그 밖: 보상 없이 새 시즌
 * ```
 * ⚠️ **나만의리그엔 준우승 보상이 없다** — StrMODE[200] 을 쓰는 곳은 시즌모드 `0x896c` 하나뿐이라
 * 결승에서 져도 탈락과 똑같이 빈손이다 (원본 그대로).
 *
 * 시즌모드 쪽 보상은 `seasonRewards.ts` 의 `nationalCupRewardOf` 가 이미 갖고 있다 —
 * 여기서 다시 만들지 않고 `nationalCupRewardFor` 가 그것을 그대로 부른다.
 */
export function careerNationalCupRewardOf(champion: number): SeasonReward {
  if (champion === KOREA_TEAM_ID) {
    return { popularity: 20, reputation: 30, money: 20, gamePoint: 1000, messageId: 199 }
  }
  return NOTHING
}

/**
 * 보상 팝업 글 (나리 `0x26` · 시즌 `0x23`/`0x24`).
 *
 * ⚠️ **StrMODE[199]·[200] 의 원문을 아직 못 뽑았다** — 문서에 남은 것은 `sprintf` 에 넘기는
 * `%d` 인자뿐이다(`P5` 3a·`P4` 4b). 그래서 **문장은 웹판이 지은 것**이고 **숫자는 원본 인자 그대로**다.
 * 원문이 나오면 이 함수만 갈아 끼우면 된다.
 *
 * ⚠️ **원본 버그 그대로**: 시즌모드 준우승(200)은 글에 **2500만**이라 적고 실제로는 **2000만**만
 * 더한다(`0x8a2e` 표시 vs `0x8b76 adds #0x14`). 그래서 글에는 `NATIONAL_CUP_RUNNER_UP_TEXT_MONEY`(25)를
 * 쓰고 `reward.money`(20)는 건드리지 않는다.
 */
export function nationalCupRewardText(reward: SeasonReward): string {
  if (reward.messageId === 0) return ''
  const shownMoney = reward.messageId === 200 ? NATIONAL_CUP_RUNNER_UP_TEXT_MONEY : reward.money
  const lines = [
    reward.messageId === 199 ? '국가대항전 우승!' : '국가대항전 준우승!',
    `인기도 +${reward.popularity} 평판 +${reward.reputation}`,
    `소지금 +${shownMoney * 100}만원`,
  ]
  if (reward.gamePoint > 0) lines.push(`${reward.gamePoint} G포인트 지급`)
  return lines.join('!N')
}

/**
 * 나만의리그 보상을 **이벤트 보상 칸**(`r_event` 명령 7, 점프 표 `0xd4e50`)으로 바꾼다.
 *
 * 나리 쪽 정산 자리는 시즌 레코드가 아니라 커리어(`PlayerCareer`)라, 팝업 `0x26` 이 직접 하는
 * 네 줄(인기도 `S+0x48` · 평판 `S+0x62` · 소지금 `S+0x2` · 전역 G포인트 `+0x64`)을
 * 같은 상한을 쓰는 `applyEventRewards` 에 넘겨 처리한다 — 종류 번호는 원본 표 그대로
 * **0 인기도 · 1 평판 · 3 소지금(100만원 단위) · 10 G포인트** 다.
 * 보상이 없으면(탈락·나리 준우승) 빈 목록이다.
 */
export function careerNationalCupRewardItems(reward: SeasonReward): readonly EventReward[] {
  if (reward.messageId === 0) return []
  return [
    { kind: 0, value: reward.popularity },
    { kind: 1, value: reward.reputation },
    { kind: 3, value: reward.money },
    { kind: 10, value: reward.gamePoint },
  ]
}

/** 모드에 맞는 대회 보상. 시즌모드는 `seasonRewards.nationalCupRewardOf` 를 그대로 쓴다 */
export function nationalCupRewardFor(mode: NationalCupMode, cup: NationalCup): SeasonReward {
  if (mode === '나만의리그') return careerNationalCupRewardOf(cup.champion)
  return nationalCupRewardOf(cup.champion, isKoreaInFinal(cup))
}

/**
 * 대회가 끝나고 여는 히든 팀 (`0x19f30` 나리 / `0xe684` 시즌, J-1 확정).
 *
 * ```
 * 0x65de5(g, 0)                                   ; 대한민국은 상태에 들어가기만 하면 열린다
 * if S+0x144 == 10:                                ; 대한민국이 우승했으면
 *     r1 = S+0x12e ; if r1 == 10: r1 = S+0x12f     ; 결승 상대
 *     0x65de5(g, r1 − 10)
 * ```
 * 즉 일본·쿠바·미국은 **대한민국이 결승에서 이긴 상대만** 열린다. 대한민국이 결승에 못 가면
 * `L+0xc4 != 10` 이라 아무도 안 열린다. (상태에 라운드마다 다시 들어오지만 이미 열려 있으면 아무 일 없다.)
 */
export function hiddenTeamsToOpen(cup: NationalCup): readonly number[] {
  const opened = [KOREA_TEAM_ID]
  if (cup.champion !== KOREA_TEAM_ID) return opened
  const opponent = cup.finalists[0] === KOREA_TEAM_ID ? cup.finalists[1] : cup.finalists[0]
  if (opponent !== UNDECIDED_TEAM && opponent !== KOREA_TEAM_ID) opened.push(opponent)
  return opened
}

export interface NationalCupFinish {
  readonly champion: number
  readonly isKoreaChampion: boolean
  /** 대한민국이 결승 두 팀에 들었는가 (시즌모드 준우승 보상 조건) */
  readonly koreaInFinal: boolean
  readonly reward: SeasonReward
  /** 이번 대회로 열리는 히든 팀 번호 */
  readonly openedTeams: readonly number[]
}

/**
 * 대회 마무리 — 결과 팝업을 닫은 뒤 벌어지는 일을 한 덩어리로 모았다
 * (나리 `0x1b92c` 팝업 `0x25`→`0x26` / 시즌 `0x896c` 팝업 1→`0x23`·`0x24`).
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * ⚠️⚠️ **여기가 국가대항전 플래그(`SeasonRecord.nationalCup` = `S+0x12c`)를 내리는 자리다.**
 *
 * 원본 **나만의리그**는 여기서 내린다 (`0x1b9ea`·`0x1bae6` 의 `S+0x12c = 0`, 새 시즌 `0x1b768`).
 * 원본 **시즌모드**에는 내리는 줄이 **하나도 없다** (S6 1절: `0x12c` 쓰기 15곳 전수 확인 — 복붙 누락).
 * 그래서 시즌모드는 대회가 끝난 뒤에도 플래그가 1 로 남아, 다음 시즌의 **정규 경기가 끝날 때마다**
 * 진입 분기(`0x4b50` = `enterSeasonScene`)가 국가대항전 대진표(243)로 새고 시즌이 막힌다.
 *
 * **여기서 지우면 풀린다 (사용자 판단 대기)** — 이 함수가 `clearNationalCup(record)` 를 부르거나,
 * `seasonRecord.ts` 의 `startNextYear` 에 `nationalCup: false` 한 줄을 더하면 된다.
 * `seasonStateMachine.ts` 에 `clearNationalCup()` 가 이미 만들어져 있고 **아무도 부르지 않는 것이
 * 원본 동작**이라, 이 모듈도 부르지 않는다. DECISIONS.md 2026-09-20 "아직 안 정한 것 1건" 참고.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
export function finishNationalCup(mode: NationalCupMode, cup: NationalCup): NationalCupFinish {
  return {
    champion: cup.champion,
    isKoreaChampion: cup.champion === KOREA_TEAM_ID,
    koreaInFinal: isKoreaInFinal(cup),
    reward: nationalCupRewardFor(mode, cup),
    openedTeams: hiddenTeamsToOpen(cup),
  }
}
