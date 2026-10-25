/// <reference types="vite/client" />
import type { Dispatch, SetStateAction } from 'react'
import type { Screen } from '@/app/model/screen'
import type { useCareerSession } from '@/app/model/useCareerSession'
import type { useMissionSession } from '@/app/model/useMissionSession'
import type { usePitcherLeagueSession } from '@/app/model/usePitcherLeagueSession'
import type { useSeasonSession } from '@/app/model/useSeasonSession'

/**
 * **장면 바로가기 손잡이** (웹 개발 도구 — 원본에 없다). `?scene=nari-outing&fixture=nari-y1` 처럼 주소로 화면에 곧바로 들어간다.
 *
 * 개발 서버(`import.meta.env.DEV`)와 `vite build --mode e2e` 산출물에서만 켜진다. 부르는 곳(`main.tsx` · `App.tsx`)은 스위치를
 * **그 자리에 그대로** `import.meta.env.DEV || import.meta.env.MODE === 'e2e'` 로 쓴다 — vite 가 두 값을 글자로 바꿔 배포 빌드에서
 * 그 덩이와 동적 import(진행기 · 장면 표 · 픽스처)가 통째로 빠진다. 이 파일에서 상수로 내보내 쓰면 rolldown 이 모듈 너머 상수를
 * 접지 않아 픽스처까지 배포 산출물에 실렸다(r210 에서 확인 — `e2e/README.md` 의 grep).
 *
 * 이 파일은 앱이 정적으로 부르는 작은 칸만 든다 — 장면 표와 진행기는 `sceneRunner.ts` · `scenes.ts` 에 있고 켜졌을 때만 동적으로 읽는다.
 */

/** 바로가기가 부르는 진입 손잡이 — App 이 그릴 때마다 지금 값으로 갈아 끼운다(세션 훅의 액션은 그 그림의 상태를 쥔다) */
export interface SceneHandles {
  readonly screen: Screen
  readonly setScreen: Dispatch<SetStateAction<Screen>>
  readonly career: ReturnType<typeof useCareerSession>
  readonly pitcher: ReturnType<typeof usePitcherLeagueSession>
  readonly season: ReturnType<typeof useSeasonSession>
  readonly mission: ReturnType<typeof useMissionSession>
  /** 메인 메뉴 게임시작 목록의 [일반모드] · [빠른실행] 답과 같은 길 (`App` 의 `onStartGeneralMode`) */
  readonly startGeneralMode: (isQuickStart: boolean) => void
  /** 전역기록 +0x3c 적기 — 메인 메뉴가 모드에 들어가기 전에 적는 칸 */
  readonly setLastPlayedMode: (mode: number) => void
}

let handles: SceneHandles | null = null

/** App 이 그릴 때마다 부른다 — 켜졌을 때만 */
export function publishSceneHandles(next: SceneHandles): void {
  handles = next
}

export function sceneHandlesNow(): SceneHandles | null {
  return handles
}

let bootSeedOverride: number | null = null

/** 픽스처가 정한 부팅 씨앗 — 없으면 null(원래대로 `bootSeed()`) */
export function devBootSeed(): number | null {
  return bootSeedOverride
}

export function setDevBootSeed(seed: number | null): void {
  bootSeedOverride = seed
}
