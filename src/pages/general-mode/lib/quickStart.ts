/**
 * **빠른실행** (J-2 · J 1-2, 확정 — 0x314b0 앞부분이 준비 기록을 통째로 굴린다).
 *
 * 메인 메뉴에서 일반모드를 고를 때 빠른실행을 잡으면 준비 1~6 단계를 건너뛰고 바로
 * 경기정보(상태 22)로 가며, 그 진입 함수가 기록을 이렇게 채운다:
 *
 * ```
 * 31500: 0x9f5a0(저장) → [rec+0] 유저 팀
 * 31512: 0x9f5a0(저장) → [rec+4] AI 팀        ; 같은 함수를 두 번 — 재추첨이 없다
 * 3151a: bfa55(0,2) != 0 → [rec+8] = 1        ; 선공/후공 50%
 * 3152e: [rec+0xc] = 유저 팀                   ; 구장 = 유저 팀 번호
 * 31538: 0x9f650(저장) → [rec+0xe] 마투수
 * 31546: 0x9f604(저장) → [rec+0xd] 마타자
 * ```
 *
 * 경기정보에서 `*` 를 누르면 20틱 동안 **팀 둘만** 매 틱 다시 뽑다가 20번째 틱에 선공·마선수까지 뽑고 멈춘다
 * (0x311a8, 아래 `rollQuickRespinTeams` · `finishQuickRespin`). R4 3b 의 "매 틱 다섯을 다 굴린다 · 구장 = 유저 팀" 은
 * 0x314b0(진입)과 섞인 것이다 — 재굴림은 구장을 안 건드린다.
 */
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import type { RandomPort } from '@/shared/api/random/randomPort'
import {
  ACE_PER_ROLE,
  NO_ACE,
  type GeneralModeSetup,
} from '@/pages/general-mode/lib/generalModeSetup'
import { HIDDEN_TEAM_FIRST_ID } from '@/pages/general-mode/lib/hiddenTeam'

/** 기본(히든이 아닌) 팀 열 개는 늘 후보다 */
export const OPEN_TEAM_COUNT = 10

/** 저장에 적힌 "지금 열려 있는 것" 들 — 빠른실행이 여기서만 뽑는다 */
export interface QuickStartOpenState {
  /** 전역 기록 +0x70+idx (= 저장 +0x7a+k) 가 켜진 히든 팀 번호 10~14 */
  readonly openedHiddenTeamIds?: readonly number[]
  /** 저장 +0x30..0x34 — 열린 마투수 번호 0~4 */
  readonly openedAcePitcherIds?: readonly number[]
  /** 저장 +0x35..0x39 — 열린 마타자 번호 0~4 */
  readonly openedAceBatterIds?: readonly number[]
}

/** `bfa55(0, n)` 균등 뽑기 — [0, n) 정수 */
function uniform(random: RandomPort, count: number): number {
  return random.rand(0, count)
}

/**
 * `0x9f5a0(저장)` — 팀 0..9 에 열린 히든 팀을 이어 붙인 목록에서 **균등**하게 하나.
 * 목록은 번호 오름차순으로 쌓인다.
 */
export function quickStartTeamCandidates(openedHiddenTeamIds: readonly number[] = []): readonly number[] {
  const hidden = [...new Set(openedHiddenTeamIds)]
    .filter((id) => id >= HIDDEN_TEAM_FIRST_ID)
    .sort((left, right) => left - right)
  return [...Array.from({ length: OPEN_TEAM_COUNT }, (_unused, index) => index), ...hidden]
}

/**
 * `0x9f650` / `0x9f604` — 열린 마선수 중 균등. 하나도 없으면 표 0xd7638[0] = −1(없음).
 * 하나도 없어도 `bfa55(0, 0)` 을 **부른다**(0x9f67c · 0x9f630 — 개수 검사가 없다). bfa55 는 범위를 보기 전에
 * 씨앗부터 돌리므로(0xbfa5c~0xbfa68) 난수 하나를 쓰고 0 을 돌려준다 → 표 [0] = −1.
 */
function rollAce(random: RandomPort, opened: readonly number[] = []): number {
  const list = [...new Set(opened)]
    .filter((id) => id >= 0 && id < ACE_PER_ROLE)
    .sort((left, right) => left - right)
  const index = uniform(random, list.length)
  return list.length === 0 ? NO_ACE : list[index]
}

