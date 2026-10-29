/**
 * 원본 대조 — 웹이 쓰는 원본 데이터(`shared/config/original/*`)를 **원본 파일에서 다시 읽은 값**과 견준다 (r337).
 *
 * 생성기(`tools/generate_game_data.py`)는 `base/extracted/*.json` 을 거쳐 읽는다. 이 시험은 그 길을 타지 않고
 * jar 안의 `data/*.zt1` · `*.arr` · `*.dat` 와 `binary.mod` 를 직접 풀어, 값 · 개수 · 차례가 같은지 본다.
 * Xls 표는 생성기의 바이트 오프셋 대신 **표 머리의 열 종류**(0 u8 · 1 s8 · 2 u16 · 3 s16 · 4 u32 · 10+n 글 n 바이트)로
 * 칸을 나눠 읽는다 — 생성기와 다른 길로 읽어 둘이 같아야 통과한다.
 *
 * 원본 파일은 저장소에 없다(저작권). `BASEBALL_JAR_DIR`(jar 를 푼 폴더) 또는 `base/work/jar` ·
 * `../baseball-2010/base/work/jar` · `../../baseball-2010/base/work/jar` 에 있으면 돌고, 없으면 건너뛴다.
 *
 * 손으로 옮긴 숫자 표(데이터 구역 주소를 주석에 적은 배열)도 같은 방법으로 훑는다 — 맨 아래 절.
 * 같은 일을 하는 파이썬 도구가 `tools/audit_code_tables.py` 다(사람이 읽는 목록을 낸다).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { ACE_PLAYERS } from '@/shared/config/original/acePlayers'
import { ACE_OPEN_POPUP, ACE_OPEN_TABLE } from '@/shared/config/original/aceOpen'
import { BATTERS, PITCHERS } from '@/shared/config/original/roster'
import { TEAMS } from '@/shared/config/original/teams'
import { ORIGINAL_TITLES } from '@/shared/config/original/titles'
import { ORIGINAL_ITEMS } from '@/shared/config/original/items'
import { ORIGINAL_ENDINGS } from '@/shared/config/original/endings'
import { ORIGINAL_TIPS } from '@/shared/config/original/tips'
import { ORIGINAL_HOWTO } from '@/shared/config/original/howto'
import { ORIGINAL_USER_EVENTS } from '@/shared/config/original/userEvents'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { ORIGINAL_MAIN_MENU_TEXT } from '@/shared/config/original/mainMenuText'
import { ORIGINAL_SKILLS } from '@/shared/config/original/skills'
import { BATTER_BURSTS, PITCHER_BURSTS } from '@/shared/config/original/bursts'
import { ORIGINAL_BURST_TABLES } from '@/shared/config/original/burstMissions'
import { MISSIONS } from '@/shared/config/original/missions'
import { PITCH_TYPES } from '@/shared/config/original/pitchTypes'
import { PITCH_RECORDS } from '@/shared/config/original/pitchRecords'
import { PITCH_PATTERNS } from '@/shared/config/original/pitchPatterns'
import { BATTING_PATTERNS } from '@/shared/config/original/battingPatterns'
import { BATTED_BALL_PATTERNS, BATTED_BALL_PHYSICS } from '@/shared/config/original/battedBallPatterns'
import { D_LEVEL, D_LEVEL_RAW } from '@/shared/config/original/dLevel'
import { BALANCE } from '@/shared/config/original/balance'
import { SINE_HUNDRED_TABLE, SINE_SIXTEEN_TABLE, TANGENT_TABLE } from '@/shared/config/original/trigonometryTables'
import { BATTER_YEAR_GOALS, PITCHER_YEAR_GOALS } from '@/shared/config/original/yearGoals'
import { SKY_COLOR_PAIRS, SKY_COLOR_ROWS } from '@/shared/config/original/stadiumScene'
import { ACE_PITCHER_REPERTOIRES, ROSTER_PITCHER_REPERTOIRES } from '@/shared/config/original/pitcherRepertoires'
import { SPEAKER_NAMES, TOTAL_EVENT_COUNT } from '@/shared/config/original/eventMeta'
import { ORIGINAL_EVENTS } from '@/shared/config/original/events'
import { ORIGINAL_SEASON_EVENTS } from '@/shared/config/original/seasonEvents'
import { ORIGINAL_SOUNDS } from '@/shared/config/original/sounds'

/* ── 원본 파일 찾기 ───────────────────────────────────────────────────────── */

const JAR_DIR = [
  process.env.BASEBALL_JAR_DIR,
  resolve(process.cwd(), 'base/work/jar'),
  resolve(process.cwd(), '../baseball-2010/base/work/jar'),
  resolve(process.cwd(), '../../baseball-2010/base/work/jar'),
].find((path): path is string => path !== undefined && existsSync(join(path, 'binary.mod')))

const read = (path: string): Buffer => readFileSync(join(JAR_DIR as string, path))

/* ── 원본 형식 풀기 (생성기와 따로 짰다) ─────────────────────────────────────── */

const cp949 = new TextDecoder('euc-kr')

/** .zt1 = u32 전체 크기 · u32 푼 크기 · zlib */
function zt1(name: string): Buffer {
  const raw = read(`data/${name}.zt1`)
  const plain = inflateSync(raw.subarray(8))
  expect(plain.length, `${name} 푼 크기`).toBe(raw.readUInt32LE(4))
  return plain
}

