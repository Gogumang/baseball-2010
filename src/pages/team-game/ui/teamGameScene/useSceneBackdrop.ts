import { useState } from 'react'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { stadiumSkyRowOf } from '@/widgets/batting-stage/lib/stageScenery'
import type { SeasonStadium } from '@/widgets/batting-stage/lib/renderScenery'
import { useSettlementEffectLayers } from '@/widgets/batting-stage/model/useSettlementEffectLayers'
import { sceneFieldPaletteOf } from '@/features/play-team-game/model/sceneStadium'
import type { TeamGameOptions, TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { useWarmFieldBackgrounds } from './otherSlices'

/** 0x783b0 의 측 0 팀 — 사람 팀이 측 0 이면 우리 */
const side0TeamOf = (options: TeamGameOptions) => (options.playerSide === 0 ? options.ourTeamId : options.opponentTeamId)

/** 구장 · 하늘 · 바닥 팔레트 · 정산 효과 층 — 타석 · 수비 · 인트로 · 정산 배경이 같이 쓴다 */
export function useSceneBackdrop(options: TeamGameOptions, progress: TeamGameProgress, seasonStadium: SeasonStadium | undefined) {
  /** 정산 배경 전용 난수 — 하늘 줄을 넘기므로 굴릴 일이 없다(꼴만 채운다). 경기 난수를 건드리지 않는다 */
  const [backdropRandom] = useState(() => createSeededRandom(0))
  /**
   * 구장 하늘 줄 +0x10 — 0x783b0: 모드 2 는 시즌 레코드 +0xb2(리그 날짜 g) mod 6, 모드 1 · 8 · 9 는 경기[0x28](측 0 팀) mod 6. 굴림이 없고
   * 경기 내내(정산 결과 그림까지) 같다 — 타석 · 정산 배경 두 캔버스가 같이 쓴다
   */
  const stadiumSkyRow = stadiumSkyRowOf({ mode: options.mode, dayCounter: options.dayCounter ?? 0, side0TeamId: side0TeamOf(options) })
  /**
   * 구장 객체 둘(0x39fdc 모드 1·8·9 갈래) — 타석 구장 +0x70 이 펜스 프레임을, 두 객체 +0xc 가 바닥·수비 바탕 팔레트 줄을 정한다.
   * 시즌 홈경기(seasonStadium)면 경기 준비 0x352e8 의 시즌 갈래가 잔디 칸으로 덮는다. 없으면 0번 구장 · 기본색
   */
  const sceneStadium = progress.sceneStadium ?? null
  const fieldPalette = seasonStadium?.grassPalette ?? sceneFieldPaletteOf(sceneStadium)
  // 타석 바닥 · 수비 바탕을 미리 칠한다 — 원본은 구장 객체 적재 때 팔레트를 갈아 끼운다
  useWarmFieldBackgrounds(fieldPalette)
  const sceneryProps = {
    ...(sceneStadium === null ? {} : { stadium: sceneStadium.stadium }),
    fieldPalette,
  }
  /** 정산 효과 층(비 · 파티클) — 타석 배경과 정산 판이 같이 쓴다 (원본 그리기 차례 0x4a384) */
  const settlementLayers = useSettlementEffectLayers()
  return { backdropRandom, stadiumSkyRow, sceneStadium, fieldPalette, sceneryProps, settlementLayers }
}
