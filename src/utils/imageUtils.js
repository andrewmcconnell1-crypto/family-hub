// Downscale an image file so its longest side is at most maxSide, returning
// a JPEG blob (or the original file when it's already small enough or isn't
// a decodable image). Used on photo upload: full camera resolution is wasted
// on phone screens and eats the storage quota.
export async function downscaleImage(file, maxSide = 2000, quality = 0.85) {
  if (!file.type?.startsWith('image/')) return file
  const bitmap = await createImageBitmap(file)
  try {
    const scale = maxSide / Math.max(bitmap.width, bitmap.height)
    if (scale >= 1) return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))),
        'image/jpeg',
        quality,
      )
    })
  } finally {
    bitmap.close()
  }
}

// Draw a region (source-image pixels) of a loaded image element onto an
// outW×outH canvas and return it as a JPEG blob. Used by the shared cropper
// for both square avatars and free-aspect photo reframing.
export function cropImageRegion(image, { x, y, w, h }, outW, outH) {
  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  canvas.getContext('2d').drawImage(image, x, y, w, h, 0, 0, outW, outH)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))),
      'image/jpeg',
      0.85,
    )
  })
}
