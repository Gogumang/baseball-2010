// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CareerRoutes } from '@/app/ui/CareerRoutes'
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
 * 필살타법 "고른 번호"(선수 +0x18) 가 관리 화면 → 세션 → 저장까지 이어지는지 (05e1690 의 남은 배선).
 * 선수정보 칸 3 의 창(상태 0x7b)에서 고르면 0x1816c `strb` 로 표 값 1~4 가 들어간다.
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
        career={session.career} onRegisterHallOfFame={() => '엔딩전'} onAceMatch={() => {}}
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
