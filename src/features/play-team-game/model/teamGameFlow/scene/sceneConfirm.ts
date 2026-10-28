import { type SubstitutionScene, substitutionEntrySoundIdOf } from '@/features/play-game/model/substitutionScene'
import { aceCutInSlotOf } from '@/features/play-game/model/aceCutIn'
import type { TeamEntryBatter } from '@/features/play-team-game/model/teamGameRoster'
import { enterSceneConfirm } from '@/features/play-game/model/sceneConfirm'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * **상태 0xe 에 선다** — 새 대기 객체를 싣고 OK 를 기다린다. 들어오는 길: 새 타석(0xd → 0xe) · 교체 연출 0x16 → 0xd → 0xe
 * (사람 `#` 교체 확정 · 0xf 진입의 CPU 대타·투수 교체) · 교체 창 취소(곧장 0xe, 0x495fc).
 * 0xe 진입 0x50674 의 감독 강판 0x504cc 는 모드 1·2·8·9 에서 늘 거짓이라 굴림이 없다. 0xe 에서는 굴림이 없고
 * OK(메시지 1 → 0x50c18) 뒤에야 돌발 0x8f158 · 0xf 진입 0x3d954 가 돈다 (`confirmScene`).
 */
/**
 * 교체 연출 0x16 한 번 — 0x16 진입 0x3d458 이 예약을 보고 +0x195c 를 세운 뒤 0xd → 0xe 에서 0x38b64 가 들어온 선수로
 * 등판음(마선수 26 · 2·3루 주자 15 · 그 밖 14)을 고른다. 루는 교체로 안 바뀐다.
 */
export function substitutionSceneAfter(
  progress: TeamGameProgress,
  /** 0x3d458 의 갈래 — 대타 예약(+0x195c 비트 0) · 투수 예약 */
  side: '투수' | '타자',
  /** 들어온 선수의 마선수 번호(0xb63a1) — 마선수가 아니면 음수 */
  aceIndex: number,
): SubstitutionScene {
  const incomingIsAce = aceIndex >= 0
  return {
    serial: (progress.substitutionScene?.serial ?? 0) + 1,
    // 0x38b64 의 가지 — 투수 ptc/004 · 타자 ptc/003
    entryKind: side,
    incomingIsAce,
    entrySoundId: substitutionEntrySoundIdOf({ isAce: incomingIsAce, bases: progress.game.bases }),
    ...(incomingIsAce ? { aceSlot: aceCutInSlotOf(side, aceIndex) } : {}),
  }
}

/** 0x3d458 3d562 `0x668cc(스킨, 공격 팀, 0)` 재료 — 나가는 타자의 레코드 칸 (`SubstitutionScene.cheerRestore`) */
export function withCheerRestore(scene: SubstitutionScene, attackSide: number, outgoing: TeamEntryBatter | undefined): SubstitutionScene {
  if (outgoing?.recordSlot === undefined) return scene
  return { ...scene, cheerRestore: { attackSide, recordSlot: outgoing.recordSlot } }
}

/** st[9] 의 다른 측 */
export function opposingSideOf(side: number): number {
  return side === 0 ? 1 : 0
}

export function enterConfirmWait(progress: TeamGameProgress): TeamGameProgress {
  return { ...progress, sceneConfirm: enterSceneConfirm(), sceneConfirmPending: true, atBatPrepared: true }
}
