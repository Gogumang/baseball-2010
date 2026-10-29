import type { GameProgress } from '@/features/play-game/model/gameFlow'
import { summaryOf } from '@/features/play-game/model/gameFlow'
import type { RandomPort } from '@/shared/api/random/randomPort'
import {
  applyGameResult,
  applyLeagueDay,
  applySeasonEnd,
  countGameForSkills,
  nariLastGameOf,
  type PlayerCareer,
} from '@/entities/career/model/playerCareer'
import { nariMoraleOf, withNariTeamRecordMorales } from '@/entities/career/model/nariMorale'
import { advanceStreaks, evaluateGame, managerCommentIndexOf, streakEventOf, type GameEvaluation } from '@/entities/career/model/gameEvaluation'
import { gameResultTitleOf } from '@/entities/career/model/titles'
import { withGameSkillCounters } from '@/entities/story/model/skillCondition'
import { applyGameEvaluation, isEvaluatedGame, shownGameEvaluationOf } from '@/app/model/careerSession/settlement/gameEvaluation'

/** 정규 · 포스트시즌 경기 정산 결과 — 116 이 보일 값과 정산 뒤 커리어 */
export interface LeagueGameSettlement {
  readonly summary: ReturnType<typeof summaryOf>
  /** 116 감독 글까지 고른 평가 (포스트시즌이면 앞 평가 경기 값 — `shownGameEvaluationOf`) */
  readonly evaluation: GameEvaluation
  /** 116 이 직접 띄우는 칭호 39 — 없으면 null */
  readonly dynamite: string | null
  /** 116 이 쌓는 연속 기록 알림 · 보상 명령 (0x8a6fc) */
  readonly streak: ReturnType<typeof streakEventOf>
  /** 하루 끝 0xb818c 의 1위 갈래가 섰나 (S+0x7a 가 올랐다) */
  readonly tookFirstPlace: boolean
  /** S+0x50 = 2 · 지난 경기 재료까지 얹은 커리어 */
  readonly career: PlayerCareer
}

/**
 * 경기 후 평가 — 인기도 → 평판 → 사기 (0xa719c), 이어서 연속 기록 (0x8a6fc). 같은 날 나머지 네 경기도 원본대로 치러 순위표에
 * 넣는다(0xc2a48 — 난수). 45경기째면 하루 끝(0xb818c)이 정규시즌을 닫고 대진(0xb80a8)을 연다.
 * CPU 끼리의 포스트시즌 경기는 **여기서 돌리지 않는다** — 원본은 대진 화면 128 의 [확인](0x13da0)에서 돈다(`pressPostseason`).
 * 승리 31 · 패배 32 징글은 정산 0x19 진입, 평가 징글 36 · 37 · 38 은 116 진입이 낸다 — 여기서는 소리가 없다.
 */
