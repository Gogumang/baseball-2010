import type { BaseState } from '@/entities/game/model/baseState'
import type { BaseRunners } from '@/entities/game/model/baseRunners'
import type { QuickLineup } from '@/entities/game/model/quickLineup'
import type { AtBatOutcome } from '@/entities/game/model/simulateHalfInning/otherSlices'
import type { HalfInningMound, HalfInningPitcherChange, HalfInningPitcherLine } from '@/entities/game/model/simulateHalfInning/types/defense'

/**
 * 타석 하나의 결과 — 어느 타순이 무엇을 쳤고 그 플레이로 몇 점이 들어왔는가.
 *
 * 원본은 간이 엔진이 끝낸 타석도 사람 경기와 **같은 기록 함수 0xa8024** 로 흘려보내
 * 선수 레코드에 타수·안타·홈런·타점을 쌓는다 (B-season-awards.md B-2). 웹은 그 결과를
 * 여기까지만 내보내고, 누구의 레코드에 넣을지는 부르는 쪽(`leagueDay`·`gameFlow`)이 정한다.
 */
export interface HalfInningPlateAppearance {
  /** `batterAt` 에 넘긴 타순 커서 그대로 — 로스터 칸은 부르는 쪽이 나머지로 구한다 */
  readonly battingOrderIndex: number
  readonly outcome: AtBatOutcome
  /** 이 플레이로 실제로 들어온 점수 (+0x2a 타점). 3아웃으로 지워진 득점은 빠진다 */
  readonly runsBattedIn: number
  /**
   * 실제로 타석에 선 선수의 로스터 칸 (`offense` 를 넘겼을 때만). 대타가 들어오면 타순 칸과
   * 로스터 칸이 갈린다 — 선수 기록은 이 칸에 쌓아야 한다.
   */
  readonly rosterSlot?: number
  /**
   * 이 타석 동안 마운드에 선 수비 투수 칸 (`defense` 를 넘겼을 때만). 득점 처리 `0xa5c34` 는 한 점마다
   * **그 순간 마운드 투수**를 승·패 투수로 적는다 (S1 2·3절) — 부르는 쪽이 그 판정을 돌릴 재료다.
   */
  readonly pitcherSlot?: number
  /**
   * 이 타석 앞에서 **0xc1ba4 가 교체를 내 0xc262c 가 공 없이 돌아간 횟수**(c266c) — 자동진행 0x21 은 틱마다 0xc262c 를 한 번 부르므로
   * 그만큼 틱이 더 든다(중계 글 없음, sim+0xc4 = 0). 0 이면 안 적는다.
   */
  readonly substitutionCalls?: number
  /** 이 타석에 파울이 났나 (`QuickAtBatPlay.fouled`) — 0x21 중계 글 코드가 본다 */
  readonly fouled?: true
  /**
   * 헛스윙 세 번째 스트라이크 겨루기에서 진 아웃(`QuickAtBatPlay.swingingStrikeOutLost`) — 결과는 '아웃' 이지만
   * 0x21 중계 글 코드는 5 "삼진 아웃" 이다(c17d8)
   */
  readonly swingingStrikeOutLost?: true
}

/**
 * 간이 엔진 도루로 한 루 간 주자 하나 (0xc1818 끝 0xc1a42~0xc1aba) — 원본은 주자마다 `0xb8b99(공격팀, 주자)` 의 레코드
 * +0x2c 를 +1 한다(0xa56dc 가 참일 때). 누구의 레코드에 넣을지는 부르는 쪽이 `HalfInningPlateAppearance` 처럼 정한다.
 * 주자 신원은 원본 주자 목록 sim+0x80 대로다 — `playQuickPlateAppearance` 가 루마다 든 주자(`BaseRunners`)에서 옮긴 주자를
 * 목록 차례(0번 = 가장 뒤 주자)로 낸다(`stolenRunners`, c1a42). 예전 근사(루 b = 커서 − b)는 걷혔다(`baseRunners.ts` 머리).
 */
export interface HalfInningStolenBase {
  readonly battingOrderIndex: number
  /** 그 타순 칸에 앉은 선수의 로스터 칸 (`offense` 를 넘겼을 때만) */
  readonly rosterSlot?: number
}

/** 이 이닝에 들어온 CPU 대타 한 번 (0xac228) */
export interface HalfInningPinchHit {
  readonly battingOrderIndex: number
  readonly outgoingRosterSlot: number
  readonly incomingRosterSlot: number
}

