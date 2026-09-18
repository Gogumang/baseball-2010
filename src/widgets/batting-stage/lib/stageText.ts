import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { SwingSituation } from '@/entities/batting/model/swingSkills'
import type { HudState } from '@/widgets/batting-stage/lib/renderHud'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import type { PitchSituation } from '@/entities/pitching/model/selectPitch'
import { STAGE_SIDE } from '@/widgets/batting-stage/lib/stageLayout'
import { batterFrameAt } from '@/widgets/batting-stage/lib/batterLayers'

/** 지금 그릴 타자 자세 f — 틱은 게임 속도(한 틱 ms)로 센다 */
export function batterFrameNow(now: number, swingStartedAt: number, isBunting: boolean): number {
  const tickOf = (time: number) => Math.floor(time / millisecondsPerFrame())
  return batterFrameAt({
    tick: tickOf(now),
    swingTick: swingStartedAt < 0 ? null : tickOf(swingStartedAt),
    isBunting,
    bodyType: 0,
  })
}

/** 캔버스 한가운데 띄우는 판정 문구. */
export function describeResolution(detail: PitchOutcomeDetail): string {
  const { resolution } = detail

  switch (resolution.kind) {
    case '볼':
      return '볼'
    case '파울':
      return '파울'
    case '스트라이크':
      return resolution.isSwinging ? '헛스윙' : '스트라이크'
    case '타구': {
      const outcome = resolution.outcome
      if (outcome.kind === '홈런') return '홈런!'
      if (outcome.kind === '안타') {
        return outcome.bases === 1 ? '안타!' : `${outcome.bases}루타!`
      }
      // 아웃은 원본 game_judge 그림(아웃)으로 띄운다
      if (outcome.kind === '아웃') return '아웃'
      return outcome.kind
    }
  }
}

/**
 * 스킬 조건에 쓰는 타석 상황. HUD 가 없으면 기본 상황이다.
 * 타자 side 는 화면 배치(STAGE_SIDE)와 같게 둔다. 투수 좌우는 원본 선수 레코드에서 아직 읽지 않아 0 — 추정.
 */
export function situationOf(hud: HudState | null, recentAtBatCodes: readonly number[] = []): SwingSituation {
  const bases = hud?.bases ?? { first: false, second: false, third: false }
  return {
    inning: hud?.inning ?? 1,
    isLosing: hud === null ? false : hud.ourScore < hud.opponentScore,
    runnerCount: Number(bases.first) + Number(bases.second) + Number(bases.third),
    hasSecondBaseRunner: bases.second,
    pitcherSide: 0,
    batterSide: STAGE_SIDE,
    balls: hud?.balls ?? 0,
    strikes: hud?.strikes ?? 0,
    batterOrderIndex: 0,
    recentAtBatCodes,
  }
}

/** CPU 투구 AI 에 넘길 볼카운트·주자 상황 */
export function pitchSituationOf(hud: HudState | null): PitchSituation {
  const bases = hud?.bases ?? { first: false, second: false, third: false }
  return {
    strikes: hud?.strikes ?? 0,
    balls: hud?.balls ?? 0,
    outs: hud?.outs ?? 0,
    runnerCount: Number(bases.first) + Number(bases.second) + Number(bases.third),
    batterSide: STAGE_SIDE,
    side: STAGE_SIDE,
  }
}
