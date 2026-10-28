import type { GameState } from '@/entities/game/model/gameState'
import type { ControlSide } from '@/entities/defense-controls/model/defenseKeys'
import type { DefensePlayInput } from '@/features/defense-play/model/runDefensePlay'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'

export interface TeamGameLogEntry {
  readonly id: number
  readonly text: string
  /** 사람이 잡은 타석인지 — 화면에서 강조한다 */
  readonly isMine: boolean
}

/** 우리 팀 투수가 이 경기에 내준 것 — 완투·노히트·퍼펙트 판정이 보는 `state+0x88·0x89·0x8a` */
export interface TeamPitchingLine {
  readonly outsRecorded: number
  readonly hitsAllowed: number
  /** 볼넷 + 사구 — 투수 +0x2a 와 같은 셈 (0xa8b58 · 0xa8bd2) */
  readonly walksAllowed: number
  readonly runsAllowed: number
  /**
   * `state+0x88` 출루 허용 — 정산 `0xa8024` 의 `0xa8c5c~0xa8ca6` 이 **주자 목록의 마지막 원소** `+0x96 == 0` 이고
   * 수비 팀이 사람이면 1 로 세운다(지우는 곳 없음). `movs r5,#0` 가 루프 안이라 마지막 원소 하나만 본다 —
   * 야수선택(타자주자 살고 앞 주자 아웃)은 안 깨고, 에러로 산 타자주자는 깬다 (CORRECTIONS 2-1, S5 U-13 1 확정).
   * 웹은 주자 운명 목록(`runnerFates`, 90c7864)을 `baserunnerAllowedOfFates` 로 읽는다 (`baserunnerAllowedOfPlay`).
   */
  readonly allowedBaserunner: boolean
}

/**
 * 기록달성 판정이 보는 원본 칸 (R8 4절 표·5절·6절).
 */
export interface TeamRecordTally {
  /** `ctx+0x162` — 사람 팀 연속 홈런 수 (백투백 6·7). 홈런 아닌 타석·상대 타석이면 0 (0xa794c · 5-4) */
  readonly homeRunStreak: number
  /** `ctx+0x15f` — 이 타석 연속 파울 (32·33). 파울 아닌 공(0xa5fdc, 유력)·타석 초기화(0xa5bcc)에서 0 */
  readonly foulStreak: number
  /** `ctx+0x161` — 이 타석 투구 수 (16 삼구 삼진). 타석 초기화 0xa5bcc 에서 0 — 교체 연출 뒤 타석은 이어받는다 */
  readonly atBatPitches: number
  /** `ctx+0x16c` — 이 반 이닝 투구 수 (25 삼구 삼자범퇴). 반 이닝 시작 0xa5b00 에서 0 — 반 이닝 열쇠로 가른다 */
  readonly halfInningPitches: { readonly inning: number; readonly half: GameState['half']; readonly pitches: number }
  /** 우리 **현재** 투수 경기 기록 `R = team+0x244+4·team[0]` 의 R[0] 삼진 · R[1] 연속 삼진 · R[3] 잡은 아웃 */
  readonly moundStrikeouts: number
  readonly moundStrikeoutCombo: number
  readonly moundOuts: number
  /** `state[0x8c]` — 이 경기에서 사람이 투구 코스를 한 번이라도 확정했는가 (유일한 1 쓰기 0x50e9c) */
  readonly pitchCourseConfirmed: boolean
  // 0xa77f0 첫 게이트(a77f2)가 보는 `[ctx+0x24]` 첫 바이트는 팀 경기에서 늘 0 이라 칸을 두지 않는다 — 1 을 쓰는 곳은
  // 0xc1b48 하나이고 부르는 곳(0x52c62 "그만 던지시겠습니까?" 0x1b · 0x507f8 감독 강판 0x23)이 모두 투수편 강판 길이다.
  // 30G 자동진행 0x3c8da 는 시뮬 초기화 0xc0dac 로 오히려 0 을 쓰고 표시는 engine+0xa0 에 둔다 (R15 10-2·10-3 확정).
}

export const EMPTY_RECORD_TALLY: TeamRecordTally = {
  homeRunStreak: 0,
  foulStreak: 0,
  atBatPitches: 0,
  halfInningPitches: { inning: 1, half: '초', pitches: 0 },
  moundStrikeouts: 0,
  moundStrikeoutCombo: 0,
  moundOuts: 0,
  pitchCourseConfirmed: false,
}

/**
 * 화면이 실시간으로 돌리는 한 타구 — 진행기에 넘길 것과, 그것이 끝난 뒤 어느 길로 먹일지.
 *
 * `side` 는 **사람이 어느 쪽을 잡는가** 다 — 조작 객체 `[+0xc]` (0 공격 · 1 수비).
 * 원본은 상태 0x17 갈래 `0x53420` 에서 **공격이면 주루 `0x5331c`**(진루 0x582 · 귀루 0x584 ·
 * OK → 슬라이딩 0x585), **수비면 송구 `0x533c8`**(0x588, 목표 루)로 가른다 (I 0절 표).
 * 팀 경기는 공수를 모두 사람이 맡으니 이 칸도 타석마다 갈린다 — 나만의리그 타자편처럼 고정이 아니다.
 */
export interface PendingDefensePlay {
  /** 사람이 잡은 쪽 — 우리 공격 타석이면 '공격'(주루), 사람이 던진 타석이면 '수비'(송구) */
  readonly side: ControlSide
  /** 진행기에 그대로 넘기는 한 타구 (`startDefensePlay`/`stepDefensePlay` 가 받는다) */
  readonly input: DefensePlayInput
  /** 이 타구를 낸 타석 결과 — 다 돌린 뒤 경기 상태에 먹일 때 쓴다 */
  readonly outcome: AtBatOutcome
}

export const EMPTY_PITCHING_LINE: TeamPitchingLine = {
  outsRecorded: 0,
  hitsAllowed: 0,
  walksAllowed: 0,
  runsAllowed: 0,
  allowedBaserunner: false,
}
