import type { SceneHandles } from '@/app/dev/sceneShortcut'
import { scenePeeksNow } from '@/shared/lib/scenePeek/scenePeek'
import { touchKeyOffersNow } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import type { TeamGamePeek } from '@/shared/lib/scenePeek/scenePeek'

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
const MODE = { 일반: 1, 시즌: 2, 투수편: 3, 타자편: 4 } as const

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

/** 게임시작 목록 [홈런더비] 답 — 선수 고르기(하위 16). 커서는 나리 타자 칸 */
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
  'nari-outing': {
    description: '나리 타자편 외출 지도 112 (관리 [외출] — runCommand)',
    fixture: 'nari-y1',
    steps: [...TO_NARI_MANAGEMENT, call('관리 [외출]', (h) => h.career.actions.runCommand('외출')), screenIs('외출'), wait(600)],
  },
  'pitcher-management': {
    description: '나리 투수편 관리 화면',
    fixture: 'pitcher-y1',
    steps: [
      call('투수편 들어가기 (onNewGame 투수편)', (h) => {
        h.setLastPlayedMode(MODE.투수편)
        h.setScreen({ kind: '투수편' })
      }),
      until('투수편 관리', (h) => h.screen.kind === '투수편' && h.pitcher.scene === '관리'),
      wait(900),
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
    description: '나리 타자편 돌발미션 결과 창 — 다음 타석 OK 대기의 꺼진 화면 전체 확인 칸 위 (r195). 씨앗 17: 넷째 타석 앞 제안',
    fixture: 'nari-y1',
    seed: 17,
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
}
