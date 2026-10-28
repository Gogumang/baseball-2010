// 예외 목록 파일(`lint.max-lines-baseline.js` · `lint.readability-baseline.js`) 읽고 쓰기.
// 목록은 파일 이름만, 경로 알파벳 순 — 숫자 주석이 없어서 파일을 고쳐도 목록이 안 바뀌고, 머지 충돌도 줄어든다.
import { readFileSync, writeFileSync } from 'node:fs'

/** 목록의 파일 이름들 */
export function readBaselineFiles(path) {
  return [...readFileSync(path, 'utf8').matchAll(/^\s*'([^']+)',/gm)].map(([, file]) => file)
}

/** `export const <exportName>` 부분만 이름 목록(알파벳 순)으로 다시 쓴다 — 머리 주석 · 다른 내보내기는 그대로 */
export function writeBaselineFiles(path, exportName, files) {
  const head = readFileSync(path, 'utf8').split(`export const ${exportName}`)[0]
  const body = [...files]
    .sort()
    .map((file) => `  '${file}',`)
    .join('\n')
  writeFileSync(path, `${head}export const ${exportName} = [\n${body}\n]\n`)
}
