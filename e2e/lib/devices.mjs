// 기기 꼴 — 이름: [브라우저, `scene.mjs` 의 DEVICES 이름, 방향]. `e2e:quick` · `e2e:only` · `e2e:hits` 가 같이 쓴다.
export const DEVICE_SETS = {
  'chromium-desktop': ['chromium', 'desktop', '가로'],
  'chromium-iphone': ['chromium', 'iphone', '세로'],
  'webkit-iphone': ['webkit', 'iphone', '세로'],
  'webkit-iphone-land': ['webkit', 'iphone-land', '가로'],
}

/** 쉼표 목록 → 기기 이름들 (없는 이름이면 던진다) */
export function deviceList(text) {
  const names = text
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
  for (const name of names)
    if (DEVICE_SETS[name] === undefined) throw new Error(`기기가 없다: ${name} (있는 것: ${Object.keys(DEVICE_SETS).join(', ')})`)
  return names
}
