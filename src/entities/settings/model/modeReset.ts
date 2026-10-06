/**
 * 모드 초기화 3종 — StrMAINMENU[82] 나만의리그 · [83] 시즌모드 · [84] 에디트 초기화
 * (환경설정 첫 화면 칸 4 "모드 초기화" 안의 하위 목록, 상태 0x21 → 갱신 0x2c6d8).
 * 근거: K-bursts-special.md K-5·5-3 · R11-special-leftovers.md 3-1 · 갱신 0x2c6d8 · 0x224ec · 0x223a8 직접 뜸.
 *
 * ## 칸 ↔ 동작 (0x2c6d8, 점프표 0xcece0 = 하위 상태 [this+0x18] 0~4)
 * ```
 * 하위 0 칸 0 → 고르기 창 0xcf848 "초기화할 데이터를 선택하세요"(종류 0x10, 2열×1행, 간격 0x74805(창, 0x3c, 0),
 *               버튼 0x74ea9 — 0 타자편 popup 13/11 · 1 투수편 14/12, 처음 커서 0x749d5 없음 = 타자편) → 하위 1
 *        칸 1 → 확인 0xcf870 (종류 2) + 0x749d5(창, 1) → 하위 3
 *        칸 2 → 확인 0xcf8d4 (종류 2) + 0x749d5(창, 1) → 하위 4
 * 하위 1 답 r = [창+0x21c]:
 *   r = 0(타자편) → 0x213c0(앱, 2, 1) 시즌 저장 올림 · 0xb5054(내 시즌 팀, 1 = 타자) && 전역기록 +0x4e
 *                   ? StrMAINMENU[212] (종류 1) · 0x74189 · 하위 0
 *                   : StrMAINMENU[210] (종류 2) + 0x749d5(창, 1) · this+0x104 = 0 · 하위 2
 *   r = 1(투수편) → 0xb5054(내 시즌 팀, 0 = 투수) && +0x4e
 *                   ? **StrMAINMENU[213]** "…삭제 하실 수 없습니다" (0x2c950 movs r1,#0xd5 — [212] 가 아니다. 원본 버그 그대로)
 *                   : StrMAINMENU[211] · this+0x104 = 1 · 하위 2
 *   r = −1(CLR) → 하위 0 · 그 밖(아직 답 없음) → 그대로
 * 하위 2 답 0(예) → 하위 0 · this+0x104 == 0 ? 0x224ec(mgr, 4) : 0x224ec(mgr, 3) · 알림 0xcf900 / 1·−1 → 하위 0
 * 하위 3 답 0(예) → 하위 0 · 0x224ec(mgr, 2) · 알림 0xcf900 / 1·−1 → 하위 0
 * 하위 4 답 0(예) → 하위 0 · 0x204c1(mgr) 이름표 memset · 알림 0xcf900 / 1·−1 → 하위 0
 * ```
 * 시즌모드·에디트 칸에는 막는 조건이 없다(곧장 확인 창 — 0x2c7e6 · 0x2c808). 막기 판정 0xb5054(팀, k) 는
 * "그 쪽(k 1 타자 +0x10/+0x18 · 0 투수 +0xc/+0x14) 선수 중 `+0xa` 를 부호 있게 읽어 < 0(= 0x80 나리 선수 비트)인 선수가 있다".
 *
 * ## 모드 저장 지우기 0x224ec(mgr, 칸) — G = 전역기록 [mgr+0xac]
 * ```
 * 칸 2 (시즌): G+0x42 = 0(시즌 커리어 있음) · G+0x48 · G+0x49 = 0 · G+0x4e = 0(시즌 경기 중간 저장) · G+0x54 · G+0x55 = 0(대전 8·9)
 *             G+0xf8 · +0xfc · +0x100 · +0x104 = 0 · G+0x108 · +0x10c = −1(u32) · G+0x110 · +0x111 · +0x114 · +0x115 · +0x116 · +0x117 = −1(u8)
 *             G+0x112 · +0x138 = 0(u16) · 파일 game_s.sav 지움(0x6a100, 이름 0xcdb24) · G+8 = 0 · 0x1f1b8 전역기록 저장
 * 칸 3 (나리 투수): G+0x43 = 0 · G+0x4f = 0 · game_pr.sav 지움(0xcdb30) · G+0xc = 0 · 저장 · 0x223a8(mgr, 1) · mgr+0x3c = 0
 * 칸 4 (나리 타자): G+0x44 = 0 · G+0x50 = 0 · game_br.sav 지움(0xcdb3c) · G+0x10 = 0 · 저장 · 0x223a8(mgr, 0) · mgr+0x38 = 0
 * ```
 * 0x223a8(mgr, 투수?) = 시즌 저장을 올려(0x213c0(앱, 2, 1)) 있고 G+0x42 면 **내 시즌 팀**(0x1f571(저장, SR[1]))에서 그 쪽 첫 나리
 * 선수(0xb6388 = +0xa bit7)를 빼고(맨 끝 선수를 그 자리로 복사 · 끝 칸 memset · 수 −1, 타자는 수비 위치 0xb8e85·칸 번호 0xb6605 를
 * 이어받는다) 시즌 저장 0x211fc(mgr, 2). 웹: `removeCareerPlayerFromRoster`(entities/season-mode).
 *
 * ## 남은 칸의 뜻 (직접 뜸 — 0x224ec · 0x213c0 · 0x22754 · 0x4a948 갈래 0x4ae50~0x4b1d0 · 0x1faa0)
 * - **G+0x48 · +0x49 = +0x40 + 모드 8·9** ("그 모드 저장 있음" 칸 줄 — +0x42 시즌 · +0x43/+0x44 나리와 같은 줄),
 *   **G+0x54 · +0x55 = +0x4c + 모드 8·9** (경기 중간 저장). 대전모드 8·9 는 시즌 팀으로 치르므로 시즌을 지울 때 같이 내린다.
 *   +0x48/+0x49 를 직접 오프셋으로 읽고 쓰는 곳은 이 함수 밖에 못 찾았다(+0x40+모드 계산 접근은 모드 3·4 의 0xf8e0 · 0x112b0).
 * - **G+0xf8~+0x117 · +0x138 = 대전모드 8·9 칸**: 대전 정산 화면(0x4a948)이 모드 8 이면 +0x114(u8) · +0xf8(8바이트) ·
 *   +0x112(s16 "승리 추가 보상" G, 0x4ae6a), 모드 9 면 +0x115 · +0x100 · +0x138 을 읽는다(0x4b1a6~0x4b1d0). +0x108/+0x10c ·
 *   +0x110/+0x111 · +0x116/+0x117 도 같은 8·9 짝 꼴이다(유력 — 오프셋이 대전 업로드 쪽 0x7094c · 0x70972 · 0x7369e~0x736d6
 *   에 보이지만 바탕 레지스터가 G 인지는 다 따라가지 않았다).
 * - **G+8 · +0xc · +0x10 = G + 4·칸 = 그 칸 파일의 도장** — 0x22754 가 파일을 쓸 때 끝(0x22be4~0x22bea)에서 버퍼 첫 u32 를
 *   G[4·칸] 에 적고, 0x213c0 이 올릴 때(0x21812 · 0x218ca · 0x2198c) 0 이 아니고 다르면 G+0x14 |= 1 << (칸 − 1)(바꿔치기 표시)
 *   하고 저장한다. 파일을 지우니 도장도 0 으로 둔다.
 * - **mgr+0x38 · +0x3c = 나리 내 선수 레코드 포인터** — 0x1faa0(mgr, 투수?, …) 이 타자편이면 mgr+0x38(0x1fb02)에 찾아 둔다
 *   (투수편 +0x3c). 지운 편의 포인터를 놓는다.
 * 웹 짝: 대전모드(🌐)는 없고, 파일 도장·포인터 캐시는 웹 저장이 그때그때 고르므로 **지울 칸이 없다**. 웹이 시즌 저장 안에 둔
 * 경기진행 설정(+0x12c+1)·창 본 표시(+0x11e)는 원본에서 이 함수가 안 건드리는 전역 칸이라 시즌 초기화 뒤에도 남긴다
 * (`useSeasonSession.resetSeason`).
 */