/**
 * 준비 기록을 한 번 굴린다.
 *
 * ⚠️ **원본 버그 — 같은 팀끼리 경기가 나올 수 있다.** 유저 팀과 AI 팀을 같은 함수로 따로 뽑기만
 * 하고 재추첨하는 코드가 없다 (J 2절 "원본 버그" 첫 줄). 상태 18·19 에서 사람이 고를 때도
 * 같은 팀 검사가 없으니(R4 3a 상태 19) 원본 동작이 한결같다 — **고치지 않는다**.
 *
 * ⚠️ **구장은 유저 팀 번호를 그대로 쓴다.** 구장 목록은 0~9 뿐인데 유저 팀이 히든(10~14)이면
 * 구장 번호도 10~14 가 된다. 원본이 자르지 않으므로 여기서도 자르지 않는다 —
 * 그림(stadium_symbol)이 열 장뿐이라 화면 쪽에서 없는 번호를 빈칸으로 둔다.
 */
export function rollQuickStart(random: RandomPort, open: QuickStartOpenState = {}): GeneralModeSetup {
  const candidates = quickStartTeamCandidates(open.openedHiddenTeamIds)
  const userTeamId = candidates[uniform(random, candidates.length)]
  const aiTeamId = candidates[uniform(random, candidates.length)]
  const playerSide = uniform(random, 2) !== 0 ? PLAYER_SIDE_LAST_BAT : PLAYER_SIDE_FIRST_BAT
  // 굴림 차례가 원본과 같아야 같은 시드에서 같은 결과가 나온다 — 마투수(+0xe) 가 마타자(+0xd) 보다 먼저다
  const acePitcherId = rollAce(random, open.openedAcePitcherIds)
  const aceBatterId = rollAce(random, open.openedAceBatterIds)
  return { userTeamId, aiTeamId, playerSide, stadiumId: userTeamId, aceBatterId, acePitcherId }
}

/** 경기정보에서 `*` 를 눌렀을 때 도는 틱 수 (메뉴+0x154 가 0 에서 20 까지, 0x31238 `cmp #0x14`) */
export const QUICK_RESPIN_TICKS = 20

/**
 * **`*` 재굴림 한 틱** — 0x311a8 의 31200~31230 (직접 떴다). [메뉴+0x14c](빠른실행) && [skin+0xf4](0x31424 가 세움)
 * 인 동안 매 틱 [메뉴+0x154]++ 하고 `0x9f5a0(저장)` 을 두 번 — 기록 +0(유저 팀) · +4(AI 팀)만 새로 적는다
 * (31296~312a4 가 나머지 +8 · +0xc 를 옛 값 그대로 되적는다). 그래서 화면은 두 엠블럼만 돈다.
 */
export function rollQuickRespinTeams(
  random: RandomPort,
  open: QuickStartOpenState = {},
): { readonly userTeamId: number; readonly aiTeamId: number } {
  const candidates = quickStartTeamCandidates(open.openedHiddenTeamIds)
  const userTeamId = candidates[uniform(random, candidates.length)]
  const aiTeamId = candidates[uniform(random, candidates.length)]
  return { userTeamId, aiTeamId }
}

/**
 * **재굴림 20번째 틱** — 31238 `cmp [메뉴+0x154], #0x14` 가 맞으면 그 틱의 팀 둘 뒤에 `bfa55(0,2)`(선공 +8) ·
 * `0x9f650`(마투수 +0xe) · `0x9f604`(마타자 +0xd) 을 굴려 적고 [skin+0xf4] = 0(3128c), 이어 `0x30f20`(31290).
 *
 * ⚠️ **원본 그대로 — 구장(+0xc)은 안 바꾼다.** 진입 0x314b0 은 구장 = 유저 팀(3152e)이지만 여기는 +0xc 낱말을
 * 옛 값으로 되적고 +0xd · +0xe 바이트만 고친다(31262 · 31272 → 31280 `ldr [sp+0x2c]`). 재굴림 뒤 구장은
 * 처음 유저 팀의 구장으로 남는다.
 */
export function finishQuickRespin(
  random: RandomPort,
  previous: GeneralModeSetup,
  open: QuickStartOpenState = {},
): GeneralModeSetup {
  const { userTeamId, aiTeamId } = rollQuickRespinTeams(random, open)
  const playerSide = uniform(random, 2) !== 0 ? PLAYER_SIDE_LAST_BAT : PLAYER_SIDE_FIRST_BAT
  const acePitcherId = rollAce(random, open.openedAcePitcherIds)
  const aceBatterId = rollAce(random, open.openedAceBatterIds)
  return { ...previous, userTeamId, aiTeamId, playerSide, aceBatterId, acePitcherId }
}
