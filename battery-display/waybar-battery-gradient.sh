#!/usr/bin/env bash
set -euo pipefail

# Battery device discovery (first BAT* found).
BAT_PATH=""
for p in /sys/class/power_supply/BAT*; do
  if [ -d "$p" ]; then
    BAT_PATH="$p"
    break
  fi
done

if [ -z "$BAT_PATH" ]; then
  printf '{"text":"", "tooltip":"No battery found"}\n'
  exit 0
fi

capacity_raw=$(cat "$BAT_PATH/capacity")
capacity="$capacity_raw"
status=$(cat "$BAT_PATH/status")

# Read power in watts (guarded to avoid missing-file errors).
power_w=""
if [ -r "$BAT_PATH/power_now" ]; then
  power_raw=$(cat "$BAT_PATH/power_now" 2>/dev/null || true)
  if [ -n "$power_raw" ]; then
    power_w=$(awk -v p="$power_raw" 'BEGIN {printf "%.1f", p/1000000}')
  fi
elif [ -r "$BAT_PATH/current_now" ] && [ -r "$BAT_PATH/voltage_now" ]; then
  current_raw=$(cat "$BAT_PATH/current_now" 2>/dev/null || true)
  voltage_raw=$(cat "$BAT_PATH/voltage_now" 2>/dev/null || true)
  if [ -n "$current_raw" ] && [ -n "$voltage_raw" ]; then
    power_w=$(awk -v c="$current_raw" -v v="$voltage_raw" 'BEGIN {printf "%.1f", (c*v)/1000000000000}')
  fi
fi

# Fallback: estimate power from energy delta over time.
if [ -z "$power_w" ] && [ -r "$BAT_PATH/energy_now" ]; then
  energy_now=$(cat "$BAT_PATH/energy_now" 2>/dev/null || true)
  if [ -n "$energy_now" ]; then
    state_file="/tmp/waybar-battery-energy.state"
    now_ts=$(date +%s)
    if [ -r "$state_file" ]; then
      prev_ts=$(awk 'NR==1{print $1}' "$state_file")
      prev_energy=$(awk 'NR==1{print $2}' "$state_file")
      dt=$((now_ts - prev_ts))
      if [ "$dt" -gt 1 ]; then
        # energy_now is in microWh; W = (delta_uWh / 1e6) * (3600 / dt)
        delta=$((energy_now - prev_energy))
        power_w=$(awk -v d="$delta" -v t="$dt" 'BEGIN {printf "%.1f", (d/1000000.0)*(3600.0/t)}')
        # Use absolute value for display.
        power_w=$(awk -v p="$power_w" 'BEGIN {printf "%.1f", (p<0?-p:p)}')
      fi
    fi
    printf "%s %s" "$now_ts" "$energy_now" > "$state_file"
  fi
fi

# Force display even when power is 0 or unknown.
if [ -z "$power_w" ]; then
  power_w="0.0"
fi

# Try to compute capacity with one decimal using energy ratio, if available.
if [ -r "$BAT_PATH/energy_now" ] && [ -r "$BAT_PATH/energy_full" ]; then
  energy_now=$(cat "$BAT_PATH/energy_now" 2>/dev/null || true)
  energy_full=$(cat "$BAT_PATH/energy_full" 2>/dev/null || true)
  if [ -n "$energy_now" ] && [ -n "$energy_full" ] && [ "$energy_full" -gt 0 ]; then
    capacity=$(awk -v n="$energy_now" -v f="$energy_full" 'BEGIN {printf "%.1f", (n*100.0)/f}')
  fi
fi

# Choose base icon based on percentage only (consistent size).
icon_default=("󰁺" "󰁻" "󰁼" "󰁽" "󰁾" "󰁿" "󰂀" "󰂁" "󰂂" "󰁹")

idx=$((capacity_raw / 10))
if [ "$idx" -gt 9 ]; then idx=9; fi

icon="${icon_default[$idx]}"

# Add a small state marker without changing the base icon size.
marker=""
if [ "$status" = "Charging" ]; then
  marker="↑"
elif [ "$status" = "Discharging" ]; then
  marker="↓"
fi

# Gradient from red (#ff0000) to green (#00ff00).
r=$(awk -v c="$capacity_raw" 'BEGIN {printf "%d", 255 - (255 * c / 100)}')
g=$(awk -v c="$capacity_raw" 'BEGIN {printf "%d", 255 * c / 100}')
b=0
color=$(printf "#%02x%02x%02x" "$r" "$g" "$b")

power_line=" ${power_w}W"

# Read Waybar height from config.jsonc if present.
# Fallback to 26 if not found or invalid.
bar_height=26
config_path="$HOME/.config/waybar/config.jsonc"
if [ -r "$config_path" ]; then
  height_val=$(awk -F':' '/"height"/ {gsub(/[^0-9]/, "", $2); if ($2 != "") print $2; exit}' "$config_path")
  if [ -n "$height_val" ]; then
    bar_height="$height_val"
  fi
fi

# Two-line output with sizes derived from bar height.
# Target: 1px top, 1px between lines, 1px bottom.
available_px=$(awk -v h="$bar_height" 'BEGIN {a=h-3; if (a<8) a=8; printf "%.2f", a}')
percent_px=$(awk -v a="$available_px" 'BEGIN {p=a*0.58; if (p<6) p=6; printf "%.2f", p}')
power_px=$(awk -v a="$available_px" -v p="$percent_px" 'BEGIN {w=a-p; if (w<5) w=5; printf "%.2f", w}')
icon_px=$(awk -v w="$power_px" 'BEGIN {i=w*0.95; printf "%.2f", i}')

percent_size=$(awk -v p="$percent_px" 'BEGIN {printf "%d", p*0.75*1024}')
power_size=$(awk -v w="$power_px" 'BEGIN {printf "%d", w*0.75*1024}')
icon_size=$(awk -v i="$icon_px" 'BEGIN {printf "%d", i*0.75*1024}')
line_height="0.80"
rise_units=$((768))  # ~1px in Pango units (0.75pt * 1024)

# Fixed-width slot to reduce visual jitter between icons of different widths.
# Overlay a white arrow inside the battery using modest negative letter spacing.
icon_slot=$(printf "<span size='%s'>%-2s</span>" "$icon_size" "$icon")
marker_slot=""
if [ -n "$marker" ]; then
  marker_size=$(awk -v i="$icon_size" 'BEGIN {printf "%d", i*0.55}')
  marker_rise=$(awk -v i="$icon_size" 'BEGIN {printf "%d", i*0.12}')
  marker_spacing=$(awk -v i="$icon_size" 'BEGIN {printf "%d", i*1.2}')
  marker_slot=$(printf "<span size='%s' foreground='#ffffff' rise='-%s' letter_spacing='-%s'>%s</span>" \
    "$marker_size" "$marker_rise" "$marker_spacing" "$marker")
fi

text="<span size='${percent_size}' foreground='${color}' line_height='${line_height}'>${capacity}%</span>"
text="${text}\n<span foreground='${color}' line_height='${line_height}' rise='-${rise_units}'>${icon_slot}${marker_slot} <span size='${power_size}'>${power_line}</span></span>"

printf '{"text":"%s", "tooltip":"Battery: %s (%s)", "class":"battery"}\n' \
  "$text" "$capacity%" "$status"
