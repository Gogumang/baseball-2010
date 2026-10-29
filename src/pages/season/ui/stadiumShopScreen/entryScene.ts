import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { stadiumPreviewOf } from '@/entities/season-mode/model/stadiumItems'
import { stadiumSkyRowOf } from '@/widgets/batting-stage/lib/stageScenery'
import { liveGameInningIndex } from '@/shared/lib/liveGameState/liveGameState'
import { rewoundScoreboardX } from '@/pages/season/lib/stadiumPreviewScene'
import type { StadiumPreviewScene } from '@/pages/season/lib/stadiumPreviewScene'
import { SEASON_MODE } from './stadiumTexts'

/**
 * 들어올 때의 장면 구장 칸. 구장관리 진입 0xe4d0 은 0x783b0 으로 하늘 줄(모드 2 — SR+0xb2 mod 6)과 +0x18(마지막 경기 상태 +0x6b)
 * 을 새로 잰다. 상점 진입 0x5f3c 는 0x783b0 을 안 불러 앞서 구장관리가 둔 값(없으면 0)이고, 0x77edc(구장, 1)로 전광판 글자를
 * 저장된 전광판 칸으로 되감는다(62ee).
 */
export function entrySceneOf(isShop: boolean, scene: StadiumPreviewScene, record: SeasonRecord): StadiumPreviewScene {
  if (isShop) return { ...scene, scoreboardX: rewoundScoreboardX(scene.scoreboardX, stadiumPreviewOf(record).board) }
  return { ...scene, skyRow: stadiumSkyRowOf({ mode: SEASON_MODE, dayCounter: record.games }) ?? 0, skyColumn: liveGameInningIndex() }
}
