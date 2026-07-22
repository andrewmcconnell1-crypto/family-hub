// Native camera capture for the Android app: snap a photo (or photograph a
// document) straight into Nest, instead of only picking existing files. Returns
// a plain File so it flows through the same addPhotos / addDocument pipeline as
// the file picker. No-op in a browser (isNativeCamera() is false there), where
// the <input type="file"> already opens the gallery/camera.

import { Capacitor } from '@capacitor/core'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Filesystem } from '@capacitor/filesystem'

export const isNativeCamera = () => Capacitor.isNativePlatform()

function base64ToBlob(base64, type) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type })
}

// Open the camera and return the captured photo as a File, or null if the user
// backs out. Throws only on an unexpected error the caller should surface.
export async function capturePhoto() {
  if (!isNativeCamera()) return null
  let photo
  try {
    photo = await Camera.getPhoto({
      source: CameraSource.Camera,
      // Uri gives us the saved file's path; we read its bytes natively below.
      // (DataUrl asks the WebView to encode the whole image inline, which runs
      // out of memory on big photos and comes back black.)
      resultType: CameraResultType.Uri,
      quality: 88,
      width: 1600, // cap the longest side natively — plenty for a phone, far lighter
      correctOrientation: true,
      saveToGallery: false,
    })
  } catch (err) {
    // The plugin throws a "User cancelled photos app" error on back-out.
    if (/cancel/i.test(err?.message || '')) return null
    throw err
  }
  // Read the file's bytes through the filesystem plugin (native, no
  // cross-origin fetch and no in-WebView re-encoding).
  const type = photo.format === 'png' ? 'image/png' : 'image/jpeg'
  const { data } = await Filesystem.readFile({ path: photo.path || photo.webPath })
  const blob = base64ToBlob(data, type)
  const ext = type === 'image/png' ? 'png' : 'jpg'
  return new File([blob], `nest-${Date.now()}.${ext}`, { type })
}
