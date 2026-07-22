// Feeds the Android home-screen widget. The widget is native and can't run our
// JS, so whenever the data changes we compute a compact "today" snapshot and
// hand it to the NestWidget plugin, which stores it and redraws the widget.
// No-op in a browser.

import { Capacitor, registerPlugin } from '@capacitor/core'
import { calendarOccurrences } from '../utils/recurrence.js'
import { toDateKey } from '../utils/dateUtils.js'

const NestWidget = registerPlugin('NestWidget')

export const isWidgetHost = () => Capacitor.isNativePlatform()

// "15:30" -> "3:30pm" (matches the reminder formatting elsewhere).
function friendlyTime(time) {
  if (!time) return ''
  const h = Number(time.slice(0, 2))
  const suffix = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 || 12
  return time.slice(3) === '00' ? `${hour}${suffix}` : `${hour}:${time.slice(3)}${suffix}`
}

// { date: "Tue 22 Jul", items: [{ time, text }] } — today's events (+birthdays)
// then to-dos due today, in the order they'd appear on Home.
export function todaySummary(data, now = new Date()) {
  const key = toDateKey(now)
  const items = calendarOccurrences(data, key, key).map((occ) => ({
    time: friendlyTime(occ.time),
    text: occ.title,
  }))
  for (const todo of data.todos || []) {
    if (!todo.done && todo.dueDate === key) items.push({ time: '', text: todo.title })
  }
  const date = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  return { date, items }
}

export async function pushWidget(data, now = new Date()) {
  if (!isWidgetHost() || !data) return
  try {
    await NestWidget.setData({ json: JSON.stringify(todaySummary(data, now)) })
  } catch (err) {
    console.error('Widget update failed', err)
  }
}
