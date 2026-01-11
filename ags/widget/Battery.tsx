import { Gtk } from "ags/gtk3"
import GLib from "gi://GLib?version=2.0"
import { createPoll } from "ags/time"
import {
  BAR_HEIGHT,
  BAR_PADDING_Y,
  BATTERY_LINE_OVERLAP_PX,
  BATTERY_LINE_SPACING_PX,
  WIDGET_COMPRESS_Y,
  WIDGET_SCALE,
} from "../barConfig"

const UPDATE_MS = 10000
const ICONS = ["󰁺", "󰁻", "󰁼", "󰁽", "󰁾", "󰁿", "󰂀", "󰂁", "󰂂", "󰁹"]

const CONTENT_HEIGHT = Math.max(10, BAR_HEIGHT - BAR_PADDING_Y * 2)
const LINE_SPACING = Math.max(0, BATTERY_LINE_SPACING_PX)
const LINE_OVERLAP = Math.max(0, BATTERY_LINE_OVERLAP_PX)
const FONT_SCALE = Math.max(1, WIDGET_SCALE)
const AVAILABLE_PX = Math.max(8, CONTENT_HEIGHT - LINE_SPACING)
const TOP_LINE_PX = Math.max(6, Math.round(AVAILABLE_PX * 0.58))
const BOTTOM_LINE_PX = Math.max(5, AVAILABLE_PX - TOP_LINE_PX)

const PERCENT_FONT = Math.max(6, Math.round(TOP_LINE_PX * 1.0 * FONT_SCALE))
const POWER_FONT = Math.max(5, Math.round(BOTTOM_LINE_PX * 0.98 * FONT_SCALE))
const ICON_FONT = Math.max(5, Math.round(BOTTOM_LINE_PX * 1.05 * FONT_SCALE))
const MARKER_FONT = Math.max(4, Math.round(ICON_FONT * 0.65))

const ICON_BOX_WIDTH = Math.max(10, Math.round(ICON_FONT * 1.0))
const LINE_GAP = Math.max(1, Math.round(BOTTOM_LINE_PX * 0.05 * FONT_SCALE))

type BatteryState = {
  visible: boolean
  percentText: string
  powerText: string
  icon: string
  marker: string
  markerVisible: boolean
  color: string
  tooltip: string
}

let batteryPath: string | null = null
let acPath: string | null = null
let lastEnergy: number | null = null
let lastTs: number | null = null

function readText(path: string): string | null {
  try {
    const [ok, contents] = GLib.file_get_contents(path)
    if (!ok) return null
    return new TextDecoder().decode(contents).trim()
  } catch (_) {
    return null
  }
}

function readNumber(path: string): number | null {
  const text = readText(path)
  if (!text) return null
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

function findBatteryPath(): string | null {
  try {
    const dir = GLib.Dir.open("/sys/class/power_supply", 0)
    let name: string | null
    while ((name = dir.read_name()) !== null) {
      if (name.startsWith("BAT")) {
        dir.close()
        return `/sys/class/power_supply/${name}`
      }
    }
    dir.close()
  } catch (_) {}
  return null
}

function findAcPath(): string | null {
  try {
    const dir = GLib.Dir.open("/sys/class/power_supply", 0)
    let name: string | null
    while ((name = dir.read_name()) !== null) {
      const path = `/sys/class/power_supply/${name}`
      const type = readText(`${path}/type`)
      if (type === "Mains" || name.startsWith("AC") || name.startsWith("ADP")) {
        dir.close()
        return path
      }
    }
    dir.close()
  } catch (_) {}
  return null
}

function toHex(value: number) {
  return value.toString(16).padStart(2, "0")
}

function parseHex(hex: string) {
  const clean = hex.replace("#", "")
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return { r, g, b }
}

function mix(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t)
}

