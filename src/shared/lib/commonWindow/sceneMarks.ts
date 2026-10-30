import { resetAppTickClockForTest } from '@/shared/lib/frameClock/frameClock'
import { freeze } from '@/shared/lib/commonWindow/freezeState'
import { settlePendingFreeze, syncGameSceneFreeze } from '@/shared/lib/commonWindow/freezeClock'

/** 창 하나가 섰다 — 돌려준 함수로 내린다(두 번 불러도 한 번만 내린다) */
export function markCommonWindowShown(): () => void {
  freeze.shownCommonWindows += 1
  syncGameSceneFreeze()
  const generation = freeze.testGeneration
  let released = false
  return () => {
    if (released || generation !== freeze.testGeneration) return
    released = true
    freeze.shownCommonWindows -= 1
    syncGameSceneFreeze()
  }
}
/** [0x140005c]+9 — 공용 창이 하나라도 떠 있는가 */
export function isCommonWindowShown(): boolean {
  return freeze.shownCommonWindows > 0
}
/**
 * 경기 장면이 멈추기 시작한 횟수 — 곧 창이 선 첫 그림([창+0x250], 52efe)의 수다. 그 그림은 배경 0x41230 을 한 번 더 그리므로
 * 배경이 스스로 올리는 칸(전광판 글자 자리 [구장+0x8c] — `sceneCloudClock.sceneScoreboardTickOf`)이 이 수를 더 센다
 */
export function gameSceneFreezeSerialNow(): number {
  settlePendingFreeze()
  return freeze.freezeSerial
}
/**
 * 창이 선 첫 그림([창+0x250]) 중 배경 0x41230 을 그린 그림의 수 — 52f26~52f36 은 상태 [장면+0x1c] 가 7 · 9 · 8(로딩 판)이면 0x41230 을
 * 건너뛴다(2026-10-24 직접 떴다). 그래서 로딩 판 동안 선 창은 전광판 글자 자리 [구장+0x8c] 를 줄이지 않는다
 * (`sceneCloudClock.sceneScoreboardTickOf`)
 */
export function gameSceneBackdropFreezeSerialNow(): number {
  settlePendingFreeze()
  return freeze.backdropFreezeSerial
}
/** 로딩 판 하나가 섰다 — 돌려준 함수로 내린다(`useMarksGameSceneLoading`) */
export function markGameSceneLoading(): () => void {
  freeze.loadingScenesUp += 1
  const generation = freeze.testGeneration
  let released = false
  return () => {
    if (released || generation !== freeze.testGeneration) return
    released = true
    freeze.loadingScenesUp -= 1
  }
}
/**
 * **단말 일시정지가 창이 선 첫 그림을 다시 세운다** — 앱 일시정지 0x2da0 이 장면 vt+0x18(경기 장면 0x463ac 463c0~463ca 도
 * [창+0x250] = 1) 뒤 0x74458([0x140005c])을 부른다: [+0x24d] = 1 · [+0x250] = 1 · [+0x24e] = [+0x24f] (7445a~74472, 직접 뜸 r215).
 * 경기 장면에 창이 서 있으면(52efe) 다음 그림이 장면 · 배경을 한 번 더 그린다 — 창이 처음 선 그림과 같다. 창이 없으면 52efe 가
 * [+9] 를 먼저 봐 아무 일 없다. 웹은 멈춤 셈을 한 번 더 올린다(`createGameSceneDrawGate` · `gameSceneFreezeSerialNow`).
 */
