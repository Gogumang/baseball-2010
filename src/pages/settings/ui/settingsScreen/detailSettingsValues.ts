import { PITCH_CONTROLS } from '@/entities/settings/model/gameSettings'
import type { GameSettings } from '@/entities/settings/model/gameSettings'

/**
 * 상세 설정 값 넷을 0/1 로 읽는다 — 원본 값 배열 `[sp+0x190]` 순서 그대로
 * (옵션 +0x2d 투구 · +0xbd 주루 · +0xf4 송구 · +0x3a 전광판, P7 K2).
 * 값 0 이 앞 문구(기본 · 수동 · 수동 · OFF) 인 것은 라벨 표 `0xd1b04` 로 **확정**이다.
 */
export function detailValuesOf(settings: GameSettings): readonly number[] {
  return [
    settings.pitchControl === '게이지' ? 1 : 0,
    settings.runningMode === '자동' ? 1 : 0,
    settings.throwMode === '자동' ? 1 : 0,
    settings.isScoreboardOn ? 1 : 0,
  ]
}

/** 칸 0~3 은 누르면 값이 뒤집힌다 (원본 갱신 0x288ac 의 `eor #1`) */
export function toggleDetail(settings: GameSettings, row: number): GameSettings {
  if (row === 0) {
    const next = PITCH_CONTROLS[(PITCH_CONTROLS.indexOf(settings.pitchControl) + 1) % PITCH_CONTROLS.length]
    return { ...settings, pitchControl: next }
  }
  if (row === 1) return { ...settings, runningMode: settings.runningMode === '자동' ? '수동' : '자동' }
  if (row === 2) return { ...settings, throwMode: settings.throwMode === '자동' ? '수동' : '자동' }
  return { ...settings, isScoreboardOn: !settings.isScoreboardOn }
}