/** 끝 NUL 만 뗀 CP949 */
function trailingNulText(bytes: Buffer): string {
  let end = bytes.length
  while (end > 0 && bytes[end - 1] === 0) end -= 1
  return cp949.decode(bytes.subarray(0, end))
}

/** 고정 칸 글 — 첫 NUL 앞까지 그대로 */
function fixedText(bytes: Buffer): string {
  const nul = bytes.indexOf(0)
  return cp949.decode(nul < 0 ? bytes : bytes.subarray(0, nul))
}

/** GST 글표: 'GST'+판 · u16 N · u16 오프셋 N+1 개 */
function stringTable(name: string): string[] {
  const raw = zt1(name)
  expect(raw.subarray(0, 3).toString('latin1')).toBe('GST')
  const count = raw.readUInt16LE(4)
  expect(raw.readUInt16LE(6 + 2 * count), `${name} 끝 오프셋`).toBe(raw.length)
  return Array.from({ length: count }, (_, i) => trailingNulText(raw.subarray(raw.readUInt16LE(6 + 2 * i), raw.readUInt16LE(8 + 2 * i))))
}

type Cell = number | string
interface RecordTable {
  readonly rows: readonly Buffer[]
  /** 열 종류로 나눈 칸 — 줄마다 열 수만큼 */
  readonly cells: readonly (readonly Cell[])[]
  /** 칸이 줄 안 몇 바이트에서 시작하나 */
  readonly offsets: readonly number[]
}

/** GXL 레코드 표: 'GXL'+판 · u16 줄 크기 · u16 열 수 · u16 줄 수 · u8 열 종류 × 열 수 · 줄들 */
function recordTable(name: string): RecordTable {
  const raw = zt1(name)
  expect(raw.subarray(0, 3).toString('latin1')).toBe('GXL')
  const rowSize = raw.readUInt16LE(4)
  const columnCount = raw.readUInt16LE(6)
  const rowCount = raw.readUInt16LE(8)
  const types = [...raw.subarray(10, 10 + columnCount)]
  const start = 10 + columnCount
  expect(start + rowSize * rowCount, `${name} 크기 검산`).toBe(raw.length)
  const widthOf = (type: number) => (type >= 10 ? type - 10 : ({ 0: 1, 1: 1, 2: 2, 3: 2, 4: 4 } as Record<number, number>)[type])
  const offsets: number[] = []
  let cursor = 0
  for (const type of types) {
    offsets.push(cursor)
    const width = widthOf(type)
    expect(width, `${name} 열 종류 ${type}`).toBeDefined()
    cursor += width
  }
  expect(cursor, `${name} 열 너비 합 = 줄 크기`).toBe(rowSize)
  const rows = Array.from({ length: rowCount }, (_, i) => raw.subarray(start + i * rowSize, start + (i + 1) * rowSize))
  const cells = rows.map((row) =>
    types.map((type, column): Cell => {
      const at = offsets[column]
      switch (type) {
        case 0:
          return row.readUInt8(at)
        case 1:
          return row.readInt8(at)
        case 2:
          return row.readUInt16LE(at)
        case 3:
          return row.readInt16LE(at)
        case 4:
          return row.readUInt32LE(at)
        default:
          return fixedText(row.subarray(at, at + type - 10))
      }
    }),
  )
  return { rows, cells, offsets }
}

const num = (cell: Cell): number => cell as number
/** s8 로 적힌 칸을 바이트로 (니블 · 비트 칸) */
const byte = (cell: Cell): number => (cell as number) & 0xff

/* binary.mod — .text VA = 파일 + 0xfcc, .data VA 0x1400000 = 파일 0x101d4c */
function binaryOffset(va: number): number {
  if (va >= 0x1400000) return va - 0x1400000 + 0x101d4c
  return va - 0xfcc
}
type Width = 'u8' | 's8' | 'u16' | 's16' | 'u32' | 's32'
const WIDTHS: readonly Width[] = ['u8', 's8', 'u16', 's16', 'u32', 's32']
const SIZE: Record<Width, number> = { u8: 1, s8: 1, u16: 2, s16: 2, u32: 4, s32: 4 }
function readAt(buffer: Buffer, offset: number, width: Width): number {
  switch (width) {
    case 'u8':
      return buffer.readUInt8(offset)
    case 's8':
      return buffer.readInt8(offset)
    case 'u16':
      return buffer.readUInt16LE(offset)
    case 's16':
      return buffer.readInt16LE(offset)
    case 'u32':
      return buffer.readUInt32LE(offset)
    case 's32':
      return buffer.readInt32LE(offset)
  }
}
let binaryCache: Buffer | undefined
const binary = (): Buffer => (binaryCache ??= read('binary.mod'))
function table(va: number, width: Width, count: number): number[] {
  const buffer = binary()
  const offset = binaryOffset(va)
  return Array.from({ length: count }, (_, i) => readAt(buffer, offset + i * SIZE[width], width))
}
function cString(va: number): string {
  const buffer = binary()
  const offset = binaryOffset(va)
  return cp949.decode(buffer.subarray(offset, buffer.indexOf(0, offset)))
}
const chunk = <T>(values: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(values.length / size) }, (_, i) => values.slice(i * size, (i + 1) * size))