export function rearmGameSceneFirstDraw(): void {
  settlePendingFreeze()
  // 갱신 뒤에 연 창이 아직 다음 틀 머리 전이면 — 그 틀(52cc6 이 창을 보는 첫 틀)이 장면을 한 번 더 그린다
  if (freeze.pendingFreeze !== null) {
    freeze.pendingFreeze.bumpsFirstDraw = true
    return
  }
  if (freeze.frozenSince === null) return
  freeze.freezeSerial += 1
  if (freeze.loadingScenesUp === 0) freeze.backdropFreezeSerial += 1
}
/**
 * **창이 선 첫 그림의 그리기 셈** — 52efe 는 [창+0x24f](경기 장면 1) && [창+9] && **[창+0x250] == 0** 일 때만 0x41230 · 그리기 표
 * 0xd05a0 을 건너뛴다. [+0x250] 은 창을 띄운 0x74ef4(7503c~) · 0x741a0 이 1 로 세우고 같은 그림 끝 창 그리기 0x746cc(53078)가 0 으로
 * 지운다 — 곧 창이 선 첫 그림은 갱신(52cc6)이 없어도 장면 그리기가 한 번 더 돈다. 그리기 함수가 스스로 올리는 칸(조준 애니 0 칸 ·
 * 게이지 커서 0x4d708 · 미션 목표 줄 0x36714 따위)은 그 그림에 한 번 오른다.
 *
 * 부품마다 하나 만들어 그림 틀마다 `allowsDraw()` 를 묻는다 — 장면이 흐르면 참, 멈춘 뒤 처음 묻는 한 번만 참, 그 뒤로 거짓.
 * 만든 때 이미 멈춰 있었으면 그 멈춤의 첫 그림은 지난 것으로 본다(멈춘 동안 새 상태가 서는 일은 없다).
 *
 * 대기 칸 창이 이어 설 때도 같다 — 창 갱신 0x754f8 이 75552 · 755d4 에서 0x75440 을 불러 0x74ef4 · 0x741a0 으로 다음 창을 띄우므로
 * [+0x250] 이 다시 선다(웹은 앞 창이 내려가고 같은 때 다음 창이 서서 멈춤이 새로 센다).
 *
 * 창을 연 자리로 갈린다(r300): 게이트(52cc6) **앞**(대기 칸 창이 0x754f9 안에서 서는 때 · 단말 일시정지 0x463ac)이면 다음 그림이 갱신 없이
 * 그리기만 하고 — 이 첫 그림을 센다. 게이트 **뒤**(키 0x498d4 의 '*' 메뉴 · 진입 · 갱신의 히든 오픈 알림 따위)면 그 틀이 갱신 · 그리기를
 * 다 하는 보통 틀이고 다음 틀부터 둘 다 건너뛴다 — 웹은 여는 쪽이 `noteCommonWindowOpensInSceneUpdate` 로 알리고, 멈춤을 다음 앱 틱
 * 머리로 늦추며 첫 그림을 안 센다(`pendingFreeze` 머리말).
 */
export interface GameSceneDrawGate {
  readonly allowsDraw: () => boolean
}

export function createGameSceneDrawGate(): GameSceneDrawGate {
  settlePendingFreeze()
  // 흐르는 중에 만든 부품도 지금까지의 멈춤은 지난 것으로 본다 — 다음에 세는 첫 그림부터 그린다
  let seenSerial = freeze.freezeSerial
  return {
    allowsDraw: () => {
      settlePendingFreeze()
      if (freeze.frozenSince === null) {
        seenSerial = freeze.freezeSerial
        return true
      }
      if (seenSerial === freeze.freezeSerial) return false
      seenSerial = freeze.freezeSerial
      return true
    },
  }
}

/** 경기 장면 화면 하나가 섰다 — 돌려준 함수로 내린다(`useMarksGameScene`) */
export function markGameSceneUp(): () => void {
  freeze.gameScenesUp += 1
  syncGameSceneFreeze()
  const generation = freeze.testGeneration
  let released = false
  return () => {
    // 시험이 셈을 되돌린 뒤 늦게 내리는 화면은 무시한다
    if (released || generation !== freeze.testGeneration) return
    released = true
    freeze.gameScenesUp -= 1
    syncGameSceneFreeze()
  }
}
/**
 * 경기 장면(0x104)이 서 있는가 — 그 장면의 받은 키는 장면 부품의 칸(`sceneKeyLatch` — 장면 틱)이 맡는다. 앱 키 문(`appKeyGate`)은
 * 장면이 서 있고 창이 없을 때 키를 그 칸에 그대로 넘긴다
 */
export function isGameSceneUp(): boolean {
  return freeze.gameScenesUp > 0
}
/** 시험용 — 센 수를 되돌린다 */
export function resetCommonWindowShownForTest(): void {
  resetAppTickClockForTest()
  freeze.testGeneration += 1
  freeze.shownCommonWindows = 0
  freeze.gameScenesUp = 0
  freeze.loadingScenesUp = 0
  freeze.inSceneUpdateOpenAppTick = null
  // 붙잡혀 있던 시계는 다시 흘린다
  syncGameSceneFreeze()
  freeze.frozenSince = null
  freeze.frozenSinceAppTick = null
  freeze.frozenTotal = 0
  freeze.frozenTicks = 0
}
