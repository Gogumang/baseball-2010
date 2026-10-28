// oxlint JS 플러그인 — oxlint 에 없는 이 저장소만의 규칙 (`oxlint.config.ts` 의 jsPlugins).
// ESLint 의 `no-restricted-syntax` 선택자(TryStatement)를 대신한다.

const TRY_MESSAGE = 'try/catch 는 shared/lib/safe 도우미로 (tryOr · tryOrElse · ignoreErrors · withFinally …)'

/** 예외 처리는 `src/shared/lib/safe` 도우미로만 — 삼키는 자리가 이름으로 드러난다 */
const noTryStatement = {
  meta: { type: 'suggestion', docs: { description: 'try 문 금지 (shared/lib/safe 도우미로)' }, schema: [] },
  create(context) {
    return {
      TryStatement(node) {
        context.report({ node, message: TRY_MESSAGE })
      },
    }
  },
}

export default {
  meta: { name: 'local' },
  rules: { 'no-try-statement': noTryStatement },
}