/* ── 시험 ─────────────────────────────────────────────────────────────── */

describe.skipIf(JAR_DIR === undefined)('원본 대조 — 웹 데이터 = jar · binary.mod 에서 다시 읽은 값 (r337)', () => {
  describe('글표 (GST)', () => {
    it.each([
      ['StrNICKNAME', ORIGINAL_TITLES],
      ['StrITEM', ORIGINAL_ITEMS],
      ['StrENDING', ORIGINAL_ENDINGS],
      ['StrTIP', ORIGINAL_TIPS],
      ['StrHOWTO', ORIGINAL_HOWTO],
      ['StrUSER_EVT', ORIGINAL_USER_EVENTS],
      ['StrMODE', ORIGINAL_MODE_TEXT],
      ['StrMAINMENU', ORIGINAL_MAIN_MENU_TEXT],
    ] as const)('%s — 개수 · 차례 · 글이 원문 그대로', (name, web) => {
      expect(web).toEqual(stringTable(name))
    })

    it('스킬 40종 = StrCOMMON[55 + n] 이름 · StrSKILL[n] 소개 · StrSKILL[40 + n] 효과', () => {
      const common = stringTable('StrCOMMON')
      const skill = stringTable('StrSKILL')
      expect(skill).toHaveLength(80)
      expect(ORIGINAL_SKILLS.map((s) => s.id)).toEqual(Array.from({ length: 40 }, (_, i) => i))
      for (const s of ORIGINAL_SKILLS) {
        expect([s.name, s.description, s.effect]).toEqual([common[55 + s.id], skill[s.id], skill[40 + s.id]])
      }
    })

    it('StrCOMMON 에서 뽑은 이름 — 팀 0~14 · 필살 25~29 · 31~36 · 마선수 기술 95~104 · 마선수 오픈 팝업 42 · 43', () => {
      const common = stringTable('StrCOMMON')
      expect(TEAMS.map((t) => t.name)).toEqual(common.slice(0, 15))
      expect(BATTER_BURSTS).toEqual(common.slice(25, 30))
      expect(PITCHER_BURSTS).toEqual(common.slice(31, 37))
      expect(ACE_PLAYERS.filter((a) => a.role === '타자').map((a) => a.burst)).toEqual(common.slice(100, 105))
      expect(ACE_PLAYERS.filter((a) => a.role === '투수').map((a) => a.burst)).toEqual(common.slice(95, 100))
      expect([ACE_OPEN_POPUP.blocked, ACE_OPEN_POPUP.confirm]).toEqual([common[42], common[43]])
    })

    it('대사 화자 이름 2~24 = StrMODE[번호 + 91]', () => {
      const mode = stringTable('StrMODE')
      expect(SPEAKER_NAMES).toEqual(['', '<player>', ...Array.from({ length: 23 }, (_, i) => mode[i + 2 + 91])])
    })
  })

  describe('선수 · 팀 · 마선수 레코드 (GXL, 열 종류로 나눠 읽기)', () => {
    // 선수 48바이트 열: 0 아이디 · 1 이름 · 2 · 3 +0xb · 4~7 능력치 · 8 +0x14 스킬 비트 · 9 +0x18 · 10·11 장비 · 12 +0x1b · 13 +0x1c · 14~ 시즌 줄
    const playerOf = (cells: readonly Cell[], index: number) => ({
      id: index,
      name: cells[1],
      ability: [num(cells[4]), num(cells[5]), num(cells[6]), num(cells[7])],
      grade: byte(cells[12]),
      profile: byte(cells[3]),
      skillBits: num(cells[8]),
      equipment: [byte(cells[10]) >> 4, byte(cells[10]) & 0xf, byte(cells[11]) >> 4, byte(cells[11]) & 0xf],
      recordLine: cells.slice(14, 20).map((cell) => (num(cell) << 16) >> 16),
    })

    it('타자 180 · 투수 120 — 줄을 하나도 안 빼고 차례 그대로', () => {
      const batters = recordTable('XlsBATTER_DATA')
      const pitchers = recordTable('XlsPITCHER_DATA')
      expect(batters.offsets.slice(0, 15)).toEqual([0, 1, 10, 11, 12, 14, 16, 18, 20, 24, 25, 26, 27, 28, 32])
      expect(BATTERS).toEqual(batters.cells.map((cells, i) => ({ ...playerOf(cells, i), position: num(cells[13]) & 0xf })))
      expect(PITCHERS).toEqual(pitchers.cells.map((cells, i) => playerOf(cells, i)))
    })

    it('투수 폼 · 마구 · 보유 구질 (+0xb >> 4 · +0x18 · +0x1c)', () => {
      const repertoire = (cells: readonly Cell[]) => ({
        name: cells[1],
        form: byte(cells[3]) >> 4,
        magicId: byte(cells[9]),
        pitchMask: num(cells[13]),
      })
      expect(ACE_PITCHER_REPERTOIRES).toEqual(recordTable('XlsACE_PIT_DATA').cells.map(repertoire))
      expect(ROSTER_PITCHER_REPERTOIRES).toEqual(recordTable('XlsPITCHER_DATA').cells.map(repertoire))
    })

    it('팀 15 — u16 여섯 칸', () => {
      expect(TEAMS.map((t) => t.values)).toEqual(recordTable('XlsTEAM_DATA').cells.map((cells) => cells.map(num)))
    })

    it('마선수 10 — 마타자(XlsACE_BAT_DATA) 5 뒤 마투수(XlsACE_PIT_DATA) 5, 이름 · 능력치 · 비트 · 시즌 줄', () => {
      const rows = [...recordTable('XlsACE_BAT_DATA').cells, ...recordTable('XlsACE_PIT_DATA').cells]
      expect(
        ACE_PLAYERS.map((a) => ({
          name: a.name,
          ability: [a.ability.hit, a.ability.power, a.ability.defense, a.ability.run],
          skillBits: a.skillBits,
          profile: a.profile,
          recordLine: a.recordLine,
        })),
      ).toEqual(
        rows.map((cells, i) => {
          const player = playerOf(cells, i)
          return { name: player.name, ability: player.ability, skillBits: player.skillBits, profile: player.profile, recordLine: player.recordLine }
        }),
      )
    })

    it('마선수 오픈 표 (XlsACE_LEVEL_UP) — 번호 · 능력치 · G 가격 · 힌트', () => {
      expect(
        ACE_OPEN_TABLE.map((e) => [e.number, e.ability.hit, e.ability.power, e.ability.defense, e.ability.run, e.openPriceGamePoint, e.openHint]),
      ).toEqual(recordTable('XlsACE_LEVEL_UP').cells)
    })
  })

  describe('미션 · 돌발미션', () => {
    it('미션 — 타자 19 · 투수 19 줄 중 이름 있는 줄, 글은 원문 그대로(앞뒤 빈칸 포함)', () => {
      const expected = (['XlsBATTER_MISSION', 'XlsPITCHER_MISSION'] as const).flatMap((name) => {
        const side = name === 'XlsBATTER_MISSION' ? '타자' : '투수'
        return recordTable(name)
          .cells.filter((cells) => cells[13] !== '')
          .map((cells) => {
            const limits = num(cells[9])
            return {
              id: num(cells[0]),
              side,
              stage: num(cells[1]),
              name: cells[13],
              goals: (cells[12] as string).split('|'),
              briefing: cells[14],
              timeLimitSeconds: num(cells[10]),
              plateAppearanceLimit: limits >> 8,
              swingLimit: (limits >> 4) & 0xf,
              pitchLimit: limits & 0xf,
              opponentAce: byte(cells[8]) >> 4,
              conditionCode: num(cells[11]),
            }
          })
      })
      expect(
        MISSIONS.map((m) => ({
          id: m.id,
          side: m.side,
          stage: m.stage,
          name: m.name,
          goals: m.goals,
          briefing: m.briefing,
          timeLimitSeconds: m.timeLimitSeconds,
          plateAppearanceLimit: m.plateAppearanceLimit,
          swingLimit: m.swingLimit,
          pitchLimit: m.pitchLimit,
          opponentAce: m.opponentAce,
          conditionCode: m.conditionCode,
        })),
      ).toEqual(expected)
    })

    it.each(['BATTER', 'PITCHER', 'SEASON'] as const)('돌발미션 %s — 본문 16바이트 그대로 · 대사 4줄(화자 · 표정 · 원문)', (label) => {
      const body = recordTable(`Xls${label}_BURST`)
      const text = recordTable(`Xls${label}_BURST_TEXT`)
      const web = ORIGINAL_BURST_TABLES[label]
      expect(web.rowBytes).toEqual(body.rows.map((row) => [...row]))
      expect(web.lines).toEqual(
        text.cells.map((cells) =>
          chunk(cells, 3).map(([speaker, expression, line]) => ({
            speaker: num(speaker),
            expression: num(expression),
            text: line,
          })),
        ),
      )
    })
  })

  describe('이벤트 스크립트 (r_event · s_event)', () => {
    /** 글표: u32 N · u32 데이터 크기 · u32 오프셋 N · 데이터 */
    function eventTexts(name: string): string[] {
      const raw = zt1(name)
      const count = raw.readUInt32LE(0)
      const size = raw.readUInt32LE(4)
      const base = 8 + 4 * count
      return Array.from({ length: count }, (_, i) => {
        const from = base + raw.readUInt32LE(8 + 4 * i)
        const to = base + (i + 1 < count ? raw.readUInt32LE(12 + 4 * i) : size)
        return fixedText(raw.subarray(from, to))
      })
    }

    /** 레코드 = u16 길이 · u16 번호 · +4.. 머리 · 조건 · 명령 (파서 0xadd10 · 초상화 바탕 표 0xd0ae6 은 binary 에서 읽는다) */
    function events(name: string) {
      const raw = zt1(name)
      const texts = eventTexts(`${name}_txt`)
      const animationBase = table(0xd0ae6, 's16', 25)
      const fileOf = (id: number) => (id >= 10 && id <= 13 ? 'event_char_1' : id >= 17 && id <= 22 ? 'event_char_2' : 'event_char_0')
      const out = []
      let at = 0
      while (at < raw.length - 1) {
        const length = raw.readUInt16LE(at)
        let p = at + 15
        const u8 = () => raw.readUInt8(p++)
        const u16 = () => {
          const v = raw.readUInt16LE(p)
          p += 2
          return v
        }
        const s16 = () => {
          const v = raw.readInt16LE(p)
          p += 2
          return v
        }
        const portraits = () =>
          Array.from({ length: u8() }, () => {
            const id = u8()
            const side = u8()
            u8()
            const expression = u8()
            const base = id === 1 ? 0 : (animationBase[id] ?? -1)
            return base < 0 ? null : { file: fileOf(id), animation: base + expression, side: side ? 'left' : 'right' }
          }).filter((portrait) => portrait !== null)
        const conditions = Array.from({ length: raw.readUInt8(at + 14) }, () => ({ type: u8(), value: s16() }))
        const commands = Array.from({ length: u8() }, () => {
          const op = u8()
          switch (op) {
            case 0: {
              const ps = portraits()
              const text = texts[u16()]
              return { op: 'say', text, speaker: u8(), format: u8(), portraits: ps }
            }
            case 1: {
              const ps = portraits()
              return { op: 'choice', portraits: ps, choices: Array.from({ length: u8() }, () => ({ text: texts[u16()], gotoEvent: u16() })) }
            }
            case 2: {
              const sub = u8()
              const arg = u16()
              return sub === 0 ? { op: 'system', sub, arg, text: texts[arg] ?? '' } : { op: 'system', sub, arg }
            }
            case 3:
              return { op: 'yesno', sub: u8(), text: texts[u16()], yesEvent: u16(), noEvent: u16() }
            case 4: {
              const sub = u8()
              const arg = u16()
              return { op: 'op4', sub, arg, pairs: Array.from({ length: u8() }, () => [u16(), u16()]) }
            }
            case 5:
              return { op: 'effect', id: u8() }
            case 6:
              return { op: 'sound', id: u8() }
            case 7:
              return { op: 'reward', items: Array.from({ length: u8() }, () => ({ kind: u8(), value: s16() })) }
            case 8:
              return { op: 'match', team: u8(), resultEvents: [u16(), u16()] }
            default:
              throw new Error(`${name} 알 수 없는 명령 ${op}`)
          }
        })
        expect(p - at, `${name} 레코드 ${raw.readUInt16LE(at + 2)} 길이`).toBe(length)
        out.push({
          id: raw.readUInt16LE(at + 2),
          audience: raw[at + 4],
          repeatable: raw[at + 5] !== 0,
          trigger: raw[at + 6],
          requiresEvent: raw.readUInt16LE(at + 7),
          dateFrom: [raw[at + 9], raw[at + 10]],
          dateTo: [raw[at + 11], raw[at + 12]],
          conditions,
          commands,
        })
        at += length
      }
      expect(at, `${name} 남는 바이트`).toBe(raw.length)
      return out
    }

    it('r_event 313편 — 머리 · 조건 · 명령 · 대사 원문 · 초상화 · 갈래가 모두 같다', () => {
      const expected = events('r_event')
      expect(expected).toHaveLength(TOTAL_EVENT_COUNT)
      expect(ORIGINAL_EVENTS).toEqual(expected)
    })

    it('s_event 30편 — 같은 형식', () => {
      expect(ORIGINAL_SEASON_EVENTS).toEqual(events('s_event'))
    })
  })

  describe('투구 · 타구 · 행동 표 (data/*.zt1 · *.arr · *.dat)', () => {
    /** pitch.zt1 = u8 항목 수 · u32 오프셋 · 항목(u8 구질 · u8 레코드 수 · 레코드(u8 크기 · 곡선 · 틱 · 점 수 · 폼 · (i32 x,y,z) × 점 수)) */
    function pitchEntries() {
      const raw = zt1('pitch')
      const count = raw[0]
      return Array.from({ length: count }, (_, index) => {
        let p = raw.readUInt32LE(1 + 4 * index)
        expect(raw[p], '항목의 구질 번호 = 차례').toBe(index)
        const records = raw[p + 1]
        p += 2
        return Array.from({ length: records }, () => {
          const [size, curve, frames, pointCount, form] = raw.subarray(p, p + 5)
          expect(size).toBe(5 + 12 * pointCount)
          const points = Array.from({ length: pointCount }, (_, k) => [
            raw.readInt32LE(p + 5 + 12 * k),
            raw.readInt32LE(p + 9 + 12 * k),
            raw.readInt32LE(p + 13 + 12 * k),
          ])
          p += size
          return { curve, frames, form, points }
        })
      })
    }

    it('투구 레코드 22항목 (구질 1~21 + 마구 22) 전부', () => {
      expect(PITCH_RECORDS).toEqual(pitchEntries())
    })

    it('구질 21종 — 이름 = .data 이름표 0x140026c 칸 1~21 · 구속 단계 틱 = 앞 네 레코드 · 구속 = 레코드 수 ÷ 32', () => {
      const entries = pitchEntries()
      const names = table(0x140026c, 'u32', 23).map(cString)
      expect(PITCH_TYPES.map((p) => p.name)).toEqual(names.slice(1, 22))
      expect(PITCH_TYPES.map((p) => p.flightSteps)).toEqual(entries.slice(0, 21).map((records) => records.slice(0, 4).map((r) => r.frames)))
      expect(PITCH_TYPES.map((p) => p.speed)).toEqual(entries.slice(0, 21).map((records) => Number((records.length / 32).toFixed(3))))
    })

    it('투구 패턴 easy · normal · hard — 머리 10 뒤 9바이트 줄', () => {
      for (const difficulty of ['easy', 'normal', 'hard'] as const) {
        const raw = read(`data/pitchpattern_${difficulty}.arr`)
        expect(raw[0]).toBe(9)
        expect(PITCH_PATTERNS[difficulty]).toEqual(chunk([...raw.subarray(10)], 9))
      }
    })

    it('CPU 타자 행동 72줄 — 머리 8 뒤 7바이트 줄', () => {
      const raw = read('data/battingPattern.arr')
      expect(raw[0]).toBe(7)
      expect(BATTING_PATTERNS).toEqual(chunk([...raw.subarray(8)], 7))
    })

    it('타구 패턴 덱 · 플래그 · 공 물리 머리 (pattern.dat · pattern_plag.dat)', () => {
      const groups = (raw: Buffer, base: number, itemSize: number) => {
        const out = new Map<number, number[]>()
        for (let i = 0; i < raw[base]; i += 1) {
          const at = base + raw.readUInt32LE(base + 1 + 4 * i)
          const size = raw.readUInt16LE(at + 1)
          out.set(
            raw[at],
            Array.from({ length: size }, (_, k) => (itemSize === 4 ? raw.readUInt32LE(at + 3 + 4 * k) : raw[at + 3 + k])),
          )
        }
        return out
      }
      const pattern = read('data/pattern.dat')
      const words = groups(pattern, 9, 4)
      const flags = groups(read('data/pattern_plag.dat'), 0, 1)
      const expected: Record<number, number[][]> = {}
      for (const [code, items] of [...words].sort((a, b) => a[0] - b[0])) {
        const codeFlags = flags.get(code) ?? items.map(() => 0)
        expect(codeFlags).toHaveLength(items.length)
        expected[code] = items.map((w, k) => [w >>> 23, (w >>> 11) & 0xfff, w & 0x7ff, codeFlags[k]])
      }
      expect(BATTED_BALL_PATTERNS).toEqual(expected)
      expect(Object.values(BATTED_BALL_PHYSICS)).toEqual([...pattern.subarray(4, 9)])
    })

    it('d_level.dat 488바이트 그대로 · 이름 붙인 칸 · balance.json 의 파일 값', () => {
      const raw = read('data/d_level.dat')
      expect(D_LEVEL_RAW).toEqual([...raw])
      const u16 = (at: number) => raw.readUInt16LE(at)
      expect(D_LEVEL.swingTiming).toEqual({ floor: u16(0x0c), scale: u16(0x0e) })
      expect(D_LEVEL.wildPitchChance).toBe(u16(0x2a))
      expect(D_LEVEL.reliefChances).toEqual([...raw.subarray(0x36, 0x3c)].map((v) => (v << 24) >> 24))
      const formula = (at: number) => ({
        hitBase: u16(at),
        hitCoefficient: u16(at + 2),
        extraBase: u16(at + 4),
        extraCoefficient: u16(at + 6),
        contactFactor: u16(at + 8),
      })
      expect(BALANCE.swing.aceFormula).toEqual(formula(0x42))
      expect(BALANCE.swing.normalFormula).toEqual(formula(0x4c))
      expect([
        BALANCE.swing.hitWeight,
        BALANCE.swing.extraWeight,
        BALANCE.swing.powerPivot,
        BALANCE.swing.foulPercent,
        BALANCE.swing.outPercent,
      ]).toEqual([...raw.subarray(0x56, 0x5b)])
      expect(BALANCE.swing.aceBonus).toEqual({
        batterBase: u16(0x1d4),
        batterPerLevel: u16(0x1d6),
        pitcherBase: u16(0x1d8),
        pitcherPerLevel: u16(0x1da),
      })
      expect(BALANCE.swing.pitchGradeMultipliers).toEqual([0, 1, 2, 3, 4, 5].map((i) => u16(0x1dc + 2 * i)))
      expect(BALANCE.quickAtBat.powerScale).toEqual({ minimum: u16(0x0c), maximumValue: u16(0x0e) })
    })
  })

  describe('binary.mod 의 표', () => {
    it('삼각함수 표 0xd310c · 0xd2fa4 · 0xd2eec', () => {
      expect(SINE_HUNDRED_TABLE).toEqual(table(0xd310c, 'u8', 91))
      expect(TANGENT_TABLE).toEqual(table(0xd2fa4, 'u32', 90))
      expect(SINE_SIXTEEN_TABLE).toEqual(table(0xd2eec, 'u16', 91))
    })

    it('올해의 목표 — 타자 0xd7f9e · 투수 0xd7e9a (2 × 13 × 5)', () => {
      expect(BATTER_YEAR_GOALS).toEqual(chunk(chunk(table(0xd7f9e, 'u16', 130), 5), 13))
      expect(PITCHER_YEAR_GOALS).toEqual(chunk(chunk(table(0xd7e9a, 'u16', 130), 5), 13))
    })

    it('하늘 색 0xd37a4 (6 × 13) · 색 쌍 0xd37f2 (10 × 6)', () => {
      expect(SKY_COLOR_ROWS).toEqual(chunk(table(0xd37a4, 'u8', 78), 13))
      expect(SKY_COLOR_PAIRS).toEqual(chunk(table(0xd37f2, 'u8', 60), 6))
    })

    it('balance.json 의 표 값 — 기록달성 금액 0xcfbf8 · 0xd8158 · 간이 타석 등급 0xd896c · 필살 훈련 0xd7e92 · 0xd80e1 · 신인 0xcc3fa', () => {
      expect(BALANCE.recordGamePoints).toEqual(table(0xcfbf8, 'u32', 40))
      expect(BALANCE.recordGamePoints).toEqual(table(0xd8158, 'u32', 40))
      expect(BALANCE.quickAtBat.pitchGradeTable).toEqual(chunk(table(0xd896c, 'u32', 20), 5))
      expect(BALANCE.specialSwing.requiredSessions).toEqual(table(0xd7e92, 'u16', 4))
      expect(BALANCE.specialSwing.gamePointCost).toEqual(table(0xd80e1, 's8', 4).map((v) => -v * 100))
      expect(BALANCE.ability.rookieByBattingType.map((a) => [a.hit, a.power, a.defense, a.run])).toEqual(
        chunk(
          table(0xcc3fa, 'u8', 8).map((v) => v * 10),
          4,
        ),
      )
      // 리터럴 풀 (간이 타석 0xc11f0 · 상한 0xc1b38)
      expect([BALANCE.quickAtBat.weakSwingGate, BALANCE.quickAtBat.tightCourseGate, BALANCE.quickAtBat.extraBaseLimit]).toEqual([
        table(0xc1584, 'u32', 1)[0],
        table(0xc1590, 'u32', 1)[0],
        table(0xc1804, 'u32', 1)[0],
      ])
      expect(BALANCE.ability.maximum).toBe(table(0xc1b38, 'u32', 1)[0])
    })
  })

  it('소리 — 표의 번호 = jar sound/%03d.mmf 파일 52개', () => {
    const files = readdirSync(join(JAR_DIR as string, 'sound'))
      .filter((f) => /^\d{3}\.mmf$/.test(f))
      .map((f) => Number(f.slice(0, 3)))
    expect(ORIGINAL_SOUNDS.map((s) => s.id).sort((a, b) => a - b)).toEqual(files.sort((a, b) => a - b))
  })

  /* ── 손으로 옮긴 숫자 표 ─────────────────────────────────────────────── */

  describe('손으로 옮긴 숫자 표 — 주석의 데이터 구역 주소와 값이 같다', () => {
    /**
     * 주소에서 그대로 읽히지 않는 배열 — 원본 표를 가공했거나(차례 바꾸기 · 일부 칸 · 코드가 고친 값) 코드 리터럴 ·
     * 점프표에서 뜬 값이라 표와 견줄 수 없다. 하나하나 주석의 근거를 확인했다 (r337 대조 기록). 새로 생기면 이유를 적어 넣을 것.
     */
    const DERIVED = new Set([
      'src/entities/collection/model/hiddenOpenNotice.ts#NAME_RANGES', // 0x61e8c 갈래 상수 (0xd1720 은 줄바꿈 글)
      'src/entities/league/model/leagueDay/ability/cpuGameAbility.ts#TEAM_ABILITY_SLOT_OF_PITCHER', // 0xb592c 코드
      'src/entities/season-mode/model/seasonReputation.ts#RECORD_CODE_TO_SLOT', // 점프표 0xd7d7c 의 갈래 차례 (B-16)
      'src/features/play-pitcher-game/model/pitcherGameEvaluation.ts#MANAGER_TEXT_GRADES_STARTER', // 0xcc558 × 2 (0x1285a)
      'src/features/play-pitcher-game/model/pitcherGameEvaluation.ts#MANAGER_TEXT_SECTION_STARTS', // 0x128ac 스택 상수
      'src/pages/pitcher-league/lib/pitchTrainingWindow.ts#TAB_BOXES', // mode_ui 39 박스 (그림 자료)
      'src/pages/pitcher-league/lib/pitcherRegisterLayout.ts#REGISTER_ROW_HINTS', // 점프표 0xcc6d8 갈래 상수
      'src/pages/record/lib/annalsGrid.ts#NICKNAME_PAGE_FIRST_NAMES', // 쪽별 칸 수 누계
      'src/pages/season/lib/seasonOutingPopup.ts#NARI_OUTING_ANIMATIONS', // 점프표 0xd4a90 갈래 상수
      'src/pages/season/lib/seasonTeamInfo.ts#STADIUM_NAME_BASES', // 0x7ca02 adds 상수
      'src/pages/story/lib/evaluationDialogue.ts#PITCHER_COMMENT_BASES', // 0x128ac 스택 상수
      'src/shared/config/frameRate.ts#MILLISECONDS_PER_FRAME_BY_SPEED', // 1000 ÷ fps 표 0xd7624 (frameRate.test 가 본다)
      'src/shared/lib/stepCover/stepCover.ts#WEIGHT_TERMS', // 0xd5e58 마스크 · 0xd5de0 밀기를 한 줄로 묶음
      'src/widgets/ace-level-up/lib/aceLevelUpLayout.ts#ACE_BATTER_ROW_LABEL_FRAMES', // 0xd1c48 을 0x5f5c2 가 바꿔 넣은 값
      'src/widgets/batting-stage/lib/batterLayers/batterEquipment.ts#HAND_THIRD_GRADES', // 코드 비교 상수
      'src/widgets/loading-tip/lib/loadingTipLayout.ts#LOADING_BACKGROUND_RGB', // .data 색 값을 RGB 로 푼 것
      'src/widgets/matchup-cards/lib/matchupRecord.ts#ACE_BATTER_PROFILES', // XlsACE_BAT_DATA +0xb (위 마선수 시험이 본다)
      'src/widgets/season/lib/seasonTrainingResult.ts#SEASON_TEAM_DETAIL_LABEL_FRAMES', // 0xd4ad8 앞 넷을 0x87360 이 바꿔 넣음
    ])
    const ROOT = process.cwd()
    const ADDRESS = /0x([0-9a-fA-F]{5,7})\b/g
    const ARRAY_START = /(?:^|[\s;])(?:export\s+)?(?:const|let)[ \t]+([A-Za-z_$][\w$]*)[^=\n]*=\s*\[/gm
    const NUMBER = /-?(?:0x[0-9a-fA-F]+|\d+)(?![\w.])/g
    const isTableAddress = (va: number) => (va >= 0xcb000 && va < 0xdaac8) || (va >= 0x1400000 && va < 0x1400998)

    function sourceFiles(dir: string): string[] {
      return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) return sourceFiles(path)
        return /\.tsx?$/.test(name) && !name.includes('.test.') ? [path] : []
      })
    }

    function arrayBody(text: string, start: number): string | null {
      let depth = 0
      for (let i = start; i < text.length && i - start < 20000; i += 1) {
        if (text[i] === '[') depth += 1
        else if (text[i] === ']' && --depth === 0) return text.slice(start, i + 1)
      }
      return null
    }

    function matches(values: readonly number[], rows: readonly number[][] | null, addresses: readonly number[]): boolean {
      const buffer = binary()
      const fits = (va: number, width: Width, transform: (v: number) => number) => {
        const offset = binaryOffset(va)
        if (offset + values.length * SIZE[width] > buffer.length) return false
        return values.every((value, i) => transform(readAt(buffer, offset + i * SIZE[width], width)) === value)
      }
      const transforms = [
        (v: number) => v,
        (v: number) => -v,
        Math.abs,
        ...[10, 100, 1000].flatMap((k) => [(v: number) => v * k, (v: number) => -v * k]),
      ]
      if (addresses.some((va) => WIDTHS.some((width) => transforms.some((transform) => fits(va, width, transform))))) return true
      // 줄 길이가 다른 표 — 줄마다 적힌 주소 뒤 1KB 안에서
      if (rows !== null) {
        for (const va of addresses) {
          for (const width of WIDTHS) {
            const window = buffer.subarray(binaryOffset(va), binaryOffset(va) + 0x400)
            const found = rows.every((row) => {
              for (let at = 0; at + row.length * SIZE[width] <= window.length; at += SIZE[width]) {
                if (row.every((value, i) => readAt(window, at + i * SIZE[width], width) === value)) return true
              }
              return false
            })
            if (found) return true
          }
        }
      }
      // 적힌 주소가 아닌 곳에 같은 열이 있다 — 값은 원본에 있다(주석 주소만 다른 칸을 가리킨다)
      return WIDTHS.some((width) => {
        const step = SIZE[width]
        for (let va = 0xcb000; va + values.length * step < 0xdaac8; va += 1) {
          if (fits(va, width, (v) => v)) return true
        }
        return false
      })
    }

    it('데이터 구역 주소를 적은 배열은 그 주소(또는 데이터 구역 어딘가)의 값과 같다 — 가공한 것은 DERIVED 에 이유와 함께', () => {
      const unexplained: string[] = []
      let checked = 0
      for (const path of sourceFiles(join(ROOT, 'src'))) {
        const file = relative(ROOT, path)
        if (file.startsWith('src/shared/config/original/') && !/\/(balance|mainMenu|trainingAnimation|sounds)\.ts$/.test(file)) continue
        const text = readFileSync(path, 'utf8')
        for (const match of text.matchAll(ARRAY_START)) {
          const body = arrayBody(text, (match.index ?? 0) + match[0].length - 1)
          if (body === null) continue
          const bare = body.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
          if (/[A-Za-z_$'"`{]/.test(bare.replace(NUMBER, ''))) continue
          const values = (bare.match(NUMBER) ?? []).map(Number)
          if (values.length < 3) continue
          const lineStart = text.lastIndexOf('\n', match.index ?? 0) + 1
          const context = text.slice(0, lineStart).split('\n').slice(-13).join('\n') + text.slice(lineStart, (match.index ?? 0) + match[0].length)
          const addresses = [...new Set([...context.matchAll(ADDRESS)].map((m) => parseInt(m[1], 16)))].filter(isTableAddress)
          if (addresses.length === 0) continue
          const inner = [...bare.slice(1, -1).matchAll(/\[([^[\]]*)\]/g)].map((m) => (m[1].match(NUMBER) ?? []).map(Number))
          const rows = inner.length >= 2 && inner.every((row) => row.length > 0) ? inner : null
          const key = `${file}#${match[1]}`
          checked += 1
          if (!DERIVED.has(key) && !matches(values, rows, addresses)) unexplained.push(`${key} [${values.slice(0, 8).join(', ')}…]`)
        }
      }
      expect(checked).toBeGreaterThan(200)
      expect(unexplained).toEqual([])
    })
  })
})
