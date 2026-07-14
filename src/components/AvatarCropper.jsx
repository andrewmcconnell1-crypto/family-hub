import { useEffect, useMemo, useRef, useState } from 'react'
import { cropImageToSquare } from '../utils/imageUtils.js'

const VIEWPORT = 280 // css px of the square crop window
const MAX_ZOOM = 4

// Position-and-zoom cropper for member photos: drag to move, slider to zoom,
// circular mask previews the final avatar. Returns a 256px JPEG blob of the
// framed square via onUse.
export default function AvatarCropper({ file, onUse, onCancel }) {
  const url = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => () => URL.revokeObjectURL(url), [url])

  const imgRef = useRef(null)
  const dragRef = useRef(null) // { pointerId, lastX, lastY }
  const [natural, setNatural] = useState(null) // { w, h }
  const [zoom, setZoom] = useState(1)
  // Image top-left relative to the viewport, in css px.
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)

  // Base scale makes the image exactly cover the viewport at zoom 1.
  const baseScale = natural ? VIEWPORT / Math.min(natural.w, natural.h) : 1
  const scale = baseScale * zoom

  // Keep the viewport fully covered — no gaps at any edge.
  const clampOffset = (off, sc, nat) => ({
    x: Math.min(0, Math.max(VIEWPORT - nat.w * sc, off.x)),
    y: Math.min(0, Math.max(VIEWPORT - nat.h * sc, off.y)),
  })

  const onLoad = (e) => {
    const nat = { w: e.target.naturalWidth, h: e.target.naturalHeight }
    const sc = VIEWPORT / Math.min(nat.w, nat.h)
    setNatural(nat)
    setOffset({ x: (VIEWPORT - nat.w * sc) / 2, y: (VIEWPORT - nat.h * sc) / 2 })
  }

  // Zoom about the viewport centre so the framed subject stays put.
  const applyZoom = (nextZoom) => {
    if (!natural) return
    const z = Math.min(MAX_ZOOM, Math.max(1, nextZoom))
    const sOld = baseScale * zoom
    const sNew = baseScale * z
    const c = VIEWPORT / 2
    setOffset((off) =>
      clampOffset(
        { x: c - ((c - off.x) / sOld) * sNew, y: c - ((c - off.y) / sOld) * sNew },
        sNew,
        natural,
      ),
    )
    setZoom(z)
  }

  const onPointerDown = (e) => {
    if (dragRef.current) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY }
  }

  const onPointerMove = (e) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId || !natural) return
    const dx = e.clientX - drag.lastX
    const dy = e.clientY - drag.lastY
    drag.lastX = e.clientX
    drag.lastY = e.clientY
    setOffset((off) => clampOffset({ x: off.x + dx, y: off.y + dy }, scale, natural))
  }

  const onPointerEnd = (e) => {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null
  }

  const apply = async () => {
    if (!natural || busy) return
    setBusy(true)
    try {
      const blob = await cropImageToSquare(imgRef.current, {
        x: -offset.x / scale,
        y: -offset.y / scale,
        side: VIEWPORT / scale,
      })
      onUse(blob)
    } catch (error) {
      console.error('Cropping photo failed', error)
      window.alert("Couldn't process that photo — try a different one.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="cropper-backdrop" role="dialog" aria-modal="true" aria-label="Adjust photo">
      <div className="cropper">
        <div
          className="cropper-viewport"
          style={{ width: VIEWPORT, height: VIEWPORT }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        >
          <img
            ref={imgRef}
            src={url}
            alt=""
            draggable={false}
            onLoad={onLoad}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transformOrigin: '0 0',
            }}
          />
          <div className="cropper-mask" aria-hidden="true" />
        </div>
        <input
          className="cropper-zoom"
          type="range"
          min="1"
          max={MAX_ZOOM}
          step="0.01"
          value={zoom}
          onChange={(e) => applyZoom(Number(e.target.value))}
          aria-label="Zoom"
        />
        <div className="form-actions">
          <button type="button" className="link-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="primary-button" disabled={!natural || busy} onClick={apply}>
            {busy ? 'Saving…' : 'Use photo'}
          </button>
        </div>
      </div>
    </div>
  )
}
