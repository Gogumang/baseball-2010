import type { MissionAcePitcher, MissionCpuPitching } from '@/entities/mission/model/missionCpuTeam'
import type { MissionAutoRelay } from '@/entities/mission/model/missionAutoRelay'
import type { MissionInningRuns } from '@/entities/mission/model/missionScoreboard'
import type { BaseRunners, BaseState, QuickLineup } from '@/entities/mission/model/missionGame/otherSlices'

/**
 * **미션 경기의 이닝 · 공수 · 점수** — 미션도 모드 5·6 짜리 보통 경기(장면 0x104)라 3아웃이면 공수가 바뀌고 이닝이 넘어간다
 * (직접 재역어셈 — 0x50c94 · 0x3ac90 · 0xb6b6c · 0x4f928 · 0xc2198 · 0xc1e04 · 0x48480 · 0xaaa6c · 0xaae7c · 0x48d50 · 0xb68fc).
 *
 * ```
 * 3아웃      메시지 3 → 0x18 진입 0x3ac90: 0xb68fc(경기 끝) 거짓이면 0xb6b6c — st[9] ↔ st[0xa], 말이 끝났으면 st[0x6b](이닝)++,
 *            주자 지움 0xa9250 · 0xa5b00. (0xaae7c 는 이때 시작 상황을 다시 깔지 않는다 — 아래)
 * 0x18 갱신  0x4f928 틱 0: 0xaebe4 두 팀 → 0xc2198(sim, 1) 참이면 상태 0x21(자동진행)
 * 0xc2198    c21d6 0xb68fc 참이면 0 (자동 끝) · 3아웃이면 0xb6b6c 뒤 모드 5·6 은 c2248 미션 판정 0xaaa6c ·
 *            그리고 0xc1e04(모드 − 1 점프표 0xd90c0): 모드 5 c1e3e · 6 c1e6a — [ctx+0xa8] ≠ 0(모든 미션)이면 `!0xc1d38` =
 *            모드 5: 수비 투수가 육성(0xb6389)·명예(0xb6349) 선수가 아니면 자동 · 모드 6: 공격 타자가 그렇지 않으면 자동
 * 0x21       0x48480 틱마다 0xc2198 참이면 간이 타석 0xc262c 하나, 거짓이면 0x18 (이전 0x21 이라 +0x1784 = 1 → 판 없이 곧장 0xd)
 * ```
 * 그래서 **사람 선수가 안 나서는 반 이닝은 간이 엔진이 돈다** — 투수 미션은 사람 칸 팀이 치는 반 이닝 통째로,
 * 타자 미션은 CPU 가 치는 반 이닝과 사람 칸 팀 타선이 미션 타자 차례에 닿기 전까지. 경기 끝(0xb68fc, 9회 · 콜드)이 나면 0x19 로 간다.
 * 미션 판정 0xaaa6c 는 aad20 에서 경기 끝이고 아직 진행(1)이면 실패(2)로 — 자동진행 중 경기가 끝나면 판정이 안 돌아(c21d6 가 먼저)
 * 미션 객체 +0xbc 가 안 서 결과도 실패다.
 *
 * 시작 상황(레코드 +4 · +5)은 0xd 메시지 0xaae7c 의 aaf10 갈래가 **이전 상태 0x18 이고 st[0x6b] == 시작 이닝(+3 아래 4비트)** 일 때만
 * 깐다 — 경기 처음(0x48658 48c8c 의 aae7c(…, 0xd, 0x18, 0/1))뿐이다. 3아웃 뒤 다음 사람 반 이닝은 늘 다른 이닝이라(사람이 안 치는 반
 * 이닝이 하나는 끼고, 그 사이 말이 끝나 이닝이 오른다) 빈 루 · 0아웃 · 0-0 에서 이어진다.
 */
