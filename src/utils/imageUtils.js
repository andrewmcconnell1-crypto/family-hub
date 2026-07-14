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
