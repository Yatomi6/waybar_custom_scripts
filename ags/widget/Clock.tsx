import GLib from "gi://GLib?version=2.0"
import { Gtk } from "ags/gtk3"
import { createPoll } from "ags/time"
import { execAsync } from "ags/process"
import { createComputed } from "gnim"
import { CLOCK_SIZES, WIDGET_COMPRESS_Y } from "../barConfig"

const CLOCK_FORMAT = "%H:%M %d/%m/%Y"
const UPDATE_MS = 1000
const TZ_COMMAND =
  "omarchy-launch-floating-terminal-with-presentation omarchy-tz-select"

function formatClock(ts: number) {
  const dt = GLib.DateTime.new_from_unix_local(Math.floor(ts / 1000))
  if (!dt) return ""
  const line1 = dt.format(CLOCK_FORMAT) || ""
  const day = dt.format("%A") || ""
  const month = dt.format("%B") || ""
  const week = dt.format("%V") || ""
  const line2 = `${day} ${month} W${week}`.trim()
  return `${line1}\n${line2}`.trim()
}

export default function Clock() {
  const now = createPoll(Date.now(), UPDATE_MS, () => Date.now())
  const label = createComputed(() => formatClock(now()))

  return (
    <eventbox
      class="clock"
      visible_window={false}
      onButtonPressEvent={(_, event) => {
        const button = (event as any).button ?? (event as any).get_button?.()?.[1]
        if (button === 3) {
          execAsync(TZ_COMMAND).catch(() => null)
        }
        return true
      }}
    >
      <label
        class="clock-label"
        label={label}
        css={`font-size: ${CLOCK_SIZES.font}px; margin: -${WIDGET_COMPRESS_Y}px 0;`}
        xalign={0.5}
        justify={Gtk.Justification.CENTER}
      />
    </eventbox>
  )
}
