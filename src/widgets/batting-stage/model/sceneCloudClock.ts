import { registerSnapshotSlot } from '@/shared/lib/dev/snapshotSlots'
import { gameSceneBackdropFreezeSerialNow, gameSceneTickOf, gameSceneTimeOf } from '@/shared/lib/commonWindow/commonWindow'
import { SCENE_STATE, sceneStateEntryAt } from '@/shared/lib/commonWindow/sceneStateEntries'
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
 * - **구름을 안 그리는 원본 세는 상태**(Q-08, r325): 0x3f060 은 갱신 고리 52e16 이 모든 상태에서 부르고 상태 7 · 0x18 · 0x19 · 0x1a ·
 *   +0x1993 이면 끝, 야외 상태(0x33c98 비트표 0x0d560001 = 6 · 0x16 · 0x17 · 0x18 · 0x1a · 0x1c · 0x1e · 0x20 · 0x21)도 0x13 도 아니면
 *   3f2f6 에서 0x78448 을 부른다(구장+0x50 이 0x11 · 0x12 면 안 셈). 그래서 교체 창 0xb · 돌발 제안 0x1b · 타석 위 돌발 결과 0x1d ·
 *   강판 감독 대사 0x23 도 틀마다 센다(0x1f 는 빈 번호, 0x22 나가기는 곧 장면 0x103 으로 내려가 셈이 되돌려진다). 웹은 이 상태들을
 *   타석 위 덮개로 그리는데 덮개 아래 루프가 '대기' 가 아니면(결과 뒤 0x1d · 강판 뒤 0x23) 안 셌다 — 덮개가 서 있는 동안
 *   `useSceneCloudCountingSpan` 이 장면 틱으로 센다. 같은 틱을 루프와 덮개가 둘 다 세지 않게 **센 마지막 틱**(`countedThrough`)을 하나 두고
 *   어느 쪽이든 그 뒤 틱만 센다. 구름 자리만 달라지고 난수 · 기록과는 무관.
 * - 세는 상태가 바뀐 고리 칸은 그 경계를 장면 틱으로 가른다 — 루프는 그림마다 지금 단계만 보므로, 그림이 틱을 건너뛰어(느린 rAF) 한 번에
 *   여러 틱을 셀 때 단계가 그 사이에 바뀌었으면 상태 경계(`sceneStateEntries` — 타석 장면 · 확인 대기가 적은 0xd~0x13 · 0x17 의 선 틱)로
 *   경계 앞 틱은 앞 그림의 단계, 경계부터는 지금 단계로 센다. 지금 틱의 칸이 그 사이에 섰고 지금 단계와 맞을 때만 쓴다 — 아니면(칸이
 *   없는 결과 창 · 웹만의 덮개) 예전처럼 사이 틱을 모두 지금 단계로 센다.
 */
let calls = LOADING_CLOUD_CALLS
let lastFrame: number | null = null
/** 센 마지막 경기 장면 틱 — 같은 틱을 두 번 세지 않는다(루프 · 덮개 셈 사이). 아직 없으면 null */
let countedThrough: number | null = null
/** 지금 서 있는 덮개 셈(`useSceneCloudCountingSpan`)의 시작 틱들 */
const countingSpans = new Map<number, number>()
let nextSpanId = 0
/** 이 장면에서 배경(0x41230)을 처음 그린 경기 장면 틱 — 전광판 글자 셈의 0 점. 아직 안 그렸으면 null */
let scoreboardOrigin: number | null = null
/** 0 점을 잡을 때의 멈춤 횟수 — 그 뒤 창이 선 첫 그림마다 배경을 한 번 더 그린다 */
let scoreboardOriginFreezes = 0

/**
 * **구장 전광판 글자 자리 [구장+0x8c] 의 셈** — 상태 7 의 구장 생성이 0x77edc 로 시작값(상자 폭 + 2)을 두고, 상태 7 · 8 · 9 를 뺀
 * 그림마다 배경 0x41230(52f26~52f36)이 413e6 에서 0x77fb5 로 그린 뒤 1 줄인다 — 곧 로딩 뒤 첫 배경 그림이 시작값이다.
 * 웹은 경기 장면 틱으로 센다: 이 장면에서 배경을 처음 그린 틱이 0 이다(`scoreboardScrollX`). 장면 시계라 공용 창 아래에서는 선다.
 * 창이 선 첫 그림([창+0x250], 52efe)은 갱신 없이 배경을 한 번 더 그려 +0x8c 가 한 번 더 준다 — 0 점 뒤로 경기 장면이 멈추기 시작한
 * 횟수를 더 센다(r170). 0x41230 은 상태 7 · 8 · 9(로딩 판)에서 안 그리므로(52f26~52f32) 로딩 판이 서 있는 동안 선 창은 빼고 센다
 * (`gameSceneBackdropFreezeSerialNow` — `LoadingTip` 이 `useMarksGameSceneLoading` 으로 알린다, r175).
 */
export function sceneScoreboardTickOf(sceneTick: number): number {
  if (scoreboardOrigin === null) {
    scoreboardOrigin = sceneTick
    scoreboardOriginFreezes = gameSceneBackdropFreezeSerialNow()
  }
  return Math.max(0, sceneTick - scoreboardOrigin) + (gameSceneBackdropFreezeSerialNow() - scoreboardOriginFreezes)
}

/** 그림 고리마다 하나 — 그 고리가 마지막으로 본 그림 번호와 그때 세는 상태였는가 */
export interface CloudFrameCursor {
  frame: number | null
  counts: boolean | null
}

