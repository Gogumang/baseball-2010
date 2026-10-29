import { AUTO_RELAY_SPEED_MAX } from '@/pages/team-game/model/autoRelaySpeed'
import { AUTO_RELAY_CHANGE_WAIT } from './relayLayout'

/** "CHANGE" 연출 대기 — sim+0x9c(걸렸나) · sim+0x9d(남은 그림, 부호 있는 바이트) */
export interface RelayWait {
  armed: boolean
  count: number
}

/** 부호 있는 바이트로 줄인다 — sim+0x9d 는 `strb` · `lsls #0x18` 로 비교하는 바이트다 */
function signedByte(value: number): number {
  return ((((value + 128) % 256) + 256) % 256) - 128
}

/** 갱신 0x48480 484a4 — 이번 그림에 0xc2198 을 부르는가 (v = 2 면 늘, 0 은 8틱 · 1 은 4틱마다) */
export function isRelayUpdateTick(tick: number, speed: number): boolean {
  return speed === AUTO_RELAY_SPEED_MAX || tick % ((AUTO_RELAY_SPEED_MAX - speed) * 4) === 0
}

/** 484ea — 대기가 걸렸으면 sim+0x9d 를 1 줄인다. 아직 > 0 이면 참(이번 갱신을 건너뛴다) */
export function applyChangeWaitBeforeUpdate(wait: RelayWait): boolean {
  if (!wait.armed) return false
  wait.count = signedByte(wait.count - 1)
  return wait.count > 0
}

/** 0xc2198 머리 — sim+0x9c · +0x9d 를 지운다 */
export function clearChangeWait(wait: RelayWait): void {
  wait.armed = false
  wait.count = 0
}

/** 0xc2198 이 반 이닝을 넘겼다 — 빠르기 2 가 아니면 "CHANGE" 대기를 건다 */
export function armChangeWait(wait: RelayWait, halfFlipped: boolean, fast: boolean): void {
  if (!halfFlipped || fast) return
  wait.armed = true
  wait.count = AUTO_RELAY_CHANGE_WAIT
}

/** 그리기 0x4258c 42b30 — 모드 · 속도를 안 보고 sim+0x9d 를 그림마다 1 줄이고 > 0 이면 "CHANGE" 를 그린다 (그릴지 돌려준다) */
export function applyChangeWaitOnDraw(wait: RelayWait): boolean {
  wait.count = signedByte(wait.count - 1)
  return wait.count > 0
}
