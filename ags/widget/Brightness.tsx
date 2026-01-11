import { Gtk } from "ags/gtk3"
import { createPoll } from "ags/time"
import { execAsync } from "ags/process"
import GLib from "gi://GLib?version=2.0"
import {
  BAR_TEXT_COLOR,
  METER_COLORS,
  METER_SIZES,
  WIDGET_COMPRESS_Y,
} from "../barConfig"

const UPDATE_MS = 400
const ICON_BRIGHTNESS = "󰃟"
const BRIGHTNESS_MIN = 0
const BRIGHTNESS_MAX = 100

type BrightnessState = {
  visible: boolean
  percent: number
  percentText: string
  tooltip: string
}

const TEXT_GAP = Math.max(1, Math.round(METER_SIZES.gap / 2))
let backlightPath: string | null = null
let lastBrightnessPercent = 0
let baselineBrightness: number | null = null
let brightnessCycleStep = -1

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

function getClickPercent(widget: Gtk.Widget, event: unknown) {
  const alloc = widget.get_allocation()
  const width = Math.max(1, alloc.width)
  let x = 0

  const evt = event as {
    x?: number
    get_position?: () => number[]
    get_coords?: () => number[]
  }

  if (typeof evt?.x === "number") {
    x = evt.x
  } else if (evt?.get_coords) {
    const coords = evt.get_coords()
    if (Array.isArray(coords) && coords.length >= 2) {
      x = typeof coords[0] === "boolean" ? coords[1] ?? 0 : coords[0] ?? 0
    }
  } else if (evt?.get_position) {
    const coords = evt.get_position()
    if (Array.isArray(coords) && coords.length >= 2) {
      x = typeof coords[0] === "boolean" ? coords[1] ?? 0 : coords[0] ?? 0
    }
  }

  if (x > width) {
    x -= alloc.x
  }

  const clamped = clamp(x, 0, width)
  return clamp(Math.round((clamped / width) * 100), 0, 100)
}

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

function findBacklightPath(): string | null {
  try {
    const dir = GLib.Dir.open("/sys/class/backlight", 0)
    let name: string | null
    while ((name = dir.read_name()) !== null) {
      const path = `/sys/class/backlight/${name}`
      if (
        GLib.file_test(`${path}/brightness`, GLib.FileTest.EXISTS) &&
        GLib.file_test(`${path}/max_brightness`, GLib.FileTest.EXISTS)
      ) {
        dir.close()
        return path
      }
    }
    dir.close()
  } catch (_) {}
  return null
}

function computeBrightnessState(): BrightnessState {
  if (!backlightPath || !GLib.file_test(backlightPath, GLib.FileTest.IS_DIR)) {
    backlightPath = findBacklightPath()
  }

  if (!backlightPath) {
    return {
      visible: false,
      percent: 0,
      percentText: "",
      tooltip: "Brightness unavailable",
    }
  }

  const current = readNumber(`${backlightPath}/brightness`)
  const max = readNumber(`${backlightPath}/max_brightness`)
  if (current === null || max === null || max <= 0) {
    return {
      visible: false,
      percent: 0,
      percentText: "",
      tooltip: "Brightness unavailable",
    }
  }

  const percent = clamp(Math.round((current / max) * 100), 0, 100)
  lastBrightnessPercent = percent
  if (percent > BRIGHTNESS_MIN && percent < BRIGHTNESS_MAX) {
    if (
      brightnessCycleStep === -1 ||
      brightnessCycleStep === 1 ||
      brightnessCycleStep === 3
    ) {
      baselineBrightness = percent
    }
  } else if (brightnessCycleStep === 0 && percent > BRIGHTNESS_MIN) {
    brightnessCycleStep = -1
    baselineBrightness = percent
  } else if (brightnessCycleStep === 2 && percent < BRIGHTNESS_MAX) {
    brightnessCycleStep = -1
    if (percent > BRIGHTNESS_MIN) {
      baselineBrightness = percent
    }
  }
  return {
    visible: true,
    percent,
    percentText: `${percent}%`,
    tooltip: `Brightness: ${percent}%`,
  }
}

