import type { RandomPort } from '@/shared/api/random/randomPort'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
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
 * 보상(`0x1b92c` 나리 / `0x896c` 시즌), 히든 팀 열기(134 진입 `0x19f30` / 243 진입 `0xe684`).
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
 * 결과 화면 문구 `0x85e6c(UI, 우승?)` — 팝업 버퍼 `0x1552af4` 에 `sprintf` 로 채우는 글이다 (원문 그대로, 색·줄바꿈 표시 포함).
 *
 * - 우승: StrMODE[144] `"!C[!cFFFF00대한민국!cFFFFFF] 대표팀!N제%d회 국가대항전 우승!!"` ← 제 n 회
 * - 그 밖: StrMODE[143] `"!C[!cFFFF00대한민국!cFFFFFF] 대표팀 탈락!!N!N[!cFFFF00%s!cFFFFFF] 대표팀 제%d회!N국가대항전 우승!!"` ← 우승국 이름 · 제 n 회
 *
 * ⚠️ **원본 버그 그대로**: 결승까지 올라가 **져도** 문구는 "대표팀 탈락!!" 이다. 준우승이라는 말이 없다.
 */
export const NATIONAL_CUP_CHAMPION_MESSAGE_ID = 144
export const NATIONAL_CUP_ELIMINATED_MESSAGE_ID = 143

/** StrMODE 원문의 `%s`·`%d` 를 차례로 채운다 (원본 `sprintf` 자리) */
const sprintfModeText = (id: number, ...values: readonly (string | number)[]): string =>
  values.reduce<string>((text, value) => text.replace(/%[sd]/, String(value)), ORIGINAL_MODE_TEXT[id] ?? '')

