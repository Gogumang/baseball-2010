import type { ModeSave, NariLeagueMode } from '@/entities/mode-save/model/modeSave/types'

/**
 * 대기 중 미션이 보는 전역기록 칸 — g[0x11f](타자편 대기) · g[0x176](투수편 대기) · g[0xf6](그때 모드)
 */
export interface AceMatchHold {
  readonly batter: boolean
  readonly pitcher: boolean
  readonly originalMode: number
}

/** 미션 쪽 손잡이 — 대기 칸을 읽고, 정산 진입 0x4ea0c 가 결과 바이트를 덮어쓴다 (`withAceMatchResultWritten`) */
export interface AceMatchHoldPort {
  readonly read: () => AceMatchHold
  readonly writeResult: (isWon: boolean) => void
}

/** 대기가 없다 — 손잡이를 안 넘긴 미션 세션(시험)이 쓴다 */
export const NO_ACE_MATCH_HOLD: AceMatchHold = { batter: false, pitcher: false, originalMode: 0 }

/** g[0x11f] · g[0x176] 중 하나라도 서 있나 — 0x4ef3e · 0x4a384 · 0x407f0 · 0x4b100 · 0xaa57c 가 보는 조건 */
export function isAceMatchHeld(hold: AceMatchHold): boolean {
  return hold.batter || hold.pitcher
}

/** 모드 저장에서 대기 칸을 읽는다 */
export function aceMatchHoldOf(save: ModeSave): AceMatchHold {
  return { batter: save.aceMatchPending[4] !== null, pitcher: save.aceMatchPending[3] !== null, originalMode: save.aceMatchMode }
}

/**
 * 나간 마선수 대결 대기 칸 손잡이 — 나리 두 편 세션이 SYS 8 · 105 진입 · 140 에서 쓴다 (`useModeSave` 가 편마다 세운다)
 */
export interface AceMatchPendingPort {
  /** 지금 대기 중인 결과 이벤트 둘 [이김, 짐] — 없으면 null */
  readonly read: () => readonly number[] | null
  /** SYS 8 — 결과 이벤트 · 대기 1 · 결과 바이트 0 · 전역기록 저장 */
  readonly hold: (resultEvents: readonly number[]) => void
  /** 140 진입 0x10df8 — 칸을 지우고 전역기록 저장 */
  readonly clear: () => void
  /** 결과 바이트(g[0x144] · g[0x177]) — 이겼는가. 대기가 없으면 거짓 */
  readonly isWon: () => boolean
}

/** 저장소 없이 메모리에만 드는 대기 칸 — 손잡이를 안 넘긴 세션(시험)이 쓴다 */
export function createMemoryAceMatchPendingPort(): AceMatchPendingPort {
  let pending: readonly number[] | null = null
  return {
    read: () => pending,
    hold: (resultEvents) => {
      pending = resultEvents
    },
    clear: () => {
      pending = null
    },
    isWon: () => false,
  }
}

/**
 * **SYS 8 — 마선수 대결을 열며 대기 칸을 적는다** (0x8d764~0x8d846, 직접 떴다): 타자편(0x7b971 참) g[0xf7] = 팀 − 1 ·
 * g[0xec]/g[0xee] = 결과 이벤트 · g[0x11f] = 1 · g[0x144] = 0, 투수편(0x7b985 참) g[0x175] · g[0x170]/g[0x172] · g[0x176] = 1 ·
 * g[0x177] = 0 → 8d84a 전역기록 저장(0x1f1b9). 전역기록이라 그 편 선수를 지우고 새로 만들어도 남는다 — 대기 플래그를 0 으로
 * 쓰는 곳은 140 진입 0x10df8(10ee0 · 10f38) 하나다(0x11f 리터럴 · `movs #0xbb ; lsls #1` 훑기: 그 밖은 읽기 — 105 진입 0x11b50 ·
 * 0x11b76, 0x1cfee · 0x1fc42 · 0x1fbf2 · 0x407f0 · 0x4a384 · 0x4b100 · 0x4ea0c · 0xaa57c · 0xb8680). 모드 초기화 0x224ec 도 안 지운다.
 * 웹은 결과 바이트(SYS 8 이 0 — 짐)가 늘 0 인 채로만 대기를 읽으므로 결과 이벤트 둘만 든다. 팀 칸(g[0xf7] · g[0x175])은
 * 웹 미션 세션이 대결 미션으로 들고 있어 여기 담지 않는다.
 */
export function withAceMatchHeld(save: ModeSave, mode: NariLeagueMode, resultEvents: readonly number[]): ModeSave {
  return {
    ...save,
    aceMatchPending: { ...save.aceMatchPending, [mode]: [...resultEvents] },
    aceMatchWon: { ...save.aceMatchWon, [mode]: false },
    // 8d836~8d846 — g[0xf6] = 그때 모드
    aceMatchMode: mode,
  }
}

/**
 * **140 진입 0x10df8** — 결과 이벤트를 틀며 대기 칸을 지우고 전역기록을 저장한다(10f72). 타자편 갈래 10ec6~10f0c 는
 * g[0xec] · g[0xee] · g[0x11f] · g[0x144] · **g[0xf6]** 을 0, g[0xf7] 을 −1(10f66 `movs #1; rsbs`) 로, 투수편 갈래 10f0e~ 는
 * g[0x170] · g[0x172] · g[0x176] · g[0x177] · **g[0xf6]**(10f56) 을 0, g[0x175] 를 −1 로 — g[0xf6] 은 다른 편 대기가 남아 있어도
 * 지운다(원본 그대로). 팀 칸(g[0xf7] · g[0x175])은 웹 저장에 없다(미션 세션이 대결 미션으로 든다).
 */
export function withAceMatchCleared(save: ModeSave, mode: NariLeagueMode): ModeSave {
  if (save.aceMatchPending[mode] === null) return save
  return {
    ...save,
    aceMatchPending: { ...save.aceMatchPending, [mode]: null },
    aceMatchWon: { ...save.aceMatchWon, [mode]: false },
    aceMatchMode: 0,
  }
}

/**
 * **정산 진입 0x4ea0c 의 결과 바이트 덮어쓰기** (4efc6~4f018, 직접 떴다) — 모드 5·6(미션 · 마선수 대결) 끝마다:
 * ```
 * 4efc6  g[0x11f] ≠ 0 → g[0x144] = [미션+0xbc](이 판 성공?) · 0x1f1b9 전역기록 저장
 * 4eff6  g[0x176] ≠ 0 → g[0x177] = [미션+0xbc] · 0x1f1b9
 * ```
 * 어느 미션인지 안 가린다 — 대기 중 보통 미션도 그 편 결과 바이트를 덮는다.
 */
export function withAceMatchResultWritten(save: ModeSave, isWon: boolean): ModeSave {
  const won = {
    3: save.aceMatchPending[3] === null ? save.aceMatchWon[3] : isWon,
    4: save.aceMatchPending[4] === null ? save.aceMatchWon[4] : isWon,
  }
  if (won[3] === save.aceMatchWon[3] && won[4] === save.aceMatchWon[4]) return save
  return { ...save, aceMatchWon: won }
}
