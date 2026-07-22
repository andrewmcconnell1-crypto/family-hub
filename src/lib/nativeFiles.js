// Open a document with the device's native viewer, for the Android app. The
// WebView won't open a blob: download link (target="_blank" does nothing), so
// instead we write the file to the app's cache and hand it to the OS, which
// opens it in the right app (PDF viewer, gallery, etc.). Browser builds keep
// using a normal download link.

import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { FileOpener } from '@capacitor-community/file-opener'

export const canOpenNative = () => Capacitor.isNativePlatform()

const MIME_EXT = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'text/plain': 'txt',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

// A safe filename that keeps (or restores) an extension so the OS picks the
// right app to open it with.
function safeName(name, mime) {
  let base = (name || 'document').replace(/[^\w.\- ]+/g, '_').trim() || 'document'
  if (!/\.[A-Za-z0-9]+$/.test(base) && MIME_EXT[mime]) base += '.' + MIME_EXT[mime]
  return base
}

// Write the blob to the app cache and open it natively. Throws if the OS has no
// app that can open the type, so the caller can tell the user.
export async function openBlobNative(blob, fileName) {
  const mime = blob.type || ''
  const data = await blobToBase64(blob)
  const { uri } = await Filesystem.writeFile({
    path: `nest/${safeName(fileName, mime)}`,
    data,
    directory: Directory.Cache,
    recursive: true,
  })
  await FileOpener.open({ filePath: uri.replace(/^file:\/\//, ''), contentType: mime || undefined })
}
