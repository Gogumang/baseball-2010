import type { Plugin } from 'vite'

/**
 * **설정 표의 설명 글을 배포판에서 뺀다** (r392 — 웹 전용, 원본에 없다).
 *
 * 원본 버그 고치기 · 해금 · 숨은 판정값 표(`shared/config/{bugfixes,unlocks,balance}/*.json`)는 항목마다 사람이 읽는 설명
 * (증상 · 해금 조건 · 효과 · 원본 근거 주소 따위)을 단다. 게임은 켬/끔 · 값 칸만 읽고 이 글은 어느 화면도 보여 주지 않는다
 * — 시험(`*.test.ts`)이 문서와 대조할 때만 읽는다. 그래서 배포 빌드에서만 글 칸을 빈 글(`""`)로 바꾸고 `$comment` 를 뺀다.
 *
 * - 동작은 그대로: 읽기 함수(`parseXxxConfig`)는 글 칸이 글이기만 보면 되고, 판정(`isBugFixed` · `isUnlocked` ·
 *   `balanceNumber`)은 id · 켬/끔 · 값만 읽는다. 항목 차례 · 칸 이름도 그대로다.
 * - 개발 서버 · 시험(vitest)에는 붙지 않는다(`apply: 'build'`) — 글이 그대로 있다.
 * Vite 의 JSON 변환보다 먼저(`enforce: 'pre'`) JSON 글을 받아 고친다.
 */
const NOTE_FIELDS_BY_TABLE: Readonly<Record<string, readonly string[]>> = {
  bugfixes: ['name', 'symptom', 'source'],
  unlocks: ['name', 'condition', 'source'],
  balance: ['name', 'source', 'effect'],
}

const CONFIG_TABLE = /[\\/]src[\\/]shared[\\/]config[\\/](bugfixes|unlocks|balance)[\\/]\1\.json$/

type JsonRecord = Record<string, unknown>

function withoutNotes(entry: JsonRecord, noteFields: readonly string[]): JsonRecord {
  const stripped = { ...entry }
  for (const field of noteFields) if (typeof stripped[field] === 'string') stripped[field] = ''
  return stripped
}

function strippedTableOf(source: string, noteFields: readonly string[]): string {
  const { $comment: _comment, entries, ...rest } = JSON.parse(source) as JsonRecord & { entries: JsonRecord[] }
  return JSON.stringify({ ...rest, entries: entries.map((entry) => withoutNotes(entry, noteFields)) })
}

export function configNotesStrip(): Plugin {
  return {
    name: 'config-notes-strip',
    apply: 'build',
    enforce: 'pre',
    transform(source, id) {
      const table = CONFIG_TABLE.exec(id)?.[1]
      if (table === undefined) return null
      return { code: strippedTableOf(source, NOTE_FIELDS_BY_TABLE[table] ?? []), map: null }
    },
  }
}
