import { migrateTeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'

/** 일반모드 = 원본 게임 모드 1 */
const GENERAL_MODE = 1

/**
 * **모드 1 저장 블록 → 이어 세울 진행.** 저장소(`entities/mode-save`)는 블록을 모르는 값(unknown)으로 들고 있으므로
 * 여기서 일반모드 경기 진행인지 가려 낸다. 아니면 null — 부르는 쪽은 저장이 없는 것으로 다룬다.
 *
 * ⚠️ 웹 전용(남김 — 옛 저장 호환, Q-13): 원본은 파일을 그대로 블록에 올린다(0x213c0). 웹은 진행 꼴이 바뀌어 옛 블록을 못 읽게 되면
 * null 로 거른다. 모드 저장(`entities/mode-save`)은 블록을 꼴 검사 없이 들고 있으므로 옛 웹 판이 쓴 블록은 여기서만 걸린다 — r325 전체
 * 시험 계측에서 null 갈래는 단위 시험(옛 꼴)만 지났고 앱 길(이어하기)은 늘 읽었다. 꼴이 넓어진 칸은 `migrateTeamGameProgress` 가 채운다.
 */
export function generalGameOfSave(raw: unknown): TeamGameProgress | null {
  if (!isObject(raw)) return null
  const progress = raw as Partial<TeamGameProgress>
  if (!isGeneralModeOptions(progress.options)) return null
  if (!isGameShape(progress.game)) return null
  if (!hasEntryArrays(progress)) return null
  return migrateTeamGameProgress(raw as TeamGameProgress)
}

const isObject = (value: unknown): value is object => value !== null && typeof value === 'object'

function isGeneralModeOptions(options: TeamGameProgress['options'] | undefined): boolean {
  return isObject(options) && options.mode === GENERAL_MODE
}

/** 경기 상태 꼴 — 이닝 수 · 초/말 */
function isGameShape(game: TeamGameProgress['game'] | undefined): boolean {
  if (!isObject(game)) return false
  return typeof game.inning === 'number' && (game.half === '초' || game.half === '말')
}

/** 두 팀 타자 · 투수 엔트리가 배열인가 */
function hasEntryArrays(progress: Partial<TeamGameProgress>): boolean {
  const entries = [progress.ourEntry, progress.opponentEntry, progress.ourPitcherEntry, progress.opponentPitcherEntry]
  return entries.every((entry) => Array.isArray(entry))
}
