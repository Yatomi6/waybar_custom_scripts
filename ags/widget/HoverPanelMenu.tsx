import app from "ags/gtk3/app"
import { Astal, Gtk, Gdk } from "ags/gtk3"
import GLib from "gi://GLib?version=2.0"
import { execAsync } from "ags/process"
import { createComputed, createState } from "gnim"
import { createPoll } from "ags/time"
import {
  BAR_COLOR,
  BAR_HEIGHT,
  BAR_TEXT_COLOR,
  HOVER_PANEL_SIZES,
  WIDGET_COMPRESS_Y,
} from "../barConfig"
import {
  hoverPanelAnchor,
  hoverPanelOpen,
  closeHoverPanel,
  setMenuHover,
  setHoverPanelRecording,
  setHoverPanelStopwatch,
} from "./hoverPanelState"

const TICK_MS = 10
const RECORD_POLL_MS = 500

const pad2 = (value: number) => value.toString().padStart(2, "0")
const pad3 = (value: number) => value.toString().padStart(3, "0")
const menuHoverEnter = () => {
  setMenuHover(true, HOVER_PANEL_SIZES.hideDelayMs)
  return true
}
const menuHoverLeave = () => {
  setMenuHover(false, 0)
  return true
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const milli = Math.max(0, Math.floor(ms % 1000))
  const seconds = totalSeconds % 60
  const minutes = Math.floor(totalSeconds / 60) % 60
  const hours = Math.floor(totalSeconds / 3600)
  if (hours > 0) {
    return `${hours}:${pad2(minutes)}:${pad2(seconds)}.${pad3(milli)}`
  }
  return `${pad2(minutes)}:${pad2(seconds)}.${pad3(milli)}`
}

function formatRecordDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(seconds / 60) % 60
  const hours = Math.floor(seconds / 3600)
  const remainder = seconds % 60
  if (hours > 0) {
    return `${hours}:${pad2(minutes)}:${pad2(remainder)}`
  }
  return `${pad2(minutes)}:${pad2(remainder)}`
}

function runCommand(command: string): string | null {
  try {
    const [ok, stdout] = GLib.spawn_command_line_sync(command)
    if (!ok || !stdout) return null
    return new TextDecoder().decode(stdout).trim()
  } catch (_) {
    return null
  }
}

type RecordState = {
  active: boolean
  elapsedSeconds: number
}

const RECORD_IDLE_ICON = "⏺"
const RECORD_ACTIVE_ICON = "⏹"
const RECORD_COMMAND = "omarchy-cmd-screenrecord --with-desktop-audio"
const SCREENSHOT_COMMAND = "omarchy-cmd-screenshot fullscreen"
let recordStartMs = 0
let recordActive = false

function findRecordingFile(pid: string) {
  const output = runCommand(`lsof -p ${pid} -Fn`)
  if (!output) return null
  const lines = output.split("\n")
  for (const line of lines) {
    if (!line.startsWith("n")) continue
    const path = line.slice(1).trim()
    if (!path) continue
    if (!path.endsWith(".mp4")) continue
    if (!path.includes("screenrecording-")) continue
    return path
  }
  return null
}

function fileSize(path: string) {
  const output = runCommand(`stat -c %s "${path}"`)
  if (!output) return null
  const value = Number(output.trim())
  return Number.isFinite(value) ? value : null
}

function computeRecordState(): RecordState {
  const pidText = runCommand("pgrep -n -f '^gpu-screen-recorder'")
  if (!pidText) {
    recordStartMs = 0
    recordActive = false
    setHoverPanelRecording(false)
    return { active: false, elapsedSeconds: 0 }
  }
  const pid = pidText.split("\n")[0]?.trim()
  if (!pid) {
    recordStartMs = 0
    recordActive = false
    setHoverPanelRecording(false)
    return { active: false, elapsedSeconds: 0 }
  }
  if (!recordActive) {
    const file = findRecordingFile(pid)
    const size = file ? fileSize(file) : null
    if (size !== null && size > 0) {
      recordStartMs = Date.now()
      recordActive = true
    }
  }
  if (!recordActive) {
    setHoverPanelRecording(false)
    return { active: false, elapsedSeconds: 0 }
  }
  setHoverPanelRecording(true)
  const elapsedSeconds = Math.floor((Date.now() - recordStartMs) / 1000)
  return {
    active: true,
    elapsedSeconds: Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0,
  }
}

function ActionButton({
  label,
  onClicked,
}: {
  label: string | (() => string)
  onClicked: () => void
}) {
  return (
    <button
      class="hover-panel-button"
      onClicked={onClicked}
      css={`padding: 0 ${HOVER_PANEL_SIZES.buttonPadX}px;`}
    >
      <label
        label={label}
        css={`font-size: ${HOVER_PANEL_SIZES.text}px; margin: -${WIDGET_COMPRESS_Y}px 0; color: ${BAR_TEXT_COLOR};`}
      />
    </button>
  )
}

function ScreenshotRow() {
  const onTrigger = () => {
    closeHoverPanel()
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 80, () => {
      execAsync(SCREENSHOT_COMMAND).catch(() => null)
      return GLib.SOURCE_REMOVE
    })
  }

  return (
    <eventbox
      class="hover-panel-row"
      visible_window={false}
      onButtonPressEvent={() => {
        onTrigger()
        return true
      }}
    >
      <box spacing={HOVER_PANEL_SIZES.gap} valign={Gtk.Align.CENTER}>
        <label
          label=""
          width_chars={2}
          xalign={0.5}
          css={`font-size: ${HOVER_PANEL_SIZES.text}px; margin: -${WIDGET_COMPRESS_Y}px 0; min-width: ${HOVER_PANEL_SIZES.text}px; color: ${BAR_TEXT_COLOR};`}
        />
        <label
          label="Screenshot"
          xalign={0}
          css={`font-size: ${HOVER_PANEL_SIZES.text}px; margin: -${WIDGET_COMPRESS_Y}px 0; color: ${BAR_TEXT_COLOR};`}
        />
      </box>
    </eventbox>
  )
}

