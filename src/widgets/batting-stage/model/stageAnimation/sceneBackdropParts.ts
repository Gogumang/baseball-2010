/** 그림 입력의 배경 · HUD 몫 — 파티클 · 정산 비 · 하늘 칸 · 결과 배경 내림 · 상태 갈래 · 스킬 판 · 미션 띠 · 구장 */
import type { SceneRain } from '@/entities/batting/model/settlementEffect'
import { gameSceneTickOf } from '@/shared/lib/commonWindow/commonWindow'
import { settlementSkyColumnOf } from '@/widgets/batting-stage/lib/settlementSky'
import { resultBackdropOffsetAt } from '@/widgets/batting-stage/lib/stageScenery'
import { frozenClockNowOf } from '@/widgets/batting-stage/lib/frozenClock'
import { sceneScoreboardTickOf } from '@/widgets/batting-stage/model/sceneCloudClock'
import type { StageLoop } from '@/widgets/batting-stage/model/stageAnimation/stageLoop'
import type { StageFrameReads } from '@/widgets/batting-stage/model/stageAnimation/frameReads'
import type { ParticleFrame } from '@/widgets/batting-stage/model/stageAnimation/particleSteps'
import { stagePhaseNow } from '@/widgets/batting-stage/model/stageAnimation/stageMarksNow'
import { stepSkillPanelNow } from '@/widgets/batting-stage/model/stageAnimation/skillPanelNow'

/** 결과 창 뒤 배경의 +0x17e2 — 배경으로 바뀐 뒤 흐른 틱(공용 창이 서 있으면 선다). 타석이면 null */
function resultBackdropOffsetNow(loop: StageLoop, reads: StageFrameReads): number | null {
  const clock = loop.backdropClock
  if (clock === null) return null
  const offsetOf = loop.refs.latestRef.current.resultBackdropOffsetOf ?? resultBackdropOffsetAt
  return offsetOf(gameSceneTickOf(frozenClockNowOf(clock, reads.tickTime)) - gameSceneTickOf(clock.startedAt))
}

export function backdropPartOf(loop: StageLoop, reads: StageFrameReads, particles: ParticleFrame, settlementRain: SceneRain | null) {
  const { settlement, isParticleGated } = particles
  const { particlesRef, phaseRef, phaseStartTickRef } = loop.refs
  const hasLayers = settlement?.layers !== undefined
  return {
    // 판이 효과 층을 깔았으면 배경 캔버스에는 배경만 — 비 · 파티클은 그 층에 그린다
    particles: !hasLayers && !isParticleGated ? particlesRef.current : null,
    rain: hasLayers ? null : settlementRain,
    // 정산 결과 배경의 하늘 칸 — 0x4a384 는 +0x14 를 안 바꾸므로 경기 끝 이닝 그대로, 지면 진입 0x4ea0c 4f4fe~4f506 이
    // 구장객체 +0x18 = 12 → 0x76fc5(구장, 0) 으로 마지막 칸(밤)에 둔다
    skyColumn: settlement === undefined ? null : settlementSkyColumnOf(settlement),
    resultBackdropOffsetY: resultBackdropOffsetNow(loop, reads),
    resultTick: phaseRef.current === '결과' ? reads.sceneTick - phaseStartTickRef.current : 0,
  }
}

export function hudPartOf(loop: StageLoop, reads: StageFrameReads) {
  const latest = loop.refs.latestRef.current
  const { isBackdrop } = reads
  return {
    // 0x4c4bc 의 상태 갈래 재료 — 웹 단계 · 그 단계에 든 뒤 틱 · 쉬는 중(0xd · 0xe 대기 따위)
    stagePhase: stagePhaseNow(loop, reads.sceneTick),
    timeKeyCount: latest.timeKeyCount ?? null,
    isSubstitutionState: latest.isSubstitutionWindowOpen === true,
    specialSwingRemaining: latest.specialSwingRemaining ?? null,
    // 0x4cad4 → 0x4b5b4 — 경기 스킬 표시 판 (결과 창 뒤 배경에는 안 그린다)
    skillPanel: isBackdrop ? null : stepSkillPanelNow(loop, reads.sceneTick),
    // 0x373d0 끝의 미션 HUD 띠 (결과 창 뒤 배경 0x4a384 는 점수판을 안 그린다)
    missionStrips: isBackdrop ? null : (latest.missionStrips ?? null),
  }
}

/**
 * 구장 번호(구장 +0x70)는 장면 셋업 0x39fdc 가 채운다 — 모드 1·8·9 만 넘어오고, 그 밖은 0 번 구장이다.
 * 시즌 구장 세 칸이 넘어오면 배경 묶음 자체가 0x77494 쪽으로 갈린다 (0x40ff0).
 */
export function sceneryOf(loop: StageLoop, reads: StageFrameReads, cloudCalls: number) {
  const latest = loop.refs.latestRef.current
  return {
    cloudCalls,
    // 전광판 글자 [구장+0x8c] — 이 장면에서 배경을 처음 그린 틱이 0 (`sceneScoreboardTickOf`)
    scoreboardTick: sceneScoreboardTickOf(reads.sceneTick),
    // 하늘 줄 = 구장 +0x10 (0x783b0 — `stadiumSkyRowOf`). 원본은 경기 장면을 세울 때(상태 8 0x48658 → 0x352e8 → 0x783b0) 한 번
    // 고른다 — 부르는 쪽이 그 줄을 넘기고, 그리는 그림마다 넘겨받은 줄을 읽는다(미션 · 홈런더비는 세션이 장면 시작 굴림 차례 끝에서
    // 굴린 rand(0, 6) — 홈런더비는 결과 진입 0x4f574 에서 한 번 더). 이 자리는 **굴리지 않는다**(r232): 원본 0x783b0 의 rand(0, 6) 은
    // 모드 5 · 6 · 7 의 장면 적재에서만 나고, 그림 쪽(0x78490 · 0x77fe8)은 구장 +0x10 을 읽기만 한다. 예전엔 줄이 아직 없으면 여기서
    // 대체 줄을 굴렸는데, 홈런더비 첫 장면은 이 효과(자식)가 세션의 장면 시작 효과(부모)보다 먼저 돌아 그 굴림이 로딩 팁 rand(0, 73)
    // 앞에 끼었다(r231 보고 — 배포 빌드에도 있던 웹 전용 굴림). 줄이 들어오기 전 그림은 0 줄로 그리고, 들어오면 그 줄을 읽는다
    skyRow: latest.skyRow ?? 0,
    stadium: latest.stadium ?? 0,
    fieldPalette: latest.fieldPalette ?? null,
    seasonStadium: latest.seasonStadium,
    // 하늘 조명 0x78490 은 모드 5·6·7(미션·홈런더비)에서 안 그린다
    gameMode: latest.gameMode,
    // 환경설정 전광판(+0x3a) OFF 면 흐르는 글자를 안 그린다 (0x77726)
    isScoreboardOn: latest.isScoreboardOn,
  }
}
