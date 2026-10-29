import type { DefenseViewState } from '@/entities/fielding/model/defenseView/defenseViewState'
import { runInCheerSoundIdOf } from '@/features/play-at-bat/model/atBatSounds'
import type { RecordedBoardTally } from '@/pages/defense/ui/playback/recordedBoardTally'
import { activeSound } from '@/shared/api/audio/soundPort'

/**
 * 재생 갱신 하나가 보낸 메시지 0x13 들의 함성 — 0x51fb8 머리 51fb8~51fdc (홈런성이 아니면 60, 홈런성이면 주자 칸 0 일 때만 30).
 * 갱신을 한 번씩만 지나는 셈(ref) 안에서 부르므로 한 번씩만 난다
 */
function playRunInCheers(tally: RecordedBoardTally, homeRunHit: boolean): void {
  for (const slot of tally.runIns) {
    const cheer = runInCheerSoundIdOf(slot, homeRunHit)
    if (cheer !== null) activeSound().play(cheer)
  }
}

/**
 * **주자 판 한 틱의 소리를 원본 차례로** — 슬롯 2 의 차례(직접 뜸): 525e8 플레이 vt48(판정 콜 — 메시지 0xbba → 0x51a56, 즉시 재생 0x6ea6c)
 * → 525fc 주자 관리 vt18 = 0xaa0a8(vtable 0xd8308 +0x18 = 0xd8320 → 0xaa0a9 — 득점 aa1b0 메시지 0x13 → 0x51fb8 함성 60/30, 예약 0x6e499)
 * → 52612 플레이 vt4c → 52670 0xaf8fc 자동 슬라이딩 > 0 이면 5268c 효과음 10(예약 0x6e499). 사람 슬라이딩 키(0x5199c)는 그 틀의
 * 키 처리라 갱신보다 앞이다. 소리 통로가 하나라 뒤 소리가 앞 소리를 끊으므로(예약도 늘 끊고 칸 하나를 덮는다 — `soundPort`) 한 틱에
 * 판정 콜 · 함성 · 자동 슬라이딩이 함께 나면 슬라이딩 10 이 남는다. 진행기가 그 틱 소리에 득점 자리(`tickRunInSoundAt`)를 싣는다.
 * 판이 닫힌 뒤 갱신(마지막 그림을 다시 쓰는 갱신)은 진행기 소리가 없고 함성만 센다
 */
export function playRunnerTickSounds(view: DefenseViewState, withEngineSounds: boolean, tally: RecordedBoardTally, homeRunHit: boolean): void {
  const ids = withEngineSounds ? (view.tickSoundIds ?? []) : []
  const runInAt = Math.min(view.tickRunInSoundAt ?? ids.length, ids.length)
  for (const soundId of ids.slice(0, runInAt)) activeSound().play(soundId)
  playRunInCheers(tally, homeRunHit)
  for (const soundId of ids.slice(runInAt)) activeSound().play(soundId)
}
