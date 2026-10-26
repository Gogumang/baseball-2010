import type { SceneHandles } from '@/app/dev/sceneShortcut'
import { scenePeeksNow } from '@/shared/lib/scenePeek/scenePeek'
import { touchKeyOffersNow } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import type { MissionPeek, PitcherGamePeek, TeamGamePeek } from '@/shared/lib/scenePeek/scenePeek'
import { MISSIONS } from '@/shared/config/original/missions'
import { EMPTY_SEASON_STATS } from '@/entities/career/model/seasonStats'
import { ACE_STAGE_THRESHOLDS, DERBY_PITCH_COUNT } from '@/entities/home-run-derby/model/derbyRules'
import { setDevDerbyStart } from '@/shared/lib/devDerbyStart/devDerbyStart'

/**
 * **장면 바로가기 표** (개발 · e2e 전용). 단계는 화면 상태를 꽂지 않고 메인 메뉴 · 관리 메뉴가 부르는 **그 진입 함수**를 부른다
 * (`EntryRoutes` 의 `onNewGame` · `onSelectMode`, 세션 훅의 `actions`). 메뉴 그림을 지나는 몫만 건너뛴다.
 * 난수 차례는 건드리지 않는다 — 픽스처의 `seed` 가 있으면 부팅 씨앗만 바꾼다.
 */
export type SceneStep =
  /** 진입 함수 부르기 — 그 그림의 손잡이로 */
  | { readonly kind: 'call'; readonly label: string; readonly run: (handles: SceneHandles) => void }
  /** 조건이 설 때까지 기다리기 */
  | { readonly kind: 'until'; readonly label: string; readonly test: (handles: SceneHandles) => boolean; readonly timeoutMs?: number }
  /** 키 누르고 떼기 (키보드 · 터치 버튼과 같은 사건) */
  | { readonly kind: 'key'; readonly key: string; readonly times?: number }
  | { readonly kind: 'wait'; readonly ms: number }
  /** 조건이 설 때까지 키를 되풀이해 누르기 (투구 → 타구 → 수비처럼 몇 번 만에 닿을지 모르는 곳) */
  | {
      readonly kind: 'keyUntil'
      readonly key: string
      readonly label: string
      readonly test: (handles: SceneHandles) => boolean
      readonly everyMs: number
      readonly timeoutMs: number
      /** 참인 동안은 누르지 않고 기다린다 — 타석(OK 가 곧 스윙)에서 공을 그냥 보내 난수 차례만으로 타석이 끝나게 */
      readonly holdWhen?: (handles: SceneHandles) => boolean
    }

export interface SceneDefinition {
  readonly description: string
  /** `?fixture=` 를 안 주면 깔 픽스처 (`e2e/fixtures/<이름>.json`). 'none' 이면 저장을 안 건드린다 */
  readonly fixture: string
  /** 픽스처의 부팅 씨앗 대신 쓸 씨앗 — 난수로만 닿는 장면(돌발미션)을 정하려고. `&seed=` 가 오면 그것이 먼저다 */
  readonly seed?: number
  readonly steps: readonly SceneStep[]
}

/** 메인 메뉴의 +0x3c 모드 번호 (`App.tsx` · `EntryRoutes.tsx` 와 같은 값) */
const MODE = { 일반: 1, 시즌: 2, 투수편: 3, 타자편: 4, 투수미션: 5, 타자미션: 6 } as const

const call = (label: string, run: (handles: SceneHandles) => void): SceneStep => ({ kind: 'call', label, run })
const until = (label: string, test: (handles: SceneHandles) => boolean, timeoutMs?: number): SceneStep =>
  timeoutMs === undefined ? { kind: 'until', label, test } : { kind: 'until', label, test, timeoutMs }
const key = (name: string, times?: number): SceneStep => (times === undefined ? { kind: 'key', key: name } : { kind: 'key', key: name, times })
const wait = (ms: number): SceneStep => ({ kind: 'wait', ms })
const keyUntil = (
  name: string,
  label: string,
  test: (handles: SceneHandles) => boolean,
  everyMs: number,
  timeoutMs: number,
  holdWhen?: (handles: SceneHandles) => boolean,
): SceneStep =>
  holdWhen === undefined
    ? { kind: 'keyUntil', key: name, label, test, everyMs, timeoutMs }
    : { kind: 'keyUntil', key: name, label, test, everyMs, timeoutMs, holdWhen }
/** 그 순간 화면이 알리는 터치 상황 버튼 — 나리 타석(번트 '8')을 가른다(돌발미션 장면이 타석에서 OK 를 안 누르게) */
const offersHave = (label: string) => () => touchKeyOffersNow().some((offer) => offer.label.includes(label))
/**
 * 돌발미션 창(`BurstMissionWindow`, role dialog '돌발미션') — 진행기에 판정(`lastBurstResolution`)이 있으면 결과 창, 없으면 타석 앞 제안 창.
 * 창이 없으면 null
 */
const burstWindowOf = (handles: SceneHandles): '제안' | '결과' | null => {
  if (document.querySelector('[role="dialog"][aria-label="돌발미션"]') === null) return null
  return handles.career.progress?.lastBurstResolution == null ? '제안' : '결과'
}
/**
 * 팀 경기 화면이 알리는 지금 자리(`shared/lib/scenePeek` — 버튼 글자 · 화면 구조에 기대지 않는다). r192 가 '*' · '#' 상황 버튼을
 * 걷고 "*MENU" · "#TIME" 글자 자리 누름 칸으로 바꾼 뒤 예전 표('대타' · '교체' 버튼 기다림)는 시간 초과로 끝났다(r222).
 */
