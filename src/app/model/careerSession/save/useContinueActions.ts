import { isBugFixed } from '@/shared/config/bugfixes'
import { countGameForSkills, nextOpponentOf, type PlayerCareer } from '@/entities/career/model/playerCareer'
import { gameResultTitleOf } from '@/entities/career/model/titles'
import { streakEventOf } from '@/entities/career/model/gameEvaluation'
import { nariTeamsOf, recordMatchAcesOf, seatNariMatchAces } from '@/entities/career/model/nariTeamRecord'
import { nationalCupMatchupOf } from '@/entities/national-cup/model/nationalCup'
import type { NariGameMatch } from '@/pages/management/lib/nariMatchPrepare'
import { enterSeasonEvent, resumePointOf } from '@/app/model/seasonEvents'
import { type CareerScope, useCareerValue } from '@/app/model/careerSession/atoms/careerScope'
import { rawCareerAtom, savedCareerAtom } from '@/app/model/careerSession/atoms/careerAtoms'
import { matchPreparedAtom } from '@/app/model/careerSession/atoms/sceneAtoms'
import { matchAcesAtom } from '@/app/model/careerSession/atoms/uiAtoms'
import { useSetUpNariScene } from '@/app/model/careerSession/state/useSceneSetUp'
import { useBeginGame } from '@/app/model/careerSession/game/useBeginGame'
import { seasonFlowOf } from '@/app/model/careerSession/seasonEnd/seasonFlow'

/** 마선수는 저장의 나리 팀 레코드에 있다(142 가 넣었다). 레코드가 없던 옛 저장이면 모드 저장 칸에 남겨 둔 그림자를 넣는다 */
function withLegacyMatchAces(saved: PlayerCareer, match: NariGameMatch | null): PlayerCareer {
  if (saved.nariTeams !== undefined || match?.aces === null || match?.aces === undefined) return saved
  return { ...saved, nariTeams: seatNariMatchAces(nariTeamsOf(saved), saved.teamId, nextOpponentOf(saved), match.aces) }
}

/** S+0x50 == 2(1c26a) — 116 진입이 저장한 지난 경기 재료. 그 자리가 아니면 null */
function evaluationResumeGameOf(saved: PlayerCareer): NonNullable<PlayerCareer['lastGame']> | null {
  if (saved.seasonEndState !== 116 || saved.lastGame === undefined) return null
  return saved.lastGame
}

