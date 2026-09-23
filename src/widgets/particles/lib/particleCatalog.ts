import type { ParticleConfig } from '@/entities/particle/model/particleEmitter'

/**
 * `public/sprites/ptcimg/particles.json` — `.ptc` 26개 설정을 불러온다.
 * 스프라이트와 같은 방식으로 비동기로 받아 두고, 도착 전에는 null 을 돌려 화면을 멈추지 않는다.
 *
 * 파일의 `callId` 는 원본 발생 함수 `0xbbc84` 의 id 다 (`sprintf("ptc/%03d.ptc", id+1)`).
 * **id > 0x18 이면 원본이 그냥 돌아간다** (0xbbca4 `cmp r2,#0x18; bls`) — 그래서 `026.ptc`(id 25) 는
 * 코드에서 부를 수 없는 에셋이다. 여기서도 `callable` 이 거짓인 줄은 내주지 않는다.
 */
interface ParticleCatalogEntry extends ParticleConfig {
  readonly file: string
  readonly callId: number
  readonly callable: boolean
}

interface ParticleCatalogFile {
  readonly emitters: readonly ParticleCatalogEntry[]
}

const CATALOG_URL = './sprites/ptcimg/particles.json'

let catalog: readonly ParticleCatalogEntry[] | null = null
let requested = false

/** 아직 안 불러왔으면 받아 두기만 하고 null 을 돌려준다 */
export function particleConfigOf(callId: number): ParticleConfig | null {
  if (catalog === null) {
    if (!requested) {
      requested = true
      void fetch(CATALOG_URL)
        .then((response) => (response.ok ? (response.json() as Promise<ParticleCatalogFile>) : null))
        .then((data) => {
          catalog = data?.emitters ?? null
        })
        .catch(() => {})
    }
    return null
  }
  const entry = catalog.find((item) => item.callId === callId)
  if (entry === undefined || !entry.callable) return null
  return entry
}
