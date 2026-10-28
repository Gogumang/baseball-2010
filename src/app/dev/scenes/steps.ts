// 장면 바로가기 표의 걸음 꼴과 걸음 짓는 도우미 — 도메인 파일(`menu.ts` · `nari.ts` …)이 같이 쓴다.
import type { SceneHandles } from '@/app/dev/sceneShortcut'
import { scenePeeksNow } from '@/shared/lib/scenePeek/scenePeek'
import { touchKeyOffersNow } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import type { MissionPeek, PitcherGamePeek, TeamGamePeek } from '@/shared/lib/scenePeek/scenePeek'

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
  /**
   * 경기 중간 스냅샷 이름 — `e2e/snapshots/<이름>.json.gz` 가 있으면 단계를 밟지 않고 그 순간을 곧장 되살린다(`&real=1` 이면 밟는다).
   * 실제 시간으로 공을 여러 번 보내야 닿거나 여는 데 오래 걸리는 장면(가벼운 맥락에서 열기 10초 넘음, r342). 뜨기 · 같음 확인은 `yarn e2e:snapshot`
   */
  readonly snapshot?: string
  readonly steps: readonly SceneStep[]
}

/** 메인 메뉴의 +0x3c 모드 번호 (`App.tsx` · `EntryRoutes.tsx` 와 같은 값) */
export const MODE = { 일반: 1, 시즌: 2, 투수편: 3, 타자편: 4, 투수미션: 5, 타자미션: 6 } as const

export const call = (label: string, run: (handles: SceneHandles) => void): SceneStep => ({ kind: 'call', label, run })
export const until = (label: string, test: (handles: SceneHandles) => boolean, timeoutMs?: number): SceneStep =>
  timeoutMs === undefined ? { kind: 'until', label, test } : { kind: 'until', label, test, timeoutMs }
export const key = (name: string, times?: number): SceneStep => (times === undefined ? { kind: 'key', key: name } : { kind: 'key', key: name, times })
export const wait = (ms: number): SceneStep => ({ kind: 'wait', ms })
export const keyUntil = (
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
export const offersHave = (label: string) => () => touchKeyOffersNow().some((offer) => offer.label.includes(label))
/**
 * 돌발미션 창(`BurstMissionWindow`, role dialog '돌발미션') — 진행기에 판정(`lastBurstResolution`)이 있으면 결과 창, 없으면 타석 앞 제안 창.
 * 창이 없으면 null
 */
export const burstWindowOf = (handles: SceneHandles): '제안' | '결과' | null => {
  if (document.querySelector('[role="dialog"][aria-label="돌발미션"]') === null) return null
  return handles.career.progress?.lastBurstResolution == null ? '제안' : '결과'
}
/**
 * 팀 경기 화면이 알리는 지금 자리(`shared/lib/scenePeek` — 버튼 글자 · 화면 구조에 기대지 않는다). r192 가 '*' · '#' 상황 버튼을
 * 걷고 "*MENU" · "#TIME" 글자 자리 누름 칸으로 바꾼 뒤 예전 표('대타' · '교체' 버튼 기다림)는 시간 초과로 끝났다(r222).
 */
export const teamGameIs = (test: (peek: TeamGamePeek) => boolean) => () => {
  const peek = scenePeeksNow().teamGame
  return peek !== undefined && test(peek)
}
/** 나리 투수편 경기 화면이 알리는 지금 자리 (`PitcherGameScreen`) */
export const pitcherGameIs = (test: (peek: PitcherGamePeek) => boolean) => () => {
  const peek = scenePeeksNow().pitcherGame
  return peek !== undefined && test(peek)
}
/** 미션 경기 화면이 알리는 지금 자리 (`MissionPlayScreen` · `PitchingScreen`) */
export const missionIs = (test: (peek: MissionPeek) => boolean) => () => {
  const peek = scenePeeksNow().mission
  return peek !== undefined && test(peek)
}
export const screenIs = (kind: SceneHandles['screen']['kind']) => until(`화면 ${kind}`, (handles) => handles.screen.kind === kind)

/** 지금 뜬 알림 상자(`MessageBox` — role dialog '알림')에 그 이름의 단추가 있는가 */
export const messageBoxHas = (button: string) => () =>
  document.querySelector(`[role="dialog"][aria-label="알림"] button[aria-label="${button}"]`) !== null