export default function Brightness() {
  const state = createPoll<BrightnessState>(
    {
      visible: false,
      percent: 0,
      percentText: "",
      tooltip: "",
    },
    UPDATE_MS,
    computeBrightnessState,
  )

  return (
    <box
      class="brightness"
      spacing={METER_SIZES.gap}
      valign={Gtk.Align.CENTER}
      visible={state.as((s) => s.visible)}
      tooltip_text={state.as((s) => s.tooltip)}
    >
      <eventbox
        class="brightness-percent-wrap"
        visible_window={false}
        onButtonPressEvent={() => {
          const current = clamp(lastBrightnessPercent, BRIGHTNESS_MIN, BRIGHTNESS_MAX)
          const baseTarget = clamp(
            baselineBrightness ?? Math.max(10, current),
            BRIGHTNESS_MIN,
            BRIGHTNESS_MAX,
          )
          if (brightnessCycleStep === -1) {
            if (current > BRIGHTNESS_MIN) {
              baselineBrightness = current
            }
            brightnessCycleStep = 0
            execAsync(`brightnessctl set ${BRIGHTNESS_MIN}%`).catch(() => null)
            return true
          }
          if (brightnessCycleStep === 0) {
            brightnessCycleStep = 1
            execAsync(`brightnessctl set ${baseTarget}%`).catch(() => null)
            return true
          }
          if (brightnessCycleStep === 1) {
            brightnessCycleStep = 2
            execAsync(`brightnessctl set ${BRIGHTNESS_MAX}%`).catch(() => null)
            return true
          }
          if (brightnessCycleStep === 2) {
            brightnessCycleStep = 3
            execAsync(`brightnessctl set ${baseTarget}%`).catch(() => null)
            return true
          }
          brightnessCycleStep = 0
          execAsync(`brightnessctl set ${BRIGHTNESS_MIN}%`).catch(() => null)
          return true
        }}
      >
        <label
          class="brightness-percent"
          label={state.as((s) => s.percentText)}
          width_chars={4}
          xalign={1}
          css={`font-size: ${METER_SIZES.text}px; margin: -${WIDGET_COMPRESS_Y}px 0; padding: 0 ${TEXT_GAP}px 0 0; color: ${BAR_TEXT_COLOR};`}
        />
      </eventbox>
      <eventbox
        class="brightness-meter-wrap"
        visible_window={false}
        width_request={METER_SIZES.width}
        height_request={METER_SIZES.height}
        onButtonPressEvent={(widget, event) => {
          const percent = getClickPercent(widget, event)
          execAsync(`brightnessctl set ${percent}%`).catch(() => null)
          return true
        }}
      >
        <box
          class="brightness-meter"
          valign={Gtk.Align.CENTER}
          css={`min-width: ${METER_SIZES.width}px; min-height: ${METER_SIZES.height}px; background-color: ${darken(
            METER_COLORS.brightness,
          )}; border-radius: ${METER_SIZES.radius}px; margin: 0; padding: 0;`}
        >
          <box
            class="brightness-meter-fill"
            css={state.as((s) => {
              const width = Math.round((METER_SIZES.width * s.percent) / 100)
              return `min-width: ${width}px; min-height: ${METER_SIZES.height}px; background-color: ${METER_COLORS.brightness}; border-radius: ${METER_SIZES.radius}px; margin: 0; padding: 0;`
            })}
          />
        </box>
      </eventbox>
      <label
        class="brightness-icon"
        label={ICON_BRIGHTNESS}
        css={`font-size: ${METER_SIZES.icon}px; margin: -${WIDGET_COMPRESS_Y}px 0; padding: 0 0 0 ${TEXT_GAP}px; color: ${BAR_TEXT_COLOR};`}
      />
    </box>
  )
}
