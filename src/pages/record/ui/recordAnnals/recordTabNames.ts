import { RECORD_NAMES } from '@/entities/game/model/gameRecords'
import { SPECIAL_RECORD_NAMES } from '@/pages/record/lib/recordAnnalsLayout'

/** 탭 0 의 칸 이름 48개 — StrGAME[8 + n] (경기 기록 40 + 달성 8) */
export const RECORD_TAB_NAMES: readonly string[] = [...RECORD_NAMES, ...SPECIAL_RECORD_NAMES]