export function createCloudFrameCursor(): CloudFrameCursor {
  return { frame: null, counts: null }
}

/** 0x3f060 이 구름을 세는 경기 장면 상태 — 0xd~0x10 ('대기') */
const CLOUD_STATES: ReadonlySet<number> = new Set([SCENE_STATE.준비, SCENE_STATE.확인, SCENE_STATE.선택, SCENE_STATE.조준])

/**
 * 앞 그림(`from`, 세는 상태 `fromCounts`) 뒤부터 이 그림(`to`, `counts`)까지 센 틱의 구간 [첫 틱, 끝 틱]. 단계가 바뀌었으면 지금 틱에
 * 선 상태 칸의 틱을 경계로 가른다(머리말). 센 틱이 없으면 null
 */
function countedTickRangeBetween(from: number, fromCounts: boolean, to: number, counts: boolean): readonly [number, number] | null {
  if (fromCounts === counts) return counts && to > from ? [from + 1, to] : null
  const entry = sceneStateEntryAt(to)
  const boundary =
    entry !== null && entry.tick > from && entry.tick <= to && CLOUD_STATES.has(entry.state) === counts ? entry.tick : from + 1
  // 경계 앞(from + 1 ~ boundary − 1)은 앞 단계, 경계부터 지금(boundary ~ to)은 지금 단계
  const range: readonly [number, number] = counts ? [boundary, to] : [from + 1, boundary - 1]
  return range[1] >= range[0] ? range : null
}

/** 틱 구간 [first, last] 을 센다 — 이미 센 틱(`countedThrough` 까지)은 빼고 */
function countTickRange(first: number, last: number): void {
  const start = countedThrough === null ? first : Math.max(first, countedThrough + 1)
  if (last < start) return
  calls += last - start + 1
  countedThrough = last
}

/** 서 있는 덮개 셈을 `frame` 까지 센다 — 덮개가 선 틱부터 */
function countSpansThrough(frame: number): void {
  for (const start of countingSpans.values()) countTickRange(start, frame)
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
  countSpansThrough(frame)
  if (cursor.frame !== null) {
    const range = frame > cursor.frame ? countedTickRangeBetween(cursor.frame, cursor.counts ?? counts, frame, counts) : null
    if (range !== null) countTickRange(range[0], range[1])
  } else {
    const elapsed = lastFrame === null ? 1 : Math.min(1, frame - lastFrame)
    if (counts && elapsed > 0) countTickRange(frame, frame)
  }
  cursor.frame = frame
  cursor.counts = counts
  lastFrame = frame
  return calls
}

/**
 * **덮개 셈** — 구름을 그리는 루프 밖에서 원본 세는 상태(0xb · 0x1b · 0x1d · 0x23)가 선다(머리말). 그 틱(`frame`)부터 센다.
 * `countThrough(틱)` 은 그 틱까지 세고, `end(틱)` 은 그 틱까지 센 뒤 덮개를 내린다
 */
export function beginSceneCloudCountingSpan(frame: number): { readonly countThrough: (frame: number) => void; readonly end: (frame: number) => void } {
  const id = nextSpanId
  nextSpanId += 1
  countingSpans.set(id, frame)
  // 다음 상태의 첫 루프 그림이 '많아야 1' 을 세는 잣대도 덮개가 본 틱으로 옮긴다
  const countThrough = (to: number) => {
    if (!countingSpans.has(id)) return
    countTickRange(frame, to)
    lastFrame = lastFrame === null ? to : Math.max(lastFrame, to)
  }
  return {
    countThrough,
    end: (to: number) => {
      // 덮개를 내리는 키는 그 틀 머리에서 다음 상태를 예약할 뿐이라(0xbcb48 → 다음 틀 0xbc9c8) 그 틀의 갱신은 아직 이 상태다 — 그 틱까지
      countThrough(to)
      countingSpans.delete(id)
    },
  }
}

/** 장면 0x104 를 나갔다 — 다음 장면은 상태 7 이 구장을 새로 만들고 로딩 판이 두 번 센다 */
export function resetSceneCloudClock(): void {
  calls = LOADING_CLOUD_CALLS
  lastFrame = null
  countedThrough = null
  countingSpans.clear()
  scoreboardOrigin = null
}

// 경기 중간 스냅샷(개발 · e2e 전용 — `shared/lib/dev/snapshotSlots`, 배포 빌드에서 빠진다): 구름 · 전광판 셈
if (import.meta.env.DEV || import.meta.env.MODE === 'e2e') {
  registerSnapshotSlot('sceneCloudClock', {
    capture: () => ({ calls, lastFrame, countedThrough, countingSpans: [...countingSpans].map(([, frame]) => frame), scoreboardOrigin, scoreboardOriginFreezes }),
    restore: (value) => {
      const saved = value as { countingSpans: number[] } & Record<string, unknown>
      ;({ calls, lastFrame, countedThrough, scoreboardOrigin, scoreboardOriginFreezes } = saved as never)
      // 덮개 셈 번호는 그 덮개 effect 가 쥔다 — 되살린 덮개가 지금 쥔 번호(단 차례)에 뜬 시작 그림을 차례로 넣는다
      const live = [...countingSpans.keys()]
      live.forEach((id, index) => {
        const frame = saved.countingSpans[index]
        if (frame !== undefined) countingSpans.set(id, frame)
      })
    },
  })
}
