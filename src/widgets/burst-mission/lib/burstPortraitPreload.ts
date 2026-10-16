/**
 * **돌발미션 창 초상 미리 받기** — 경기 안에서 뜨는 컷인 초상(event_char_0 104~106 따위)이 비지 않게, 경기 장면이 서 있는 동안
 * 유휴 줄로 받는다(기다리지 않는다, 게임 타이밍 그대로).
 *
 * r134 측정(지연 80ms, 나리 타자편)에서 경기 중 event_char_0 104~106 이 한 번 비었다 — 애니 39 = 표 0xd0ae6[화자 5] 37 + 표정 2,
 * 곧 돌발미션 창 0x8f29c 가 그리는 초상이다(대사를 실을 때 0x8e2dc 가 0x63a04([0x1552cfc], 화자, 표정)로 싣는다,
 * `burstPortraitOf`). 어느 줄이 뜰지는 굴림 · 판정으로 갈리므로 **세 돌발 표(BATTER · PITCHER · SEASON) 대사의 화자 · 표정 전부**를
 * 계산해 받는다 — 측정에서 옮겨 적지 않는다.
 */
import { ORIGINAL_BURST_TABLES } from '@/shared/config/original/burstMissions'
import type { SpriteFolderPreload } from '@/shared/lib/sprite/spritePreload'
import { burstPortraitOf } from '@/widgets/burst-mission/lib/burstMissionWindowLayout'

const PORTRAIT_JSON = ['animations.json', 'origins.json'] as const

/** 돌발미션 대사 초상 — 폴더(event_char_0 · _1 · _2)마다 쓰는 애니 전부 */
export function burstPortraitPreloads(): SpriteFolderPreload[] {
  const animationsByFile = new Map<string, Set<number>>()
  for (const table of Object.values(ORIGINAL_BURST_TABLES)) {
    for (const row of table.lines) {
      for (const line of row) {
        const portrait = burstPortraitOf(line.speaker, line.expression)
        if (portrait === null) continue
        const animations = animationsByFile.get(portrait.file) ?? new Set<number>()
        animations.add(portrait.animation)
        animationsByFile.set(portrait.file, animations)
      }
    }
  }
  return [...animationsByFile]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([file, animations]) => ({
      folder: `./sprites/${file}/frames`,
      frames: [],
      animations: [...animations].sort((a, b) => a - b),
      json: PORTRAIT_JSON,
    }))
}
