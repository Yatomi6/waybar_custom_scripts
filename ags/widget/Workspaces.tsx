import { Gdk } from "ags/gtk3"
import GLib from "gi://GLib?version=2.0"
import Gio from "gi://Gio?version=2.0"
import { execAsync } from "ags/process"
import { For, createComputed, createState, onCleanup } from "gnim"
import {
  WORKSPACE_ICONS,
  WORKSPACE_PERSISTENT,
  WORKSPACE_POLL_MS,
  WORKSPACE_EVENT_DEBOUNCE_MS,
  WORKSPACE_SIZES,
  WIDGET_COMPRESS_Y,
} from "../barConfig"

type HyprWorkspace = {
  id: number
  name: string
  monitor: string
  windows: number
}

type HyprMonitor = {
  name: string
  x: number
  y: number
  width: number
  height: number
  activeWorkspace?: {
    id: number
  }
}

type WorkspaceItem = {
  id: number
  icon: string
  isActive: boolean
  isEmpty: boolean
}

type WorkspaceSnapshot = {
  workspaces: HyprWorkspace[]
  monitorName: string | null
  activeId: number | null
}

async function runJson<T>(command: string) {
  try {
    const raw = await execAsync(command)
    return JSON.parse(raw) as T
  } catch (_) {
    return null
  }
}

function matchMonitor(monitors: HyprMonitor[], geometry: Gdk.Rectangle | null) {
  if (!geometry) return null
  return (
    monitors.find(
      (mon) =>
        mon.x === geometry.x &&
        mon.y === geometry.y &&
        mon.width === geometry.width &&
        mon.height === geometry.height,
    ) ?? null
  )
}

function buildItems(
  workspaces: HyprWorkspace[],
  activeId: number | null,
  monitorName: string | null,
): WorkspaceItem[] {
  const visible = monitorName
    ? workspaces.filter((ws) => ws.monitor === monitorName && ws.id > 0)
    : workspaces.filter((ws) => ws.id > 0)

  const ids = new Set<number>([...WORKSPACE_PERSISTENT, ...visible.map((w) => w.id)])
  const sorted = Array.from(ids).sort((a, b) => a - b)

  return sorted.map((id) => {
    const ws = visible.find((w) => w.id === id)
    const isActive = activeId !== null && id === activeId
    const isEmpty = !isActive && (!ws || ws.windows === 0)
    const icon = isActive
      ? WORKSPACE_ICONS.active
      : WORKSPACE_ICONS.map[id as keyof typeof WORKSPACE_ICONS.map] ??
        WORKSPACE_ICONS.default

    return { id, icon, isActive, isEmpty }
  })
}

async function fetchSnapshot(monitor: Gdk.Monitor): Promise<WorkspaceSnapshot> {
  const [workspaces, monitors] = await Promise.all([
    runJson<HyprWorkspace[]>("hyprctl workspaces -j"),
    runJson<HyprMonitor[]>("hyprctl monitors -j"),
  ])

  const workspaceList = workspaces ?? []
  const monitorList = monitors ?? []
  const geometry = monitor.get_geometry()
  const matched = matchMonitor(monitorList, geometry)
  const activeId = matched?.activeWorkspace?.id ?? null
  const monitorName = matched?.name ?? null

  return { workspaces: workspaceList, monitorName, activeId }
}

function openHyprEventStream(onLine: (line: string) => void) {
  const sig = GLib.getenv("HYPRLAND_INSTANCE_SIGNATURE")
  const runtime = GLib.getenv("XDG_RUNTIME_DIR")
  if (!sig || !runtime) return null

  const path = `${runtime}/hypr/${sig}/.socket2.sock`
  try {
    const client = new Gio.SocketClient()
    const address = Gio.UnixSocketAddress.new(path)
    const connection = client.connect(address, null)
    const stream = new Gio.DataInputStream({
      base_stream: connection.get_input_stream(),
    })

    const readNext = () => {
      stream.read_line_async(GLib.PRIORITY_DEFAULT, null, (source, res) => {
        try {
          const [line] = source.read_line_finish(res)
          if (line === null) return
          const text = new TextDecoder().decode(line).trim()
          if (text) onLine(text)
          readNext()
        } catch (_) {
          try {
            connection.close(null)
          } catch (_) {}
        }
      })
    }

    readNext()

    return () => {
      try {
        connection.close(null)
      } catch (_) {}
    }
  } catch (_) {
    return null
  }
}

export default function Workspaces({ monitor }: { monitor: Gdk.Monitor }) {
  const [snapshot, setSnapshot] = createState<WorkspaceSnapshot>({
    workspaces: [],
    monitorName: null,
    activeId: null,
  })

  let refreshSource: number | null = null

  const refreshSnapshot = () => {
    fetchSnapshot(monitor).then(setSnapshot)
  }

  const scheduleRefresh = () => {
    if (refreshSource !== null) return
    refreshSource = GLib.timeout_add(
      GLib.PRIORITY_DEFAULT,
      WORKSPACE_EVENT_DEBOUNCE_MS,
      () => {
        refreshSource = null
        refreshSnapshot()
        return GLib.SOURCE_REMOVE
      },
    )
  }

  refreshSnapshot()

  const pollSource = GLib.timeout_add(
    GLib.PRIORITY_DEFAULT,
    WORKSPACE_POLL_MS,
    () => {
      refreshSnapshot()
      return GLib.SOURCE_CONTINUE
    },
  )

  const disposeStream = openHyprEventStream((line) => {
    const event = line.split(">>")[0]
    if (
      event === "workspace" ||
      event === "workspacev2" ||
      event === "focusedmon" ||
      event === "createworkspace" ||
      event === "destroyworkspace" ||
      event === "moveworkspace" ||
      event === "moveworkspacev2" ||
      event === "renameworkspace" ||
      event === "monitoradded" ||
      event === "monitorremoved"
    ) {
      scheduleRefresh()
    }
  })

  onCleanup(() => {
    if (refreshSource !== null) {
      GLib.source_remove(refreshSource)
    }
    GLib.source_remove(pollSource)
    disposeStream?.()
  })

  const items = createComputed(() =>
    buildItems(snapshot().workspaces, snapshot().activeId, snapshot().monitorName),
  )

  return (
    <box class="workspaces" spacing={0}>
      <For each={items} id={(item) => item.id}>
        {(item) => {
          const current = items.as(
            (list) => list.find((ws) => ws.id === item.id) ?? item,
          )
          const className = current.as((ws) => {
            const active = ws.isActive ? " active" : ""
            const empty = ws.isEmpty ? " empty" : ""
            return `workspace-button${active}${empty}`
          })

          return (
            <button
              class={className}
              css={`padding: 0 ${WORKSPACE_SIZES.paddingX}px; margin: 0 ${WORKSPACE_SIZES.marginX}px; min-width: ${WORKSPACE_SIZES.minWidth}px;`}
              onClicked={() =>
                execAsync(`hyprctl dispatch workspace ${item.id}`).catch(() => null)
              }
            >
              <label
                class="workspace-label"
                label={current.as((ws) => ws.icon)}
                css={`font-size: ${WORKSPACE_SIZES.font}px; margin: -${WIDGET_COMPRESS_Y}px 0;`}
              />
            </button>
          )
        }}
      </For>
    </box>
  )
}