export interface HalfInningResult {
  readonly runs: number
  /** 다음 이닝이 이어받을 타순 */
  readonly nextBattingOrderIndex: number
  /** 이 이닝에 나온 타석 결과 (0xa8024 가 선수 레코드에 쌓는 재료) */
  readonly plateAppearances: readonly HalfInningPlateAppearance[]
  /** 이 이닝에 맞은 안타 수 — 완투 계열 기록(0xa7de8)이 state+0x89 로 센다 */
  readonly hits: number
  /** 이 이닝에 내준 볼넷 수 — state+0x88 (투구 판정 0xc1818 에서 나온다) */
  readonly walks: number
  /** 이 이닝에 잡은 아웃 수 — 보통 3 이다. 경기 끝 판정(`hooks.endsGame`)으로 멈춘 반 이닝은 3 보다 적을 수 있다 */
  readonly outs: number
  /** 이 이닝에 잡은 삼진 수 */
  readonly strikeouts: number
  /** 이 이닝에 던진 공 수 — 삼구 삼자범퇴(25) 판정에 쓴다 */
  readonly pitches: number
  /** 이 이닝에 달성한 삼진 계열 기록 id */
  readonly recordIds: readonly number[]
  /** 이닝이 끝났을 때 이어지고 있는 연속 삼진 수 — 다음 이닝이 이어받는다 */
  readonly strikeoutCombo: number
  /** 이 이닝에 허용한 도루 수 (0xc1818, E-5) — 원본은 주자마다 도루 기록 +1 을 준다 */
  readonly steals: number
  /** 도루로 한 루 간 주자들 — 일어난 차례대로 (`steals` 와 같은 수) */
  readonly stolenBases: readonly HalfInningStolenBase[]
  /**
   * 이 이닝에 던진 투수마다 한 줄 (`defense` 를 넘겼을 때만 채운다).
   * 교체가 없으면 한 줄이고, 교체가 있으면 던진 순서대로 여러 줄이다.
   */
  readonly pitcherLines: readonly HalfInningPitcherLine[]
  /** 이닝이 끝났을 때의 마운드 — 다음 이닝에 그대로 넘긴다 (`defense` 를 넘겼을 때만) */
  readonly mound?: HalfInningMound
  /**
   * 이 이닝에 난 투수 교체 — 일어난 차례대로 (`defense` 를 넘겼을 때만 찬다).
   * 원본 간이 엔진은 교체 자리(0xc26a2)에서 세이브 후보 `0xa60c0` 을 부른다 — 그 판정이 보는
   * 그 순간의 아웃·주자 수·이 이닝 실점을 남긴다 (S1 4절).
   */
  readonly pitcherChanges?: readonly HalfInningPitcherChange[]
  /** 이닝이 끝났을 때의 공격 팀 명단 (`offense` 를 넘겼을 때만) — 다음 공격에 그대로 넘긴다 */
  readonly lineup?: QuickLineup
  /**
   * `state[0xe]` — CPU 대타 막음 칸 (`offense` 를 넘겼을 때만). 양 팀 공용 한 칸이고 **공마다 내려간다**
   * (`0xa5e14` a5e7c) — 반 이닝이 끝나면 늘 거짓이다(마지막 타석도 공을 던졌으므로).
   */
  readonly pinchHitUsed?: boolean
  /** 이 이닝에 들어온 CPU 대타 */
  readonly pinchHits: readonly HalfInningPinchHit[]
  /** 경기 끝 판정 0xb68fc(`hooks.endsGame`)이 참을 낸 타석에서 멈췄다 — 경기가 끝났다 */
  readonly gameEnded?: boolean
  /** `hooks.stopsBefore` 가 참이라 그 타석을 열기 전에 멈췄다 — 반 이닝이 아직 이어진다 */
  readonly stoppedBeforeBatter?: boolean
  /** 멈춘 자리(또는 3아웃)의 루 */
  readonly bases?: BaseState
  /** 그 루에 선 주자의 신원 — 반 이닝 타순 커서(`battingOrderIndex` 와 같은 셈, 원본 주자 목록 sim+0x80) */
  readonly runners?: BaseRunners
  /**
   * 이 반 이닝에서 0xb570c 가 **공격 팀 레코드 +2** 를 한 번이라도 덮었는가 (나리 b5768, `QuickPlateAppearance.touchesOffenseRecord`).
   * 간이 엔진은 수비 팀은 공마다(c1446 · c1852) 덮지만 공격 팀은 스윙 경로 0xab214(ab4c0~ab4d8) · 주자가 있는 판정 경로(c19ec)에서만
   * 덮는다 — 투구 판정 경로만으로 끝난 주자 없는 반 이닝(삼진 셋)이면 거짓이다. CPU 대타 0xac228 은 0xb570c 를 안 부른다 (r104 직접 뜸)
   */
  readonly offenseRecordTouched: boolean
}
