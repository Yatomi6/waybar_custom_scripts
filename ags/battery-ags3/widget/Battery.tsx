import app from "ags/gtk3/app"
import { Astal, Gtk, Gdk } from "ags/gtk3"
import GLib from "gi://GLib?version=2.0"
import { createPoll } from "ags/time"

const UPDATE_MS = 10000
const ICONS = ["󰁺", "󰁻", "󰁼", "󰁽", "󰁾", "󰁿", "󰂀", "󰂁", "󰂂", "󰁹"]

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

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function hue2rgb(p: number, q: number, t: number) {
  let tt = t
  if (tt < 0) tt += 1
  if (tt > 1) tt -= 1
  if (tt < 1 / 6) return p + (q - p) * 6 * tt
  if (tt < 1 / 2) return q
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
  return p
}

function hslToRgb(h: number, s: number, l: number) {
  const hh = h / 360
  const ss = s / 100
  const ll = l / 100
  if (ss === 0) {
    const v = Math.round(ll * 255)
    return [v, v, v]
  }
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss
  const p = 2 * ll - q
  const r = hue2rgb(p, q, hh + 1 / 3)
  const g = hue2rgb(p, q, hh)
  const b = hue2rgb(p, q, hh - 1 / 3)
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

function toHex(value: number) {
  return value.toString(16).padStart(2, "0")
}

function gradientColor(capacity: number) {
  const c = Math.max(0, Math.min(100, capacity))
  let h
  let s
  let l
  if (c >= 75) {
    const t = (c - 75) / 25
    h = lerp(102, 45, t)
    s = lerp(38, 100, t)
    l = lerp(63, 70, t)
  } else if (c >= 50) {
    const t = (c - 50) / 25
    h = lerp(45, 31, t)
    s = lerp(100, 89, t)
    l = lerp(70, 69, t)
  } else if (c >= 25) {
    const t = (c - 25) / 25
    h = lerp(31, 0, t)
    s = lerp(89, 66, t)
    l = lerp(69, 64, t)
  } else {
    h = 0
    s = 66
    l = 64
  }
  const [r, g, b] = hslToRgb(h, s, l)
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function iconFor(capacity: number) {
  const idx = Math.min(9, Math.max(0, Math.floor(capacity / 10)))
  return ICONS[idx]
}

function computeBatteryState(): BatteryState {
  if (!batteryPath || !GLib.file_test(batteryPath, GLib.FileTest.IS_DIR)) {
    batteryPath = findBatteryPath()
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

  let marker = ""
  let markerVisible = false
  if (status === "Charging") {
    marker = "↑"
    markerVisible = true
  } else if (status === "Discharging") {
    marker = "↓"
    markerVisible = true
  }

  const color = gradientColor(capacityForColor)

  return {
    visible: true,
    percentText: `${capacityDisplay}%`,
    powerText: `${powerW.toFixed(1)}W`,
    icon: iconFor(capacityForColor),
    marker,
    markerVisible,
    color,
    tooltip: `Battery: ${capacityDisplay}% (${status})`,
  }
}

export default function Battery(monitor: Gdk.Monitor) {
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

  const { TOP, RIGHT } = Astal.WindowAnchor

  return (
    <window
      name="battery-preview"
      class="battery-window"
      gdkmonitor={monitor}
      anchor={TOP | RIGHT}
      layer={Astal.Layer.TOP}
      exclusivity={Astal.Exclusivity.IGNORE}
      margin_top={12}
      margin_right={12}
      application={app}
      visible={state.as((s) => s.visible)}
    >
      <box
        class="battery"
        orientation={Gtk.Orientation.VERTICAL}
        spacing={2}
        tooltip_text={state.as((s) => s.tooltip)}
      >
        <label
          class="battery-percent"
          label={state.as((s) => s.percentText)}
          css={state.as((s) => `color: ${s.color};`)}
          xalign={0}
        />
        <box class="battery-line" spacing={6}>
          <box class="battery-icon-box" spacing={2}>
            <label
              class="battery-icon"
              label={state.as((s) => s.icon)}
              css={state.as((s) => `color: ${s.color};`)}
              xalign={0}
            />
            <label
              class="battery-marker"
              label={state.as((s) => s.marker)}
              visible={state.as((s) => s.markerVisible)}
              xalign={0}
            />
          </box>
          <label
            class="battery-power"
            label={state.as((s) => s.powerText)}
            css={state.as((s) => `color: ${s.color};`)}
            xalign={0}
          />
        </box>
      </box>
    </window>
  )
}
