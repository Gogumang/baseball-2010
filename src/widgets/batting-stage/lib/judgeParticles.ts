import { STAGE_WIDTH, stageLayoutOf } from '@/widgets/batting-stage/lib/stageLayout'
import { judgeAnimationOf } from '@/widgets/batting-stage/lib/stageScenery'

/** 판정 글자 애니 9 — 표 0xcfe90 에서 판정 v = 5(삼진) 하나만 닿는다 (0x393d4 `movs r5, #9`) */
const STRIKEOUT_JUDGE_ANIMATION = 9

/** 파티클 한 발 — `emitParticles(장면, 설정(id), x, y, img)` = 원본 `0xbbc84(x, y, id, img, 0, −1, 0, 0)` */
export interface JudgeParticleShot {
  readonly id: number
  readonly x: number
  readonly y: number
  readonly img: number
}

/**
 * **삼진 양끝 파티클** — 판정 글자 0x393b4 의 보통 갈래(다섯째 인자 0, 0x39474~, r197 직접 뜸):
 * ```
 * 39474  0xba759(그림, 애니 r5, 2, x, y, …)          ; 판정 글자 (`drawResultText`)
 * 39492  r6 = [장면+0x2c] ; bne 394d6                 ; 상태 틱 0 인 그림만
 * 39498  cmp r5, #9 ; bne 394d6                       ; 애니 9 = 삼진(v 5)만
 * 394b2  0xbbc85(0, y, 7, 0xb, 0, −1, 0, 0)          ; ptc 008 · img 11 을 화면 왼끝
 * 394c0  w = [0x14008b8](…)                          ; 화면 폭 (240)
 * 394d2  0xbbc85(w, y, 8, 0xc, 0, −1, 0, 0)          ; ptc 009 · img 12 를 화면 오른끝
 * ```
 * y 는 0x39504 가 넘긴 판정 글자 원점 y(존 표 0xcfb7c[+0x17e1] — `judgeCenter`)다. 0x39504 는 상태 0x12 그리기 0x4ce9c 가
 * 조건 없이 부르므로(0x4d0a4) 0x12 틱 0 의 그림에서 한 번 — 그 틀 끝 관리자 틱(53048) 앞이다.
 */
export function strikeoutJudgeParticlesOf(resultText: string, side: number): readonly JudgeParticleShot[] {
  if (judgeAnimationOf(resultText) !== STRIKEOUT_JUDGE_ANIMATION) return []
  const { y } = stageLayoutOf(side).judgeCenter
  return [
    { id: 7, x: 0, y, img: 11 },
    { id: 8, x: STAGE_WIDTH, y, img: 12 },
  ]
}