const teamGameIs = (test: (peek: TeamGamePeek) => boolean) => () => {
  const peek = scenePeeksNow().teamGame
  return peek !== undefined && test(peek)
}
/** 나리 투수편 경기 화면이 알리는 지금 자리 (`PitcherGameScreen`) */
const pitcherGameIs = (test: (peek: PitcherGamePeek) => boolean) => () => {
  const peek = scenePeeksNow().pitcherGame
  return peek !== undefined && test(peek)
}
/** 미션 경기 화면이 알리는 지금 자리 (`MissionPlayScreen` · `PitchingScreen`) */
const missionIs = (test: (peek: MissionPeek) => boolean) => () => {
  const peek = scenePeeksNow().mission
  return peek !== undefined && test(peek)
}
const screenIs = (kind: SceneHandles['screen']['kind']) => until(`화면 ${kind}`, (handles) => handles.screen.kind === kind)

/** 켤 때 길 그대로 — 이용안내(아무 키) → 로고(저절로) → 타이틀 */
const TO_TITLE: readonly SceneStep[] = [
  screenIs('이용안내'),
  key('Enter'),
  until('화면 타이틀', (h) => h.screen.kind === '타이틀', 15000),
  // 들어오는 연출이 끝나 "PRESS" 깜빡임(`data-prompt-frame`)이 서야 키를 받는다
  until('타이틀 키 받기', () => document.querySelector('[data-prompt-frame]') !== null, 15000),
]

/** 나리 타자편 — 게임시작 목록 [나만의리그] → [14] 타자편 답(`onNewGame('타자편')`): 저장이 있으면 이어하기 0x1c154 */
const TO_NARI_MANAGEMENT: readonly SceneStep[] = [
  call('타자편 이어하기 (onNewGame 타자편)', (h) => {
    h.setLastPlayedMode(MODE.타자편)
    h.career.actions.continueSaved()
  }),
  screenIs('관리'),
]

/** 시즌모드 — 게임시작 목록 [시즌모드] 답(`onSelectMode('시즌모드')`) */
const TO_SEASON_MANAGEMENT: readonly SceneStep[] = [
  call('시즌모드 들어가기 (onSelectMode 시즌모드)', (h) => {
    h.setLastPlayedMode(MODE.시즌)
    h.setScreen({ kind: '시즌모드' })
  }),
  until('시즌 관리 메뉴 0xc9', (h) => h.screen.kind === '시즌모드' && h.season.scene === 0xc9),
]

/** 나리 투수편 — 게임시작 목록 [나만의리그] → [14] 투수편 답(`onNewGame('투수편')`): 저장이 있으면 관리 */
const TO_PITCHER_MANAGEMENT: readonly SceneStep[] = [
  call('투수편 들어가기 (onNewGame 투수편)', (h) => {
    h.setLastPlayedMode(MODE.투수편)
    h.setScreen({ kind: '투수편' })
  }),
  until('투수편 관리', (h) => h.screen.kind === '투수편' && h.pitcher.scene === '관리'),
]

/**
 * 투수편 관리 [다음경기] 하위 메뉴 [경기시작] 답(`onNextGame` = `openNextGameStandings`) → 109 순위 · 142 경기 준비 · 로딩 · 인트로 ·
 * 0xe 소개 판은 OK. 우리 공격 반 이닝은 간이 엔진 중계(모드 3 은 키를 안 받는다)라 그대로 흘려보낸다. 구질 고르기(0xf)가 서면 멈춘다
 */
const TO_PITCHER_PITCH: readonly SceneStep[] = [
  ...TO_PITCHER_MANAGEMENT,
  call('관리 [다음경기] → 경기시작 (openNextGameStandings)', (h) => h.pitcher.actions.openNextGameStandings()),
  keyUntil('Enter', '투수편 구질 고르기 0xf', pitcherGameIs((peek) => peek.isPitchSlotPickerShown), 400, 90000),
]

/** 미션 하나 — 게임시작 목록 [미션] 답(하위 17 선수 고르기) → 나리 선수 → 미션 목록에서 고른 미션의 [61] 예(`actions.begin`) */
const toMission = (side: '타자' | '투수', id: number): readonly SceneStep[] => [
  call('미션 (onSelectMode 미션)', (h) => h.setScreen({ kind: '미션선택' })),
  screenIs('미션선택'),
  call(`선수 고르기 나리 ${side} (choosePlayer)`, (h) => {
    if (side === '타자' ? h.career.savedCareer === null : h.pitcher.career === null) throw new Error(`나리 ${side} 저장이 없다`)
    // 메인 메뉴 길의 choosePlayer 는 모드를 먼저 적는다(App 의 missionFromMenu)
    h.setLastPlayedMode(side === '투수' ? MODE.투수미션 : MODE.타자미션)
    h.mission.actions.choosePlayer({ side, hallOfFameIndex: null })
  }),
  until('미션 목록', (h) => h.mission.player !== null),
  wait(300),
  call(`미션 ${side} ${id} [61] 예 (begin)`, (h) => {
    const mission = MISSIONS.find((row) => row.side === side && row.id === id)
    if (mission === undefined) throw new Error(`미션이 없다: ${side} ${id}`)
    h.mission.actions.begin(mission)
  }),
  screenIs(side === '투수' ? '투수미션' : '미션진행'),
]

/** 시즌모드 들어가기 — 진입 분기 0xcb 가 저장의 phase · 국가대항전 칸을 보고 고른 상태까지 (`enterSeasonScene`) */
const toSeasonState = (state: number, label: string): readonly SceneStep[] => [
  call('시즌모드 들어가기 (onSelectMode 시즌모드)', (h) => {
    h.setLastPlayedMode(MODE.시즌)
    h.setScreen({ kind: '시즌모드' })
  }),
  until(label, (h) => h.screen.kind === '시즌모드' && h.season.scene === state),
]