/** 이어하기 · 곧장 경기 (그림마다 새 함수 — 옛 꼴 그대로) */
export function useContinueActions(scope: CareerScope) {
  const { atoms, audio, setScreen } = scope
  const savedCareer = useCareerValue(atoms, savedCareerAtom)
  const setUpNariScene = useSetUpNariScene(scope)
  const { beginGame, beginCupGame } = useBeginGame(scope)
  const { startNewSeason, enterGameEvaluationScreen, enterPostseason } = seasonFlowOf(scope)

  /**
   * **S+0x50 == 2(1c26a) 면 116 을 다시 띄운다** (0x1278c 직접 떴다): 진입이 S+0x50 = 2 · 저장 뒤 S 의 칸(+7 · 사기 0xa3a25 ·
   * +0x4a 인기도 변화 · 인기도 0xb6e79 · +0x64 · +0x62 평판 · S+0x1d8 기록)으로 0x8a6fc(12b6e)를 불러 평가 내장 이벤트를 다시
   * 쌓고, 경기 뒤 카운터(12bc2~12c3c: +0x1c7 무력감 · +0x1c2 += +0x4a · 0xa4d09 · +0x1cd/+0x1c0 먹튀)를 **다시 쓴 뒤** 저장 →
   * [114 → 105/109/136/128]. 114 가 그 이벤트를 틀면 연속 기록 보상 명령도 다시 먹는다 — 이어하기마다 겹쳐 쌓인다(원본 버그 B-28 —
   * 고친 길은 카운터를 다시 쓰지 않는다. 웹의 보상 명령은 [확인] 한 번에만 먹으므로 겹치는 것은 카운터뿐이다).
   * 경기 정산(0x4ea0c — 승패 · G · 평가 0xa719c · 리그 하루)은 다시 안 돈다. 결과 판(상태 0x18)의 승패 징글도 없다.
   */
  const reenterGameEvaluation = (saved: PlayerCareer, lastGame: NonNullable<PlayerCareer['lastGame']>) => {
    // 116 진입 0x1278c 다시 — 원본은 카운터를 한 번 더 쓰고(겹쳐 쌓임, B-28) 평가 창을 다시 띄운다.
    // 고친 길(기본)은 첫 진입이 이미 센 저장 그대로 창만 다시 띄운다(굴림 없음 — 난수 차례 같음)
    const counted = isBugFixed('B-28') ? saved : countGameForSkills(saved, lastGame.evaluation.popularityChange)
    // 1299e 도 다시 — 비트가 이미 섰으면 팝업을 안 건다. 주는 것은 키 0x1b1e4 (`confirmGameResultTitle`)
    const dynamite = gameResultTitleOf(counted.titleIds, (lastGame.recordLine ?? lastGame.summary.stats).homeRuns)
    // 116 진입 — 평가 징글(12c96)까지. 경기 결과(경기 장면 0x18 · 0x19)는 다시 안 선다
    atoms.set(rawCareerAtom, counted)
    enterGameEvaluationScreen({
      newTitles: dynamite === null ? [] : [dynamite],
      evaluation: lastGame.evaluation,
      streakNotices: streakEventOf(counted).notices,
      streakRewards: streakEventOf(counted).rewards,
    })
  }

  /** 이어하기 자리에 그 커리어를 그대로 두고 화면만 선다 */
  const resumeScreen = (saved: PlayerCareer, screen: Parameters<typeof setScreen>[0]) => {
    atoms.set(rawCareerAtom, saved)
    setScreen(screen)
  }

  /** 상태 100 진입 0x1c154 의 S+0x50 분기 (`resumePointOf`) — 그 상태가 진입에서 하는 일을 다시 한다 */
  const resumeAt = (saved: PlayerCareer) => {
    const point = resumePointOf(saved)
    // 1c24e — S+0x50 == 6|7 이 맨 앞 갈래다: 141 진입 0x12300 을 다시 밟는다. 보너스를 받은 뒤 저장이라(S+0x7b) 키 0x1220c 가
    // 보너스 팝업 없이 등록 팝업 0x2d 를 띄운다(`EndingScreen.isBonusReceived`)
    if (point.kind === '엔딩') return resumeScreen(saved, { kind: '엔딩', endingIndex: point.endingIndex, fromResume: true })
    const lastGame = evaluationResumeGameOf(saved)
    if (lastGame !== null) return reenterGameEvaluation(saved, lastGame)
    // 1c25e — S+0x50 == 0x11(464 거절 보상 뒤 끊김) · 1c308(0xa 갈래) → 새 시즌 처리 0x1b768 → 1c3be(0xbcb49(1)) — 남은 +0x289 를
    // 연초 114 틀이 9 틀째에 받아 137 을 띄운다(`startNewSeason` · `nariYearCover` 의 이어하기 길)
    if (point.kind === '새시즌') return startNewSeason(saved, { fromResume: true })
    if (point.kind === '이벤트')
      return resumeScreen(enterSeasonEvent(saved, point.eventId), { kind: '이벤트', eventId: point.eventId, context: '시즌' })
    // 그 밖 갈래의 첫 줄 1c346~1c35a — S+0x12c(국가대항전 중)면 134 대진판. S+0xb4(끝난 포스트시즌)보다 먼저다(`resumePointOf`).
    // 463 끝이 S+0x50 = 3 으로 두므로 대회 중엔 늘 이 갈래다. 134 의 틀 0x1b92c 머리 — 들어온 첫 틀에 비트 8 이 없으면 칭호 8
    // "국가 대표" 팝업. 이어하기로 들어와도 같다(463 보상 뒤 끊겼으면 아직 없다 — 대회 중 끊겼으면 이미 있어 안 뜬다). 팝업 · 히든 팀 열기는 화면 몫이다
    if (point.kind === '국가대항전') return resumeScreen(saved, { kind: '국가대항전', cup: point.cup })
    if (point.kind === '포스트시즌') return enterPostseason(saved, true)
    // 109 — 100 → 1(자원 적재) → 109 라 이전 상태가 1: 취소가 안 먹고 바닥 1, 배경음 4 (0x10d8c · 0x105f0)
    resumeScreen(saved, point.kind === '다음경기순위' ? { kind: '다음경기순위', fromManagement: false } : { kind: '관리' })
  }

  /**
   * 이어하기 — 상태 100 진입 0x1c154 의 S+0x50 분기 (`resumePointOf`).
   * 시즌 끝 사슬 안이면 그 상태로 돌아가 그 상태가 진입에서 하는 일을 다시 한다 — 136·130·131·132 는 이벤트를 다시 틀고,
   * 128 은 진입 0x120a4 를 다시 밟는다(S+0x77 이 서 있으면 정규시즌 우승 팝업을 다시 안 띄운다).
   * 팝업 7·8 은 저장되지 않는다 — 원본도 128 [확인]이 우승 팀 발표부터 다시 띄우고, 팝업 8 보상은 132 진입과 함께 적힌다.
   */
  const continueSaved = () => {
    if (savedCareer === null) return
    // 장면 0x106 이 새로 선다 — 장면+0x288 = 0 (0xfb7c) · 반복 이벤트 · 커서 · mgr+0x304 (0xf684)
    setUpNariScene()
    // 100 진입 0x1c154 의 머리 1c15e `0x6e439` stopBgm — S+0x50 갈래보다 먼저 늘 부른다(r163 직접 뜸). 메인 메뉴 1 이 끊겨
    // 134 대진판 · 116 경기 결과처럼 배경음을 안 트는 자리는 소리 없이 선다. 105 · 109 · 128 · 141 은 화면 배경음 표가 이 뒤
    // 그리기에서 제 소리를 튼다(`useSceneBgm` — 번호가 1 에서 바뀐다)
    audio.stopBgm()
    resumeAt(savedCareer)
  }

  return {
    continueSaved,

    /**
     * **곧장 경기** — [14] 타자편·[최근게임](모드 4)의 0x327b8 모드 3·4 갈래(3288e~328b4): 전역기록 `+0x44 && +0x50` 이면
     * `0x213c0(앱, 4, 0)` 으로 타자편 저장을 올려 장면 0x104 → 셋업 0x39fdc 모드 3·4 갈래가 그 저장으로 경기를 새로 세운다
     * (나리 경기는 반 이닝 저장이 없어 그만둔 경기를 처음부터 — 같은 일정·142 가 명부에 넣은 마선수 그대로). 장면 0x106 을
     * 거치지 않아 142 진입(마선수 굴림)도 없다. 경기가 끝나면 나리 장면이 새로 서고 상태 100 0x1c154 로 이어진다.
     * 국가대항전 경기(S+0x12c)는 저장의 대회 칸과 대표팀 칸 두 개로 다시 세운다(대회가 없는 옛 웹 저장만 이어하기로).
     */
    resumeInterruptedGame: (match: NariGameMatch | null): void => {
      if (savedCareer === null) return
      // 경기 뒤 나리 장면이 새로 선다 — 장면+0x288 = 0
      atoms.set(matchPreparedAtom, false)
      if (match?.isNationalCup === true) {
        // 대회 경기 — 셋업 0x39fdc 모드 4 갈래가 올린 저장의 S+0x12c · 대회 칸(L+0xa8~)과 142 가 고쳐 둔 대표팀 칸 두 개로 그 경기를
        // 처음부터 다시 세운다(0x1f8f8 — 팀 10 → +0xbc4 · 그 밖 → +0xbe0). 142 를 안 거쳐 구장 굴림이 없다.
        // 대회가 없는 옛 웹 저장(대회를 저장하지 않던 때)이면 이어하기로 간다
        const cup = savedCareer.nationalCup
        const matchup = cup === undefined ? null : nationalCupMatchupOf(cup)
        if (cup === undefined || matchup === null) return continueSaved()
        atoms.set(rawCareerAtom, savedCareer)
        return beginCupGame(savedCareer, matchup, cup)
      }
      const loaded = withLegacyMatchAces(savedCareer, match)
      atoms.set(matchAcesAtom, recordMatchAcesOf(nariTeamsOf(loaded), loaded.teamId, nextOpponentOf(loaded)))
      atoms.set(rawCareerAtom, loaded)
      beginGame(loaded)
    },
  }
}
