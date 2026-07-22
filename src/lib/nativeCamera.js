// Native camera capture for the Android app: snap a photo (or photograph a
// document) straight into Nest, instead of only picking existing files. Returns
// a plain File so it flows through the same addPhotos / addDocument pipeline as
// the file picker. No-op in a browser (isNativeCamera() is false there), where
// the <input type="file"> already opens the gallery/camera.

import { Capacitor } from '@capacitor/core'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'

export const isNativeCamera = () => Capacitor.isNativePlatform()

// Open the camera and return the captured photo as a File, or null if the user
// backs out. Throws only on an unexpected error the caller should surface.
export async function capturePhoto() {
  if (!isNativeCamera()) return null
  let photo
  try {
    photo = await Camera.getPhoto({
      source: CameraSource.Camera,
      // DataUrl returns the image inline. Uri would hand back a file URL on
      // Capacitor's local origin, which the app (loaded from the remote site)
      // can't fetch cross-origin — so the shot never made it back into Nest.
      resultType: CameraResultType.DataUrl,
      quality: 90,
      correctOrientation: true,
      saveToGallery: false,
    })
  } catch (err) {
    // The plugin throws a "User cancelled photos app" error on back-out.
    if (/cancel/i.test(err?.message || '')) return null
    throw err
  }
  // A data: URL is always fetchable (no origin), so this can't be blocked.
  const blob = await fetch(photo.dataUrl).then((r) => r.blob())
  const ext = blob.type === 'image/png' ? 'png' : 'jpg'
  const name = `nest-${Date.now()}.${ext}`
  return new File([blob], name, { type: blob.type || 'image/jpeg' })
}
