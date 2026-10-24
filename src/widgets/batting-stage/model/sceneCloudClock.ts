import { gameSceneFreezeSerialNow, gameSceneTickOf, gameSceneTimeOf } from '@/shared/lib/commonWindow/commonWindow'
import { LOADING_CLOUD_CALLS } from '@/widgets/batting-stage/lib/stageScenery'

/**
 * **구장 객체의 구름 셈** — 경기 장면(0x104)의 구장 [장면+0xf10] 은 상태 7 갱신 0x3e340(3eec6)이 한 번 만들고 장면이 사는 동안 남는다.
 * 그래서 구름 자리(+0x1c~+0x24)는 타석 · 수비 판 · 이닝을 건너 이어진다 — 웹은 0x78448 이 센 부름 수(`cloudScrollAt` 의 `calls`)를
 * 경기 장면 동안 하나만 둔다. 로딩 판의 두 부름(`LOADING_CLOUD_CALLS`)에서 시작하고, 장면이 내려가면(`leaveGameSceneObject`) 되돌린다.
 *
 * 세는 쪽은 구름을 그리는 화면의 그림 고리다 — 인트로 배경(`SceneryBackdrop`, 상태 0xc) · 타석(`useStageAnimation` · `PitcherSideStage`의
 * '대기' = 0xd~0x10 과 결과 창 0x19 · 0x1a). 그림마다 `observeSceneCloudFrame(경기 장면 그림 번호, 세는 상태인가, 고리 칸)` 을 부른다.
 * 그림 번호는 경기 장면 시계(`gameSceneTimeOf` — 공용 창이 서 있으면 선다)를 그림 길이로 나눈 것이라, 창이 떠 있는 동안은 안 오른다.
 *
 * - 한 고리 안에서는 앞 그림에서 지난 그림 수를 센다(세는 상태일 때만).
 * - 고리가 새로 서면(화면이 서거나 루프를 다시 세움) 첫 그림은 **많아야 1** 을 센다 — 마지막으로 본 그림과 같은 그림이면 0
 *   (StrictMode 의 두 번 세우기 · 타자 교대로 루프를 다시 세울 때 겹쳐 세지 않게).
 * - ⚠️ 근사: 구름을 안 그리는 웹 화면(이닝 판 · 돌발 · 교체 판 따위)에 머문 그림은 세지 않는다. 원본은 그중 야외 화면 상태(0x16 · 0x18 …)가
 *   아닌 상태(0xb · 0x1b · 0x1d · 0x1f · 0x22 · 0x23 따위)에서도 갱신마다 센다.
 * - ⚠️ 근사: 웹 단계가 바뀐 그림의 경계는 루프가 본 그림 단위다(한 그림 안에서 '대기' → '투구중' 이 바뀌면 그 그림은 바뀐 뒤 단계로 센다).
 */
let calls = LOADING_CLOUD_CALLS
let lastFrame: number | null = null
/** 이 장면에서 배경(0x41230)을 처음 그린 경기 장면 틱 — 전광판 글자 셈의 0 점. 아직 안 그렸으면 null */
let scoreboardOrigin: number | null = null
/** 0 점을 잡을 때의 멈춤 횟수 — 그 뒤 창이 선 첫 그림마다 배경을 한 번 더 그린다 */
let scoreboardOriginFreezes = 0

/**
 * **구장 전광판 글자 자리 [구장+0x8c] 의 셈** — 상태 7 의 구장 생성이 0x77edc 로 시작값(상자 폭 + 2)을 두고, 상태 7 · 8 · 9 를 뺀
 * 그림마다 배경 0x41230(52f26~52f36)이 413e6 에서 0x77fb5 로 그린 뒤 1 줄인다 — 곧 로딩 뒤 첫 배경 그림이 시작값이다.
 * 웹은 경기 장면 틱으로 센다: 이 장면에서 배경을 처음 그린 틱이 0 이다(`scoreboardScrollX`). 장면 시계라 공용 창 아래에서는 선다.
 * 창이 선 첫 그림([창+0x250], 52efe)은 갱신 없이 배경을 한 번 더 그려 +0x8c 가 한 번 더 준다 — 0 점 뒤로 경기 장면이 멈추기 시작한
 * 횟수(`gameSceneFreezeSerialNow`)를 더 센다(r170). ⚠️ 미확인: 0x41230 은 상태 7 · 8 · 9(로딩)에서 안 그리는데, 웹은 그때 선 창도 센다.
 */
export function sceneScoreboardTickOf(sceneTick: number): number {
  if (scoreboardOrigin === null) {
    scoreboardOrigin = sceneTick
    scoreboardOriginFreezes = gameSceneFreezeSerialNow()
  }
  return Math.max(0, sceneTick - scoreboardOrigin) + (gameSceneFreezeSerialNow() - scoreboardOriginFreezes)
}

/** 그림 고리마다 하나 — 그 고리가 마지막으로 본 그림 번호 */
export interface CloudFrameCursor {
  frame: number | null
}

export function createCloudFrameCursor(): CloudFrameCursor {
  return { frame: null }
}

/** requestAnimationFrame 시각 → 경기 장면 그림 번호 (경기 장면 시계 기준 — 공용 창이 떠 있는 동안은 안 오른다) */
export function sceneCloudFrameOf(rawNow: number): number {
  return gameSceneTickOf(gameSceneTimeOf(rawNow))
}

/** 지금까지 센 0x78448 부름 수 */
export function sceneCloudCallsNow(): number {
  return calls
}

/**
 * 경기 장면 그림 `frame` 을 본다 — `counts` 면 그 사이 그림 수만큼 센다. 돌려주는 값은 이 그림에 그릴 부름 수다
 * (0x3f060 이 그리기 앞이라 이 그림의 부름까지 든다).
 */
export function observeSceneCloudFrame(frame: number, counts: boolean, cursor: CloudFrameCursor): number {
  const elapsed =
    cursor.frame !== null
      ? frame - cursor.frame
      : lastFrame === null
        ? 1
        : Math.min(1, frame - lastFrame)
  if (counts && elapsed > 0) calls += elapsed
  cursor.frame = frame
  lastFrame = frame
  return calls
}

/** 장면 0x104 를 나갔다 — 다음 장면은 상태 7 이 구장을 새로 만들고 로딩 판이 두 번 센다 */
export function resetSceneCloudClock(): void {
  calls = LOADING_CLOUD_CALLS
  lastFrame = null
  scoreboardOrigin = null
}