export function rollLeagueGameSettlement(
  finished: GameProgress,
  currentCareer: PlayerCareer,
  random: RandomPort,
  aceLevels: Readonly<Record<number, number>> | undefined,
): LeagueGameSettlement {
  const summary = summaryOf(finished)
  const thisEvaluation = evaluateGame(currentCareer, summary)
  const isEvaluated = isEvaluatedGame(currentCareer)
  /*
   * 116 이 읽는 S+0x4a · +0x64 · +7 · S+0x1d8 은 평가 0xa719c(정규시즌만, 0x4f268)가 쓰는 칸이라 **포스트시즌 경기 뒤에는 앞 평가
   * 경기 값**이다 — 평가 창 숫자 · 감독 글 · 징글 · 경기 뒤 카운터(+0x1c2 · 먹튀) · 칭호 39 모두. 옛 저장에 앞 값이 없으면 이 경기 값.
   */
  const { evaluation: staleEvaluation, recordLine } = shownGameEvaluationOf(isEvaluated, thisEvaluation, currentCareer.lastGame, summary.stats)
  const resulted = applyGameResult(currentCareer, summary)
  // CPU 경기 0xc2a48(4f296)는 평가 0xa719c(4f274)가 사기를 바꾼 **뒤**다 — 간이 엔진 0xb570c b5768 이 두 팀 레코드 +2 에 그 사기를 쓴다
  const moraleAtCpuGames = nariMoraleOf(applyGameEvaluation(resulted, thisEvaluation, isEvaluated))
  // 사람 경기 상대의 리그 레코드 +2 는 이 경기에서 0xb570c 가 마지막으로 그 칸을 덮을 때의 나리 사기로 남는다 (`teamRecordMorales`, r101).
  // 마지막 타석의 돌발 보상이 사기를 바꾸면(0x1c · 0x1d 진입) 그 뒤 0x18 · 0x19 는 그 칸을 안 덮어 **바뀌기 전 값**이다
  // (`GameProgress.opponentRecordMorale`, r104). 그 값이 없는 옛 진행(경기 중 저장)은 경기 끝 값 그대로
  const settled = withNariTeamRecordMorales(
    applySeasonEnd(applyLeagueDay(resulted, summary.ourTeamId, random, aceLevels, moraleAtCpuGames)),
    [finished.opponentTeamId],
    finished.opponentRecordMorale ?? finished.teamMorale ?? nariMoraleOf(currentCareer),
  )
  // 평가 0xa719c 안 0xa690c 가 경기 뒤 누적 카운터 S+0x1f0 을 더한다 — 정규시즌(평가하는 경기)만 (`withGameSkillCounters`)
  const evaluated = applyGameEvaluation(isEvaluated ? withGameSkillCounters(settled, summary) : settled, thisEvaluation, isEvaluated)
  // 116 감독 글은 진입이 +0x4a 와 **평가 뒤** 평판 +0x62 로 고른다 (0x128d2~0x12938 — 모드 4 표 39~74)
  const evaluation = { ...staleEvaluation, commentIndex: managerCommentIndexOf(evaluated, staleEvaluation.popularityChange) }
  // 스킬 조건용 경기 뒤 카운터 — 사기까지 반영된 뒤에 센다 (A-4). 116 쪽(0x12bc2~0x12c3c)이라 포스트시즌에도 돈다 — 그때
  // +0x4a 는 앞 평가 경기 값이다(위).
  //    포스트시즌엔 정산 0xa8024 의 [sp+0x34] = 0xa56dc(지금 타자, 0)(a8070)가 거짓이라 그 게이트 여덟 곳이 막힌다 —
  //    a8362 도루 +0x2c · a8498 안타 +0x22 · a8538 2루타 +0x24 · a8578 3루타 +0x26 · a85c4 홈런 +0x28 · a8866 타수 +0x20 ·
  //    a895c 타점 +0x2a 는 `applyGameResult` 의 `withoutRecordLine` 이 뺀다. 남은 a84d6 은 장내 홈런 state[0x25] 를 홈런 수
  //    [sp+0x24] 에 더하는 자리라, 포스트시즌 장내 홈런은 a8210 이 루타 4 안타로 적되 홈런 갈래(a85be~a86b4 · e[0x13] a8728)를
  //    건너뛴다 — 경기 흐름이 판을 먹일 때 옮겼다(`resolveDefensePlay` 의 `isRecorded` → `finishPlayerOutcome`).
  //    a8024 를 다 보아도 타자 레코드 +0x20~+0x2c 를 게이트 없이 쓰는 곳은 없다 — 게이트 없는 레코드 쓰기는 수비 투수의
  //    +0x2a 사사구(a8b58 · a8bd2)뿐이라 타자편 내 기록에는 없다.
  const counted = countGameForSkills(evaluated, evaluation.popularityChange)
  // 연속 기록 칸을 잇는다. 116 의 0x8a6fc 는 그 칸을 읽어 알림 줄과 **보상 명령**(평판 · 슬럼프 스킬)을 내장 이벤트에
  // 쌓을 뿐이라, 보상은 114 가 이벤트를 틀 때(웹은 [확인] `confirmGameResult`) 먹는다 (`streakEventOf`)
  // 0xa4ce0 은 평가 0xa719c 안이라 포스트시즌 경기는 잇지 않는다 (0x4f268) — 116 은 지난 칸으로 알림·보상을 다시 쌓는다
  const advanced = isEvaluated ? advanceStreaks(counted, summary.stats) : counted
  // 0x1a1c0 칭호는 여기서 주지 않는다(관리 화면 갱신 0x1aec4 `pendingTitle`) — 116 은 칭호 39 하나만 직접 띄운다
  // (1299e: 이 경기 홈런 > 3 · 비트 없음 → +0x270 = 39 · 0x1274c 팝업). 진입은 팝업만 걸고 주는 것은 키 0x1b1e4 다
  // (`confirmGameResultTitle`) — 116 진입 저장(S+0x50 = 2)에는 비트가 없어 키 전에 끄면 이어하기가 팝업을 다시 띄운다.
  // 칭호 39 는 S+0x1d8[3] 을 본다 — 포스트시즌 경기 뒤에는 앞 평가 경기의 홈런 수다
  const dynamite = gameResultTitleOf(advanced.titleIds, recordLine.homeRuns)
  // 부상은 경기 뒤가 아니라 훈련 결과 창을 닫을 때 굴린다 (0x1b4c4)
  // 경기 뒤 평가 116 진입 0x1278c 가 S+0x50 = 2 · 저장 — 이어하기가 116 을 다시 띄운다(`continueSaved`). S 의 +0x4a ·
  // +0x1d8 처럼 지난 경기 재료를 저장에 남긴다(`lastGame`).
  return {
    summary,
    evaluation,
    dynamite,
    streak: streakEventOf(advanced),
    // 하루 끝 0xb818c 의 1위 갈래(b8266~b829c) — S+0x7a 다음에 통계 [mgr+0xc8]+0xfc(기록연감 셀 8 "나리 타자편 우승") +1 · 저장
    tookFirstPlace: settled.regularSeasonFirstCount > resulted.regularSeasonFirstCount,
    career: { ...advanced, seasonEndState: 116, lastGame: nariLastGameOf(summary, evaluation, recordLine) },
  }
}