export function nationalCupResultText(edition: number, isKoreaChampion: boolean, championName: string): string {
  if (isKoreaChampion) return sprintfModeText(NATIONAL_CUP_CHAMPION_MESSAGE_ID, edition)
  return sprintfModeText(NATIONAL_CUP_ELIMINATED_MESSAGE_ID, championName, edition)
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
 * 보상 팝업 글 (나리 `0x26` · 시즌 `0x23`/`0x24`) — StrMODE 원문에 `sprintf` 인자를 그대로 넣는다.
 *
 * - [199] `"!C[!c00FF00국가대항전 우승!!!cFFFFFF]!N!N인기도 +%d / 평판 +%d!N소지금 +%d만!NG포인트 +%d"`
 *   — 나리 `sprintf(StrMODE[199], 20, 30, 2000, 1000)` (1b9b8~1b9e4) · 시즌 `(30, 40, 5000, 1000)` (89ca~89f0)
 * - [200] `"!C[!c00FF00국가대항전 준우승!!!cFFFFFF]!N!N인기도 +%d / 평판 +%d!N소지금 +%d만"`
 *   — 시즌 `sprintf(StrMODE[200], 20, 20, 2500)` (8a26~8a44). 나리는 [200] 을 쓰지 않는다
 *
 * 소지금 인자는 만 원 단위라 100만원 단위 `reward.money` × 100 이다.
 *
 * ⚠️ **원본 버그 그대로**: 시즌모드 준우승(200)은 글에 **2500만**이라 적고 실제로는 **2000만**만
 * 더한다(`0x8a2e` 표시 vs `0x8b76 adds #0x14`). 그래서 글에는 `NATIONAL_CUP_RUNNER_UP_TEXT_MONEY`(25)를
 * 쓰고 `reward.money`(20)는 건드리지 않는다.
 */
export function nationalCupRewardText(reward: SeasonReward): string {
  if (reward.messageId === 0) return ''
  if (reward.messageId === 200) {
    return sprintfModeText(200, reward.popularity, reward.reputation, NATIONAL_CUP_RUNNER_UP_TEXT_MONEY * 100)
  }
  return sprintfModeText(reward.messageId, reward.popularity, reward.reputation, reward.money * 100, reward.gamePoint)
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
 * 순위(대진) 화면 134 에 **들어올 때마다** 여는 히든 팀 (`0x19f30` 나리 / `0xe684` 시즌, J-1 확정).
 *
 * ```
 * 19f46 0x65de5(g, 0)                             ; 대한민국은 상태에 들어가기만 하면 열린다
 * 19f4e if S+0x144 == 10:                          ; 대한민국이 우승했으면 (결승 승 기록 0xb76dc 가 L+0xc4 를 쓴 뒤 다시 들어온 134)
 *           r1 = S+0x12e ; if r1 == 10: r1 = S+0x12f   ; 결승 상대
 * 19f78     0x65de5(g, r1 − 10)
 * ```
 * 즉 일본·쿠바·미국은 **대한민국이 결승에서 이긴 상대만** 열린다. 대한민국이 결승에 못 가면
 * `L+0xc4 != 10` 이라 아무도 안 열린다. 결승 뒤 101 → 134 로 돌아온 그 진입에서 열리므로 결과 팝업(134 키)보다 앞이다.
 * 차례는 대한민국 → 결승 상대.
 */
export function hiddenTeamsToOpen(cup: NationalCup): readonly number[] {
  const opened = [KOREA_TEAM_ID]
  if (cup.champion !== KOREA_TEAM_ID) return opened
  const opponent = cup.finalists[0] === KOREA_TEAM_ID ? cup.finalists[1] : cup.finalists[0]
  if (opponent !== UNDECIDED_TEAM && opponent !== KOREA_TEAM_ID) opened.push(opponent)
  return opened
}

/**
 * 134 진입에서 **처음 열리는** 히든 팀 — 여는 함수 `0x65de4(g, k)` 는 전역 `+0x7a+k` 가 이미 1 이면 0 을 돌려주고
 * 아무것도 안 한다(65df8~65e00). 0 이었을 때만 1 로 쓰고 · 전역 저장 `0x1f1b9` · 팝업을 띄운다.
 * 웹의 전역 해금표는 `openedHiddenIds`(팀은 10~14 번 그대로)다.
 */
export function newlyOpenedHiddenTeamsOf(cup: NationalCup, openedHiddenIds: readonly number[]): readonly number[] {
  return hiddenTeamsToOpen(cup).filter((team) => !openedHiddenIds.includes(team))
}

/**
 * StrCOMMON[138] 원문 — `base/extracted/StrCOMMON.json` 138 번 그대로다.
 * (`shared/config/original` 에 StrCOMMON 묶음이 따로 없어 이 한 줄만 옮겨 둔다.)
 */
export const HIDDEN_TEAM_OPEN_TEXT = '!C히든 팀 오픈!!!N[!cFFFF00%s!cFFFFFF]'

/**
 * 히든 팀 오픈 알림 — `0x65de4` 65e18~65e52: `sprintf(buf, StrCOMMON[138], StrCOMMON[10 + k])` 를
 * `0xbbef9(buf, 1, 0x22, 1)` (팝업 종류 0x22) 로 띄운다. StrCOMMON[10..14] 는 팀 이름(대한민국·일본·쿠바·미국·외인구단)이라
 * 팀 표 이름과 같다.
 */
export function hiddenTeamOpenText(teamName: string): string {
  return HIDDEN_TEAM_OPEN_TEXT.replace('%s', teamName)
}

/**
 * 한 틀에 팝업이 여럿 걸릴 때 실제로 뜨는 차례 — 팝업 관리자 `[0x140005c]` 는 **띄운 것 하나 + 대기 한 칸**뿐이다.
 *
 * - 글 팝업 `0x74ef4`(0xbbef9 가 부름)·칭호 팝업 `0x741a0`(0x1274c 가 부름) 모두 이미 떠 있으면(`+9 != 0`) 대기 깃발
 *   `+0x2a4 = 1` 을 세우고 대기 칸에 적는다 — 글은 `+0x2a8` 버퍼 · 종류 `+0x3a8`, 칭호는 `+0x3b0..+0x3bc`(종류 · 그리기 · 키 · this).
 *   대기 칸은 하나라 나중에 적은 것이 앞의 것을 덮는다.
 * - 닫힐 때 `0x75440` 이 대기 깃발을 보고, 그리기·키 콜백(`+0x3b4`/`+0x3b8`)이 있으면 `0x741a0`, 없으면 `0x74ef4` 로
 *   다시 띄운 뒤 `+0x2a8` 부터 0x120 바이트를 지운다.
 *
 * 134 첫 진입은 진입 `0x19f30` 의 히든 팀 팝업(0x22) → 같은 진입의 첫 틀 `0x1b92c` 머리의 칭호 8 팝업(0x78) 차례로 걸리므로
 * **히든 팀 오픈이 먼저 뜨고, 닫으면 칭호 "국가 대표"** 가 뜬다. 여기서는 칭호가 늘 마지막이라 "첫 것 + 마지막 것" 이다.
 */
export function queuedPopupsOf<T>(requested: readonly T[]): readonly T[] {
  if (requested.length <= 2) return requested
  return [requested[0], requested[requested.length - 1]]
}

export interface NationalCupFinish {
  readonly champion: number
  readonly isKoreaChampion: boolean
  /** 대한민국이 결승 두 팀에 들었는가 (시즌모드 준우승 보상 조건) */
  readonly koreaInFinal: boolean
  readonly reward: SeasonReward
  /**
   * 이번 대회로 열리는 히든 팀 번호 (`hiddenTeamsToOpen`).
   * 나만의리그는 이것을 쓰지 않는다 — 134 진입마다 화면이 이미 열었다(`NationalCupScreen` 의 `openedHiddenIds`).
   */
  readonly openedTeams: readonly number[]
}

/**
 * 대회 마무리 — 결과 팝업을 닫은 뒤 벌어지는 일을 한 덩어리로 모았다
 * (나리 `0x1b92c` 팝업 `0x25`→`0x26` / 시즌 `0x896c` 팝업 1→`0x23`·`0x24`).
 *
 * 국가대항전 플래그(`SeasonRecord.nationalCup` = `S+0x12c`)는 **여기서 내리지 않는다** — 내리는 자리는 모드마다 따로다:
 * - **나만의리그**: `0x1b9ea`·`0x1bae6` 의 `S+0x12c = 0`, 새 시즌 `0x1b768`.
 * - **시즌모드**: 대회 끝 `0x896c` → 보상 `0x8a56`/`0x8b10` → `0x8b88: bl 0x6e0c`(새 해)다. 새 해의 리그 초기화
 *   `0xa305c → 0xb7b34` 가 L(= SR+0x80)을 0xf8 바이트 memset 하므로 `SR+0x12c`(L+0xac)도 함께 0 이 된다 (588b201).
 *   S6 1절의 "내리는 줄이 없다(시즌이 막히는 원본 버그)" 는 strb 만 센 전수 스캔이 이 memset 을 놓친 것이다 —
 *   원본은 막히지 않는다. 웹은 `useSeasonSession.finishCup` 이 `nextYearOf` 로 새 해에 들어가고
 *   `seasonRecord.startNextYear` 가 플래그를 내린다.
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
