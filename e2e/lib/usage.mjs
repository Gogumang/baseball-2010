// **자원 재기** — 이 프로세스 나무(node · preview · 빌드 · 브라우저와 그 자식)의 CPU 초 합 · 최대 RSS 합 · 최대 동시 브라우저 수.
// `ps` 를 `everyMs` 마다 떠서 pid 마다 누적 CPU(ps `time`)의 마지막 값을 더한다 — 떠 보기 사이에 끝난 프로세스의 마지막 몇백 ms 는
// 빠진다(조금 적게 센다). 웹킷의 WebContent · GPU · Networking 은 launchd 자식(XPC)이라 나무 밖이다 — 재기 동안 새로 선
// `ms-playwright` XPC 를 더하지만, 같은 때 다른 일이 웹킷을 띄우면 섞인다.
//
//   const meter = startUsageMeter()
//   …
//   const usage = await meter.stop()   // { cpuSeconds, peakRssMB, peakBrowsers, samples }
//   console.log(formatUsage(usage))
import { execFile } from 'node:child_process'

/** ps `time` (`MM:SS.ss` · `H:MM:SS.ss`) → 초 */
function secondsOf(text) {
  return text.split(':').reduce((sum, part) => sum * 60 + Number(part), 0)
}

function psRows() {
  return new Promise((resolve) => {
    execFile('ps', ['-axo', 'pid=,ppid=,rss=,time=,comm='], { maxBuffer: 16 * 2 ** 20 }, (error, stdout) => {
      if (error !== null) return resolve([])
      resolve(
        stdout
          .split('\n')
          .filter(Boolean)
          .map((line) => {
            const [pid, ppid, rss, time, ...comm] = line.trim().split(/\s+/)
            return { pid: Number(pid), ppid: Number(ppid), rssKB: Number(rss), cpu: secondsOf(time), comm: comm.join(' ') }
          }),
      )
    })
  })
}

const isBrowserRoot = (row, byPid) => {
  const browser = /ms-playwright|chrome-headless-shell|Chromium|Playwright\.app/
  return browser.test(row.comm) && !browser.test(byPid.get(row.ppid)?.comm ?? '')
}

/** `rootPid`(기본 이 프로세스) 아래 나무를 잰다 */
export function startUsageMeter({ rootPid = process.pid, everyMs = 500 } = {}) {
  const cpuByKey = new Map()
  const seenBefore = new Set()
  const usage = { cpuSeconds: 0, peakRssMB: 0, peakBrowsers: 0, samples: 0 }
  let primed = false
  const sample = async () => {
    const rows = await psRows()
    const byPid = new Map(rows.map((row) => [row.pid, row]))
    if (!primed) {
      // 재기 앞에 이미 있던 XPC 는 남의 것
      for (const row of rows) if (row.ppid === 1) seenBefore.add(`${row.pid}:${row.comm}`)
      primed = true
    }
    const children = new Map()
    for (const row of rows) children.set(row.ppid, [...(children.get(row.ppid) ?? []), row])
    const mine = []
    const stack = [byPid.get(rootPid)].filter(Boolean)
    while (stack.length > 0) {
      const row = stack.pop()
      mine.push(row)
      stack.push(...(children.get(row.pid) ?? []))
    }
    for (const row of rows) {
      if (row.ppid === 1 && /ms-playwright\/webkit/.test(row.comm) && !seenBefore.has(`${row.pid}:${row.comm}`)) mine.push({ ...row, xpc: true })
    }
    let rssKB = 0
    let browsers = 0
    for (const row of mine) {
      if (row.comm === 'ps' || row.comm.endsWith('/ps')) continue
      cpuByKey.set(`${row.pid}:${row.comm}`, row.cpu)
      rssKB += row.rssKB
      if (row.xpc !== true && isBrowserRoot(row, byPid)) browsers += 1
    }
    usage.peakRssMB = Math.max(usage.peakRssMB, Math.round(rssKB / 1024))
    usage.peakBrowsers = Math.max(usage.peakBrowsers, browsers)
    usage.samples += 1
  }
  let running = sample()
  const timer = setInterval(() => {
    running = running.then(sample)
  }, everyMs)
  return {
    async stop() {
      clearInterval(timer)
      await running
      await sample()
      usage.cpuSeconds = +[...cpuByKey.values()].reduce((sum, value) => sum + value, 0).toFixed(1)
      return { ...usage }
    },
  }
}

/** 한 줄 요약 */
export function formatUsage(usage, { wallMs, peakContexts } = {}) {
  const parts = [
    `CPU ${usage.cpuSeconds.toFixed(0)}초`,
    `최대 RSS ${(usage.peakRssMB / 1024).toFixed(2)}GB`,
    `동시 브라우저 최대 ${usage.peakBrowsers}`,
  ]
  if (peakContexts !== undefined) parts.push(`동시 맥락 최대 ${peakContexts}`)
  if (wallMs !== undefined) parts.push(`벽시계 ${(wallMs / 1000).toFixed(1)}s`)
  return `자원: ${parts.join(' · ')}`
}
