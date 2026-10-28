import { tryOr } from '@/shared/lib/safe/tryOr'

/** `JSON.parse` — 깨진 글이면 `fallback` */
export function safeJsonParse<F>(text: string, fallback: F): unknown {
  return tryOr(() => JSON.parse(text) as unknown, fallback)
}
