import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { seasonRecordProfileOf } from '@/entities/season-mode/model/seasonEntry'
import { equippedAbilityOf } from '@/entities/career/model/condition'
import { skillBitsOfIds } from '@/entities/team/model/recordAbility'
import { entryBatterLineOfRecord } from '@/entities/season-mode/model/entryEditor'
import type { EntryBatterLine } from '@/entities/season-mode/model/entryEditor'
import { batterRecordLineOf } from '@/entities/career/model/seasonStats'
import type { NariEntryFace } from './types'

/**
 * **타자편 내 선수 줄** — 나리 팀 레코드의 내 칸은 커리어 0x30 바이트 레코드다(0x1fc75 · 시즌 영입 사본 `seasonNariBatterRecordOf` 와 같은 칸).
 * 0x5b798 타자 갈래(5b81e~)가 읽는 것: 도형 0xb6414(rec, k, 1) = 장비 · 장착 스킬을 얹은 값(`equippedAbilityOf`) · +0xb 타입(>> 5) ·
 * 손(비트 4) · +0x14 장착 스킬 비트 · +0x18 고른 필살 번호 · 연봉 — 육성(0xb6388 = +0xa 비트 7)이고 모드 3 · 4 라 +0x1b 가 아니라
 * 저장 +0x1c8 × 100 (5c848~5c872). 보직 딱지 +0xb & 3 = 포지션 (등록 0x16f28)
 */
export function myBatterEntryFaceOf(career: PlayerCareer): NariEntryFace {
  const equipped = equippedAbilityOf(career)
  const ability = [equipped.hit, equipped.power, equipped.defense, equipped.run]
  const profile = seasonRecordProfileOf(career.battingTypeIndex, career.battingSide, career.skinIndex, career.positionIndex)
  return {
    name: career.name,
    ability,
    profileLow: profile & 3,
    detailSource: {
      isPitcher: false,
      abilities: ability,
      aceIndex: -1,
      profile,
      skillBits: skillBitsOfIds(career.equippedSkillIds),
      specialNumber: career.specialSwingNumber,
      grade: null,
      nurturedSalary: career.salary,
    },
  }
}

/**
 * **타자편 내 선수 줄의 기록 열** — 목록 칸 그리기 0x56ebc 는 줄 레코드 `[팀+0x18][i] × 0x30 + 0x20` 을 그대로 읽는다(56f44~56f56 ·
 * 비트 갈래 5700a~57036: 1 → +0x20 타수 · 2 → +0x22 안타 · 4 → +0x24 2루타 · 8 → +0x26 3루타 · 0x10 → +0x28 홈런 · 0x20 → +0x2a 타점 ·
 * 0x40 → +0x2c 도루 · 0x80 → +0x2e 실책, 0 → 타율 0xb8e3d(레코드)). 육성 비트 · 모드 갈래가 없어 내 칸도 같은 줄을 읽는다.
 * 내 칸 +0x20~ 는 다른 칸처럼 시즌 시작 0xb6cc4 가 지우고 정산 0xa8024 가 게이트 0xa56dc(정규시즌)를 지날 때 쌓는다 —
 * 웹은 커리어 시즌 줄(`career.stats` — 포스트시즌은 `withoutRecordLine` 으로 안 쌓는다)이 그 칸이다(`batterRecordLineOf`).
 * +0x2c 도루는 `SeasonStats.stolenBases`(동료 간이 타석 0xc1818 의 도루). +0x2e 실책은 수비 그림 0x43278 이 야수로 선 선수에게만
 * 올리는데 타자편 내 팀 수비는 그리지 않아(간이 엔진) 늘 0 이다.
 */
export function myBatterEntryLineOf(career: PlayerCareer): EntryBatterLine {
  return { ...entryBatterLineOfRecord(batterRecordLineOf(career.stats)), steals: career.stats.stolenBases ?? 0, errors: 0 }
}
