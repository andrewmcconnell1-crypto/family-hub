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

// Draw a square region (source-image pixels) of a loaded image element onto a
// size×size canvas and return it as a small JPEG blob. Used by the avatar
// cropper so member photos stay a few KB instead of a full camera photo.
export function cropImageToSquare(image, { x, y, side }, size = 256) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  canvas.getContext('2d').drawImage(image, x, y, side, side, 0, 0, size, size)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))),
      'image/jpeg',
      0.85,
    )
  })
}
