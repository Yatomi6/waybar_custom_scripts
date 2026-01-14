import { Gdk, Gtk } from "ags/gtk3"
import { createComputed } from "gnim"
import {
  BAR_TEXT_COLOR,
  HOVER_PANEL_SIZES,
  WIDGET_COMPRESS_Y,
} from "../barConfig"
import {
  setHandleHover,
  updateAnchor,
  hoverPanelOpen,
  hoverPanelRecording,
  hoverPanelStopwatch,
} from "./hoverPanelState"

const ARROW_UP = "▴"
const ARROW_DOWN = "▾"
const RECORD_ICON = "■"
const STOPWATCH_ICON = "󰔛"

export default function HoverPanel() {
  const label = createComputed(() => {
    if (hoverPanelRecording()) return RECORD_ICON
    if (hoverPanelStopwatch()) return STOPWATCH_ICON
    return hoverPanelOpen() ? ARROW_DOWN : ARROW_UP
  })
  const color = createComputed(() =>
    hoverPanelRecording() ? "#bf616a" : BAR_TEXT_COLOR,
  )

  const updateFromWidget = (widget: Gtk.Widget) => {
    const alloc = widget.get_allocation()
    let x = alloc.x
    const toplevel = widget.get_toplevel?.()
    if (toplevel && widget.translate_coordinates) {
      const translated = widget.translate_coordinates(toplevel as Gtk.Widget, 0, 0)
      if (Array.isArray(translated) && translated.length >= 3) {
        const ok = translated[0]
        const tx = translated[1]
        if (ok && typeof tx === "number") {
          x = tx
        }
      }
    }
    updateAnchor({
      x: Math.max(0, Math.round(x)),
      width: Math.max(1, Math.round(alloc.width)),
    })
  }

  return (
    <eventbox
      class="hover-panel"
      visible_window={false}
      events={Gdk.EventMask.ENTER_NOTIFY_MASK | Gdk.EventMask.LEAVE_NOTIFY_MASK}
      css={`padding-right: ${HOVER_PANEL_SIZES.triggerPadRight}px;`}
      onEnterNotifyEvent={(widget) => {
        updateFromWidget(widget)
        setHandleHover(true, HOVER_PANEL_SIZES.hideDelayMs)
        return true
      }}
      onLeaveNotifyEvent={() => {
        setHandleHover(false, HOVER_PANEL_SIZES.hideDelayMs)
        return true
      }}
      $={(self) => {
        updateFromWidget(self)
      }}
    >
      <box
        class="hover-panel-box"
        spacing={HOVER_PANEL_SIZES.gap}
        valign={Gtk.Align.CENTER}
      >
        <label
          class="hover-panel-handle"
          label={label}
          css={color.as(
            (tone) =>
              `font-size: ${HOVER_PANEL_SIZES.icon}px; margin: -${WIDGET_COMPRESS_Y}px 0; padding: 0 ${HOVER_PANEL_SIZES.paddingX}px; color: ${tone};`,
          )}
        />
      </box>
    </eventbox>
  )
}
