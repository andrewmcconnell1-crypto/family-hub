import { describe, expect, it } from 'vitest'
import { readTakenAt } from './exif.js'

// Build a minimal JPEG carrying an EXIF DateTimeOriginal, little-endian TIFF.
function jpegWithDateTaken(exifDate) {
  const str = exifDate + '\0' // ASCII, NUL-terminated (count 20 for a full stamp)
  const tiff = 64 // fixed layout below
  const bytes = new Uint8Array(2 + 2 + 2 + 6 + tiff)
  const dv = new DataView(bytes.buffer)
  let p = 0
  dv.setUint16(p, 0xffd8); p += 2 // SOI
  dv.setUint16(p, 0xffe1); p += 2 // APP1
  dv.setUint16(p, 2 + 6 + tiff); p += 2 // segment length (big-endian)
  for (const ch of 'Exif') dv.setUint8(p++, ch.charCodeAt(0))
  dv.setUint8(p++, 0); dv.setUint8(p++, 0) // "Exif\0\0"
  const t = p // tiffStart
  dv.setUint16(t + 0, 0x4949) // "II" little-endian
  dv.setUint16(t + 2, 0x002a, true)
  dv.setUint32(t + 4, 8, true) // IFD0 at +8
  // IFD0: one entry -> Exif sub-IFD pointer
  dv.setUint16(t + 8, 1, true)
  dv.setUint16(t + 10, 0x8769, true) // ExifIFDPointer
  dv.setUint16(t + 12, 4, true) // LONG
  dv.setUint32(t + 14, 1, true)
  dv.setUint32(t + 18, 26, true) // Exif sub-IFD at +26
  dv.setUint32(t + 22, 0, true) // next IFD = 0
  // Exif sub-IFD: one entry -> DateTimeOriginal
  dv.setUint16(t + 26, 1, true)
  dv.setUint16(t + 28, 0x9003, true) // DateTimeOriginal
  dv.setUint16(t + 30, 2, true) // ASCII
  dv.setUint32(t + 32, 20, true) // count
  dv.setUint32(t + 36, 44, true) // value at +44
  dv.setUint32(t + 40, 0, true) // next IFD = 0
  for (let i = 0; i < str.length; i++) dv.setUint8(t + 44 + i, str.charCodeAt(i))
  return { type: 'image/jpeg', arrayBuffer: async () => bytes.buffer }
}

describe('readTakenAt', () => {
  it('reads the EXIF DateTimeOriginal', async () => {
    const file = jpegWithDateTaken('2024:05:15 10:30:00')
    expect(await readTakenAt(file)).toBe('2024-05-15T10:30:00')
  })

  it('falls back to the file modified date when there is no EXIF', async () => {
    const when = new Date(2023, 10, 2, 8, 5, 0) // local time
    const file = { type: 'image/png', lastModified: when.getTime(), arrayBuffer: async () => new ArrayBuffer(0) }
    const pad = (n) => String(n).padStart(2, '0')
    const expected = `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T08:05:00`
    expect(await readTakenAt(file)).toBe(expected)
  })

  it('returns empty when nothing is known (no EXIF, no date)', async () => {
    const file = { type: 'image/png', arrayBuffer: async () => new ArrayBuffer(0) }
    expect(await readTakenAt(file)).toBe('')
  })

  it('ignores a non-JPEG and uses its file date', async () => {
    const file = { type: 'image/webp', lastModified: Date.UTC(2022, 0, 1), arrayBuffer: async () => new ArrayBuffer(4) }
    expect(await readTakenAt(file)).toMatch(/^2021-12-31T|^2022-01-01T/)
  })
})
