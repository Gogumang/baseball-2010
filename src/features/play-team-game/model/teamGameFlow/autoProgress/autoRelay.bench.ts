import { test } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { FULL_PLAY_SETTINGS, MATCH_SETTING_KIND } from '@/features/play-team-game/model/matchSettings'
import { startTeamGame, stepAutoRelay, type TeamGameOptions } from '@/features/play-team-game/model/teamGameFlow'

/**
 * 경기 틱 한 번 — 자동진행 중계(상태 0x21)가 틀마다 부르는 0xc262c 한 걸음(`stepAutoRelay`).
 * 기준 숫자만 남긴다(기계마다 달라 실패 기준은 없다) — `pnpm bench`
 */
const 전부자동중계: TeamGameOptions = {
  mode: 2,
  ourTeamId: 0,
  opponentTeamId: 1,
  playerSide: PLAYER_SIDE_LAST_BAT,
  season: { illness: 0, morale: 100, coach: -1 },
  settings: { ...FULL_PLAY_SETTINGS, kind: MATCH_SETTING_KIND.상세, value: 0 },
  liveAutoRelay: true,
}
const 시작 = startTeamGame(전부자동중계, createSeededRandom(1))

test('경기 틱', async ({ bench }) => {
  let seed = 0
  await bench('자동진행 중계 한 걸음 (stepAutoRelay)', () => {
    seed += 1
    stepAutoRelay(시작, createSeededRandom(seed))
  }).run()
})
