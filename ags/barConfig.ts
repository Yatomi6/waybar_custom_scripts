const BASE_HEIGHT = 30

export const BAR_HEIGHT = 60
export const BAR_COLOR = "#2e3440"
export const BAR_TEXT_COLOR = "#d8dee9"

const SCALE = BAR_HEIGHT / BASE_HEIGHT
export const WIDGET_SCALE = 1.7
const WIDGET_FACTOR = SCALE * WIDGET_SCALE
export const WIDGET_COMPRESS_Y = Math.max(0, Math.round((WIDGET_SCALE - 1) * 4))
export const WORKSPACE_SCALE = 0.9
export const CLOCK_SCALE = 0.9

export const METER_SIZES = {
  width: Math.max(26, Math.round(48 * WIDGET_FACTOR)),
  height: Math.max(2, Math.round(4 * SCALE)),
  radius: Math.max(1, Math.round(3 * SCALE)),
  gap: Math.max(2, Math.round(4 * SCALE)),
  icon: Math.max(9, Math.round(11 * WIDGET_FACTOR)),
  text: Math.max(9, Math.round(11 * WIDGET_FACTOR)),
}

export const METER_COLORS = {
  track: "#3b4252",
  audio: "#88c0d0",
  brightness: "#ebcb8b",
  muted: "#bf616a",
}

export const BAR_PADDING_Y = Math.max(1, Math.round(2 * SCALE))
export const BAR_PADDING_X = Math.max(6, Math.round(10 * SCALE))
export const BAR_ITEM_PAD = Math.max(2, Math.round(6 * SCALE))
export const BAR_ITEM_PAD_TIGHT = Math.max(0, Math.round(BAR_HEIGHT * 0.02))
export const BAR_CONTENT_HEIGHT = Math.max(1, BAR_HEIGHT - BAR_PADDING_Y * 2)

export const BAR_CSS = `min-height: ${BAR_CONTENT_HEIGHT}px; background: ${BAR_COLOR}; color: ${BAR_TEXT_COLOR}; padding: ${BAR_PADDING_Y}px ${BAR_PADDING_X}px;`

export const MODULE_SPACING = Math.max(6, Math.round(8 * SCALE))
export const METERS_BATTERY_GAP = Math.max(4, Math.round(6 * SCALE))
export const WIFI_METERS_GAP = Math.max(4, Math.round(6 * SCALE))
export const WIFI_SPACING_X = Math.max(2, Math.round(4 * SCALE))
export const WIFI_SPACING_Y = Math.max(1, Math.round(2 * SCALE))

export const WORKSPACE_ICONS = {
  active: "󱓻",
  default: "",
  map: {
    1: "1",
    2: "2",
    3: "3",
    4: "4",
    5: "5",
    6: "6",
    7: "7",
    8: "8",
    9: "9",
    10: "0",
  },
}

export const WORKSPACE_PERSISTENT = [1, 2, 3, 4, 5]
export const WORKSPACE_POLL_MS = 3000
export const WORKSPACE_EVENT_DEBOUNCE_MS = 10

export const WORKSPACE_SIZES = {
  font: Math.max(10, Math.round(12 * WIDGET_FACTOR * WORKSPACE_SCALE)),
  paddingX: Math.max(4, Math.round(6 * WIDGET_FACTOR * WORKSPACE_SCALE)),
  marginX: Math.max(1, Math.round(2 * WIDGET_FACTOR * WORKSPACE_SCALE)),
  minWidth: Math.max(9, Math.round(9 * WIDGET_FACTOR * WORKSPACE_SCALE)),
}

export const BATTERY_SIZES = {
  percent: Math.max(10, Math.round(12 * WIDGET_FACTOR)),
  icon: Math.max(9, Math.round(11 * WIDGET_FACTOR)),
  power: Math.max(9, Math.round(10 * WIDGET_FACTOR)),
  marker: Math.max(7, Math.round(8 * WIDGET_FACTOR)),
}

export const BATTERY_LINE_SPACING_PX = 0
export const BATTERY_LINE_OVERLAP_PX = 0
export const BATTERY_LINE_HEIGHT = 0.75
export const BATTERY_RISE_PX = 1

export const CLOCK_SIZES = {
  font: Math.max(10, Math.round(12 * WIDGET_FACTOR * CLOCK_SCALE)),
}