export type ModeResetTarget = 'career-batter' | 'career-pitcher' | 'season' | 'edit'

/** 나만의리그 칸 고르기 창 0xcf848 의 두 편 — 답 0 타자편 · 1 투수편 */
export type CareerResetEdition = '타자편' | '투수편'

/** 0x224ec 의 칸 번호 — 0x213c0(앱, 칸) 과 같다 */
export const MODE_RESET_SLOT = { 시즌: 2, 나리투수: 3, 나리타자: 4 } as const

/** 원문 (StrMAINMENU.json · .text 문자열) */
export const MODE_RESET_TEXT = {
  /** 0xcf848 — 나만의리그 칸 고르기 창 */
  careerChoose: '!C!cffffff초기화할 데이터를 선택하세요',
  /** StrMAINMENU[210] */
  careerBatterConfirm:
    '!C!cFFFFFF나만의 리그 타자편!N초기화를 하시겠습니까?!N(!cFF0000G포인트 아이템도!N함께 삭제됩니다!cFFFFFF)',
  /** StrMAINMENU[211] */
  careerPitcherConfirm:
    '!C!cFFFFFF나만의 리그 투수편!N초기화를 하시겠습니까?!N(!cFF0000G포인트 아이템도!N함께 삭제됩니다!cFFFFFF)',
  /** StrMAINMENU[212] — 타자편 막기 */
  blockedReset: '!C!cFFFFFF시즌모드 경기 진행 중에는!N초기화 하실 수 없습니다',
  /** StrMAINMENU[213] — 투수편 막기가 이 글을 띄운다(원본 버그) */
  blockedDelete: '!C!cFFFFFF시즌모드 경기 진행 중에는!N삭제 하실 수 없습니다',
} as const

