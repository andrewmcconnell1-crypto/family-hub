import { useEffect, useMemo, useRef, useState } from 'react'
import { cropImageRegion } from '../utils/imageUtils.js'

const MAX_ZOOM = 4

function fitViewport(round, natural) {
  if (round || !natural) return { w: 280, h: 280 }
  const maxW = 300
  const maxH = 330
  const ratio = natural.w / natural.h
  let w = maxW
  let h = w / ratio
  if (h > maxH) {
    h = maxH
    w = h * ratio
  }
  return { w: Math.round(w), h: Math.round(h) }
}

// Position-and-zoom cropper: drag to move, slider to zoom. `round` gives the
// circle-masked square flavour used for member avatars (`output` = the exact
// square size); otherwise the viewport keeps the image's own aspect ratio and
// `output` caps the long side of the result (photo reframing).
export default function ImageCropper({ file, round = false, output = 2000, onUse, onCancel }) {
  const url = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => () => URL.revokeObjectURL(url), [url])

  const imgRef = useRef(null)
  const dragRef = useRef(null) // { pointerId, lastX, lastY }
  const pointersRef = useRef(new Map()) // pointerId -> { x, y }
  const pinchRef = useRef(null) // { startDist, startZoom }
  const [natural, setNatural] = useState(null) // { w, h }
  const [zoom, setZoom] = useState(1)
  // Image top-left relative to the viewport, in css px.
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)

  const vp = useMemo(() => fitViewport(round, natural), [round, natural])
  // Base scale makes the image exactly cover the viewport at zoom 1.
  const baseScale = natural ? Math.max(vp.w / natural.w, vp.h / natural.h) : 1
  const scale = baseScale * zoom

  // Keep the viewport fully covered — no gaps at any edge.
  const clampOffset = (off, sc, nat, v) => ({
    x: Math.min(0, Math.max(v.w - nat.w * sc, off.x)),
    y: Math.min(0, Math.max(v.h - nat.h * sc, off.y)),
  })

  const onLoad = (e) => {
    const nat = { w: e.target.naturalWidth, h: e.target.naturalHeight }
    const v = fitViewport(round, nat)
    const sc = Math.max(v.w / nat.w, v.h / nat.h)
    setNatural(nat)
    setZoom(1)
    setOffset({ x: (v.w - nat.w * sc) / 2, y: (v.h - nat.h * sc) / 2 })
  }

  // Zoom about the viewport centre so the framed subject stays put.
  const applyZoom = (nextZoom) => {
    if (!natural) return
    const z = Math.min(MAX_ZOOM, Math.max(1, nextZoom))
    const sOld = baseScale * zoom
    const sNew = baseScale * z
    setOffset((off) =>
      clampOffset(
        {
          x: vp.w / 2 - ((vp.w / 2 - off.x) / sOld) * sNew,
          y: vp.h / 2 - ((vp.h / 2 - off.y) / sOld) * sNew,
        },
        sNew,
        natural,
        vp,
      ),
    )
    setZoom(z)
  }

  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

  const onPointerDown = (e) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Synthetic pointers (tests) can't be captured — events still arrive.
    }
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const points = [...pointersRef.current.values()]
    if (points.length === 2) {
      // Second finger down: switch from drag to pinch.
      pinchRef.current = { startDist: distance(points[0], points[1]), startZoom: zoom }
      dragRef.current = null
    } else if (points.length === 1) {
      dragRef.current = { pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY }
    }
  }

  const onPointerMove = (e) => {
    if (!pointersRef.current.has(e.pointerId) || !natural) return
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    const pinch = pinchRef.current
    if (pinch && pointersRef.current.size >= 2) {
      const points = [...pointersRef.current.values()]
      const dist = distance(points[0], points[1])
      if (pinch.startDist > 0) applyZoom(pinch.startZoom * (dist / pinch.startDist))
      return
    }

    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const dx = e.clientX - drag.lastX
    const dy = e.clientY - drag.lastY
    drag.lastX = e.clientX
    drag.lastY = e.clientY
    setOffset((off) => clampOffset({ x: off.x + dx, y: off.y + dy }, scale, natural, vp))
  }

  const onPointerEnd = (e) => {
    pointersRef.current.delete(e.pointerId)
    if (pointersRef.current.size < 2) pinchRef.current = null
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null
    // If one finger remains after a pinch, continue as a drag from where it is.
    if (pointersRef.current.size === 1 && !dragRef.current) {
      const [pointerId, point] = [...pointersRef.current.entries()][0]
      dragRef.current = { pointerId, lastX: point.x, lastY: point.y }
    }
  }

  const apply = async () => {
    if (!natural || busy) return
    setBusy(true)
    try {
      const region = {
        x: -offset.x / scale,
        y: -offset.y / scale,
        w: vp.w / scale,
        h: vp.h / scale,
      }
      let outW
      let outH
      if (round) {
        outW = output
        outH = output
      } else {
        const k = Math.min(1, output / Math.max(region.w, region.h))
        outW = Math.max(1, Math.round(region.w * k))
        outH = Math.max(1, Math.round(region.h * k))
      }
      const blob = await cropImageRegion(imgRef.current, region, outW, outH)
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
          style={{ width: vp.w, height: vp.h }}
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
          {round && <div className="cropper-mask" aria-hidden="true" />}
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
          <button type="button" className="secondary-button" onClick={onCancel}>
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
