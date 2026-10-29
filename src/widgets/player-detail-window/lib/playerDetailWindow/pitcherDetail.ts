import { pitcherHandOf } from '@/entities/pitching/model/pitcherHand'
import type { PlayerDetailSource } from '@/entities/season-mode/model/entryEditor'
import { ACE_PLAYERS } from '@/shared/config/original/acePlayers'
import { PITCH_TYPES } from '@/shared/config/original/pitchTypes'
import {
  ACE_PITCHER_TYPE_TEXT,
  DETAIL_NONE_TEXT,
  type DetailRowValue,
  FORM_MAGIC_TEXT,
  HAND_TEXT,
  JOIN_TEXT,
  MAGIC_TEXT,
  PITCHER_TYPE_TEXT,
  type PlayerDetail,
  skillNamesOf,
  textValue,
  tickerOrNone,
} from '@/widgets/player-detail-window/lib/playerDetailWindow/detailTexts'

/** 투수 갈래(종류 3, 0x5bf64~) — 29 타입 · 30 손 · 34 구질 · 33 스킬 · 32 마구 · 86 연봉 */
export function pitcherDetailOf(source: PlayerDetailSource, salary: DetailRowValue): PlayerDetail {
  const isAce = source.aceIndex >= 0
  const { form, magicNumber, pitchMask } = source.repertoire ?? NO_REPERTOIRE
  return {
    kind: '투수',
    abilities: source.abilities,
    values: [
      textValue(pitcherTypeTextOf(form, source.aceIndex)),
      textValue(HAND_TEXT.pitcher[pitcherHandOf(form, isAce)] ?? ''),
      { kind: 'ticker', text: pitchNamesOf(pitchMask).join(JOIN_TEXT) },
      tickerOrNone(skillNamesOf(source.skillBits, true)),
      magicValueOf(magicNumber, form, source.aceIndex),
      salary,
    ],
  }
}

const NO_REPERTOIRE = { form: 0, magicNumber: 0, pitchMask: 0 }

/** 타입 — 마투수는 StrCOMMON[0x6e + 순번], 그 밖은 표 0x1400124 의 (폼 >> 1) + 2 */
function pitcherTypeTextOf(form: number, aceIndex: number): string {
  if (aceIndex >= 0) return ACE_PITCHER_TYPE_TEXT[aceIndex] ?? ''
  return PITCHER_TYPE_TEXT[form >> 1] ?? ''
}

/** 5c2b0 — k = 1..22, 레코드 +0x1c & 표 0xd17a8[k](= 1 << (k − 1)) 이면 이름 표 0x14000c8[k] */
function pitchNamesOf(pitchMask: number): string[] {
  const pitches: string[] = []
  for (let k = 1; k <= 0x16; k += 1) if ((pitchMask & (1 << (k - 1))) !== 0) pitches.push(PITCH_TYPES[k - 1]?.name ?? '')
  return pitches
}

/** 마구 — 없으면 "-", 마투수는 그 버스트 이름, n = 4 면 폼 마구 [0x22 + 폼 >> 1], 그 밖 [0x1e + n] */
function magicValueOf(magicNumber: number, form: number, aceIndex: number): DetailRowValue {
  if (magicNumber <= 0) return textValue(DETAIL_NONE_TEXT)
  if (aceIndex >= 0) return { kind: 'ticker' as const, text: ACE_PLAYERS[5 + aceIndex]?.burst ?? '' }
  return { kind: 'ticker' as const, text: magicNumber === 4 ? (FORM_MAGIC_TEXT[form >> 1] ?? '') : (MAGIC_TEXT[magicNumber - 1] ?? '') }
}