/** 게임시작 목록 [홈런더비] 답 — 선수 고르기(하위 16). 커서는 나리 타자 칸 */
/**
 * **더비 단계 N 에서 시작** (A-07) — 더비 화면에 들어서기 전에 첫 판을 그 단계의 시작 상태로 적어 둔다(`shared/lib/devDerbyStart`):
 * 단계 N · 누적 = 문턱 표 0xd84dc[N − 1](그 단계로 막 오른 값) · 남은 기회 10(`&derbyPitches=<1~10>` 으로 바꾼다). 첫 0xd 가 그 단계
 * 마투수(0xcfce8[N − 1])를 세우고 0xe 소개 판에서 OK 를 기다린다. 게임 길(실제 단계 오름 0xae3e8 → 0xd)과 같은 판을 실제로 쳐서
 * 닿지 않고 보려고 — 이 장면 밖에서는 칸을 안 쓴다
 */
function derbyStageScenes(stages: readonly number[]): Record<string, SceneDefinition> {
  const entries = stages.map((stage): [string, SceneDefinition] => [
    `derby-stage${stage}`,
    {
      description: `홈런더비 단계 ${stage} 에서 시작 — 누적 ${ACE_STAGE_THRESHOLDS[stage - 1]}M · 마투수 소개 0xe (\`&derbyPitches=\` 남은 기회, 기본 10)`,
      fixture: 'nari-y1',
      steps: [
        call(`더비 단계 ${stage} 시작 상태`, () => {
          const asked = Number(new URLSearchParams(window.location.search).get('derbyPitches') ?? DERBY_PITCH_COUNT)
          const remainingPitches = Number.isInteger(asked) && asked >= 1 && asked <= DERBY_PITCH_COUNT ? asked : DERBY_PITCH_COUNT
          setDevDerbyStart({ stage, totalDistance: ACE_STAGE_THRESHOLDS[stage - 1] ?? 0, remainingPitches })
        }),
        ...TO_DERBY_PICK,
        key('Enter'),
        until(`더비 단계 ${stage} 타석 0xe`, () => scenePeeksNow().homeRunDerby?.acceptsConfirm === true, 15000),
        wait(500),
      ],
    },
  ])
  return Object.fromEntries(entries)
}

const TO_DERBY_PICK: readonly SceneStep[] = [
  call('홈런더비 (onSelectMode 홈런더비)', (h) => h.setScreen({ kind: '홈런더비' })),
  screenIs('홈런더비'),
  wait(600),
]

/** 일반모드 빠른실행 → 경기정보. 빈 저장이면 경기설정 창(전역기록 +0x11e)이 저절로 뜬다 */
const TO_GENERAL_QUICK: readonly SceneStep[] = [
  call('일반모드 빠른실행 (onStartGeneralMode true)', (h) => {
    h.setLastPlayedMode(MODE.일반)
    h.startGeneralMode(true)
  }),
  screenIs('일반모드'),
  wait(1200),
]

/**
 * 경기설정 창 [이닝 플레이](처음 칸) → [자동진행 없음] → "현재 설정으로 플레이" 예 → 경기정보 PLAY BALL → 로딩 판 → 인트로(0xc).
 * 인트로는 원본도 OK 로 끝난다(0x39b54 — 54틱을 다 안 기다린다). 인트로가 끝나면 더 누르지 않는다(첫 타석 0xe 의 OK 를 먹지 않게)
 */
const TO_GENERAL_GAME: readonly SceneStep[] = [
  ...TO_GENERAL_QUICK,
  key('Enter'),
  wait(700),
  key('Enter'),
  wait(700),
  key('Enter'),
  wait(1000),
  key('Enter'),
  until('경기 화면(인트로)', teamGameIs(() => true), 15000),
  keyUntil('Enter', '인트로 OK', teamGameIs((peek) => peek.isIntroDone), 300, 15000),
]

/**
 * 나리 타자편 이어하기 — [14] 타자편 답(`onNewGame('타자편')`)의 `continueSaved`(0x1c154)가 저장의 S+0x50 · 대회 칸 · 엔딩 칸으로
 * 고른 자리까지 (soak 픽스처 — `src/app/model/soak/soakFixtures.test.tsx`)
 */
const toNariResume = (kind: SceneHandles['screen']['kind']): readonly SceneStep[] => [
  call('타자편 이어하기 (onNewGame 타자편)', (h) => {
    h.setLastPlayedMode(MODE.타자편)
    h.career.actions.continueSaved()
  }),
  screenIs(kind),
]

/** 나리 투수편 들어가기 — 투수 저장의 이어할 자리(`pitcherResumePointOf`)가 고른 장면까지 */
const toPitcherResume = (scene: SceneHandles['pitcher']['scene']): readonly SceneStep[] => [
  call('투수편 들어가기 (onNewGame 투수편)', (h) => {
    h.setLastPlayedMode(MODE.투수편)
    h.setScreen({ kind: '투수편' })
  }),
  until(`투수편 ${scene}`, (h) => h.screen.kind === '투수편' && h.pitcher.scene === scene),
]

/** 지금 뜬 알림 상자(`MessageBox` — role dialog '알림')에 그 이름의 단추가 있는가 */
const messageBoxHas = (button: string) => () =>
  document.querySelector(`[role="dialog"][aria-label="알림"] button[aria-label="${button}"]`) !== null

/**
 * 134 진입 팝업(히든 팀 열림 · 칭호 8)을 OK 로 닫는다 — 대진판의 확인 칸(`NationalCupBracket` — 팝업이 다 닫혀야 선다)이 서면 멈춘다.
 * 대진판 확인 자체는 누르지 않는다
 */
