import type { LeaguePlateAppearance, LeagueStolenBase, LeagueFieldingError } from '@/entities/league/model/leaguePlayerStats'
import type { BurstSession, BurstResolution } from '@/entities/burst-mission/model/burstMissionSession'
import type { BurstRewardDelta } from '@/entities/burst-mission/model/burstMissionReward'
import type { PendingDefensePlay, TeamGameLogEntry, TeamPitchingLine } from '@/features/play-team-game/model/teamGameFlow/types/records'

/**
 * `TeamGameProgress` 의 뒤쪽 칸 — 수비 진행 중 타구 · 투구 줄 · 리그 기록 · 돌발 · 로그.
 * 파일 줄 수(150) 때문에 떼어 낸 묶음일 뿐 `TeamGameProgress` 의 모양은 그대로다(r344).
 */
export interface TeamGameProgressLedger {
  /**
   * **지금 화면이 실시간으로 돌리고 있는 타구.** 차 있으면 이 경기는 "수비 진행 중" 이고,
   * 타석 결과(안타/아웃 코드)만 정해졌을 뿐 **진루·아웃·득점은 아직 하나도 안 먹였다**.
   *
   * 원본은 타구가 뜨면 경기 장면이 상태 0x17 로 넘어가 공이 멈출 때까지 같은 루프를 돌며
   * 매 갱신 눌린 키를 읽는다 (R10 · I 0절). 그 동안 다음 투구는 나가지 않는다 —
   * 웹도 이 칸이 차 있는 동안 `isHumanTurn` 이 거짓이 되어 다음 타석을 시작하지 않는다.
   *
   * 화면이 다 돌고 나면 `resolveDefensePlay` 가 그 결과를 먹이고 이 칸을 비운다.
   * 미리 다 계산해도 되는 자리(자동 소화·테스트)는 `applyBatterOutcome`·`throwPitch` 를 부르면
   * 이 칸을 거쳐 가되 한 번에 비워져 나온다 — 밖에서 보면 예전과 똑같다.
   */
  readonly pendingDefensePlay: PendingDefensePlay | null
  readonly pitching: TeamPitchingLine
  /** 우리 팀 타선이 친 안타 수 (간단 박스스코어) */
  readonly ourHits: number
  /** 리그 선수 기록표에 넘길 타석 결과 — **양 팀 전부** (원본 0xa8024 가 사람 경기도 같게 쌓는다) */
  readonly leaguePlateAppearances: readonly LeaguePlateAppearance[]
  /** 리그 기록표 +0x2c 에 넘길 도루 (`withLeagueStolenBases`). 없으면 빈 것 */
  readonly leagueStolenBases?: readonly LeagueStolenBase[]
  /**
   * 리그 기록표 +0x2e 에 넘길 실책 — 수비 그림 0x43278 이 펌블 6 · 악송구 4 를 본 야수마다(`recordDrawnTeamFieldingErrors`). 양 팀.
   * 없으면 빈 것
   */
  readonly leagueErrors?: readonly LeagueFieldingError[]
  /** 이번 경기의 돌발미션 (경기 장면이 모드 2·3·4 에서만 만든다 — 팀 경기에서는 **시즌만**) */
  readonly burst: BurstSession | null
  readonly lastBurstResolution: BurstResolution | null
  /** 이 경기에서 난 돌발 판정의 보상·페널티 — `resolveBurst` 의 `deltas` 를 판정 차례대로 이어 붙인다 */
  readonly burstRewardDeltas: readonly BurstRewardDelta[]
  readonly log: readonly TeamGameLogEntry[]
  readonly nextLogId: number
}
