import app from "ags/gtk3/app"
import { Astal, Gtk, Gdk } from "ags/gtk3"
import Battery from "./Battery"
import Brightness from "./Brightness"
import Clock from "./Clock"
import Audio from "./Audio"
import Workspaces from "./Workspaces"
import Wifi from "./Wifi"
import {
  BAR_CONTENT_HEIGHT,
  BAR_CSS,
  BAR_HEIGHT,
  BAR_TEXT_COLOR,
  METERS_BATTERY_GAP,
  MODULE_SPACING,
  WIFI_METERS_GAP,
} from "../barConfig"

export default function Bar(gdkmonitor: Gdk.Monitor) {
  const { TOP, LEFT, RIGHT } = Astal.WindowAnchor
  const ITEM_PAD = 6
  const SEP_GAP = 0
  const SEP_WIDTH = 0
  const RightItem = ({ children }: { children: JSX.Element | JSX.Element[] }) => (
    <box
      class="bar-item"
      valign={Gtk.Align.CENTER}
      css={`min-height: ${BAR_CONTENT_HEIGHT}px; padding: 0 ${ITEM_PAD}px;`}
    >
      {children}
    </box>
  )
  const Separator = () => null

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
          spacing={0}
          halign={Gtk.Align.END}
        >
          <RightItem>
            <Wifi />
          </RightItem>
          <RightItem>
            <box
              class="meters"
              orientation={Gtk.Orientation.VERTICAL}
              spacing={0}
              valign={Gtk.Align.CENTER}
            >
              <Brightness />
              <Audio />
            </box>
          </RightItem>
          <RightItem>
            <Battery />
          </RightItem>
        </box>
      </centerbox>
    </window>
  )
}