export interface MissionGame {
  /** `st[0x6b]` — 0부터 센 이닝 (0xaa57c 가 레코드 +3 아래 4비트로) */
  readonly inning: number
  /** `st[9]` — 지금 공격 측 (0 초 · 1 말) */
  readonly offenseSide: 0 | 1
  /** `st[0x7e]` · `st[0x7f]` — 측 0 · 측 1 점수 (0xb69b0) */
  readonly scores: readonly [number, number]
  /** `st[0x6c..]` — 측마다 이닝별 점수 아홉 칸 (0xb6989 — 점수판 0x41c18 이 읽는다, `missionScoreboard`) */
  readonly inningRuns: MissionInningRuns
  /** 미션 객체 `+0x24` — 0xaae7c 마선수 다시 끼우기가 마지막으로 본 이닝 (0xaa57c aa8b6 이 −1) */
  readonly aceCheckedInning: number
  /** 사람 칸 팀의 타선 — 투수 미션의 자동진행 반 이닝이 친다 (레코드 +7 윗 4비트 타순) */
  readonly humanBatting: MissionTeamBatting
  /**
   * **타자 미션의 미션 타자 레코드 칸 k** = P+0xa & 0x1f (`humanRecordsOf` 의 k) — 0xb53f0 이 P 를 [k] 에 넣고 0xb8768 이 그 첨자로
   * 다시 매긴 뒤, aa7e8 0xb8cb8 → 0xb5e98 맞바꿈은 0x30 바이트를 통째 옮겨 +0xa 를 안 고친다. 그래서 시작 타순 칸에 선 P 의
   * 0xb6394 는 여전히 k 다 (투수 스킬 31 이 본다). 투수 미션은 없다
   */
  readonly humanRecordSlot?: number
  /** 투수 미션의 CPU 수비 — 사람 칸 팀이 치는 자동진행 반 이닝에 던진다 (선발 = 레코드 +6 아래 4비트, 0xb8c94) */
  readonly cpuAutoPitching: MissionCpuPitching | null
  /** 타자 미션의 CPU 타선 — CPU 가 치는 자동진행 반 이닝 (타순 = 레코드 +7 아래 4비트) */
  readonly cpuAutoBatting: MissionTeamBatting | null
  /** 타자 미션의 사람 칸 팀 투수진 — CPU 가 치는 자동진행 반 이닝에 던진다 (명부 차례 그대로 — 0xaa57c 는 모드 6 에서 안 바꾼다) */
  readonly humanPitching: MissionCpuPitching | null
  /** 사람이 맡은 반 이닝이 3아웃으로 끝나 0x18 · 자동진행을 기다린다 (부르는 쪽이 난수로 `runMissionAutoHalves` 류를 돌린다) */
  readonly halfEnded: boolean
  /**
   * 마지막 자동진행(0x18 → 0x21 → 0x18)의 중계 틱 — 사람 반 이닝이 3아웃으로 끝날 때마다 새로 쌓는다(`withMissionAutoRelay`).
   * 화면이 `serial` 이 바뀔 때마다 한 번 튼다(틱마다 한 칸). 아직 안 돌았으면 null.
   */
  readonly autoRelay: MissionAutoRelay | null
}

export interface MissionTeamBatting {
  readonly teamId: number
  /** `team+0xe` 명단 — 칸마다 레코드 번호 */
  readonly lineup: QuickLineup
  /** 레코드 칸마다 든 선수 — 마스터 줄(팀 안 0~11) 또는 미션 타자(`MISSION_NARI_RECORD`) */
  readonly records: readonly number[]
  /** `team+0x32` */
  readonly order: number
}

/**
 * 타자 미션의 **미션 타자** 레코드 표지 — 0xaa57c aa7b0(모드 6)이 `0xb87cc(사람 칸 팀)`으로 미션 타자(선수 게터 0x1fc20 — 나리 타자편
 * 저장 선수 또는 명예 타자)를 명부에 넣고 `0xb8cb8(팀, 레코드 +7 윗 4비트, k)` 로 시작 타순 레코드와 맞바꾼다 (`humanRecordsOf`).
 */
export const MISSION_NARI_RECORD = -2

/**
 * **미션 타자가 처음 드는 레코드 k** 를 모를 때 쓰는 값 — 명부 끝(레코드 12). 그 자리면 0xb53f0 의 "옛 k 를 끝으로" 가 빈 칸을 옮겨
 * 예전 근사(레코드 12 에 넣고 시작 타순 ↔ 12)와 같아진다. ⚠️ 원본은 k = 선수 +0xa & 0x1f 다 — 부르는 쪽이 알면 넘긴다.
 */
export const MISSION_NARI_RECORD_FALLBACK = 12

/** 타순 아홉 칸 — 0x42364 의 0xae914 가 (팀[+0x32] + i) mod 9 */
export const LINEUP_SLOTS = 9

/** 마스터 팀 타자 12 줄 */
export const BATTERS_PER_TEAM = 12
/** 마스터 팀 투수 8 줄 */
export const PITCHERS_PER_TEAM = 8

/** 자동진행 반 이닝 하나의 끝 */
export interface MissionAutoHalf {
  readonly batting: MissionTeamBatting
  readonly pitching: MissionCpuPitching
  /** 이 반 이닝(멈춘 자리까지)의 득점 */
  readonly runs: number
  readonly outs: number
  readonly bases: BaseState
  /** 그 루에 선 주자의 신원 — 공격 타선의 타순 칸(0~8). 간이 엔진 주자 목록 그대로 (`simulateHalfInningTicks`) */
  readonly runners: BaseRunners
  /** c21d6 — 경기 끝(끝내기 · 콜드 · 9회 3아웃) */
  readonly gameEnded: boolean
  /** 미션 타자 차례라 멈췄다 (타자 미션의 사람 칸 팀 공격만) */
  readonly stoppedBeforeNari: boolean
}

/** 자동진행 반 이닝의 수비 재료 갈래 — 마투수 칸의 레코드 · 0x66864 교체 막음 (`missionPitchingDefenseOf`) */
export interface MissionAutoDefenseOptions {
  readonly ace?: MissionAcePitcher
  readonly pitcherChangeBlocked?: boolean
}
