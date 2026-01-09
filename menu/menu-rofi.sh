#!/bin/bash
set -euo pipefail

ROFI_BIN="rofi"
if command -v rofi-wayland >/dev/null 2>&1; then
  ROFI_BIN="rofi-wayland"
fi

THEME="${XDG_CONFIG_HOME:-$HOME/.config}/rofi/menu-rofi.rasi"
APP_CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/omarchy-menu-apps.cache"

if [ ! -s "$APP_CACHE" ] && command -v menu-refresh-app-cache >/dev/null 2>&1; then
  menu-refresh-app-cache >/dev/null 2>&1 || true
fi

labels=()
icons=()
cmds=()

add_entry() {
  labels+=("$1")
  icons+=("$2")
  cmds+=("$3")
}

add_entry "Apps" "applications-all" "omarchy-launch-walker -m desktopapplications"
add_entry "Learn" "help-browser" "omarchy-menu learn"
add_entry "Trigger" "media-record" "omarchy-menu trigger"
add_entry "Style" "preferences-desktop-theme" "omarchy-menu style"
add_entry "Setup" "preferences-system" "omarchy-menu setup"
add_entry "Install" "system-software-install" "omarchy-menu install"
add_entry "Remove" "edit-delete" "omarchy-menu remove"
add_entry "Update" "view-refresh" "omarchy-menu update"
add_entry "About" "help-about" "omarchy-launch-about"
add_entry "System" "system-shutdown" "omarchy-menu system"

readarray -t sub_items <<'EOF_ITEMS'
Install: AI|applications-science|omarchy-menu install
Install: AUR|package-x-generic|omarchy-launch-tui omarchy-pkg-aur-install
Install: Development|applications-development|omarchy-menu install
Install: Editor|accessories-text-editor|omarchy-menu install
Install: Gaming|applications-games|omarchy-menu install
Install: Package|package-x-generic|omarchy-launch-tui omarchy-pkg-install
Install: Service|application-x-addon|omarchy-menu install
Install: Style|preferences-desktop-theme|omarchy-menu install
Install: Terminal|utilities-terminal|omarchy-menu install
Install: TUI|utilities-terminal|omarchy-launch-floating-terminal-with-presentation omarchy-tui-install
Install: Web App|web-browser|omarchy-launch-floating-terminal-with-presentation omarchy-webapp-install
Install: Windows VM|windows|omarchy-launch-floating-terminal-with-presentation 'omarchy-windows-vm install'
Learn: Arch Wiki|help-browser|omarchy-launch-webapp https://wiki.archlinux.org/title/Main_page
Learn: Bash Cheatsheet|utilities-terminal|omarchy-launch-webapp https://devhints.io/bash
Learn: Hyprland Wiki|help-browser|omarchy-launch-webapp https://wiki.hypr.land/
Learn: Keybindings|input-keyboard|omarchy-menu-keybindings
Learn: Neovim Keymaps|accessories-text-editor|omarchy-launch-webapp https://www.lazyvim.org/keymaps
Learn: Omarchy Manual|help-browser|omarchy-launch-webapp https://learn.omacom.io/2/the-omarchy-manual
Remove: Dictation|edit-delete|omarchy-launch-floating-terminal-with-presentation omarchy-voxtype-remove
Remove: Development|edit-delete|omarchy-menu remove
Remove: Fingerprint|edit-delete|omarchy-launch-floating-terminal-with-presentation 'omarchy-setup-fingerprint --remove'
Remove: Fido2|edit-delete|omarchy-launch-floating-terminal-with-presentation 'omarchy-setup-fido2 --remove'
Remove: Package|edit-delete|omarchy-launch-tui omarchy-pkg-remove
Remove: Theme|edit-delete|omarchy-launch-floating-terminal-with-presentation omarchy-theme-remove
Remove: TUI|edit-delete|omarchy-launch-floating-terminal-with-presentation omarchy-tui-remove
Remove: Web App|edit-delete|omarchy-launch-floating-terminal-with-presentation omarchy-webapp-remove
Remove: Windows VM|edit-delete|omarchy-launch-floating-terminal-with-presentation 'omarchy-windows-vm remove'
Setup: Audio|audio-volume-high|omarchy-launch-audio
Setup: Bluetooth|bluetooth|omarchy-launch-bluetooth
Setup: Config|preferences-system|omarchy-menu setup
Setup: DNS|network-workgroup|omarchy-launch-floating-terminal-with-presentation omarchy-setup-dns
Setup: Monitors|video-display|omarchy-launch-editor ~/.config/hypr/monitors.conf
Setup: Power Profile|battery|omarchy-menu power
Setup: Security|security-high|omarchy-menu setup
Setup: System Sleep|system-suspend|omarchy-menu setup
Setup: Wifi|network-wireless|omarchy-launch-wifi
Style: About Branding|document-properties|omarchy-launch-editor ~/.config/omarchy/branding/about.txt
Style: Background Next|preferences-desktop-wallpaper|omarchy-theme-bg-next
Style: Font|preferences-desktop-font|omarchy-font-menu
Style: Hyprland Config|preferences-system|omarchy-launch-editor ~/.config/hypr/looknfeel.conf
Style: Screensaver Branding|preferences-desktop-screensaver|omarchy-launch-editor ~/.config/omarchy/branding/screensaver.txt
Style: Theme|preferences-desktop-theme|omarchy-launch-walker -m menus:omarchythemes --width 800 --minheight 400
System: Lock|system-lock-screen|omarchy-lock-screen
System: Screensaver|preferences-desktop-screensaver|omarchy-launch-screensaver force
System: Restart|system-reboot|omarchy-cmd-reboot
System: Shutdown|system-shutdown|omarchy-cmd-shutdown
Trigger: Color Picker|color-picker|sh -c 'pkill hyprpicker || hyprpicker -a'
Trigger: Screenrecord (desktop + mic + webcam)|media-record|sh -c 'omarchy-cmd-screenrecord --stop-recording || omarchy-cmd-screenrecord --with-desktop-audio --with-microphone-audio --with-webcam'
Trigger: Screenrecord (desktop + mic)|media-record|sh -c 'omarchy-cmd-screenrecord --stop-recording || omarchy-cmd-screenrecord --with-desktop-audio --with-microphone-audio'
Trigger: Screenrecord (desktop audio)|media-record|sh -c 'omarchy-cmd-screenrecord --stop-recording || omarchy-cmd-screenrecord --with-desktop-audio'
Trigger: Screenshot (clipboard)|camera-photo|omarchy-cmd-screenshot smart clipboard
Trigger: Screenshot (edit)|camera-photo|omarchy-cmd-screenshot smart
Trigger: Share Clipboard|send-to|omarchy-cmd-share clipboard
Trigger: Share File|send-to|uwsm-app -- xdg-terminal-exec --app-id=org.omarchy.terminal -e bash -c 'omarchy-cmd-share file'
Trigger: Share Folder|send-to|uwsm-app -- xdg-terminal-exec --app-id=org.omarchy.terminal -e bash -c 'omarchy-cmd-share folder'
Trigger: Toggle Idle Lock|changes-allow|omarchy-toggle-idle
Trigger: Toggle Nightlight|weather-clear-night|omarchy-toggle-nightlight
Trigger: Toggle Screensaver|preferences-desktop-screensaver|omarchy-toggle-screensaver
Trigger: Toggle Top Bar|view-restore|omarchy-toggle-waybar
Update: Channel|system-software-update|omarchy-menu update
Update: Config|preferences-system|omarchy-menu update
Update: Extra Themes|preferences-desktop-theme|omarchy-launch-floating-terminal-with-presentation omarchy-theme-update
Update: Firmware|system-software-update|omarchy-launch-floating-terminal-with-presentation omarchy-update-firmware
Update: Hardware|drive-harddisk|omarchy-menu update
Update: Omarchy|view-refresh|omarchy-launch-floating-terminal-with-presentation omarchy-update
Update: Password|dialog-password|omarchy-menu update
Update: Process|view-refresh|omarchy-menu update
Update: Time|preferences-system-time|omarchy-launch-floating-terminal-with-presentation omarchy-update-time
Update: Timezone|preferences-system-time|omarchy-launch-floating-terminal-with-presentation omarchy-tz-select
EOF_ITEMS