const CLOSE_CUP_ENTRY_POPUPS = keyUntil(
  'Enter',
  '134 진입 팝업 닫힘',
  () => document.querySelector('[role="group"][aria-label="국가대항전 대진"] button[aria-label="확인"]') !== null,
  700,
  10000,
)

/** 대진 128 위에 뜬 팝업 (타자편 화면 · 투수편 세션) — 없으면 null */
const postseasonPopupOf = (h: SceneHandles): string | null => {
  if (h.screen.kind === '포스트시즌') return h.screen.popup?.kind ?? null
  if (h.screen.kind === '투수편' && h.pitcher.scene === '포스트시즌') return h.pitcher.postseasonPopup?.kind ?? null
  return null
}

/**
 * 내 시리즈 차례인 대진 128 에서 [다음](키 0x13da0 — 내 차례면 142) → 142 경기 준비 [확인] → 144 → 경기 장면 인트로를 OK 로 넘긴다.
 * `isStarted`(타자편 첫 내 타석 · 투수편 첫 구질 고르기 0xf)가 서면 더 누르지 않는다(타석 · 구질 고르기의 OK 를 먹지 않게)
 */
const POSTSEASON_GAME_START = (isPrepare: (h: SceneHandles) => boolean, isStarted: (h: SceneHandles) => boolean): readonly SceneStep[] => [
  wait(600),
  keyUntil('Enter', '142 경기 준비', isPrepare, 700, 10000),
  wait(900),
  keyUntil('Enter', '포스트시즌 경기 시작', isStarted, 400, 90000),
  wait(300),
]

/** 끝난 대진(내 팀 우승)에서 [다음] → StrMODE[137] 우승 팀 발표(팝업 7) — `korean` 이면 OK 로 닫아 StrMODE[190] 내 팀 우승(팝업 8)까지 */
const POSTSEASON_CHAMPION = (korean: boolean): readonly SceneStep[] => [
  wait(600),
  keyUntil('Enter', '우승 팀 발표 팝업 7 (StrMODE[137])', (h) => postseasonPopupOf(h) === '우승발표', 700, 10000),
  ...(korean ? [wait(700), keyUntil('Enter', '한국시리즈 우승 팝업 8 (StrMODE[190])', (h) => postseasonPopupOf(h) === '한국시리즈우승', 700, 10000)] : []),
  wait(900),
]

/** 대회가 끝난 대진판(진입 팝업 닫음)에서 확인(0x19fdc) → 결과 팝업 0x25 */
const CUP_RESULT_POPUP: readonly SceneStep[] = [
  wait(600),
  CLOSE_CUP_ENTRY_POPUPS,
  wait(600),
  keyUntil('Enter', '국가대항전 결과 팝업 0x25', messageBoxHas('확인'), 700, 10000),
  wait(900),
]

/** 엔딩 141 이 선 뒤 — 연말 · 은퇴 이벤트(114)를 OK 로 넘긴다(선택지는 처음 커서). 엔딩 화면이 서면 멈춘다 */
const EVENT_TO_ENDING = (isEnding: (h: SceneHandles) => boolean): readonly SceneStep[] => [
  keyUntil('Enter', '엔딩 141', isEnding, 300, 90000),
  wait(1500),
]

