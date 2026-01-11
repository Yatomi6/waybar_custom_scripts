import app from "ags/gtk3/app"
import { Astal, Gtk, Gdk } from "ags/gtk3"
import Battery from "./Battery"
import Brightness from "./Brightness"
import Clock from "./Clock"
import Audio from "./Audio"
import Workspaces from "./Workspaces"
import Wifi from "./Wifi"
import {
  BAR_CSS,
  BAR_HEIGHT,
  METERS_BATTERY_GAP,
  MODULE_SPACING,
  WIFI_METERS_GAP,
} from "../barConfig"

export default function Bar(gdkmonitor: Gdk.Monitor) {
  const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

  return (
    <window
      name="main-bar"
      class="bar-window"
      gdkmonitor={gdkmonitor}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      anchor={TOP | LEFT | RIGHT}
      layer={Astal.Layer.TOP}
      application={app}
    >
      <centerbox class="bar" css={BAR_CSS} height_request={BAR_HEIGHT}>
        <box $type="start" class="bar-left" spacing={MODULE_SPACING}>
          <Workspaces monitor={gdkmonitor} />
        </box>
        <box $type="center" class="bar-center" spacing={MODULE_SPACING}>
          <Clock />
        </box>
        <box
          $type="end"
          class="bar-right"
          spacing={MODULE_SPACING}
          halign={Gtk.Align.END}
        >
          <box css={`margin-right: ${WIFI_METERS_GAP}px;`} valign={Gtk.Align.CENTER}>
            <Wifi />
          </box>
          <box
            class="meters"
            orientation={Gtk.Orientation.VERTICAL}
            spacing={0}
            valign={Gtk.Align.CENTER}
            css={`margin-right: ${METERS_BATTERY_GAP}px;`}
          >
            <Brightness />
            <Audio />
          </box>
          <Battery />
        </box>
      </centerbox>
    </window>
  )
}
