import { useState } from 'react'
import { INITIAL_STADIUM_PREVIEW_SCENE } from '@/pages/season'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'

/** 카드 딱지 [창+0x168] 를 넣는 진입 — 팀 고르기 0xca 0x50a8 · 트레이드 0xe4 0x4774 */
function isCardBadgeScene(scene: number): boolean {
  return scene === SEASON_SCENE_STATE.팀고르기 || scene === SEASON_SCENE_STATE.트레이드
}

/**
 * 장면 0x105 객체 · 시즌 창의 칸 — 수명이 장면과 같아 경기(0xe1 → 장면 0x104)로 장면이 지워지면 새로 선 값이다.
 * 장면이 바뀐 그림에서 고친다(원본은 진입이 그리기보다 먼저라 그 그림부터 새 값).
 */
export function useSceneLifeCells(scene: number) {
  /**
   * 훈련 결과 팝업 글 상자 첫 줄 [창+0x2d8] — 시즌 장면 창의 칸이라 팝업 · 0xcf 를 떠나도 남는다(시즌에서 비우는 곳이 없다,
   * `SeasonTrainingScreen` 주석). **창의 수명은 장면 0x105 와 같다** (직접 떴다):
   * - 창은 장면 0x105 초기화 0x3b14 의 0x3ef4~0x3f7c 가 `new(0x398)` → 0x7b7b9 로 만들어 [장면+0xc0] 에 넣는다.
   *   new 0x1239 → 0x2ac4 는 잡은 칸을 0 으로 채우고(0x2ad4 memset) 생성자 0x7b4dc 는 +0x2d8 을 안 건드려 **새 창은 0** 이다.
   * - 장면 전환 0x3874 는 [앱+0x20] 에 다음 장면이 서면 지금 장면을 소멸자(vt+4, 0x3948)로 지우고 다음 장면을 new 한다.
   *   그래서 0xe1 → 경기 장면 0x104 로 가면 0x105 와 창이 사라지고, 경기 뒤 0x105 로 돌아오면 새 창(첫 줄 0)이다.
   * 웹은 경기 화면이 이 라우트 안(`경기직전` 0xe1)에 있으므로 0xe1 에 들어설 때 0 으로 되돌린다. 메인 메뉴로 나가면 라우트가 내려가
   * 다시 서며 0 이다.
   */
  const [trainingResultFirstLine, setTrainingResultFirstLine] = useState(0)
  /**
   * 외출 지도 고른 칸 this+0xf8 — 장면 0x105 객체 칸이라 지도를 오가도 남고(진입 0xbd24 는 그림만 싣는다), 경기로 장면이
   * 지워졌다 새로 서면(위 창 첫 줄과 같은 수명) 0 이다.
   */
  const [outingCursor, setOutingCursor] = useState(0)
  /**
   * 장면 구장 [장면+0x10c] 의 하늘 줄 · 하늘 칸 · 전광판 글자 자리 — 0x3b14 가 장면마다 새로 만든다(`StadiumPreviewScene`).
   * 상점(0xdc 종류 4)은 앞서 구장관리(0xea)가 잰 하늘을 그대로 쓰고, 구장관리는 상점이 흘려 둔 글자 자리에 멈춰 있다.
   */
  const [stadiumPreviewScene, setStadiumPreviewScene] = useState(INITIAL_STADIUM_PREVIEW_SCENE)
  /**
   * 카드 딱지 [창+0x168] — 같은 창 칸이라 수명이 장면 0x105 와 같다. 팀 고르기 0xca 진입 0x50a8 · 트레이드 0xe4 진입 0x4774 만
   * 슬롯 그림([장면+0xd4] = ui/slt_frame)을 넣는다 (`pages/season/lib/seasonPlayerCard.ts` 머리말). 경기로 장면이 지워지면 다시 0.
   */
  const [hasCardBadge, setHasCardBadge] = useState(() => isCardBadgeScene(scene))
  /**
   * 장면이 바뀐 그림에서 위 장면 칸들을 고친다 — 0xe1(경기직전)에 들어서면 창 · 장면 칸이 새로 선 값(0)으로, 팀 고르기 · 트레이드
   * 진입은 카드 딱지를 넣는다. 원본은 진입이 그리기보다 먼저라 그 그림부터 새 값이다
   */
  const [sceneOfLife, setSceneOfLife] = useState(scene)
  if (sceneOfLife !== scene) {
    setSceneOfLife(scene)
    if (isCardBadgeScene(scene)) setHasCardBadge(true)
    if (scene === SEASON_SCENE_STATE.경기직전) {
      setTrainingResultFirstLine(0)
      setOutingCursor(0)
      setStadiumPreviewScene(INITIAL_STADIUM_PREVIEW_SCENE)
      setHasCardBadge(false)
    }
  }
  return {
    trainingResultFirstLine,
    setTrainingResultFirstLine,
    outingCursor,
    setOutingCursor,
    stadiumPreviewScene,
    setStadiumPreviewScene,
    hasCardBadge,
  }
}