function ScreenRecordRow() {
  const state = createPoll<RecordState>(
    { active: false, elapsedSeconds: 0 },
    RECORD_POLL_MS,
    computeRecordState,
  )
  const icon = state.as((current) =>
    current.active ? RECORD_ACTIVE_ICON : RECORD_IDLE_ICON,
  )
  const duration = state.as((current) =>
    formatRecordDuration(current.elapsedSeconds),
  )
  const iconCss = state.as((current) => {
    const color = current.active ? "#bf616a" : BAR_TEXT_COLOR
    return `font-size: ${HOVER_PANEL_SIZES.text}px; margin: -${WIDGET_COMPRESS_Y}px 0; color: ${color};`
  })
  const toggleRecord = () => {
    execAsync(RECORD_COMMAND).catch(() => null)
  }

  return (
    <eventbox
      class="hover-panel-row"
      visible_window={false}
      onButtonPressEvent={() => {
        toggleRecord()
        return true
      }}
    >
      <box spacing={HOVER_PANEL_SIZES.innerGap} valign={Gtk.Align.CENTER}>
        <label label={icon} css={iconCss} />
        <label
          class="hover-panel-time"
          label={duration}
          width_chars={HOVER_PANEL_SIZES.widthChars}
          xalign={0}
          css={`font-size: ${HOVER_PANEL_SIZES.text}px; margin: -${WIDGET_COMPRESS_Y}px 0; color: ${BAR_TEXT_COLOR};`}
        />
      </box>
    </eventbox>
  )
}

function StopwatchRow() {
  const [running, setRunning] = createState(false)
  const [elapsed, setElapsed] = createState(0)
  const [startTs, setStartTs] = createState<number | null>(null)
  const now = createPoll(Date.now(), TICK_MS, () => Date.now())

  const display = createComputed(() => {
    const base = elapsed()
    const start = startTs()
    const total = running() && start !== null ? base + (now() - start) : base
    return formatDuration(total)
  })
  const toggleLabel = createComputed(() => (running() ? "Pause" : "Start"))

  const start = () => {
    if (running()) return
    setStartTs(Date.now())
    setRunning(true)
    setHoverPanelStopwatch(true)
  }

  const pause = () => {
    if (!running()) return
    const start = startTs()
    if (start !== null) {
      const delta = Date.now() - start
      setElapsed((prev) => prev + delta)
    }
    setStartTs(null)
    setRunning(false)
    setHoverPanelStopwatch(false)
  }

  const toggle = () => {
    if (running()) {
      pause()
    } else {
      start()
    }
  }

  const reset = () => {
    setStartTs(null)
    setElapsed(0)
    setRunning(false)
    setHoverPanelStopwatch(false)
  }

  return (
    <box
      class="hover-panel-row"
      spacing={HOVER_PANEL_SIZES.innerGap}
      valign={Gtk.Align.CENTER}
    >
      <box
        class="hover-panel-controls"
        spacing={HOVER_PANEL_SIZES.gap}
        valign={Gtk.Align.CENTER}
      >
        <ActionButton label={toggleLabel} onClicked={toggle} />
        <ActionButton label="Reset" onClicked={reset} />
      </box>
      <label
        class="hover-panel-time"
        label={display}
        width_chars={HOVER_PANEL_SIZES.widthChars}
        xalign={0}
        css={`font-size: ${HOVER_PANEL_SIZES.text}px; margin: -${WIDGET_COMPRESS_Y}px 0; color: ${BAR_TEXT_COLOR};`}
      />
    </box>
  )
}

export default function HoverPanelMenu(gdkmonitor: Gdk.Monitor) {
  const { TOP, LEFT } = Astal.WindowAnchor
  const visible = createComputed(
    () => hoverPanelOpen() && hoverPanelAnchor() !== null,
  )
  const anchorX = hoverPanelAnchor.as((anchor) =>
    anchor ? Math.max(0, anchor.x) : 0,
  )
  const anchorY = BAR_HEIGHT + HOVER_PANEL_SIZES.popupOffsetY
  const panelCss = `background: ${BAR_COLOR}; border: 1px solid #3b4252; border-radius: 8px; padding: ${HOVER_PANEL_SIZES.panelPaddingY}px ${HOVER_PANEL_SIZES.panelPaddingX}px;`

  return (
    <window
      name="hover-panel-menu"
      class="hover-panel-window"
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.IGNORE}
      anchor={TOP | LEFT}
      layer={Astal.Layer.OVERLAY}
      visible={visible.as((isVisible) => isVisible)}
      events={Gdk.EventMask.ENTER_NOTIFY_MASK | Gdk.EventMask.LEAVE_NOTIFY_MASK}
      onEnterNotifyEvent={menuHoverEnter}
      onLeaveNotifyEvent={menuHoverLeave}
      application={app}
    >
      <box
        class="hover-panel-row"
        margin_start={anchorX}
        margin_top={anchorY}
      >
        <eventbox class="hover-panel-popup" visible_window={true}>
          <box
            class="hover-panel-popup-content"
            orientation={Gtk.Orientation.VERTICAL}
            spacing={HOVER_PANEL_SIZES.rowGap}
            css={panelCss}
          >
            <ScreenshotRow />
            <ScreenRecordRow />
            <StopwatchRow />
          </box>
        </eventbox>
      </box>
    </window>
  )
}
