import type { OriginalMission } from '@/shared/config/original/missions'
import type { MissionProgress } from '@/entities/mission/model/missionGoal'

/**
 * **0x36358 이 줄 글로 고르는 목표** — 모드 6 표 0xcfdc4(글 12개)와 `strcmp`(0x14003b8) 해 **똑같은** 줄을 찾고
 * 점프표 0xcfe18 로 (지금, 목표)를 꺼낸다. 아무것과도 안 같으면 첫 칸("안타")이다(r7 = 0 으로 시작).
 * 행 = 0xa5485(M, k) — 목표 칸(레코드 +0xa0..), B = R+0xb4.
 * ```
 * 0 안타          (B 네 칸 합 0x363d4 , 행[6])
 * 1 2루타         (B+4 = R+0xb8      , 행[0] 위)
 * 2 3루타         (B+8 = R+0xbc      , 행[0] 아래)
 * 3 홈런          (B+0xc = R+0xc0    , 행[3] 아래)
 * 4 만루홈런      (B+0x14 = R+0xc8   , 행[2] 위)
 * 5 런닝홈런      (B+0x18 = R+0xcc   , 행[2] 아래)
 * 6 타점          (B+0x50 = R+0x104  , 행[5])
 * 7 번트          (B+0x40 = R+0xf4   , 행[4] 위)
 * 8 도루          (B+0x58 = R+0x10c  , 행[4] 아래)
 * 9 그라운드홈런  (0, 1)   ; 0x3644c — 칸을 안 읽는다. 원본 레코드의 글은 "그라운드홈런" 이라 늘 0/1 (원본 그대로)
 * 10 승리         (0, 1)
 * 11 사이클링히트 (0, 1)
 * ```
 * 그 뒤 0x3667a: 지금 > 목표면 지금 = 목표.
 * 웹 진행 칸(`MissionProgress.counts`)은 같은 정산 칸을 이름으로 든다(`goalNamesFor` — '안타' 는 홈런까지 센 합, '번트' 는 번트 안타).
 * 런닝홈런 칸 R+0xcc 는 웹 '그라운드홈런' 이 든다.
 */
const GOAL_KEYWORDS = [
  '안타',
  '2루타',
  '3루타',
  '홈런',
  '만루홈런',
  '런닝홈런',
  '타점',
  '번트',
  '도루',
  '그라운드홈런',
  '승리',
  '사이클링히트',
] as const

/** 줄 글 → 웹 진행 칸 이름 (null = 칸을 안 읽고 0/1) */
const COUNT_KEY_OF: Readonly<Record<(typeof GOAL_KEYWORDS)[number], string | null>> = {
  안타: '안타',
  '2루타': '2루타',
  '3루타': '3루타',
  홈런: '홈런',
  만루홈런: '만루홈런',
  런닝홈런: '그라운드홈런',
  타점: '타점',
  번트: '번트',
  도루: '도루',
  그라운드홈런: null,
  승리: null,
  사이클링히트: null,
}

/**
 * **모드 5 의 줄 맞대기** — 0x36466~0x36522: 이름표 0xcfdf4(9 개)를 0x14003b8(strcmp)로 맞대 칸 번호 i 를 고르고 점프표 0xcfe48[i] 로
 * (목표 = 행 목표 칸 0xa54b5 의 니블, 지금 = 투수 칸 P = R+0x124 의 값)을 고른다. 맞는 이름이 없으면 i 는 0 그대로다(36492~364ae).
 * ```
 * 0 탈삼진     목표 행+0xa0 윗 4비트 · 지금 P+0x10        1 삼진콤보   아랫 4비트 · P+0x28
 * 2 MAX게이지  행+0xa1 윗 4비트 · P+0x34                  3 무실점 · 4 노히트노런 · 5 퍼펙트게임 → (0, 1)
 * 6 실점       행+0xa1 아랫 4비트 · P+4                    7 아웃       행+0xa4 바이트 · P+0x18
 * 8 피안타     36524 로 곧장 — 첫 값 (0, 0) 그대로
 * ```
 * 웹 진행 칸(`MissionProgress.counts`)은 같은 이름으로 탈삼진 · 삼진콤보 · MAX게이지 · 아웃을 든다. 실점은 허용 실점(`allowed.runs`).
 */
const PITCHER_GOAL_KEYWORDS = ['탈삼진', '삼진콤보', 'MAX게이지', '무실점', '노히트노런', '퍼펙트게임', '실점', '아웃', '피안타'] as const

/** 칸을 안 읽는 줄 — 무실점 · 노히트노런 · 퍼펙트게임은 (0, 1), 피안타는 첫 값 (0, 0) 그대로 */
const FIXED_PITCHER_COUNTS: Readonly<Partial<Record<(typeof PITCHER_GOAL_KEYWORDS)[number], GoalCount>>> = {
  무실점: { current: 0, target: 1 },
  노히트노런: { current: 0, target: 1 },
  퍼펙트게임: { current: 0, target: 1 },
  피안타: { current: 0, target: 0 },
}

export function pitcherGoalCountOf(mission: OriginalMission, progress: MissionProgress, line: string, allowedRuns: number): GoalCount {
  const keyword = PITCHER_GOAL_KEYWORDS.find((word) => word === line) ?? PITCHER_GOAL_KEYWORDS[0]
  const fixed = FIXED_PITCHER_COUNTS[keyword]
  if (fixed !== undefined) return { ...fixed }
  const target = mission.goalCounts[keyword] ?? 0
  const current = keyword === '실점' ? allowedRuns : (progress.counts[keyword] ?? 0)
  // 0x3667a — 지금 > 목표면 지금 = 목표
  return { current: Math.min(current, target), target }
}

export interface GoalCount {
  readonly current: number
  readonly target: number
}

export function goalCountOf(mission: OriginalMission, progress: MissionProgress, line: string): GoalCount {
  const keyword = GOAL_KEYWORDS.find((word) => word === line) ?? GOAL_KEYWORDS[0]
  const key = COUNT_KEY_OF[keyword]
  if (key === null) return { current: 0, target: 1 }
  // 목표 = 레코드 목표 칸 (생성기 `goalCounts`, 칸 이름이 곧 0x36358 표의 이름)
  const target = mission.goalCounts[keyword === '런닝홈런' ? '그라운드홈런' : keyword] ?? 0
  const current = progress.counts[key] ?? 0
  return { current: Math.min(current, target), target }
}