/**
 * 판정에 필요한 맥락 — 실제 저장 조회(시즌 진행 여부·나리 선수가 시즌 팀에 있는지)는 부르는 쪽이 채운다.
 */
export interface ModeResetContext {
  /** 전역 기록 +0x4e ≠ 0 — 시즌모드 경기가 진행 중(중간 저장 상태)인가 */
  readonly isSeasonGameInProgress: boolean
  /**
   * 초기화 대상 편의 나리 선수가 지금 시즌 내 팀 명단에 들어가 있는가 (0xb5054 — 타자편은 타자 쪽, 투수편은 투수 쪽).
   * `career-batter`/`career-pitcher` 판정에만 쓰인다. 시즌 저장이 없으면 거짓.
   */
  readonly isCareerPlayerInSeasonTeam: boolean
}

/** 막힌 까닭 — 시즌 경기 진행 중 */
export type ModeResetBlockReason = 'season-game-in-progress'

export interface ModeResetJudgement {
  readonly canReset: boolean
  readonly blockReason: ModeResetBlockReason | null
  /** 막혔을 때 띄우는 글 (종류 1) — 타자편 [212] · 투수편 [213]. 통과면 null */
  readonly blockText: string | null
}

/**
 * "시즌 중 막기" 는 **나만의리그(타자·투수) 칸에만** 있다 — 그 편 나리 선수가 시즌 내 팀에 들어가 있고 && 시즌모드 경기가
 * 진행 중이면 막는다. 통과하면 편별 확인 창([210]/[211])으로 이어진다. 시즌·에디트 칸은 막는 조건 없이 곧장 확인이다.
 */
export function judgeModeReset(target: ModeResetTarget, context: ModeResetContext): ModeResetJudgement {
  if (target === 'career-batter' || target === 'career-pitcher') {
    const isBlocked = context.isCareerPlayerInSeasonTeam && context.isSeasonGameInProgress
    if (!isBlocked) return { canReset: true, blockReason: null, blockText: null }
    return {
      canReset: false,
      blockReason: 'season-game-in-progress',
      blockText: target === 'career-batter' ? MODE_RESET_TEXT.blockedReset : MODE_RESET_TEXT.blockedDelete,
    }
  }
  return { canReset: true, blockReason: null, blockText: null }
}

/** 편 → 판정 대상 */
export function careerResetTargetOf(edition: CareerResetEdition): ModeResetTarget {
  return edition === '타자편' ? 'career-batter' : 'career-pitcher'
}
