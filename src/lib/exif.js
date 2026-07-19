// Read the date a photo was TAKEN, for album grouping. Prefers the EXIF
// DateTimeOriginal tag (the camera's capture time); falls back to the file's
// last-modified date when there's no EXIF (PNGs, screenshots, cropped blobs).
// Returns a local "YYYY-MM-DDTHH:MM:SS" string, or '' if nothing is known.
//
// Dependency-free: we parse just enough of the JPEG/TIFF/EXIF structure to
// find the one tag we need, reading only the file's head (EXIF lives near the
// start; an APP1 segment is at most 64 KB).

const pad = (n) => String(n).padStart(2, '0')

const localIso = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T` +
  `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`

export async function readTakenAt(file) {
  try {
    const exif = await readExifDate(file)
    if (exif) return exif
  } catch {
    // Corrupt/odd EXIF — fall through to the file date.
  }
  const lm = file?.lastModified
  if (typeof lm === 'number' && lm > 0) return localIso(new Date(lm))
  return ''
}

// EXIF timestamps look like "YYYY:MM:DD HH:MM:SS" (local, no zone).
function exifToIso(value) {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value || '')
  if (!m || m[1] === '0000') return ''
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`
}

async function readExifDate(file) {
  if (!file || typeof file.arrayBuffer !== 'function') return ''
  if (file.type && !/jpe?g/i.test(file.type)) return '' // EXIF dates: JPEG only here
  const head = typeof file.slice === 'function' ? file.slice(0, 131072) : file
  const view = new DataView(await head.arrayBuffer())
  const len = view.byteLength
  if (len < 4 || view.getUint16(0) !== 0xffd8) return '' // not a JPEG

  // Walk the JPEG marker segments looking for APP1 ("Exif\0\0").
  let offset = 2
  while (offset + 4 <= len) {
    if (view.getUint8(offset) !== 0xff) break
    const marker = view.getUint16(offset)
    if (marker === 0xffda || marker === 0xffd9) break // start-of-scan / end: no more metadata
    const size = view.getUint16(offset + 2)
    if (size < 2) break
    if (
      marker === 0xffe1 &&
      offset + 10 <= len &&
      view.getUint32(offset + 4) === 0x45786966 && // "Exif"
      view.getUint16(offset + 8) === 0x0000
    ) {
      return parseTiff(view, offset + 10)
    }
    offset += 2 + size
  }
  return ''
}

function parseTiff(view, tiffStart) {
  const bom = view.getUint16(tiffStart)
  const little = bom === 0x4949 // "II"; "MM" (0x4d4d) is big-endian
  if (!little && bom !== 0x4d4d) return ''
  const u16 = (o) => view.getUint16(o, little)
  const u32 = (o) => view.getUint32(o, little)
  if (u16(tiffStart + 2) !== 0x002a) return ''

  const entryTag = (ifd, tag) => {
    if (ifd + 2 > view.byteLength) return null
    const count = u16(ifd)
    for (let i = 0; i < count; i++) {
      const entry = ifd + 2 + i * 12
      if (entry + 12 > view.byteLength) break
      if (u16(entry) === tag) return entry
    }
    return null
  }
  const asciiAt = (entry) => {
    const count = u32(entry + 4)
    const at = count <= 4 ? entry + 8 : tiffStart + u32(entry + 8)
    let s = ''
    for (let i = 0; i < count && at + i < view.byteLength; i++) {
      const c = view.getUint8(at + i)
      if (c === 0) break
      s += String.fromCharCode(c)
    }
    return s
  }

  const ifd0 = tiffStart + u32(tiffStart + 4)
  // DateTimeOriginal (0x9003) lives in the Exif sub-IFD (pointer tag 0x8769).
  const exifPtr = entryTag(ifd0, 0x8769)
  if (exifPtr) {
    const exifIfd = tiffStart + u32(exifPtr + 8)
    const dto = entryTag(exifIfd, 0x9003)
    if (dto) {
      const iso = exifToIso(asciiAt(dto))
      if (iso) return iso
    }
  }
  // Fall back to IFD0 DateTime (0x0132) — the file's modification time.
  const dt = entryTag(ifd0, 0x0132)
  if (dt) return exifToIso(asciiAt(dt))
  return ''
}
