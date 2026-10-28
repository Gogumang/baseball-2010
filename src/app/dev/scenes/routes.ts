// 장면으로 가는 공통 길 — 메인 메뉴 · 관리 메뉴가 부르는 진입 함수를 차례로 (도메인 파일이 같이 쓴다).
import type { SceneHandles } from '@/app/dev/sceneShortcut'
import { MISSIONS } from '@/shared/config/original/missions'
import type { SceneStep } from '@/app/dev/scenes/steps'
import { MODE, call, until, key, wait, keyUntil, teamGameIs, pitcherGameIs, screenIs } from '@/app/dev/scenes/steps'

/** 켤 때 길 그대로 — 이용안내(아무 키) → 로고(저절로) → 타이틀 */
export const TO_TITLE: readonly SceneStep[] = [
  screenIs('이용안내'),
  key('Enter'),
  until('화면 타이틀', (h) => h.screen.kind === '타이틀', 15000),
  // 들어오는 연출이 끝나 "PRESS" 깜빡임(`data-prompt-frame`)이 서야 키를 받는다
  until('타이틀 키 받기', () => document.querySelector('[data-prompt-frame]') !== null, 15000),
]

/** 나리 타자편 — 게임시작 목록 [나만의리그] → [14] 타자편 답(`onNewGame('타자편')`): 저장이 있으면 이어하기 0x1c154 */
export const TO_NARI_MANAGEMENT: readonly SceneStep[] = [
  call('타자편 이어하기 (onNewGame 타자편)', (h) => {
    h.setLastPlayedMode(MODE.타자편)
    h.career.actions.continueSaved()
  }),
  screenIs('관리'),
]

/** 시즌모드 — 게임시작 목록 [시즌모드] 답(`onSelectMode('시즌모드')`) */
export const TO_SEASON_MANAGEMENT: readonly SceneStep[] = [
  call('시즌모드 들어가기 (onSelectMode 시즌모드)', (h) => {
    h.setLastPlayedMode(MODE.시즌)
    h.setScreen({ kind: '시즌모드' })
  }),
  until('시즌 관리 메뉴 0xc9', (h) => h.screen.kind === '시즌모드' && h.season.scene === 0xc9),
]

/** 나리 투수편 — 게임시작 목록 [나만의리그] → [14] 투수편 답(`onNewGame('투수편')`): 저장이 있으면 관리 */
export const TO_PITCHER_MANAGEMENT: readonly SceneStep[] = [
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
export const TO_PITCHER_PITCH: readonly SceneStep[] = [
  ...TO_PITCHER_MANAGEMENT,
  call('관리 [다음경기] → 경기시작 (openNextGameStandings)', (h) => h.pitcher.actions.openNextGameStandings()),
  keyUntil(
    'Enter',
    '투수편 구질 고르기 0xf',
    pitcherGameIs((peek) => peek.isPitchSlotPickerShown),
    400,
    90000,
  ),
]

/** 미션 하나 — 게임시작 목록 [미션] 답(하위 17 선수 고르기) → 나리 선수 → 미션 목록에서 고른 미션의 [61] 예(`actions.begin`) */
export const toMission = (side: '타자' | '투수', id: number): readonly SceneStep[] => [
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
export const toSeasonState = (state: number, label: string): readonly SceneStep[] => [
  call('시즌모드 들어가기 (onSelectMode 시즌모드)', (h) => {
    h.setLastPlayedMode(MODE.시즌)
    h.setScreen({ kind: '시즌모드' })
  }),
  until(label, (h) => h.screen.kind === '시즌모드' && h.season.scene === state),
]

/** 게임시작 목록 [홈런더비] 답 — 선수 고르기(하위 16). 커서는 나리 타자 칸 */
export const TO_DERBY_PICK: readonly SceneStep[] = [
  call('홈런더비 (onSelectMode 홈런더비)', (h) => h.setScreen({ kind: '홈런더비' })),
  screenIs('홈런더비'),
  wait(600),
]

/** 일반모드 빠른실행 → 경기정보. 빈 저장이면 경기설정 창(전역기록 +0x11e)이 저절로 뜬다 */
export const TO_GENERAL_QUICK: readonly SceneStep[] = [
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
export const TO_GENERAL_GAME: readonly SceneStep[] = [
  ...TO_GENERAL_QUICK,
  key('Enter'),
  wait(700),
  key('Enter'),
  wait(700),
  key('Enter'),
  wait(1000),
  key('Enter'),
  until(
    '경기 화면(인트로)',
    teamGameIs(() => true),
    15000,
  ),
  keyUntil(
    'Enter',
    '인트로 OK',
    teamGameIs((peek) => peek.isIntroDone),
    300,
    15000,
  ),
]

/**
 * 나리 타자편 이어하기 — [14] 타자편 답(`onNewGame('타자편')`)의 `continueSaved`(0x1c154)가 저장의 S+0x50 · 대회 칸 · 엔딩 칸으로
 * 고른 자리까지 (soak 픽스처 — `src/app/model/soak/soakFixtures.test.tsx`)
 */
export const toNariResume = (kind: SceneHandles['screen']['kind']): readonly SceneStep[] => [
  call('타자편 이어하기 (onNewGame 타자편)', (h) => {
    h.setLastPlayedMode(MODE.타자편)
    h.career.actions.continueSaved()
  }),
  screenIs(kind),
]

/** 나리 투수편 들어가기 — 투수 저장의 이어할 자리(`pitcherResumePointOf`)가 고른 장면까지 */
export const toPitcherResume = (scene: SceneHandles['pitcher']['scene']): readonly SceneStep[] => [
  call('투수편 들어가기 (onNewGame 투수편)', (h) => {
    h.setLastPlayedMode(MODE.투수편)
    h.setScreen({ kind: '투수편' })
  }),
  until(`투수편 ${scene}`, (h) => h.screen.kind === '투수편' && h.pitcher.scene === scene),
]
