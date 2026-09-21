/**
 * 모드 초기화 3종 — StrMAINMENU[82] 나만의리그 · [83] 시즌모드 · [84] 에디트 초기화
 * (환경설정 첫 화면 칸 4 "모드 초기화" 안의 하위 목록, 상태 0x21 → 0x2c6d8).
 * 근거: K-bursts-special.md K-5·5-3 · R11-special-leftovers.md 3-1.
 *
 * 지우는 곳 (모드 저장 지우기 0x224ed(mgr, 저장칸) — 저장칸 번호는 0x213c0(앱, 칸) 과 같다):
 *   나만의리그 타자편 초기화 — 저장칸 4
 *   나만의리그 투수편 초기화 — 저장칸 3
 *   시즌모드 초기화           — 저장칸 2
 * 에디트 초기화는 저장칸이 아니라 별도 호출 **0x204c1(mgr)** — 편집한 선수 이름을 원래대로 되돌린다.
 * 셋 다 StrHOWTO[31]: 초기화하면 그 모드에서 쓰던 보유 아이템도 함께 지워진다.
 *
 * ⚠️ 실제로 저장을 지우는 호출(0x224ed·0x204c1 에 대응하는 코드)은 이 작업 범위 밖이다 —
 * `src/entities/career`·`src/entities/pitcher-career`·`src/entities/league`·`src/app/` 는
 * 다른 작업이 동시에 손대고 있어 건드릴 수 없다. 여기서는 "지울 수 있는가" 판정 함수까지만 만든다.
 * (저장을 실제로 지우는 배선은 저 파일들 쪽에 이어야 한다.)
 */
export type ModeResetTarget = 'career-batter' | 'career-pitcher' | 'season' | 'edit'

/**
 * 판정에 필요한 맥락 — 실제 저장 조회(시즌 진행 여부·나리 선수가 시즌 팀에 있는지)는
 * entities/career·entities/league 쪽 일이라 범위 밖이다. 호출부가 값을 채워 넘긴다.
 */
export interface ModeResetContext {
  /** 전역 기록 +0x4e ≠ 0 — 시즌모드 경기가 진행 중(중간 저장 상태)인가 */
  readonly isSeasonGameInProgress: boolean
  /**
   * 초기화 대상 나만의리그 선수가 지금 시즌 내 팀 명단에 들어가 있는가 (0xb5055).
   * `career-batter`/`career-pitcher` 판정에만 쓰인다.
   */
  readonly isCareerPlayerInSeasonTeam: boolean
}

/** StrMAINMENU[212] "시즌모드 경기 진행 중에는 초기화 하실 수 없습니다" */
export type ModeResetBlockReason = 'season-game-in-progress'

export interface ModeResetJudgement {
  readonly canReset: boolean
  readonly blockReason: ModeResetBlockReason | null
}

/**
 * "시즌 중 막기" 는 **나만의리그(타자·투수) 초기화에만** 있다 (R11-special-leftovers.md 3-1, 확정) —
 * 그 나리 선수가 시즌 내 팀에 들어가 있고 && 시즌모드 경기가 진행 중이면 막는다(StrMAINMENU[212]).
 * 통과하면 확인 팝업(타자편 StrMAINMENU[210] · 투수편 [211])으로 이어진다 — 팝업 자체는 이 함수 밖.
 *
 * 시즌모드 초기화·에디트 초기화 자체를 막는 조건은 원본 문서에서 확인되지 않았다(⚠️ 미해결) —
 * 여기서는 항상 허용으로 둔다. 근거가 나오면 이 함수만 고치면 된다.
 */
export function judgeModeReset(target: ModeResetTarget, context: ModeResetContext): ModeResetJudgement {
  if (target === 'career-batter' || target === 'career-pitcher') {
    const isBlocked = context.isCareerPlayerInSeasonTeam && context.isSeasonGameInProgress
    return { canReset: !isBlocked, blockReason: isBlocked ? 'season-game-in-progress' : null }
  }
  return { canReset: true, blockReason: null }
}
