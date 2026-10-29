import type { PitcherRole } from '@/entities/pitcher-career/model/pitcherRole'
import { PITCHER_DECISION_CODE } from '@/entities/game/model/winLossSave'

/** 경기 뒤 평가가 읽는 투수 기록 (평가 객체 R 의 칸들) */
export interface PitcherEvaluationRecord {
  /** R+0x12c — 피안타 */
  readonly hitsAllowed: number
  /** R+0x134 — 탈삼진 */
  readonly strikeouts: number
  /** R+0x13c — 잡은 아웃 수 (÷3 = 이닝) */
  readonly outsRecorded: number
  /** R+0x144 — 볼넷 */
  readonly walksAllowed: number
  /** R+0x148 — 사구 */
  readonly hitByPitch: number
  /** R+0x14c — 이어지고 있는 연속 탈삼진 */
  readonly strikeoutCombo: number
  /** R+0x150 — 등판 순간 팀이 앞서고 있었나(세이브 기회) */
  readonly leadingAtEntry: boolean
  /** R+0x154 — 삼자범퇴 이닝 수 */
  readonly perfectInnings: number
  /** R+0x124 — 1 승 · 2 패 · 3 세이브 · 0 없음 */
  readonly decisionCode: number
  /**
   * R+0x128 — 내 투수에게 매겨진 실점 (득점 주자를 내보낸 투수가 나일 때 주자마다 +1).
   *
   * 정산 0xa8024 의 주자 루프가 **사건 함수 0xa57f8 을 거치지 않고 직접** 올린다 (0xa8f56, 9d039b6):
   * 주자+0x95(득점)가 선 주자마다 P = 0xb8c44(수비 팀, 주자+0x30), `0xb6388(P)`(육성·명전 비트7) &&
   * `0xa56dc(R, P, 0)` 이면 `R+0x128 += 1`. 세는 쪽은 `pitcherGameFlow.applyDefensivePlay` 의 `chargedToMe`.
   * (P1 5-1 의 "채우는 코드가 없어 늘 0(유력)" 은 틀렸다 — 그래서 완투가 늘 완봉이 되는 일도 없다.)
   *
   * 평가가 이 칸을 읽는 곳 (전수, 상수 0x128 을 만드는 자리):
   * - 인기도 0xa690c: 퍼펙트 0xa6b2c · 노히트 0xa6b7c · 완봉/완투 0xa6bd8 · 선발 실점 항 0xa6c92(음수 비교) ·
   *   구원 실점 항 0xa6d1c·0xa6dd6 (`> 4 → −4 · > 3 → −2 · > 0 → −1`)
   * - 평판 0xa6218: 선발 0xa651c (`> 5 → −5`, `4·5 → −3`) · 구원 0xa65d6 (`== 0 → +1`) · 0xa663c (`2·3 → −3`, `> 3 → −5`)
   * - 0xa726c (0xa719c 모드 3): career+0x1d8 묶음 +2 바이트에 그대로 적는다 (이 파일 밖)
   */
  readonly runsAllowedField: number
}

export const EMPTY_PITCHER_EVALUATION_RECORD: PitcherEvaluationRecord = {
  hitsAllowed: 0,
  strikeouts: 0,
  outsRecorded: 0,
  walksAllowed: 0,
  hitByPitch: 0,
  strikeoutCombo: 0,
  leadingAtEntry: false,
  perfectInnings: 0,
  decisionCode: PITCHER_DECISION_CODE.none,
  runsAllowedField: 0,
}

export interface PitcherEvaluationContext {
  /** 포지션 코드 `rec[+0xa] & 0x1f` — 인기도·감독 글이 **≤3 이면 선발형**으로 가른다 */
  readonly positionCode: number
  /** 보직 `rec[+0xb] & 3` — 평판·사기가 본다 */
  readonly role: PitcherRole
  /** 우리 팀이 이겼는가 (0xb69b0 로 읽은 점수 비교) */
  readonly won: boolean
  /** 치른 이닝 `state+0x6b` (0-기준) — 완투 판정 `아웃 == 3·이닝 + 3` 에 쓴다 */
  readonly endedInningIndex: number
  /** state+0x88 출루 허용(정산이 읽는 주자 목록 마지막 원소가 살았던 적이 있는가) — 완투 계열 판정용 */
  readonly teamBaserunnerAllowed: boolean
  /** state+0x89 피안타 · +0x8a 실점 (완투 계열 판정용) */
  readonly teamHitsAllowed: number
  readonly teamRunsAllowed: number
  /** 구원이 등판조차 못 했는가 — 원본 `state[0x6a] == state[0x6b]` (P1 5-3·5-5) */
  readonly neverEntered: boolean
  /** 평판 `career+0x62` (0~999) — 평판 꼬리 표와 감독 글 구간이 본다 */
  readonly reputation: number
  /** 라이벌전인가 — 사기 변화가 두 배가 된다 */
  readonly isRivalGame?: boolean
  /** 행운 스킬(0xa4b.., 6)을 가졌는가 — 사기 +1 */
  readonly hasLuckSkill?: boolean
}

/** 완투 계열 갈래 — 인기도·평판이 각각 다른 점수를 준다 */
export type CompleteGameKind = '퍼펙트' | '노히트' | '완봉' | '완투' | '없음'

export interface ReputationParts {
  /** 가점 합 r */
  readonly gain: number
  /** 감점 합 pen (음수) */
  readonly penalty: number
}

export interface PitcherGameEvaluation {
  /** `career+0x4a` 에 적히는 이번 경기 인기도 변화 p */
  readonly popularityChange: number
  /** `career+0x64` 에 적히는 평판 변화 Δ */
  readonly reputationChange: number
  /** 사기 변화 */
  readonly moraleChange: number
  /** StrUSER_EVT 번호 */
  readonly managerCommentIndex: number
  readonly completeGame: CompleteGameKind
  /**
   * 선수 카운터 +0x1e0/+0x1f0 에 세는 완투 계열 — 0xa690c 선발형 **승리** 갈래(0xa6b02~0xa6c1e)에서만 올린다
   * (퍼펙트 [0] · 노히트 [1] · 완봉 [2] · 완투 [3]). 구원형이나 진 경기는 '없음'.
   */
  readonly countedCompleteGame: CompleteGameKind
}
