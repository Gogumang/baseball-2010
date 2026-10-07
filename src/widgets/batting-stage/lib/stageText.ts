import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { SwingSituation } from '@/entities/batting/model/swingSkills'
import type { HudState } from '@/widgets/batting-stage/lib/renderHud'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import type { PitchSituation } from '@/entities/pitching/model/selectPitch'
import type { Pitch } from '@/entities/pitching/model/pitch'
import { pitcherHandOfPitch } from '@/entities/pitching/model/pitcherHand'
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
    // 판정 v4 — game_judge 애니 7 "몸에 맞는 공" (stageScenery JUDGE_ANIMATIONS)
    case '사구':
      return '몸에 맞는 공'
    case '파울':
      return '파울'
    case '스트라이크':
      return resolution.isSwinging ? '헛스윙' : '스트라이크'
    case '타구': {
      // 2스트라이크 번트 파울 아웃(판정 11)은 판 없이 그 자리에서 아웃이다 — 원본 game_judge 그림(아웃)
      if (detail.isBuntFoulOut === true) return '아웃'
      // 맞은 공의 안타·아웃은 수비 판(상태 0x17)이 끝나야 정해진다 — 타석에 실린 결과는 임시 값이라(`battedContact`)
      // 맞는 순간에는 글자를 띄우지 않는다. 담장을 먼저 넘는 궤적만 HOMERUN 연출(아래 `isHomeRunResolution`)로 간다
      if (resolution.outcome.kind === '홈런') return '홈런!'
      return ''
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
 *
 * 투수 좌우는 타석 판정 0xab214 가 **던진 투수 레코드**로 `0xb63c0` 을 바로 부른 값이다
 * (0xab9f0 좌완UP 13 · 0xaba1e 우완UP 14) — 공에 실린 폼·+0x18 로 `pitcherHandOfPitch` 가 낸다.
 * 공을 안 넘기면 0(우투)으로 본다 — 13 은 늘 꺼지고 14 는 늘 켜지는 옛 동작이다.
 *
 * `batterRecordSlot` 은 투수 스킬 31(0xabcd8)이 보는 `0xb6394(타자)` = 타자 레코드 `+0xa & 0x1f` 다 —
 * 타순이 아니라 **레코드의 팀 안 칸 번호**(일반 타자 0~11, 마타자 순번, 0xb53f0 이 자리를 옮길 때 0xb6604 로
 * 다시 쓴다 — S6 3-4)이고 2·3·4 면 C −10%. 안 넘기면 0 (31 은 늘 꺼짐).
 */
export function situationOf(
  hud: HudState | null,
  recentAtBatCodes: readonly number[] = [],
  batterForm = 0,
  pitch?: Pick<Pitch, 'pitcherForm' | 'pitcherMagicNumber'>,
  batterRecordSlot = 0,
): SwingSituation {
  const bases = hud?.bases ?? { first: false, second: false, third: false }
  return {
    inning: hud?.inning ?? 1,
    isLosing: hud === null ? false : hud.ourScore < hud.opponentScore,
    runnerCount: Number(bases.first) + Number(bases.second) + Number(bases.third),
    hasSecondBaseRunner: bases.second,
    pitcherSide: pitch === undefined ? 0 : pitcherHandOfPitch(pitch),
    batterSide: batterSideOfForm(batterForm),
    balls: hud?.balls ?? 0,
    strikes: hud?.strikes ?? 0,
    batterOrderIndex: batterRecordSlot,
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
    hasSecondBaseRunner: bases.second,
    batterSide: batterSideOfForm(batterForm),
    side: batterSideOfForm(batterForm),
  }
}
