import { useEffect, useMemo, useState } from 'react'
import type { Screen } from '@/app/model/screen'
import { bootSeed, createSeededRandom } from '@/shared/api/random/seededRandom'
import { useGameSettings } from '@/app/model/useGameSettings'
import { useSceneEnterSound, useSound, useSoundLevelKeys, useSoundPauseOnHide } from '@/app/model/useSound'
import { screenEnterSoundOf, useSceneEnterStop } from '@/app/model/screenBgm'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { createGameStartCursor } from '@/pages/main-menu/model/mainMenu'
import { preloadLazyScreens } from '@/shared/lib/lazyScreen/lazyScreen'
import { noteSafePoint } from '@/shared/lib/staleBuild/staleBuild'
import { SAFE_TO_RELOAD_SCREENS } from '@/app/ui/app/appConstants'
import type { AfterStores } from '@/app/ui/app/useAppStores'

/** 앱 껍데기 — 환경설정 · 소리 통로 · 부팅 씨앗 · 화면 칸 · 덩이 미리 받기 · 다시 부르기 안전 지점 · 일반모드 진입 칸 · 들어설 때 소리 */
export function useAppShell(app: Pick<AfterStores, 'bootScreen' | 'settingsStore'>) {
  const { bootScreen, settingsStore } = app
  const gameSettings = useGameSettings(settingsStore)
  // 소리 통로 하나 — 환경설정 칸(0~4) × 25 가 원본 소리 크기다 (옵션 +0x2e)
  const sound = useSound(gameSettings.settings.soundLevel)
  // 앱 전역 키 처리 0x2ddc 의 소리 단축키 −13 · −14 · 단말 일시정지 0x2da0 의 소리 멈춤 (`useSound.ts`)
  useSoundLevelKeys(sound, gameSettings.settings.soundLevel, (soundLevel) => {
    gameSettings.setSettings({ ...gameSettings.settings, soundLevel })
  })
  useSoundPauseOnHide(sound)
  // 부팅 씨앗 — 원본 0x2ed8 은 밀리초 시계의 아래 32비트 (저장 · 읽기 때 다시 세우기는 옮기지 않았다 — seededRandom 머리 주석)
  const seed = useMemo(() => bootSeed(), [])
  const random = useMemo(() => createSeededRandom(seed), [seed])
  // 켤 때는 장면 0x103 생성자의 [0x140006c] = −1 갈래 — 하위 0x2a <이용안내> 부터 (→ 2 로고 → 3 타이틀)
  const [screen, setScreen] = useState<Screen>(() => bootScreen ?? { kind: '이용안내' })
  // 모드 화면 덩이(`lazyScreen`)는 로고가 끝난 뒤(타이틀부터) 받아 둔다 — 타이틀 · 메인 메뉴에 머무는 동안 다 온다.
  // 이용안내 · 로고 동안 받으면 스크립트가 로고 그림보다 앞서 줄을 차지해 느린 4G 에서 로고가 2초 가까이 비었다(r224 측정).
  // 한 덩이씩 받아 화면 그림과 덜 다툰다
  const isPastLogo = screen.kind !== '이용안내' && screen.kind !== '로고'
  useEffect(() => {
    if (isPastLogo) void preloadLazyScreens()
  }, [isPastLogo])
  // 새 배포 뒤 열려 있던 탭은 저장된 자리에서만 다시 부른다 — 켤 때 길 · 타이틀 · 메인 메뉴는 날아갈 진행이 없다 (r318, `staleBuild`)
  const isSafeToReload = SAFE_TO_RELOAD_SCREENS.has(screen.kind)
  useEffect(() => {
    noteSafePoint(isSafeToReload)
  }, [isSafeToReload])
  /** 게임시작 목록 커서 전역 [0x1552d24] — 장면 0x103 이 내려가도 남는다(관리 메뉴 취소로 하위 5 에 바로 서면 그 칸) */
  const [gameStartCursor] = useState(createGameStartCursor)
  /** 일반모드 진입 창 [13] 에서 빠른실행을 골랐는가 (원본 메인 메뉴 this+0x14c) */
  const [isGeneralQuickStart, setGeneralQuickStart] = useState(false)
  /** 일반모드 이어하기로 올린 진행 — 있으면 준비 화면 없이 경기 장면으로 (0x213c0(앱, 1, 0) → 0x104) */
  const [generalResume, setGeneralResume] = useState<TeamGameProgress | null>(null)
  // 화면에 들어설 때 한 번 나는 소리 (`SCREEN_ENTER_SOUND` — 지금은 없다. 로고 음성 0 은 `EntryRoutes` 의 onLogoVoice)
  useSceneEnterSound(sound, screen.kind, screenEnterSoundOf(screen))
  // 환경설정 진입 0x259fc 끝의 소리 끊기 0x6e419
  useSceneEnterStop(sound, screen)
  return {
    gameSettings,
    sound,
    seed,
    random,
    isPastLogo,
    isSafeToReload,
    screen,
    setScreen,
    gameStartCursor,
    isGeneralQuickStart,
    setGeneralQuickStart,
    generalResume,
    setGeneralResume,
  }
}

/** 이 훅까지 선 앱 칸 */
export type AfterShell = AfterStores & ReturnType<typeof useAppShell>
