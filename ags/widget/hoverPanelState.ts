import GLib from "gi://GLib?version=2.0"
import { createState } from "gnim"

export type HoverAnchor = {
  x: number
  width: number
}

const [anchor, setAnchor] = createState<HoverAnchor | null>(null)
const [open, setOpen] = createState(false)
const [recording, setRecording] = createState(false)
const [stopwatch, setStopwatch] = createState(false)
let hideSource: number | null = null
let overHandle = false
let overMenu = false

const clearHide = () => {
  if (hideSource !== null) {
    GLib.source_remove(hideSource)
    hideSource = null
  }
}

const scheduleHide = (delayMs: number) => {
  if (hideSource !== null) return
  hideSource = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delayMs, () => {
    hideSource = null
    if (!overHandle && !overMenu) {
      setOpen(false)
    }
    return GLib.SOURCE_REMOVE
  })
}

export const hoverPanelAnchor = anchor
export const hoverPanelOpen = open
export const hoverPanelRecording = recording
export const hoverPanelStopwatch = stopwatch

export const setHandleHover = (active: boolean, delayMs: number) => {
  overHandle = active
  if (active) {
    clearHide()
    setOpen(true)
  } else {
    scheduleHide(delayMs)
  }
}

export const setMenuHover = (active: boolean, delayMs: number) => {
  overMenu = active
  if (active) {
    clearHide()
    return
  }
  if (delayMs <= 0 && !overHandle) {
    clearHide()
    setOpen(false)
    return
  }
  scheduleHide(delayMs)
}

export const updateAnchor = (value: HoverAnchor) => {
  setAnchor(value)
}

export const closeHoverPanel = () => {
  overHandle = false
  overMenu = false
  clearHide()
  setOpen(false)
}

export const setHoverPanelRecording = (active: boolean) => {
  setRecording(active)
}

export const setHoverPanelStopwatch = (active: boolean) => {
  setStopwatch(active)
}
