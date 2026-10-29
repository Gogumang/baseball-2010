// FSD 층 경계 규칙 (r366) — `localPlugin.mjs` 가 `local/fsd-layer-direction` · `local/fsd-cross-slice` 로 싣는다.
// 층은 위에서 아래로 app > pages > widgets > features > entities > shared. 위가 아래를 import 한다.
//   fsd-layer-direction  아래 층이 위 층을 import 하면 위반 (예: entities → features)
//   fsd-cross-slice      같은 층의 다른 조각(slice)을 import 하면 위반 (예: pages/season → pages/general-mode).
//                        shared · app 은 조각이 없는 층이라 보지 않는다
// import 경로는 `@/층/조각/…` 별칭만 본다(이 저장소는 상대 경로를 거의 안 쓴다). 정적 import · export from · import() 를 모두 센다.

/** 아래(0)에서 위로 */
const LAYERS = ['shared', 'entities', 'features', 'widgets', 'pages', 'app']
const SLICED_LAYERS = new Set(['entities', 'features', 'widgets', 'pages'])
const SRC_MARK = '/src/'

/** `/…/src/pages/season/ui/X.tsx` → { layer: 'pages', slice: 'season' } (src 밖이면 null) */
function locationOfFile(filename) {
  const at = filename.lastIndexOf(SRC_MARK)
  if (at < 0) return null
  const [layer, slice] = filename.slice(at + SRC_MARK.length).split('/')
  return LAYERS.includes(layer) ? { layer, slice } : null
}

/** `@/widgets/season/lib/x` → { layer: 'widgets', slice: 'season' } (별칭이 아니면 null) */
function locationOfSpecifier(specifier) {
  if (typeof specifier !== 'string' || !specifier.startsWith('@/')) return null
  const [layer, slice] = specifier.slice(2).split('/')
  return LAYERS.includes(layer) ? { layer, slice } : null
}

/** import 꼴 노드마다 `check(sourceNode)` 를 부르는 방문자 */
function importVisitors(check) {
  const visit = (node) => {
    if (node.source) check(node.source)
  }
  return { ImportDeclaration: visit, ExportNamedDeclaration: visit, ExportAllDeclaration: visit, ImportExpression: visit }
}

/** 두 자리를 받아 위반 문구(또는 null)를 내는 판정 하나로 규칙을 만든다 */
function boundaryRule(description, violationOf) {
  return {
    meta: { type: 'problem', docs: { description }, schema: [] },
    create(context) {
      const from = locationOfFile(context.filename)
      if (from === null) return {}
      return importVisitors((source) => {
        const to = locationOfSpecifier(source.value)
        const message = to === null ? null : violationOf(from, to)
        if (message !== null) context.report({ node: source, message })
      })
    },
  }
}

export const fsdLayerDirection = boundaryRule('아래 층이 위 층을 import 하지 않는다 (FSD)', (from, to) =>
  LAYERS.indexOf(to.layer) > LAYERS.indexOf(from.layer)
    ? `${from.layer} 층이 위 층 ${to.layer} 를 import 한다 — 아래 층으로 옮기거나 위에서 넘겨 받는다`
    : null,
)

export const fsdCrossSlice = boundaryRule('같은 층의 다른 조각을 import 하지 않는다 (FSD)', (from, to) => {
  const isOtherSlice = to.layer === from.layer && SLICED_LAYERS.has(from.layer) && to.slice !== from.slice
  return isOtherSlice
    ? `${from.layer}/${from.slice} 가 같은 층의 다른 조각 ${to.layer}/${to.slice} 를 import 한다 — 아래 층으로 내리거나 위 층에서 잇는다`
    : null
})
