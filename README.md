# Omarchy tweaks

Personal scripts and tweaks for an Omarchy + Hyprland setup.

## Contents

- `waybar/battery/` : Waybar script + config for gradient battery display.
- `waybar/downloads/` : Waybar scripts to monitor and open downloads.
- `menu/` : Rofi-based Omarchy launcher (Alt+Space).

## Waybar battery

Files:
- `waybar/battery/waybar-battery-gradient.sh` : script used by Waybar.
- `waybar/battery/waybar-battery-gradient.jsonc` : config snippet.

Usage:
- Copy the script to `~/.config/waybar/scripts/battery-gradient.sh`.
- Merge the JSONC snippet into `~/.config/waybar/config.jsonc`.

## Waybar downloads

Files:
- `waybar/downloads/waybar-downloads-watch.sh` : download monitor (Waybar module).
- `waybar/downloads/waybar-downloads-open.sh` : open current download folder.

Notes:
- Config file: `~/.config/waybar/download-dirs.conf`
- State cache: `~/.cache/waybar-downloads/`

## Menu

Files:
- `menu/menu-rofi.sh` : launcher script.
- `menu/menu-rofi.rasi` : Rofi theme used by the launcher.

Dependencies:
- Omarchy scripts (`omarchy-menu`, `omarchy-launch-*`, `omarchy-font-menu`, etc.).
- Hyprland (`hyprctl`) for floating windows on launch.
- Rofi (`rofi` or `rofi-wayland`).
- Runtime app cache: `~/.cache/omarchy-menu-apps.cache`.
- Runtime theme path: `~/.config/rofi/menu-rofi.rasi`.

Usage:
- Run directly: `menu/menu-rofi.sh`
- Bind in Hyprland (example): `bindd = ALT, SPACE, Omarchy menu, exec, /absolute/path/to/menu/menu-rofi.sh`

Notes:
- The app cache is a tab-separated list of `label`, `desktop_id`, and `icon`.
  Generate it with `menu-refresh-app-cache`. It is kept up to date by
  the user systemd path `omarchy-menu-apps.path` (if enabled).
- You can remove the Omarchy-specific entries and replace them with your own
  commands to make the menu work without Omarchy.
- You can replace `menu/menu-rofi.sh` with any other launcher script; update
  your Hyprland binding accordingly.
