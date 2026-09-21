import { existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  LOOPING_SOUND_IDS,
  ORIGINAL_SOUNDS,
  findOriginalSound,
  isLoopingSound,
  soundFileUrl,
} from '@/shared/config/original/sounds'

/**
 * 번호 표가 원본 파일 목록과 어긋나지 않는지 본다.
 * 원본 jar 의 `sound/` 에는 52개가 있고 번호가 중간중간 비어 있다 (19·41·43·45·47·49·54~58).
 */

const ORIGINAL_FILE_IDS = [
  ...Array.from({ length: 19 }, (_, i) => i), // 0~18
  ...Array.from({ length: 21 }, (_, i) => 20 + i), // 20~40
  42, 44, 46, 48, 50, 51, 52, 53, 59, 60, 61, 62,
]

describe('원본 소리 번호 표', () => {
  it('원본에 있는 52개 번호를 하나도 빠뜨리지 않는다', () => {
    const ids = ORIGINAL_SOUNDS.map((sound) => sound.id).sort((a, b) => a - b)

    expect(ids).toHaveLength(52)
    expect(ids, `표에 없는 번호: ${ORIGINAL_FILE_IDS.filter((id) => !ids.includes(id))}`)
      .toEqual(ORIGINAL_FILE_IDS)
  })

  it('번호가 겹치지 않는다', () => {
    const ids = ORIGINAL_SOUNDS.map((sound) => sound.id)

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('배경음 목록은 이벤트 스크립트 0x8d470 의 loop 판정 그대로다', () => {
    expect([...LOOPING_SOUND_IDS].sort((a, b) => a - b)).toEqual([1, 3, 4, 33, 40, 44, 46, 47, 52])
    // 47 은 원본에 파일이 없다 — 목록에는 있고 표에는 없다.
    expect(findOriginalSound(47)).toBeUndefined()
  })

  it('트는 곳이 있는 배경음은 전부 loop 목록에 든다', () => {
    const bgmIds = ORIGINAL_SOUNDS
      .filter((sound) => sound.role === 'bgm' && !sound.unused)
      .map((sound) => sound.id)

    for (const id of bgmIds) {
      expect(isLoopingSound(id), `${id} 번은 배경음인데 loop 목록에 없다`).toBe(true)
    }
    // 002 만 예외다 — loop 목록에 없고, 앱 재개 0x2ddc 의 "1~4 다시 틀기" 범위에만 든다.
    expect(isLoopingSound(2)).toBe(false)
  })

  it('002 만 "원본이 안 트는 번호" 로 남는다', () => {
    const unused = ORIGINAL_SOUNDS.filter((sound) => sound.unused).map((sound) => sound.id)

    expect(unused).toEqual([2])
  })

  it('파일 이름은 원본 sprintf("%03d") 규칙을 따른다', () => {
    expect(soundFileUrl(0)).toBe('sounds/000.mp3')
    expect(soundFileUrl(62)).toBe('sounds/062.mp3')
    expect(soundFileUrl(7, '/base/sounds')).toBe('/base/sounds/007.mp3')
  })
})

describe('구워 둔 소리 파일', () => {
  const soundsDir = fileURLToPath(new URL('../../../../public/sounds', import.meta.url))

  it.skipIf(!existsSync(soundsDir))('public/sounds 에 표의 52개가 모두 있다', () => {
    const files = new Set(readdirSync(soundsDir))

    for (const sound of ORIGINAL_SOUNDS) {
      const name = soundFileUrl(sound.id, '').replace(/^\//, '')
      expect(files.has(name), `${name} 이 없다 — tools/extract_sounds.py 를 돌려라`).toBe(true)
    }
  })
})
