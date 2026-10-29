import { isBugFixed } from '@/shared/config/bugfixes'
import type { SeasonRecord, SeasonState } from '@/entities/season-mode/model/seasonRecord/types'
import {
  emptySeasonDayBoard,
  falses,
  FINAL_YEAR_INDEX,
  GAME_RECORD_SIZE,
  initialTeamAbilities,
  MORALE_LIMIT,
  NO_COACH,
  OUTING_SUB_ITEM_SIZE,
  SEASON_GAME_COUNT,
  STADIUM_EQUIPPED_SIZE,
  STADIUM_OWNED_SIZE,
  TEAM_ABILITY_LIMIT,
  TRAINING_SUB_ITEM_SIZE,
  zeros,
} from '@/entities/season-mode/model/seasonRecord/layout'

/**
 * 새 시즌 초기화 — 원본 0x5758 (상태 0xcc). P4 1c 절 그대로.
 *
 * ```
 * SR[1] = 고른 팀 · SR+0x187 = 0
 * SR+2 (소지금) = 50      ; 100만 단위 → 5000만 원
 * SR+0x48 (인기도) = 0
 * 팀레코드 +2 (팀 사기) = 100
 * 0xa305c(SR) 가 리그를 초기화하고 SR+0x78 = 현재 인기도
 * ```
 * 평판(+0x62)·연차(+0xb3)는 여기서 쓰지 않는다 — `0x204e0` 초기화 값(0)으로 남는다(유력).
 */
export function startNewSeason(teamId: number, name: string): SeasonState {
  return {
    record: {
      teamId,
      name,
      money: 50,
      acted: false,
      illness: 0,
      illnessSlack: 0,
      // 0x204e0(저장, 2, 1) 의 모드 2 자료 초기화 — 본 이벤트 비트도 비어 있다 (유력)
      seenEvents: [],
      lastMoraleChange: 0,
      popularity: 0,
      lastPopularityChange: 0,
      phase: 1,
      aimVisionGames: 0,
      storeGames: 0,
      tradeUsed: 0,
      // SR+0x185 — 코치 없음. 위 필드 주석 참고(원본이 −1 을 쓰는 자리는 문서에 없다)
      coach: NO_COACH,
      trainingSubItems: falses(TRAINING_SUB_ITEM_SIZE),
      outingSubItems: falses(OUTING_SUB_ITEM_SIZE),
      massager: false,
      reputation: 0,
      lastReputationGrade: 0,
      crowdLevel: 0,
      lastIncome: 0,
      // 0xa305c 가 리그를 초기화한 뒤 "지금 인기도" 를 떠 둔다 — 새 시즌은 인기도가 0 이다
      popularityAtSeasonStart: 0,
      regularSeasonFirsts: 0,
      illnessCooldown: 0,
      games: 0,
      yearIndex: 0,
      inPostseason: false,
      postseasonRound: -1,
      postseasonChampion: 0xf,
      nationalCup: false,
      nationalCupChampion: 0xf,
      gameRecord: zeros(GAME_RECORD_SIZE),
      // SR+0x187 = 0 (0x57c4)
      yearGoalShown: false,
      lastAttendance: 0,
      lastGameScore: 0,
      lastGameConceded: 0,
      dayBoard: emptySeasonDayBoard(),
      tradeRequestCount: 0,
      stadiumOwned: falses(STADIUM_OWNED_SIZE),
      stadiumEquipped: zeros(STADIUM_EQUIPPED_SIZE),
      // SR+0x1bc — 새 시즌은 `0x204e0` 초기화 값(0)으로 남는다
      endingSeen: false,
      // SR+0x7b — 새 시즌 레코드의 처음 값 0 (따로 쓰는 곳 없음)
      endingBonusReceived: false,
    },
    teamMorale: MORALE_LIMIT,
    teamAbilities: initialTeamAbilities(),
  }
}

