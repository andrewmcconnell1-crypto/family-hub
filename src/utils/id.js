// Short, collision-safe-enough ids for local data ("child-m3k9x0a2-4f7q").
export function makeId(prefix) {
  const time = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 6)
  return `${prefix}-${time}-${rand}`
}