function gradientColor(capacity: number) {
  const c = Math.max(0, Math.min(100, capacity))
  const stops = [
    { at: 0, color: "#e06666" }, // red
    { at: 33, color: "#f6b26b" }, // orange
    { at: 66, color: "#ffd966" }, // yellow
    { at: 100, color: "#93c47d" }, // green
  ]

  const idx = stops.findIndex((stop, i) => c <= stop.at && i > 0)
  if (idx <= 0) {
    const { r, g, b } = parseHex(stops[0].color)
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
  }

  const from = stops[idx - 1]
  const to = stops[idx]
  const t = (c - from.at) / (to.at - from.at)
  const a = parseHex(from.color)
  const b = parseHex(to.color)
  const r = mix(a.r, b.r, t)
  const g = mix(a.g, b.g, t)
  const bl = mix(a.b, b.b, t)
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`
}

function iconFor(capacity: number) {
  const idx = Math.min(9, Math.max(0, Math.floor(capacity / 10)))
  return ICONS[idx]
}

function computeBatteryState(): BatteryState {
  if (!batteryPath || !GLib.file_test(batteryPath, GLib.FileTest.IS_DIR)) {
    batteryPath = findBatteryPath()
  }
  if (!acPath || !GLib.file_test(acPath, GLib.FileTest.IS_DIR)) {
    acPath = findAcPath()
  }

  if (!batteryPath) {
    return {
      visible: false,
      percentText: "",
      powerText: "",
      icon: "",
      marker: "",
      markerVisible: false,
      color: "#ffffff",
      tooltip: "No battery found",
    }
  }

  const capacityRaw = readNumber(`${batteryPath}/capacity`)
  let capacityDisplay = capacityRaw !== null ? `${capacityRaw}` : "0"
  let capacityForColor = capacityRaw !== null ? capacityRaw : 0

  const energyNow = readNumber(`${batteryPath}/energy_now`)
  const energyFull = readNumber(`${batteryPath}/energy_full`)
  if (energyNow !== null && energyFull !== null && energyFull > 0) {
    const capacity = (energyNow * 100) / energyFull
    capacityDisplay = capacity.toFixed(1)
    if (capacityRaw === null) {
      capacityForColor = Math.round(capacity)
    }
  }

  const status = readText(`${batteryPath}/status`) || "Unknown"
  const onlineRaw = acPath ? readText(`${acPath}/online`) : null
  const acOnline = onlineRaw !== null ? onlineRaw.trim() === "1" : null

  let powerW: number | null = null
  const powerRaw = readNumber(`${batteryPath}/power_now`)
  if (powerRaw !== null) {
    powerW = powerRaw / 1000000
  } else {
    const currentRaw = readNumber(`${batteryPath}/current_now`)
    const voltageRaw = readNumber(`${batteryPath}/voltage_now`)
    if (currentRaw !== null && voltageRaw !== null) {
      powerW = (currentRaw * voltageRaw) / 1000000000000
    }
  }

  if (powerW === null && energyNow !== null) {
    const nowTs = Math.floor(Date.now() / 1000)
    if (lastEnergy !== null && lastTs !== null) {
      const dt = nowTs - lastTs
      if (dt > 1) {
        const delta = energyNow - lastEnergy
        powerW = Math.abs((delta / 1000000) * (3600 / dt))
      }
    }
    lastEnergy = energyNow
    lastTs = nowTs
  }

  if (powerW === null || !Number.isFinite(powerW)) {
    powerW = 0
  }

  let markerText = ""
  let markerVisible = false
  if (acOnline !== null) {
    markerText = acOnline ? "↑" : "↓"
    markerVisible = true
  } else if (status === "Charging") {
    markerText = "↑"
    markerVisible = true
  } else if (status === "Discharging") {
    markerText = "↓"
    markerVisible = true
  }

  const color = gradientColor(capacityForColor)

  return {
    visible: true,
    percentText: `${capacityDisplay}%`,
    powerText: `${powerW.toFixed(1)}W`,
    icon: iconFor(capacityForColor),
    marker: markerText,
    markerVisible,
    color,
    tooltip: `Battery: ${capacityDisplay}% (${status})`,
  }
}

export default function Battery() {
  const state = createPoll<BatteryState>(
    {
      visible: true,
      percentText: "",
      powerText: "",
      icon: "",
      marker: "",
      markerVisible: false,
      color: "#ffffff",
      tooltip: "",
    },
    UPDATE_MS,
    computeBatteryState,
  )

  return (
    <box
      class="battery"
      orientation={Gtk.Orientation.VERTICAL}
      spacing={LINE_SPACING}
      height_request={CONTENT_HEIGHT}
      valign={Gtk.Align.START}
      tooltip_text={state.as((s) => s.tooltip)}
      visible={state.as((s) => s.visible)}
    >
      <label
        class="battery-percent"
        label={state.as((s) => s.percentText)}
        css={state.as(
          (s) =>
            `color: ${s.color}; font-size: ${PERCENT_FONT}px; margin: -${WIDGET_COMPRESS_Y}px 0; padding: 0;`,
        )}
        yalign={0}
        xalign={0}
      />
      <box
        class="battery-line"
        spacing={LINE_GAP}
        valign={Gtk.Align.START}
        css={LINE_OVERLAP > 0 ? `margin-top: -${LINE_OVERLAP}px;` : undefined}
      >
        <overlay
          class="battery-icon-overlay"
          width_request={ICON_BOX_WIDTH}
          valign={Gtk.Align.START}
        >
          <label
            class="battery-icon"
            label={state.as((s) => s.icon)}
            css={state.as(
              (s) =>
                `color: ${s.color}; font-size: ${ICON_FONT}px; margin: -${WIDGET_COMPRESS_Y}px 0; padding: 0;`,
            )}
            halign={Gtk.Align.CENTER}
            valign={Gtk.Align.CENTER}
          />
          <label
            class="battery-marker"
            label={state.as((s) => s.marker)}
            visible={state.as((s) => s.markerVisible)}
            css={`font-size: ${MARKER_FONT}px; margin: -${WIDGET_COMPRESS_Y}px 0; padding: 0; color: #ffffff;`}
            halign={Gtk.Align.CENTER}
            valign={Gtk.Align.CENTER}
            $type="overlay"
          />
        </overlay>
        <label
          class="battery-power"
          label={state.as((s) => s.powerText)}
          css={state.as(
            (s) =>
              `color: ${s.color}; font-size: ${POWER_FONT}px; margin: -${WIDGET_COMPRESS_Y}px 0; padding: 0;`,
          )}
          yalign={0}
          xalign={0}
        />
      </box>
    </box>
  )
}
