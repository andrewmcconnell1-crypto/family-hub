// Minimal dependency-free ZIP writer (STORE method, no compression — the
// contents are already-compressed JPEGs/PDFs). Enough for the family backup:
// local file headers + central directory + end record, UTF-8 names, CRC-32.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes) {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

// files: [{ name: 'folder/file.ext', data: Blob | string }] -> zip Blob
export async function buildZip(files) {
  const encoder = new TextEncoder()
  const parts = []
  const central = []
  let offset = 0

  for (const file of files) {
    const nameBytes = encoder.encode(file.name)
    const data =
      typeof file.data === 'string'
        ? encoder.encode(file.data)
        : new Uint8Array(await file.data.arrayBuffer())
    const crc = crc32(data)

    const header = new DataView(new ArrayBuffer(30))
    header.setUint32(0, 0x04034b50, true) // local file header signature
    header.setUint16(4, 20, true) // version needed
    header.setUint16(6, 0x0800, true) // flags: UTF-8 names
    header.setUint16(8, 0, true) // method: store
    header.setUint32(14, crc, true)
    header.setUint32(18, data.length, true)
    header.setUint32(22, data.length, true)
    header.setUint16(26, nameBytes.length, true)

    parts.push(header.buffer, nameBytes, data)
    central.push({ nameBytes, crc, size: data.length, offset })
    offset += 30 + nameBytes.length + data.length
  }

  const centralStart = offset
  let centralSize = 0
  for (const entry of central) {
    const record = new DataView(new ArrayBuffer(46))
    record.setUint32(0, 0x02014b50, true) // central directory signature
    record.setUint16(4, 20, true) // version made by
    record.setUint16(6, 20, true) // version needed
    record.setUint16(8, 0x0800, true) // flags: UTF-8 names
    record.setUint32(16, entry.crc, true)
    record.setUint32(20, entry.size, true)
    record.setUint32(24, entry.size, true)
    record.setUint16(28, entry.nameBytes.length, true)
    record.setUint32(42, entry.offset, true)
    parts.push(record.buffer, entry.nameBytes)
    centralSize += 46 + entry.nameBytes.length
  }

  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true) // end of central directory signature
  end.setUint16(8, central.length, true)
  end.setUint16(10, central.length, true)
  end.setUint32(12, centralSize, true)
  end.setUint32(16, centralStart, true)
  parts.push(end.buffer)

  return new Blob(parts, { type: 'application/zip' })
}

const EXT_BY_TYPE = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'text/plain': '.txt',
}

export function safeFileName(title, fallback) {
  const cleaned = (title || '')
    .replace(/[^\w\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
  return cleaned || fallback
}

export function extensionFor(fileName, mimeType) {
  const fromName = /\.\w{1,5}$/.exec(fileName || '')
  if (fromName) return fromName[0].toLowerCase()
  return EXT_BY_TYPE[mimeType] || ''
}