if [ -f "$HOME/.config/hypr/bindings.conf" ]; then
  sub_items+=("Setup: Keybindings|input-keyboard|omarchy-launch-editor ~/.config/hypr/bindings.conf")
fi
if [ -f "$HOME/.config/hypr/input.conf" ]; then
  sub_items+=("Setup: Input|input-mouse|omarchy-launch-editor ~/.config/hypr/input.conf")
fi
if [ -f "$HOME/.local/state/omarchy/toggles/suspend-on" ]; then
  sub_items+=("System: Suspend|system-suspend|systemctl suspend")
fi
if command -v omarchy-hibernation-available >/dev/null 2>&1 && omarchy-hibernation-available >/dev/null 2>&1; then
  sub_items+=("System: Hibernate|system-suspend|systemctl hibernate")
fi

app_items=()
if [ -s "$APP_CACHE" ]; then
  while IFS=$'\t' read -r label app_id icon; do
    [ -z "$label" ] && continue
    [ -z "$app_id" ] && continue
    app_items+=("$label|$icon|gtk-launch $app_id")
  done < "$APP_CACHE"
fi

if [ ${#sub_items[@]} -gt 0 ] || [ ${#app_items[@]} -gt 0 ]; then
  sorted_items=$(printf '%s\n' "${sub_items[@]}" "${app_items[@]}" | sed '/^$/d' | sort -f -t '|' -k1,1)
  while IFS='|' read -r label icon cmd; do
    [ -z "$label" ] && continue
    add_entry "$label" "$icon" "$cmd"
  done <<< "$sorted_items"
fi

selection_index=$(
  for i in "${!labels[@]}"; do
    if [ -n "${icons[$i]}" ]; then
      printf '%s\0icon\x1f%s\n' "${labels[$i]}" "${icons[$i]}"
    else
      printf '%s\n' "${labels[$i]}"
    fi
  done | "$ROFI_BIN" -dmenu -i -p "" -show-icons -matching fuzzy -format i -theme "$THEME"
)

if [ -z "$selection_index" ] || [ "$selection_index" = "-1" ]; then
  exit 0
fi

cmd="${cmds[$selection_index]}"
if [ -n "$cmd" ]; then
  if command -v hyprctl >/dev/null 2>&1; then
    hyprctl dispatch exec "[float] $cmd" >/dev/null 2>&1 &
  else
    bash -c "$cmd" >/dev/null 2>&1 &
  fi
fi
