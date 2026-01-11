import GLib from "gi://GLib?version=2.0"
import { createPoll } from "ags/time"
import { execAsync } from "ags/process"
import { createComputed, createState } from "gnim"
import { CLOCK_SIZES, WIDGET_COMPRESS_Y } from "../barConfig"

const CLOCK_FORMAT = "%A %H:%M"
const CLOCK_ALT_FORMAT = "%d %B W%V %Y"
const UPDATE_MS = 1000
const TZ_COMMAND =
  "omarchy-launch-floating-terminal-with-presentation omarchy-tz-select"

function formatClock(ts: number, useAlt: boolean) {
  const dt = GLib.DateTime.new_from_unix_local(Math.floor(ts / 1000))
  if (!dt) return ""
  return dt.format(useAlt ? CLOCK_ALT_FORMAT : CLOCK_FORMAT) || ""
}

export default function Clock() {
  const now = createPoll(Date.now(), UPDATE_MS, () => Date.now())
  const [useAlt, setUseAlt] = createState(false)
  const label = createComputed(() => formatClock(now(), useAlt()))

  return (
    <eventbox
      class="clock"
      visible_window={false}
      onButtonPressEvent={(_, event) => {
        const button = (event as any).button ?? (event as any).get_button?.()?.[1]
        if (button === 1) {
          setUseAlt((prev) => !prev)
        } else if (button === 3) {
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
      />
    </eventbox>
  )
}
