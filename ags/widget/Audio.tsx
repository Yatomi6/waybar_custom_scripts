import { Gtk, Gdk } from "ags/gtk3"
import { createPoll } from "ags/time"
import { execAsync } from "ags/process"
import GLib from "gi://GLib?version=2.0"
import { createComputed, createState } from "gnim"
import {
  BAR_TEXT_COLOR,
  METER_COLORS,
  METER_SIZES,
  WIDGET_COMPRESS_Y,
} from "../barConfig"

const UPDATE_MS = 250
const LAUNCH_AUDIO = "omarchy-launch-audio"
const TOGGLE_MUTE = "wpctl set-mute @DEFAULT_SINK@ toggle"

type AudioState = {
  visible: boolean
  percent: number
  percentText: string
  muted: boolean
  icon: string
  tooltip: string
}

const TEXT_GAP = Math.max(1, Math.round(METER_SIZES.gap / 2))
const ICON_MUTED = ""
const ICON_UNMUTED = ""

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function toHex(value: number) {
  return value.toString(16).padStart(2, "0")
}

function parseHex(hex: string) {
  const clean = hex.replace("#", "")
  if (clean.length !== 6) return null
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  if ([r, g, b].some((v) => Number.isNaN(v))) return null
  return { r, g, b }
}

function darken(hex: string, factor = 0.5) {
  const parsed = parseHex(hex)
  if (!parsed) return hex
  const r = Math.max(0, Math.min(255, Math.round(parsed.r * factor)))
  const g = Math.max(0, Math.min(255, Math.round(parsed.g * factor)))
  const b = Math.max(0, Math.min(255, Math.round(parsed.b * factor)))
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function extractX(coords: unknown): number | null {
  if (!Array.isArray(coords) || coords.length === 0) return null
  if (typeof coords[0] === "boolean") {
    return typeof coords[1] === "number" ? coords[1] : null
  }
  return typeof coords[0] === "number" ? coords[0] : null
}

function getEventX(widget: Gtk.Widget, event: unknown) {
  const evt = event as {
    x?: number
    get_position?: () => number[]
    get_coords?: () => number[]
    get_root_coords?: () => number[]
  }

  const localX =
    extractX(evt?.get_coords?.()) ??
    extractX(evt?.get_position?.()) ??
    (typeof evt?.x === "number" ? evt.x : null)

  if (localX !== null) return localX

  const rootX = extractX(evt?.get_root_coords?.())
  if (rootX === null) return 0

  const origin =
    widget.get_window?.()?.get_origin?.() ??
    widget.get_toplevel?.()?.get_window?.()?.get_origin?.()
  const originX = extractX(origin)
  if (originX === null) return rootX

  return rootX - originX
}

function getClickPercent(widget: Gtk.Widget, event: unknown) {
  const width = Math.max(1, widget.get_allocation().width)
  const x = getEventX(widget, event)
  if (x <= 0) return 0
  if (x >= width) return 100
  const clamped = clamp(x, 0, width)
  return clamp(Math.round((clamped / width) * 100), 0, 100)
}

function getButton(event: unknown) {
  const evt = event as {
    button?: number
    get_button?: () => [boolean, number]
  }
  if (typeof evt?.button === "number") return evt.button
  if (evt?.get_button) {
    const result = evt.get_button()
    if (Array.isArray(result) && result.length >= 2) return result[1] ?? 0
  }
  return 0
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

function parseWpctl(output: string): { percent: number; muted: boolean } | null {
  const match = output.match(/Volume:\s*([0-9.]+)/)
  if (!match) return null
  const value = Number(match[1])
  if (!Number.isFinite(value)) return null
  const percent = clamp(Math.round(value * 100), 0, 150)
  const muted = /\bMUTED\b/i.test(output)
  return { percent, muted }
}

function parsePamixer(output: string): { percent: number; muted: boolean } | null {
  const lines = output.split("\n").map((line) => line.trim()).filter(Boolean)
  if (lines.length < 2) return null
  const percent = clamp(Number(lines[0]), 0, 150)
  if (!Number.isFinite(percent)) return null
  const muted = lines[1].toLowerCase() === "true"
  return { percent, muted }
}

function computeAudioState(): AudioState {
  const wpctl = runCommand("wpctl get-volume @DEFAULT_SINK@")
  const parsedWpctl = wpctl ? parseWpctl(wpctl) : null
  const pamixer = parsedWpctl ? null : runCommand("pamixer --get-volume --get-mute")
  const parsedPamixer = pamixer ? parsePamixer(pamixer) : null
  const parsed = parsedWpctl ?? parsedPamixer

  if (!parsed) {
    return {
      visible: false,
      percent: 0,
      percentText: "",
      muted: false,
      icon: ICON_UNMUTED,
      tooltip: "Audio unavailable",
    }
  }

  const muted = parsed.muted
  const percent = clamp(parsed.percent, 0, 100)
  const icon = muted ? ICON_MUTED : ICON_UNMUTED
  const tooltip = muted ? "Muted" : `Volume: ${percent}%`

  return {
    visible: true,
    percent,
    percentText: `${percent}%`,
    muted,
    icon,
    tooltip,
  }
}

export default function Audio() {
  let dragging = false
  let lastSet = -1
  let clearTimer: ReturnType<typeof setTimeout> | null = null
  const [dragPercent, setDragPercent] = createState<number | null>(null)
  const applyVolume = (widget: Gtk.Widget, event: unknown) => {
    if (clearTimer) {
      clearTimeout(clearTimer)
      clearTimer = null
    }
    const percent = getClickPercent(widget, event)
    setDragPercent(percent)
    if (percent === lastSet) return
    lastSet = percent
    execAsync(`wpctl set-volume @DEFAULT_SINK@ ${percent}%`).catch(() => null)
  }
  const state = createPoll<AudioState>(
    {
      visible: false,
      percent: 0,
      percentText: "",
      muted: false,
      icon: ICON_UNMUTED,
      tooltip: "",
    },
    UPDATE_MS,
    computeAudioState,
  )

  const percentValue = createComputed(() => {
    const override = dragPercent()
    return override === null ? state().percent : override
  })
  const percentText = createComputed(() => {
    const override = dragPercent()
    return override === null ? state().percentText : `${override}%`
  })

  return (
    <box
      class="audio"
      visible={state.as((s) => s.visible)}
      tooltip_text={state.as((s) => s.tooltip)}
    >
      <box class="audio-box" spacing={METER_SIZES.gap} valign={Gtk.Align.CENTER}>
        <eventbox
          class="audio-percent-wrap"
          visible_window={false}
          onButtonPressEvent={() => {
            execAsync(TOGGLE_MUTE).catch(() => null)
            return true
          }}
        >
          <label
            class="audio-percent"
            label={percentText}
            width_chars={4}
            xalign={1}
            css={`font-size: ${METER_SIZES.text}px; margin: -${WIDGET_COMPRESS_Y}px 0; padding: 0 ${TEXT_GAP}px 0 0; color: ${BAR_TEXT_COLOR};`}
          />
        </eventbox>
        <eventbox
          class="audio-meter-wrap"
          visible_window={false}
          width_request={METER_SIZES.width}
          height_request={METER_SIZES.height}
          events={
            Gdk.EventMask.POINTER_MOTION_MASK |
            Gdk.EventMask.BUTTON1_MOTION_MASK |
            Gdk.EventMask.BUTTON_PRESS_MASK |
            Gdk.EventMask.BUTTON_RELEASE_MASK
          }
          onButtonPressEvent={(widget, event) => {
            dragging = getButton(event) === 1
            if (dragging) {
              applyVolume(widget, event)
            }
            return true
          }}
          onButtonReleaseEvent={() => {
            dragging = false
            if (clearTimer) {
              clearTimeout(clearTimer)
            }
            clearTimer = setTimeout(() => {
              setDragPercent(null)
              clearTimer = null
            }, 150)
            return true
          }}
          onMotionNotifyEvent={(widget, event) => {
            if (!dragging) return false
            applyVolume(widget, event)
            return true
          }}
        >
          <box
            class="audio-meter"
            valign={Gtk.Align.CENTER}
            css={createComputed(() => {
              const base = state().muted ? METER_COLORS.muted : METER_COLORS.audio
              const track = darken(base)
              return `min-width: ${METER_SIZES.width}px; min-height: ${METER_SIZES.height}px; background-color: ${track}; border-radius: ${METER_SIZES.radius}px; margin: 0; padding: 0;`
            })}
          >
            <box
              class="audio-meter-fill"
              css={createComputed(() => {
                const percent = percentValue()
                const width = Math.round((METER_SIZES.width * percent) / 100)
                const color = state().muted ? METER_COLORS.muted : METER_COLORS.audio
                return `min-width: ${width}px; min-height: ${METER_SIZES.height}px; background-color: ${color}; border-radius: ${METER_SIZES.radius}px; margin: 0; padding: 0;`
              })}
            />
          </box>
        </eventbox>
        <eventbox
          class="audio-icon-wrap"
          visible_window={false}
          onButtonPressEvent={() => {
            execAsync(LAUNCH_AUDIO).catch(() => null)
            return true
          }}
        >
          <label
            class="audio-icon"
            label={state.as((s) => s.icon)}
            css={`font-size: ${METER_SIZES.icon}px; margin: -${WIDGET_COMPRESS_Y}px 0; padding: 0 0 0 ${TEXT_GAP}px; color: ${BAR_TEXT_COLOR};`}
          />
        </eventbox>
      </box>
    </box>
  )
}
