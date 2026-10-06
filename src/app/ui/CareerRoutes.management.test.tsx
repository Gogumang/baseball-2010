// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CareerRoutes } from '@/app/ui/CareerRoutes'
import { EMPTY_COLLECTION } from '@/entities/collection/model/collection'
import { useCareerSession } from '@/app/model/useCareerSession'
import { useAtBatRunner } from '@/app/model/useAtBatRunner'
import { useGameSettings } from '@/app/model/useGameSettings'
import type { Screen } from '@/app/model/screen'
import { createCareer } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { SaveGamePort } from '@/shared/api/save/saveGamePort'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'

/**
 * 관리 화면 창 → 세션 → 저장 흐름.
 *   필살타법 "고른 번호"(선수 +0x18) — 선수정보 칸 3 의 창(상태 0x7b)에서 고르면 0x1816c `strb` 로 표 값 1~4.
 *   스킬 창(선수정보 "아이템/스킬", 상태 122) — 대화 0x147b0 의 3 해제 · 4 장착 · 6 확장.
 */

afterEach(cleanup)

const 설정저장: JsonStorePort = (() => {
  let held: unknown = null
  return {
    load: () => held,
    save: (value: object) => {
      held = value
    },
  }
})()

function 메모리저장(held: PlayerCareer | null) {
  const box = { saved: held }
  const port: SaveGamePort = {
    load: () => box.saved,
    save: (career) => {
      box.saved = career
    },
    clear: () => {
      box.saved = null
    },
  }
  return { port, box }
}

function 띄우기(saved: PlayerCareer) {
  const { port, box } = 메모리저장(saved)
  const random = createSeededRandom(20100901)
  const latest: { career: PlayerCareer | null } = { career: null }
  function Harness() {
    const [screenState, setScreen] = useState<Screen>({ kind: '메인메뉴' })
    const runner = useAtBatRunner()
    const session = useCareerSession({ runner, random, saveGame: port, screen: screenState, setScreen })
    const gameSettings = useGameSettings(설정저장)
    latest.career = session.career
    if (session.career === null) {
      return <button type="button" onClick={() => { session.actions.continueSaved() }}>이어하기</button>
    }
    return (
      <CareerRoutes screen={screenState} setScreen={setScreen} session={session} runner={runner} random={random}
        career={session.career} hallOfFame={{ collection: EMPTY_COLLECTION, nariPitcher: null, register: () => '엔딩전' }}
        onAceMatch={() => {}}
        gameSettings={gameSettings} />
    )
  }
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: '이어하기' }))
  return { box, latest }
}

describe('필살타법 고른 번호 세션 연결', () => {
  it('선수정보 → 필살타법 창에서 고른 번호가 커리어 +0x18 에 쓰이고 저장된다', () => {
    const { box, latest } = 띄우기({ ...createCareer('테스터'), specialSwingLevel: 2 })
    expect(latest.career?.specialSwingNumber).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: '선수정보' }))
    fireEvent.click(screen.getByRole('button', { name: '필살타법' }))
    fireEvent.click(screen.getByRole('button', { name: '플레임 스윙' }))
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(latest.career?.specialSwingNumber).toBe(2)
    expect(box.saved?.specialSwingNumber).toBe(2)
  })
})

describe('스킬 창 장착·해제·확장 세션 연결', () => {
  const 열기 = () => {
    fireEvent.click(screen.getByRole('button', { name: '선수정보' }))
    fireEvent.click(screen.getByRole('button', { name: '아이템/스킬' }))
  }

  it('장착한 플러스 스킬을 해제하고 다시 장착한다 — 보유는 그대로다 (0xa4b04)', () => {
    const { box, latest } = 띄우기(createCareer('테스터'))
    열기()

    fireEvent.click(screen.getByRole('button', { name: '병아리' }))
    expect(screen.getByRole('dialog', { name: '알림' }).textContent).toContain('해제하시겠습니까')
    fireEvent.click(screen.getByRole('button', { name: '예' }))
    expect(latest.career?.equippedSkillIds).toEqual([8])
    expect(latest.career?.skillIds).toEqual([0, 8])
    expect(box.saved?.equippedSkillIds).toEqual([8])

    fireEvent.click(screen.getByRole('button', { name: '병아리' }))
    expect(screen.getByRole('dialog', { name: '알림' }).textContent).toContain('사용하시겠습니까')
    fireEvent.click(screen.getByRole('button', { name: '예' }))
    expect(latest.career?.equippedSkillIds).toEqual([8, 0])
  })

  it('가득 찬 채 고르면 5000 G 확장을 묻고, "예" 면 G 를 깎고 상한 8 로 넓힌다 (0x1484c)', () => {
    const plus = [0, 1, 6, 7, 8, 9]
    const { latest } = 띄우기({ ...createCareer('테스터'), skillIds: [...plus, 10], equippedSkillIds: plus, gamePoint: 6000 })
    열기()

    fireEvent.click(screen.getByRole('button', { name: '해결사' }))
    expect(screen.getByRole('dialog', { name: '알림' }).textContent).toContain('5000')
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(latest.career?.skillSlotLevel).toBe(1)
    expect(latest.career?.gamePoint).toBe(1000)
    expect(screen.getByRole('dialog', { name: '알림' }).textContent).toContain('8개로 확장')
  })
})