/**
 * 새 해 — 원본 0x6e0c 의 "엔딩이 아닐 때" 갈래 (P4 1c).
 *
 * ```
 * phase = 1 ; 0xa305c(SR) (리그 초기화 + SR+0x78 = 인기도) ; 0x204e0(저장, 2, 0)
 * 연차 SR+0xb3 += 1 ; 팀 사기 = 100 ; SR+0x187 = 0 (올해의 목표 창 다시)
 * CPU 9팀 전부: 팀 능력치 4칸 각각 += 30, 999 상한   ← 해마다 CPU 가 강해진다
 * ```
 * 인기도·평판·소지금은 해를 넘겨 그대로 간다 (초기화 코드가 없다).
 *
 * 국가대항전 플래그(`nationalCup` = SR+0x12c)는 **여기서 내려간다.** 리그 초기화 `0xa305c` 가 부르는
 * `0xb7b34(L)` 가 L(= SR+0x80)을 통째로 지운다 (b7b34~b7b6a, 직접 떴다):
 * ```
 * memcpy(tmp, L, 0xf8)      ; 0x1400408
 * memset(L, 0, 0xf8)        ; 0x1400428 — SR+0x80 ~ SR+0x177, 곧 SR+0x12c(= L+0xac) 포함
 * L+0x33 = tmp+0x33         ; 연차(SR+0xb3)만 되살린다
 * L+0x37 = 0xf              ; 우승팀 미정
 * ```
 * ⚠️ S6 1절·DECISIONS 2026-09-20 은 "`+0x12c` 를 0 으로 쓰는 strb 가 없다" 는 전수 스캔으로 **리셋이 없다(원본 버그)**
 * 고 보았지만, 그 스캔은 memset 을 세지 않았다. 원본은 대회 끝(`0x896c` → `0x8b88: bl 0x6e0c`)에서 이 함수를 지나며
 * 플래그를 지우므로 **시즌이 막히지 않는다.** 그래서 웹도 여기서 내린다 — 지어낸 줄이 아니라 원본 memset 이다.
 *
 * ⚠️ **원본 버그 그대로 — 국가대항전을 치른 해는 사기가 100 으로 안 돌아간다** (r101 직접 뜸): 팀 사기 = 100 은 6ea0~6ea8
 * `ldr r2, [this+0xa4] ; strh 0x64, [r2, #2]` 로 **장면에 들어올 때 잡아 둔 팀 레코드 포인터**에 쓴다. this+0xa4 를 쓰는 곳은
 * 장면 진입 0xcb `0x4b50`(4b6a~4b7c `0x1f570(저장, SR[1])`) · 새 시즌 `0x5758`(57da~57e8) 둘뿐이고, 대회 중 경기 뒤 진입은
 * S+0x12c ≠ 0 이라 `0x1f570` 이 **상대국 슬롯 base+0x934** 를 돌려준다(1f5a0). 대회 끝 `0x896c → 0x8b88 bl 0x6e0c` 사이에
 * 다시 들어오는 진입이 없어 100 은 그 슬롯에 들어가고 리그 칸 사기는 지난해 값 그대로 이어진다. 곧 `record.nationalCup`(대회를 치른 해)
 * 이면 사기를 그대로 둔다. 같은 포인터를 읽는 CPU 트레이드 요청 0x93c8(94a0)은 그동안 **돌지 않는다**(확인, U-135 · r130 다시 뜸):
 * 0x93c8 은 0xf1 진입 0x953c(진입 분기 0xe9ac 의 ead0)에서만 돌고, 상태 0xf1 을 세우는 곳은 `movs r1, #0xf1` 전수로 0xe9 진입의
 * e10a 하나 · 0xe9 는 0x4b50 의 4ba6(phase 2) 하나다. 대회 중 경기 끝 0x4ea0c 는 4f02e~4f038 에서 L+0x34 · L+0xac 면 phase 2 를
 * 안 세우고, 새 해 뒤 첫 0xcb 진입 0x4b50 은 4b6a~4b7c 에서 [this+0xa4] 를 (L+0xac 가 지워진 뒤라) 리그 칸으로 다시 잡는다
 * — 상대국 명단을 보는 트레이드 요청은 없다 (`useSeasonSession` 0xf1 진입 주석).
 */
export function startNextYear(state: SeasonState): SeasonState {
  const { record } = state
  return {
    record: {
      ...record,
      phase: 1,
      yearIndex: record.yearIndex + 1,
      games: 0,
      inPostseason: false,
      postseasonRound: -1,
      postseasonChampion: 0xf,
      // L+0xac — 위 memset 이 지운다
      nationalCup: false,
      // SR+0x187 = 0 (6eaa~6eb2) — 새 해 첫 관리 메뉴에서 올해의 목표가 다시 뜬다
      yearGoalShown: false,
      acted: false,
      popularityAtSeasonStart: record.popularity,
      // SR+0x56 — 원본은 새 해에도 안 지운다(원본 버그 B-20: 트레이드가 시즌모드 내내 한 번). 고침(기본 켬): 해마다 한 번
      ...(isBugFixed('B-20') ? { tradeUsed: 0 } : {}),
    },
    // 6ea4 [this+0xa4]+2 = 100 — 대회를 치른 해는 그 포인터가 상대국 슬롯이라 리그 사기가 그대로 남는다(원본 버그 B-18).
    // 고침(`bugfixes.json` B-18, 기본 켬): 대회를 치른 해도 내 팀 사기를 100 으로. 굴림 없음
    teamMorale: record.nationalCup && !isBugFixed('B-18') ? state.teamMorale : MORALE_LIMIT,
    teamAbilities: state.teamAbilities.map((abilities, team) =>
      team === record.teamId ? abilities : abilities.map((value) => Math.min(value + 30, TEAM_ABILITY_LIMIT)),
    ),
  }
}

/** 10년차 엔딩 판정에 걸리는 해인가 (0xa3084: 연차 idx 가 9 가 아니면 −1) */
export function isFinalYear(record: SeasonRecord): boolean {
  return record.yearIndex === FINAL_YEAR_INDEX
}

/**
 * 이벤트 날짜 창이 쓰는 "지금" (A-2): `연차idx × 45 + 경기수 + 1`.
 * 1 = 첫 경기 전 · 3 = 2경기 뒤 · 21 = 20경기 뒤 (P4 2a).
 */
export function seasonDayOf(record: SeasonRecord): number {
  return record.yearIndex * SEASON_GAME_COUNT + record.games + 1
}