export const SCENES: Readonly<Record<string, SceneDefinition>> = {
  title: {
    description: '타이틀 (켤 때 길: 이용안내 → 로고 → 타이틀)',
    fixture: 'none',
    steps: TO_TITLE,
  },
  'main-menu': {
    description: '메인 메뉴 처음 단 (타이틀에서 키)',
    fixture: 'none',
    steps: [...TO_TITLE, key('Enter'), screenIs('메인메뉴'), wait(600)],
  },
  'nari-new': {
    description: '나리 타자편 새로 — 팀 고르기 (저장 없음, onNewGame 타자편)',
    fixture: 'empty',
    steps: [
      call('타자편 새로 (onNewGame 타자편)', (h) => {
        h.setLastPlayedMode(MODE.타자편)
        if (h.career.savedCareer !== null) throw new Error('타자편 저장이 있다 — fixture=none 으로 저장을 비워라')
        h.setScreen({ kind: '팀선택' })
      }),
      screenIs('팀선택'),
    ],
  },
  'pitcher-new': {
    description: '나리 투수편 새로 — 등록 (저장 없음, onNewGame 투수편)',
    fixture: 'empty',
    steps: [
      call('투수편 들어가기 (onNewGame 투수편)', (h) => {
        h.setLastPlayedMode(MODE.투수편)
        h.setScreen({ kind: '투수편' })
      }),
      screenIs('투수편'),
    ],
  },
  'season-new': {
    description: '시즌모드 처음 — 팀 고르기 (저장 없음)',
    fixture: 'empty',
    steps: [
      call('시즌모드 들어가기 (onSelectMode 시즌모드)', (h) => {
        h.setLastPlayedMode(MODE.시즌)
        h.setScreen({ kind: '시즌모드' })
      }),
      screenIs('시즌모드'),
    ],
  },
  'nari-management': {
    description: '나리 타자편 관리 화면 105',
    fixture: 'nari-y1',
    steps: [...TO_NARI_MANAGEMENT, wait(900)],
  },
  'nari-evaluation': {
    description: '나리 타자편 116 경기 뒤 평가 — 경기 결과(정산 판, 경기 장면 0x19)를 세우고 OK 로 나가면(0x3f3) 나리 장면 116 → 114 평가 대사 (r287)',
    fixture: 'nari-y1',
    steps: [
      ...TO_NARI_MANAGEMENT,
      call('경기 결과 0x19 를 세운다(정산 효과 없이 정산 판만)', (h) => h.setScreen({
        kind: '경기결과',
        summary: {
          result: '승', ourScore: 5, opponentScore: 3, stats: EMPTY_SEASON_STATS, popularityPoints: 0, doublePlays: 0,
          scoringPositionOuts: 0,
          reputationCounts: { grandSlams: 0, walkOffs: 0, buntHits: 0, walks: 0, goAheadRuns: 0, tyingRuns: 0 },
          ourTeamId: h.career.career?.teamId ?? 0, opponentTeamId: 1, recordIds: [],
        },
        gamePointReward: 0,
        newTitles: [],
        evaluation: { popularityChange: 2, reputationChange: 3, moraleChange: 1, commentIndex: 40 },
        streakNotices: [],
      })),
      screenIs('경기결과'),
      wait(600),
      key('Enter'),
      screenIs('경기평가'),
      wait(900),
    ],
  },
  'nari-bat': {
    description: '나리 타자편 경기 — 1년차 첫 경기 내 첫 타석 0xe (관리 [다음경기] → 순위표 · 경기 준비 OK → 경기). 타이밍 재기 r242',
    fixture: 'nari-y1',
    // 픽스처는 부팅 씨앗이 없어 시계로 굴린다 — 브라우저 · 기기마다 같은 공 · 같은 판에 닿게 정한다
    seed: 1,
    steps: [
      ...TO_NARI_MANAGEMENT,
      call('관리 [다음경기] (runCommand)', (h) => h.career.actions.runCommand('다음경기')),
      // 타석 화면(`BattingStage`)이 서면 멈춘다 — 그 뒤 OK 는 스윙이라 누르지 않는다
      keyUntil('Enter', '나리 타석 0xe', () => scenePeeksNow().battingStage !== undefined, 400, 90000),
      wait(400),
    ],
  },
  'nari-outing': {
    description: '나리 타자편 외출 지도 112 (관리 [외출] — runCommand)',
    fixture: 'nari-y1',
    steps: [...TO_NARI_MANAGEMENT, call('관리 [외출]', (h) => h.career.actions.runCommand('외출')), screenIs('외출'), wait(600)],
  },
  'pitcher-management': {
    description: '나리 투수편 관리 화면',
    fixture: 'pitcher-y1',
    steps: [...TO_PITCHER_MANAGEMENT, wait(900)],
  },
  'pitcher-pitch': {
    description: '나리 투수편 경기 — 1년차 첫 경기 첫 수비 타석의 구질 고르기 0xf (관리 [다음경기] → 경기시작)',
    fixture: 'pitcher-y1',
    // 픽스처는 부팅 씨앗이 없어 시계로 굴린다 — 브라우저 · 기기마다 같은 공 · 같은 판에 닿게 정한다
    seed: 1,
    steps: [...TO_PITCHER_PITCH, wait(400)],
  },
  'pitcher-defense': {
    description: '나리 투수편 경기 — 던진 공이 맞아 뜬 내 수비 판 0x17 (구질 · 코스 · 게이지 OK 만 되풀이)',
    fixture: 'pitcher-y1',
    // 픽스처는 부팅 씨앗이 없어 시계로 굴린다 — 브라우저 · 기기마다 같은 공 · 같은 판에 닿게 정한다
    seed: 1,
    steps: [
      ...TO_PITCHER_PITCH,
      keyUntil('Enter', '투수편 수비 판 0x17', pitcherGameIs((peek) => peek.isDefensePlayShown), 500, 90000),
      wait(300),
    ],
  },
  'season-management': {
    description: '시즌모드 관리 메뉴 0xc9',
    fixture: 'season-y1',
    steps: [...TO_SEASON_MANAGEMENT, wait(900)],
  },
  'season-outing': {
    description: '시즌모드 외출 지도 0xd1 (관리 메뉴 칸 3 [외출] — goto)',
    fixture: 'season-y1',
    steps: [
      ...TO_SEASON_MANAGEMENT,
      call('관리 메뉴 [외출] (managementMenuTarget 3)', (h) => h.season.actions.goto(0xd1)),
      until('시즌 외출 지도 0xd1', (h) => h.season.scene === 0xd1),
      wait(600),
    ],
  },
  'season-postseason': {
    description: '시즌모드 포스트시즌 시작 0xee — 정규시즌 45경기를 마친 저장(phase 0xb)으로 들어가 시작 이벤트(0xd3)가 선 자리',
    fixture: 'season-postseason',
    steps: [
      call('시즌모드 들어가기 (onSelectMode 시즌모드)', (h) => {
        h.setLastPlayedMode(MODE.시즌)
        h.setScreen({ kind: '시즌모드' })
      }),
      // 진입 분기 0xcb 가 0xee 로 보내고, 0xee 는 곧바로 이벤트 재생 0xd3 을 연다
      until('포스트시즌 시작 0xee → 이벤트 0xd3', (h) => h.screen.kind === '시즌모드' && h.season.scene === 0xd3),
      wait(1500),
    ],
  },
  'season-cup': {
    description: '시즌모드 국가대항전 0xf3 — 1년차 정규시즌 45경기 · 결산 뒤 예선 1경기 앞 (진입 분기 0xcb 의 국가대항전 칸 갈래)',
    fixture: 'season-cup',
    steps: [...toSeasonState(0xf3, '국가대항전 0xf3'), wait(900)],
  },
  'general-quick': {
    description: '일반모드 빠른실행 — 경기정보(상태 22)에 경기설정 창이 저절로 뜬 자리 (진입 창 [13] 빠른실행 답)',
    fixture: 'general-bat',
    steps: TO_GENERAL_QUICK,
  },
  'general-bat': {
    description: '일반모드 타석 — 경기 시작 직후 1회초 사람 팀 첫 타자 (씨앗 1: 사람 선공 · 이닝플레이 자동진행 없음)',
    fixture: 'general-bat',
    steps: [...TO_GENERAL_GAME, until('사람 타석 0xe · 0xf', teamGameIs((peek) => peek.canBat && peek.acceptsChangeKey), 15000), wait(300)],
  },
  'general-pitch': {
    description: '일반모드 투구 — 경기 시작 직후 1회초 사람 투수 구질 고르기 (씨앗 2: CPU 선공)',
    fixture: 'general-pitch',
    steps: [
      ...TO_GENERAL_GAME,
      until('사람 수비 타석 0xe · 0xf', teamGameIs((peek) => peek.canPitch && peek.acceptsChangeKey), 15000),
      // 타자 소개 판을 OK 로 넘겨 구질 고르기 판(`PitchSlotPicker`)이 설 때까지
      keyUntil('Enter', '구질 고르기 0xf', teamGameIs((peek) => peek.isPitchSlotPickerShown), 700, 15000),
      wait(400),
    ],
  },
  'general-defense': {
    description: '일반모드 수비 — 사람 투수가 던져 타구가 뜬 인플레이 (씨앗 2 · OK 만 되풀이)',
    fixture: 'general-pitch',
    steps: [
      ...TO_GENERAL_GAME,
      until('사람 수비 타석 0xe · 0xf', teamGameIs((peek) => peek.canPitch && peek.acceptsChangeKey), 15000),
      // 구질 · 코스 · 게이지 모두 OK — 공을 칠 때까지 던진다
      keyUntil('Enter', '수비 판 0x17', teamGameIs((peek) => peek.defensePlaySide === '수비'), 500, 60000),
      wait(300),
    ],
  },
  'nari-burst-result': {
    description: '나리 타자편 돌발미션 결과 창 — 다음 타석 OK 대기의 꺼진 화면 전체 확인 칸 위 (r195). 씨앗 5: 첫 경기 일찍 제안(약 25초)',
    fixture: 'nari-y1',
    // 씨앗 0~19 를 훑어 제안 창이 가장 일찍 뜬 씨앗(r227 — 17 은 넷째 타석 앞 · 약 105초, 5 는 약 43초에 결과 창)
    seed: 5,
    steps: [
      ...TO_NARI_MANAGEMENT,
      call('관리 [다음경기]', (h) => h.career.actions.runCommand('다음경기')),
      // 순위 · 경기준비 · 타석 앞 OK 는 Enter, 타석(번트 '8' 이 뜸)에서는 누르지 않고 공을 보낸다 — 난수 차례만으로 간다
      keyUntil('Enter', '돌발미션 제안 창', (h) => burstWindowOf(h) === '제안', 250, 150000, offersHave('번트')),
      // 제안 창만 Enter 로 닫고 그 뒤로는 누르지 않는다 — 타석이 끝나면 결과 창이 다음 타석 OK 대기와 함께 저절로 선다
      keyUntil('Enter', '돌발미션 결과 창', (h) => burstWindowOf(h) === '결과', 250, 60000, (h) => burstWindowOf(h) !== '제안'),
      // 판이 오르고 글이 다 나올 때까지 — 결과 창이 선 직후 한 그림쯤 경기 화면이 다시 서며 창이 잠깐 빠지는 틈이 있어 넉넉히
      wait(3000),
      until('돌발미션 결과 창 그대로', (h) => burstWindowOf(h) === '결과', 3000),
    ],
  },
  'general-relay': {
    description: "일반모드 자동진행 중계 0x21 — 첫 타석에서 경기 중 메뉴 '*' [자동진행] 예 (general-bat 픽스처 씨앗 1)",
    fixture: 'general-bat',
    steps: [
      ...TO_GENERAL_GAME,
      until('사람 타석 0xe · 0xf', teamGameIs((peek) => peek.canBat && peek.acceptsChangeKey), 15000),
      key('*'),
      wait(500),
      key('ArrowDown'),
      key('Enter'),
      wait(400),
      // 자동진행 질문 상자 — 처음 커서 [예]
      keyUntil('Enter', '자동진행 중계 0x21', teamGameIs((peek) => peek.isAutoRelay), 400, 8000),
      wait(800),
    ],
  },
  'mission-bat': {
    description: '타자 미션 1 「명품 타자의 첫 걸음」 첫 타석 0xe (나리 타자편 저장의 선수 — 미션 선수 고르기 · 목록 [61] 예)',
    fixture: 'nari-y1',
    // 픽스처는 부팅 씨앗이 없어 시계로 굴린다 — 브라우저 · 기기마다 같은 공 · 같은 판에 닿게 정한다
    seed: 1,
    steps: [
      ...toMission('타자', 1),
      keyUntil('Enter', '미션 타석 0xe', missionIs((peek) => peek.side === '타자' && peek.isAwaitingConfirm), 400, 30000),
      wait(400),
    ],
  },
  'mission-pitch': {
    description: '투수 미션 3 「혼이 실린 스트라이크」 구질 고르기 0xf (나리 투수편 저장의 선수)',
    fixture: 'pitcher-y1',
    // 픽스처는 부팅 씨앗이 없어 시계로 굴린다 — 브라우저 · 기기마다 같은 공 · 같은 판에 닿게 정한다
    seed: 1,
    steps: [
      ...toMission('투수', 3),
      keyUntil('Enter', '미션 구질 고르기 0xf', missionIs((peek) => peek.side === '투수' && peek.isPitchSlotPickerShown), 400, 30000),
      wait(400),
    ],
  },
  'mission-result': {
    description: '투수 미션 3 결과 판 0x19 — 10구 제한까지 구질 · 코스 · 게이지 OK 만 되풀이',
    fixture: 'pitcher-y1',
    // 픽스처는 부팅 씨앗이 없어 시계로 굴린다 — 브라우저 · 기기마다 같은 공 · 같은 판에 닿게 정한다
    seed: 1,
    steps: [
      ...toMission('투수', 3),
      keyUntil('Enter', '미션 결과 판 0x19', missionIs((peek) => peek.isResultShown), 300, 150000),
      wait(1500),
    ],
  },
  'derby-pick': {
    description: '홈런더비 선수 고르기 (게임시작 목록 [홈런더비] 답)',
    fixture: 'nari-y1',
    steps: TO_DERBY_PICK,
  },
  'derby-start': {
    description: '홈런더비 시작 — 나리 타자를 골라 첫 공 앞 (1/10)',
    fixture: 'nari-y1',
    steps: [...TO_DERBY_PICK, key('Enter'), until('더비 타석 0xe (첫 공 앞)', () => scenePeeksNow().homeRunDerby?.acceptsConfirm === true, 15000), wait(500)],
  },
  ...derbyStageScenes([2, 3, 4]),
  'season-ending': {
    description: '시즌모드 10년차 엔딩 0xf5 — 저장 phase 6(엔딩)이라 진입 분기 0xcb 가 곧장 엔딩으로 (soak 픽스처)',
    fixture: 'season-ending',
    seed: 1,
    steps: [...toSeasonState(0xf5, '시즌 엔딩 0xf5'), wait(1500)],
  },
  'nari-postseason': {
    description: '나리 타자편 포스트시즌 128 시작 — 1년차 45경기 뒤 준플레이오프 대진 (이어하기가 128 진입 0x120a4 를 다시 밟는다, soak 픽스처)',
    fixture: 'nari-postseason',
    seed: 1,
    steps: [...toNariResume('포스트시즌'), wait(900)],
  },
  'nari-cup': {
    description: '나리 타자편 국가대항전 134 진입 대진판 — 134 가 처음 선 순간(463 끝) 저장의 이어하기가 134 로 돌아와 히든 팀 · 칭호 8 팝업 (soak 픽스처)',
    fixture: 'nari-cup',
    seed: 1,
    steps: [...toNariResume('국가대항전'), wait(900)],
  },
  'nari-cup-result': {
    description: '나리 타자편 국가대항전 134 — 대회가 끝난 대진판, 진입 팝업(히든 팀)을 닫은 자리 (OK 가 결과 팝업 0x25, soak 픽스처)',
    fixture: 'nari-cup-result',
    seed: 1,
    steps: [...toNariResume('국가대항전'), wait(600), CLOSE_CUP_ENTRY_POPUPS, wait(600)],
  },
  'nari-ending': {
    description: '나리 타자편 13년차 은퇴 엔딩 141 — 엔딩 직전 저장의 이어하기가 연말 · 은퇴 이벤트 114 로 가고 OK 로 넘겨 141 (soak 픽스처)',
    fixture: 'nari-ending',
    seed: 1,
    steps: [...toNariResume('이벤트'), ...EVENT_TO_ENDING((h) => h.screen.kind === '엔딩')],
  },
  'nari-hall-of-fame': {
    description: '나리 타자편 명예의 전당 등록 질문 0x2d — 보너스 뒤 저장의 이어하기가 141 로 곧장, 키로 제작진 → 등록 질문 (soak 픽스처)',
    fixture: 'nari-hall-of-fame',
    seed: 1,
    steps: [
      ...toNariResume('엔딩'),
      keyUntil('Enter', '명예의 전당 등록 질문', messageBoxHas('예'), 600, 30000),
      wait(600),
    ],
  },
  'pitcher-postseason': {
    description: '나리 투수편 포스트시즌 128 시작 — 1년차 45경기 뒤 준플레이오프 대진 (soak 픽스처)',
    fixture: 'pitcher-postseason',
    seed: 1,
    steps: [...toPitcherResume('포스트시즌'), wait(900)],
  },
  'pitcher-cup': {
    description: '나리 투수편 국가대항전 134 진입 대진판 — 저장의 대회 칸으로 들어서 히든 팀 팝업이 뜬 자리 (soak 픽스처)',
    fixture: 'pitcher-cup',
    seed: 1,
    steps: [...toPitcherResume('국가대항전'), wait(900)],
  },
  'pitcher-cup-result': {
    description: '나리 투수편 국가대항전 134 — 대회가 끝난 대진판, 진입 팝업(히든 팀)을 닫은 자리 (OK 가 결과 팝업 0x25, soak 픽스처)',
    fixture: 'pitcher-cup-result',
    seed: 1,
    steps: [...toPitcherResume('국가대항전'), wait(600), CLOSE_CUP_ENTRY_POPUPS, wait(600)],
  },
  'pitcher-ending': {
    description: '나리 투수편 13년차 은퇴 엔딩 141 — 엔딩 직전 저장으로 들어서 은퇴 이벤트 114 를 OK 로 넘겨 141 (soak 픽스처)',
    fixture: 'pitcher-ending',
    seed: 1,
    steps: [...toPitcherResume('이벤트'), ...EVENT_TO_ENDING((h) => h.screen.kind === '투수편' && h.pitcher.scene === '엔딩')],
  },
  'pitcher-hall-of-fame': {
    description: '나리 투수편 명예의 전당 등록 질문 0x2d — 보너스 뒤 저장으로 141 에 곧장, 키로 제작진 → 등록 질문 (soak 픽스처)',
    fixture: 'pitcher-hall-of-fame',
    seed: 1,
    steps: [
      ...toPitcherResume('엔딩'),
      keyUntil('Enter', '명예의 전당 등록 질문', messageBoxHas('예'), 600, 30000),
      wait(600),
    ],
  },
  // r254 — 사람 팀이 포스트시즌 시리즈를 직접 치르는 길 · 한국시리즈 우승 팝업 · 국가대항전 한국 우승 (soak 픽스처)
  'nari-postseason-game': {
    description: '나리 타자편 포스트시즌 내 시리즈 경기 시작 — 1년차 한국시리즈 내 차례 대진 [다음] → 142 경기 준비 → 경기 첫 내 타석 (soak 픽스처)',
    fixture: 'nari-postseason-game',
    seed: 1,
    steps: [
      ...toNariResume('포스트시즌'),
      // 타자편 경기 화면(`GameRoute`)은 들여다보기 칸이 없다 — 내 타석(터치 상황 버튼 번트 '8')이 서면 멈춘다(돌발미션 장면과 같은 표지)
      ...POSTSEASON_GAME_START((h) => h.screen.kind === '경기준비', (h) => h.screen.kind === '경기' && offersHave('번트')()),
    ],
  },
  'nari-postseason-next': {
    description: '나리 타자편 포스트시즌 내 시리즈가 끝나고 다음 라운드 — 7년차 준플레이오프를 이기고 116 → 114 → 128 로 돌아온 플레이오프 대진 (soak 픽스처)',
    fixture: 'nari-postseason-next',
    seed: 1,
    steps: [...toNariResume('포스트시즌'), wait(900)],
  },
  'nari-postseason-champion': {
    description: '나리 타자편 포스트시즌 끝 — 내 팀이 한국시리즈를 이긴 대진 [다음] → StrMODE[137] 우승 팀 발표 팝업 7 (soak 픽스처)',
    fixture: 'nari-postseason-champion',
    seed: 1,
    steps: [...toNariResume('포스트시즌'), ...POSTSEASON_CHAMPION(false)],
  },
  'nari-korean-series': {
    description: '나리 타자편 한국시리즈 우승 — 우승 팀 발표 팝업 7 을 OK 로 닫아 StrMODE[190] 내 팀 우승 팝업 8 (soak 픽스처)',
    fixture: 'nari-postseason-champion',
    seed: 1,
    steps: [...toNariResume('포스트시즌'), ...POSTSEASON_CHAMPION(true)],
  },
  'nari-cup-win': {
    description: '나리 타자편 국가대항전 한국 우승 — 대회가 끝난 대진판 확인 → 결과 팝업 0x25 (soak 픽스처, 씨앗 5 판)',
    fixture: 'nari-cup-win',
    seed: 1,
    steps: [...toNariResume('국가대항전'), ...CUP_RESULT_POPUP],
  },
  'nari-cup-cover': {
    description: '나리 타자편 국가대항전 끝 → 새 시즌 — 결과 · 보상 팝업을 닫으면 134 대진판이 선 채 아홉 틀 어두워지고 137 "N년차" 표지 (r287)',
    fixture: 'nari-cup-win',
    seed: 1,
    steps: [
      ...toNariResume('국가대항전'),
      ...CUP_RESULT_POPUP,
      keyUntil('Enter', '137 표지', (h) => h.screen.kind === '연차표지', 700, 15000),
    ],
  },
  'pitcher-postseason-game': {
    description: '나리 투수편 포스트시즌 내 시리즈 경기 시작 — 1년차 한국시리즈 내 차례 대진 [다음] → 142 경기 준비 → 경기 첫 구질 고르기 0xf (soak 픽스처)',
    fixture: 'pitcher-postseason-game',
    seed: 1,
    steps: [
      ...toPitcherResume('포스트시즌'),
      ...POSTSEASON_GAME_START(
        (h) => h.screen.kind === '투수편' && h.pitcher.scene === '경기준비',
        (h) => h.screen.kind === '투수편' && h.pitcher.scene === '경기' && pitcherGameIs((peek) => peek.isPitchSlotPickerShown)(),
      ),
    ],
  },
  'pitcher-postseason-next': {
    description: '나리 투수편 포스트시즌 내 시리즈가 끝나고 다음 라운드 — 6년차 준플레이오프를 이기고 돌아온 플레이오프 대진 (soak 픽스처)',
    fixture: 'pitcher-postseason-next',
    seed: 1,
    steps: [...toPitcherResume('포스트시즌'), wait(900)],
  },
  'pitcher-postseason-champion': {
    description: '나리 투수편 포스트시즌 끝 — 내 팀이 한국시리즈를 이긴 대진 [다음] → StrMODE[137] 우승 팀 발표 팝업 7 (soak 픽스처)',
    fixture: 'pitcher-postseason-champion',
    seed: 1,
    steps: [...toPitcherResume('포스트시즌'), ...POSTSEASON_CHAMPION(false)],
  },
  'pitcher-korean-series': {
    description: '나리 투수편 한국시리즈 우승 — 우승 팀 발표 팝업 7 을 OK 로 닫아 StrMODE[190] 내 팀 우승 팝업 8 (soak 픽스처)',
    fixture: 'pitcher-postseason-champion',
    seed: 1,
    steps: [...toPitcherResume('포스트시즌'), ...POSTSEASON_CHAMPION(true)],
  },
  'pitcher-cup-win': {
    description: '나리 투수편 국가대항전 한국 우승 — 3년차 대회가 끝난 대진판 확인 → 결과 팝업 0x25 (soak 픽스처)',
    fixture: 'pitcher-cup-win',
    seed: 1,
    steps: [...toPitcherResume('국가대항전'), ...CUP_RESULT_POPUP],
  },
}
