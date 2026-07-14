// Downscale + centre-crop an image file to a small square JPEG, so member
// avatars stay a few KB instead of storing a full camera photo per person.
export async function squareThumbnail(file, size = 256) {
  const bitmap = await createImageBitmap(file)
  try {
    const side = Math.min(bitmap.width, bitmap.height)
    const sx = (bitmap.width - side) / 2
    const sy = (bitmap.height - side) / 2
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    canvas.getContext('2d').drawImage(bitmap, sx, sy, side, side, 0, 0, size, size)
    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))),
        'image/jpeg',
        0.85,
      )
    })
  } finally {
    bitmap.close()
  }
}
