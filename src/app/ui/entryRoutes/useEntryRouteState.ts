import { useMemo, useState } from 'react'
import type { HallOfFamePlayerPick } from '@/entities/collection/model/collection'
import { createLocalStorageJsonStore } from '@/shared/api/save/localStorageJsonStore'
import { createGameStartCursor } from '@/pages/main-menu/model/mainMenu'
import { INITIAL_SECRET_CODE_STATE } from '@/pages/record/lib/statCells'
import type { EntryRoutesProps } from '@/app/ui/entryRoutes/entryRoutesProps'

/** 홈런더비 최고 비거리 저장 칸 */
const DERBY_BEST_KEY = 'compus-baseball/derby-best'

/** 메뉴 장면 0x103 의 칸 — 기록연감 비밀 번호 · 수집 보상 글 · 홈런더비 고른 선수 · 최고 비거리 · 처음 메뉴 커서 (훅 차례 그대로) */
export function useEntryRouteState({ screen, claimCollectionReward }: Pick<EntryRoutesProps, 'screen' | 'claimCollectionReward'>) {
  /**
   * 기록연감 비밀 번호의 센 수·열림 [skin+0x2d0] — 메뉴 객체 값이라 메뉴를 만들 때(0x234d4, 0x237f8)만 지운다.
   * 웹은 메뉴 장면이 아닌 곳(나만의리그 등록 장면 0xf684 · 홈런더비 경기 장면)으로 가면 비운다 —
   * 경기 모드로 가면 이 컴포넌트가 내려가 저절로 비워진다. 버퍼는 기록연감이 들어올 때 비운다(0x2407c).
   */
  const [annalsSecretCode, setAnnalsSecretCode] = useState(INITIAL_SECRET_CODE_STATE)
  const isOutsideMenuScene = screen.kind === '팀선택' || screen.kind === '선수등록' || screen.kind === '홈런더비'
  // 메뉴 장면 밖으로 나간 그림에서 비운다(그동안은 기록연감이 안 서 보이는 것이 같다)
  const [wasOutsideMenuScene, setWasOutsideMenuScene] = useState(isOutsideMenuScene)
  if (wasOutsideMenuScene !== isOutsideMenuScene) {
    setWasOutsideMenuScene(isOutsideMenuScene)
    if (isOutsideMenuScene) setAnnalsSecretCode(INITIAL_SECRET_CODE_STATE)
  }
  /** 전부 수집 보상 팝업 글 (0x292f8 의 `0xbbef9(글, 1, −1, 1)`) — 메뉴 위에 뜬다 */
  const [collectionRewardText, setCollectionRewardText] = useState<string | null>(null)
  const claimReward = () => setCollectionRewardText(claimCollectionReward?.() ?? null)
  /**
   * 홈런더비 선수 고르기 결과 (하위 16 0x29ac8 — 코드 2 나리 타자 · 4 명예 타자, 전역기록 +0xa6).
   * null 이면 아직 안 골랐다 — 들어올 때마다 0x25e6c → 0x5eb8c 가 +0xa6 을 −1 로 되돌리고 다시 고르게 한다.
   */
  const [derbyPick, setDerbyPick] = useState<HallOfFamePlayerPick | null>(null)
  /** 홈런더비 최고 비거리 (저장 +0x5c) — 원본은 게임 전체 저장에 두므로 커리어와 따로 둔다 */
  const derbyStore = useMemo(() => createLocalStorageJsonStore(DERBY_BEST_KEY), [])
  /**
   * 처음 메뉴 바퀴 커서 `[this+0xe8]` — 장면 0x103 객체 값이라 같은 장면 안(스페셜 6 · 도움말 7 · 환경설정 8 · 랭킹 9 · 게임문의 10)을
   * 다녀오면 그 칸에 선다(진입 0x24a40 은 안 건드린다). 다른 장면(0x104~0x107)으로는 늘 [게임시작](0 칸)에서 하위 5 를 거쳐 나가므로
   * 돌아와 장면을 새로 세울 때(memset 0)와 값이 같다 — 이 컴포넌트가 내려가 0 으로 돌아와도 원본과 같다.
   */
  const [topMenuCursor] = useState(createGameStartCursor)
  const [derbyBest, setDerbyBest] = useState(() => {
    const saved = derbyStore.load()
    const value = (saved as { bestDistance?: unknown } | null)?.bestDistance
    return typeof value === 'number' && Number.isFinite(value) ? value : 0
  })
  return {
    annalsSecretCode,
    setAnnalsSecretCode,
    collectionRewardText,
    claimReward,
    derbyPick,
    setDerbyPick,
    derbyStore,
    topMenuCursor,
    derbyBest,
    setDerbyBest,
  }
}

/** 메뉴 화면 갈래가 그리는 데 쓰는 재료 — 라우트 props(기본값을 채운) · 메뉴 장면 칸 */
export interface EntryRouteView extends EntryRoutesProps, ReturnType<typeof useEntryRouteState> {
  readonly isGeneralGameInProgress: boolean
  readonly lastPlayedMode: number
}
