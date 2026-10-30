import { assetLoadVersion } from '@/shared/lib/sprite/assetLoadVersion'

/**
 * **그림 입력이 바뀐 틀에서만 다시 그린다** — 원본은 틱(기본 16/s)마다 한 번 그리지만 웹 루프는 requestAnimationFrame(60~120Hz)마다
 * 돈다. 그리기 함수(`renderBattingStage` 따위)는 넘긴 입력과 실린 재료만으로 그림이 정해지므로(틱 사이를 잇는 보간 · rAF 시각을
 * 그리기 안에서 읽는 곳 없음), 입력이 앞 틀과 같으면 캔버스에 남은 그림이 곧 이번 틀의 그림이다 — 그리기만 건너뛴다.
 * 상태 갱신(틱 진행 · 난수 굴림)은 부르는 쪽이 지금처럼 틀마다 돌린다.
 *
 * 다시 그리는 때: 처음 · 입력이 값으로 달라짐 · 캔버스가 바뀜(다른 요소 · 크기 — 크기를 다시 매기면 캔버스가 지워진다) ·
 * 늦게 받는 재료가 도착함(`assetLoadVersion`) · `invalidate`.
 *
 * ⚠️ 입력은 값으로 견준다(`sameDrawInput`) — 제자리에서 고쳐 쓰는 객체(파티클 관리자 따위)는 그대로 넘기지 말고 그 모습을 뜬 값
 * (`particleSignatureOf`)으로 바꿔 넘긴다. 같은 객체를 그대로 넘기면 앞 틀의 그 객체와 늘 같다고 본다.
 */
export interface DrawMemo {
  /** 이 입력으로 이 캔버스를 다시 그려야 하는가 — 참이면 입력을 기억한다(부르는 쪽은 곧 그린다) */
  readonly needsDraw: (canvas: HTMLCanvasElement | null | undefined, input: unknown) => boolean
  /** 다음 물음에 꼭 다시 그리게 한다 */
  readonly invalidate: () => void
}

/** 시험용 — 참이면 늘 다시 그린다(건너뛰기 전 동작) */
let bypassForTest = false
export function setDrawMemoBypassForTest(isBypassed: boolean): void {
  bypassForTest = isBypassed
}

const EMPTY = Symbol('비었음')

/** 캔버스 크기 — 캔버스가 없으면 −1 */
const canvasWidthOf = (canvas: HTMLCanvasElement | null | undefined) => canvas?.width ?? -1
const canvasHeightOf = (canvas: HTMLCanvasElement | null | undefined) => canvas?.height ?? -1

export function createDrawMemo(): DrawMemo {
  let lastCanvas: HTMLCanvasElement | null | undefined = undefined
  let lastWidth = -1
  let lastHeight = -1
  let lastVersion = -1
  let lastInput: unknown = EMPTY
  return {
    needsDraw: (canvas, input) => {
      const version = assetLoadVersion()
      const width = canvasWidthOf(canvas)
      const height = canvasHeightOf(canvas)
      if (
        !bypassForTest &&
        lastInput !== EMPTY &&
        canvas === lastCanvas &&
        width === lastWidth &&
        height === lastHeight &&
        version === lastVersion &&
        sameDrawInput(lastInput, input)
      ) {
        return false
      }
      lastCanvas = canvas
      lastWidth = width
      lastHeight = height
      lastVersion = version
      lastInput = input
      return true
    },
    invalidate: () => {
      lastInput = EMPTY
    },
  }
}

/** 이보다 깊으면 다르다고 본다(다시 그린다 — 틀려도 그림이 늘 맞는 쪽) */
const MAX_DEPTH = 12

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value) as unknown
  return prototype === Object.prototype || prototype === null
}

const isObject = (value: unknown): value is object => typeof value === 'object' && value !== null

/**
 * 그림 입력 두 개가 값으로 같은가 — 원시값은 `Object.is`, 배열 · 보통 객체는 칸마다, 그 밖(그림 · 캔버스 · 함수 · 클래스 객체)은 같은
 * 것일 때만 같다. 같은 객체를 가리키면 안을 보지 않고 같다.
 */
export function sameDrawInput(left: unknown, right: unknown, depth = 0): boolean {
  if (Object.is(left, right)) return true
  if (!isObject(left) || !isObject(right) || depth >= MAX_DEPTH) return false
  if (Array.isArray(left)) return sameArrays(left, right, depth)
  return samePlainObjects(left, right, depth)
}

function sameArrays(left: readonly unknown[], right: object, depth: number): boolean {
  if (!Array.isArray(right) || left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (!sameDrawInput(left[index], right[index], depth + 1)) return false
  }
  return true
}

function samePlainObjects(left: object, right: object, depth: number): boolean {
  if (Array.isArray(right) || !isPlainObject(left) || !isPlainObject(right)) return false
  const leftRecord = left as Record<string, unknown>
  const rightRecord = right as Record<string, unknown>
  const keys = Object.keys(leftRecord)
  if (keys.length !== Object.keys(rightRecord).length) return false
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(rightRecord, key) || !sameDrawInput(leftRecord[key], rightRecord[key], depth + 1)) return false
  }
  return true
}
