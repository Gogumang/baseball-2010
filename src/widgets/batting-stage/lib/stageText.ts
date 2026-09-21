import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { SwingSituation } from '@/entities/batting/model/swingSkills'
import type { HudState } from '@/widgets/batting-stage/lib/renderHud'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import type { PitchSituation } from '@/entities/pitching/model/selectPitch'
import { batterSideOfForm } from '@/widgets/batting-stage/lib/stageLayout'
import { batterFrameAt } from '@/widgets/batting-stage/lib/batterLayers'

/** 지금 그릴 타자 자세 f — 틱은 게임 속도(한 틱 ms)로 센다. 자세표도 몸통 종류로 갈린다 */
export function batterFrameNow(now: number, swingStartedAt: number, isBunting: boolean, bodyType: number): number {
  const tickOf = (time: number) => Math.floor(time / millisecondsPerFrame())
  return batterFrameAt({
    tick: tickOf(now),
    swingTick: swingStartedAt < 0 ? null : tickOf(swingStartedAt),
    isBunting,
    bodyType,
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
 * 홈런인가 — 판정 스위치 v = 8·12 (R2 3-2 의 켜는 곳).
 * 화면에 띄우는 문구는 사람이 읽는 글자라 바뀔 수 있으니 문구 대신 결과로 가린다.
 */
export function isHomeRunResolution(detail: PitchOutcomeDetail): boolean {
  const { resolution } = detail
  return resolution.kind === '타구' && resolution.outcome.kind === '홈런'
}

/**
 * 스킬 조건에 쓰는 타석 상황. HUD 가 없으면 기본 상황이다.
 * 타자 side 는 **폼의 낮은 비트 = 손**(0xb63c0, 0 우타 · 1 좌타)이다 — 화면 배치와 같은 값을 쓴다.
 * 투수 좌우는 원본 선수 레코드에서 아직 읽지 않아 0 — 추정.
 */
export function situationOf(
  hud: HudState | null,
  recentAtBatCodes: readonly number[] = [],
  batterForm = 0,
): SwingSituation {
  const bases = hud?.bases ?? { first: false, second: false, third: false }
  return {
    inning: hud?.inning ?? 1,
    isLosing: hud === null ? false : hud.ourScore < hud.opponentScore,
    runnerCount: Number(bases.first) + Number(bases.second) + Number(bases.third),
    hasSecondBaseRunner: bases.second,
    pitcherSide: 0,
    batterSide: batterSideOfForm(batterForm),
    balls: hud?.balls ?? 0,
    strikes: hud?.strikes ?? 0,
    batterOrderIndex: 0,
    recentAtBatCodes,
  }
}

/** CPU 투구 AI 에 넘길 볼카운트·주자 상황. side 는 타자 손이라 투구 원점·판정 기준점이 따라 갈린다 */
export function pitchSituationOf(hud: HudState | null, batterForm = 0): PitchSituation {
  const bases = hud?.bases ?? { first: false, second: false, third: false }
  return {
    strikes: hud?.strikes ?? 0,
    balls: hud?.balls ?? 0,
    outs: hud?.outs ?? 0,
    runnerCount: Number(bases.first) + Number(bases.second) + Number(bases.third),
    batterSide: batterSideOfForm(batterForm),
    side: batterSideOfForm(batterForm),
  }
}
