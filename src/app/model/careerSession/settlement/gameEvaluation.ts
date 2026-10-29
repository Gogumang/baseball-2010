import { isBugFixed } from '@/shared/config/bugfixes'
import { gainMorale, gainPopularity, gainReputation, nariRecordLineOf, type PlayerCareer } from '@/entities/career/model/playerCareer'
import type { GameEvaluation } from '@/entities/career/model/gameEvaluation'

/**
 * **경기 뒤 평가 창의 좋음·보통·나쁨 징글** (36 · 37 · 38).
 *
 * 나만의리그 상태 116(경기 뒤 평가) 안 `0x12c96~0x12cc6` — 디스어셈 재확인:
 * ```
 * 00012c96: ldr r3,[r4] ; adds r3,#0x4a ; ldrsb r0,[r3,r0]  ; p = (s8)레코드[+0x4a]
 * 00012c9e: cmp r0,#0 ; bge 0x12cb2
 * 00012ca4: movs r1,#0x26        ; p < 0      → 38
 * 00012cb6: cmp r0,#1 ; bgt 0x12cc0
 * 00012cbc: movs r1,#0x25        ; 0 ≤ p ≤ 1 → 37
 * 00012cc2: movs r1,#0x24        ; p > 1     → 36
 * ```
 * 시즌모드 쪽(0xdea0 = 0x105 상태 0xe9, 경기 뒤 관중·수입 창)은 같은 모양인데 문턱만 **3** 이다
 * (0xdece `cmp r3,#3`). 이 세션은 **나만의리그 타자편**(모드 4 · 장면 0x106)이라 문턱 1 을 쓴다.
 *
 * 레코드 `+0x4a` = **직전 경기 인기도 변화 p** 로 확정돼 있다 (A 0절 "+0x4a s8: 지난 경기
 * 인기도 변화 (0xa68ca 가 쓴다) 확정" · P1 5-2 정정). 웹 값은 `evaluation.popularityChange` 다.
 *
 * 우는 때는 116 진입이다 — 경기 결과(경기 장면 0x104 의 0x18 · 0x19)와 평가(나리 장면 0x106 의 116)가 따로 서는 원본처럼 웹도
 * 두 화면이라(r287) 승패 징글 31 · 32 는 정산 0x19 진입, 평가 징글은 정산 판을 나가 116 이 선 그 틀에 낸다(`enterGameEvaluationScreen`).
 */
const MY_LEAGUE_EVALUATION_THRESHOLD = 1

export function evaluationJingleIdOf(popularityChange: number): number {
  if (popularityChange < 0) return 38
  return popularityChange > MY_LEAGUE_EVALUATION_THRESHOLD ? 36 : 37
}

/**
 * **경기 뒤 평가 0xa719c 는 정규시즌 경기만 탄다** (모드 4 도 투수편과 같은 갈래, 6921426).
 *
 * 유일한 호출지 0x4ea0c 안 0x4f274 앞에서 0x4f216 이 L+0xac(국가대항전)면, 0x4f268 이 L+0x34(포스트시즌)면
 * 0x4f29a(하루 끝)로 건너뛴다. 이 갈래에는 모드 갈림이 없다. 국가대항전 경기는 웹도 `finishCupGame` 이 커리어 정산을
 * 아예 안 타므로 남는 것은 포스트시즌이다. 포스트시즌 표시는 45번째 경기의 하루 끝(0xb818c → 0xb80a8)에야 서므로
 * **경기 전 커리어**로 가른다 — 45번째 경기는 평가된다.
 */
export function isEvaluatedGame(careerBeforeGame: Pick<PlayerCareer, 'postseason'>): boolean {
  return careerBeforeGame.postseason === null
}

/** 평가 변화 없음 — 포스트시즌 경기는 0xa719c 를 안 타 인기도 · 평판 · 사기가 그대로다 (B-73 고친 길의 116 숫자) */
const NO_EVALUATION_CHANGE = { popularityChange: 0, reputationChange: 0, moraleChange: 0 } as const

/**
 * 116 이 보일 평가 숫자와 기록 줄 — S+0x4a · +0x64 · +7 · S+0x1d8 은 평가 0xa719c(정규시즌만 — 0x4f268 `ldrb L+0x34 ; bne 0x4f29a`)가 쓴다.
 * ⚠️ 원본 버그(B-73): 포스트시즌 경기 뒤 116 은 **앞 정규 경기의** 평가 숫자 · 기록 줄(타수 안타 타점 홈런) · 칭호 39 판정을 다시 보인다.
 * 옛 저장에 앞 값이 없으면 이 경기 값.
 * **고침(`bugfixes.json` B-73, 기본 켬)**: 기록 줄은 이 경기 값, 평가 숫자는 실제로 안 바뀌었으므로 0 (감독 글은 부르는 곳이 0 으로 다시 고른다).
 * 굴림 없음 — 다만 116 쪽 스킬 카운터(`countGameForSkills` +0x1c2 · 먹튀)가 0 을 세고 칭호 39 가 이 경기 홈런을 본다.
 */
export function shownGameEvaluationOf(
  isEvaluated: boolean,
  thisEvaluation: GameEvaluation,
  previous: PlayerCareer['lastGame'],
  stats: Parameters<typeof nariRecordLineOf>[0],
): { readonly evaluation: GameEvaluation; readonly recordLine: ReturnType<typeof nariRecordLineOf> } {
  if (isEvaluated) return { evaluation: thisEvaluation, recordLine: nariRecordLineOf(stats) }
  if (isBugFixed('B-73')) return { evaluation: { ...thisEvaluation, ...NO_EVALUATION_CHANGE }, recordLine: nariRecordLineOf(stats) }
  if (previous === undefined) return { evaluation: thisEvaluation, recordLine: nariRecordLineOf(stats) }
  return { evaluation: previous.evaluation, recordLine: previous.recordLine ?? nariRecordLineOf(previous.summary.stats) }
}

/** 평가(인기도 → 평판 → 사기, 0xa719c)를 얹는다 — 평가하지 않는 경기면 그대로 */
export function applyGameEvaluation(
  career: PlayerCareer,
  evaluation: Pick<GameEvaluation, 'popularityChange' | 'reputationChange' | 'moraleChange'>,
  isEvaluated: boolean,
): PlayerCareer {
  if (!isEvaluated) return career
  return gainMorale(gainReputation(gainPopularity(career, evaluation.popularityChange), evaluation.reputationChange), evaluation.moraleChange)
}
