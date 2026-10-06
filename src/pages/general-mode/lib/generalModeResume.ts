import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'

/** 일반모드 = 원본 게임 모드 1 */
const GENERAL_MODE = 1

/**
 * **모드 1 저장 블록 → 이어 세울 진행.** 저장소(`entities/mode-save`)는 블록을 모르는 값(unknown)으로 들고 있으므로
 * 여기서 일반모드 경기 진행인지 가려 낸다. 아니면 null — 부르는 쪽은 저장이 없는 것으로 다룬다.
 *
 * ⚠️ 웹 전용: 원본은 파일을 그대로 블록에 올린다(0x213c0). 웹은 진행 꼴이 바뀌어 옛 블록을 못 읽게 되면 null 로 거른다.
 */
export function generalGameOfSave(raw: unknown): TeamGameProgress | null {
  if (raw === null || typeof raw !== 'object') return null
  const progress = raw as Partial<TeamGameProgress>
  const { options, game } = progress
  if (options === undefined || options === null || typeof options !== 'object') return null
  if (options.mode !== GENERAL_MODE) return null
  if (game === undefined || game === null || typeof game !== 'object') return null
  if (typeof game.inning !== 'number' || (game.half !== '초' && game.half !== '말')) return null
  if (!Array.isArray(progress.ourEntry) || !Array.isArray(progress.opponentEntry)) return null
  if (!Array.isArray(progress.ourPitcherEntry) || !Array.isArray(progress.opponentPitcherEntry)) return null
  return raw as TeamGameProgress
}
