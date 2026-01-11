import App from 'resource:///com/github/Aylur/ags/app.js';
import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import GLib from 'gi://GLib';

const UPDATE_MS = 10000;
const ICONS = ["󰁺", "󰁻", "󰁼", "󰁽", "󰁾", "󰁿", "󰂀", "󰂁", "󰂂", "󰁹"];

const ByteArray = imports.byteArray;
let batteryPath = null;
let lastEnergy = null;
let lastTs = null;

function readFile(path) {
  try {
    const [ok, contents] = GLib.file_get_contents(path);
    if (!ok) return null;
    return ByteArray.toString(contents).trim();
  } catch (_) {
    return null;
  }
}

function readNumber(path) {
  const text = readFile(path);
  if (text === null || text === '') return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function findBatteryPath() {
  try {
    const dir = GLib.Dir.open('/sys/class/power_supply', 0);
    let name;
    while ((name = dir.read_name()) !== null) {
      if (name.startsWith('BAT')) {
        dir.close();
        return `/sys/class/power_supply/${name}`;
      }
    }
    dir.close();
  } catch (_) {}
  return null;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hue2rgb(p, q, t) {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

function hslToRgb(h, s, l) {
  const hh = h / 360;
  const ss = s / 100;
  const ll = l / 100;
  if (ss === 0) {
    const v = Math.round(ll * 255);
    return [v, v, v];
  }
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  const r = hue2rgb(p, q, hh + 1 / 3);
  const g = hue2rgb(p, q, hh);
  const b = hue2rgb(p, q, hh - 1 / 3);
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function toHex(value) {
  return value.toString(16).padStart(2, '0');
}

function gradientColor(capacity) {
  const c = Math.max(0, Math.min(100, capacity));
  let h;
  let s;
  let l;
  if (c >= 75) {
    const t = (c - 75) / 25;
    h = lerp(102, 45, t);
    s = lerp(38, 100, t);
    l = lerp(63, 70, t);
  } else if (c >= 50) {
    const t = (c - 50) / 25;
    h = lerp(45, 31, t);
    s = lerp(100, 89, t);
    l = lerp(70, 69, t);
  } else if (c >= 25) {
    const t = (c - 25) / 25;
    h = lerp(31, 0, t);
    s = lerp(89, 66, t);
    l = lerp(69, 64, t);
  } else {
    h = 0;
    s = 66;
    l = 64;
  }
  const [r, g, b] = hslToRgb(h, s, l);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function iconFor(capacity) {
  const idx = Math.min(9, Math.max(0, Math.floor(capacity / 10)));
  return ICONS[idx];
}

function BatteryWidget() {
  const percent = Widget.Label({ class_name: 'battery-percent' });
  const icon = Widget.Label({ class_name: 'battery-icon' });
  const marker = Widget.Label({ class_name: 'battery-marker' });
  const power = Widget.Label({ class_name: 'battery-power' });

  const iconBox = Widget.Box({
    class_name: 'battery-icon-box',
    spacing: 2,
    children: [icon, marker],
  });

  const line = Widget.Box({
    class_name: 'battery-line',
    spacing: 6,
    children: [iconBox, power],
  });

  const box = Widget.Box({
    class_name: 'battery',
    vertical: true,
    spacing: 2,
    children: [percent, line],
  });

  function update() {
    if (!batteryPath || !GLib.file_test(batteryPath, GLib.FileTest.IS_DIR)) {
      batteryPath = findBatteryPath();
    }

    if (!batteryPath) {
      percent.label = '';
      icon.label = '';
      marker.label = '';
      marker.visible = false;
      power.label = '';
      box.tooltip_text = 'No battery found';
      return true;
    }

    const capacityRaw = readNumber(`${batteryPath}/capacity`);
    let capacityDisplay = capacityRaw !== null ? `${capacityRaw}` : '0';

    const energyNow = readNumber(`${batteryPath}/energy_now`);
    const energyFull = readNumber(`${batteryPath}/energy_full`);
    let capacityForColor = capacityRaw !== null ? capacityRaw : 0;

    if (energyNow !== null && energyFull !== null && energyFull > 0) {
      const capacity = (energyNow * 100) / energyFull;
      capacityDisplay = capacity.toFixed(1);
      capacityForColor = capacityRaw !== null ? capacityRaw : Math.round(capacity);
    }

    const status = readFile(`${batteryPath}/status`) || 'Unknown';

    let powerW = null;
    const powerRaw = readNumber(`${batteryPath}/power_now`);
    if (powerRaw !== null) {
      powerW = powerRaw / 1000000;
    } else {
      const currentRaw = readNumber(`${batteryPath}/current_now`);
      const voltageRaw = readNumber(`${batteryPath}/voltage_now`);
      if (currentRaw !== null && voltageRaw !== null) {
        powerW = (currentRaw * voltageRaw) / 1000000000000;
      }
    }

    if (powerW === null && energyNow !== null) {
      const nowTs = Math.floor(Date.now() / 1000);
      if (lastEnergy !== null && lastTs !== null) {
        const dt = nowTs - lastTs;
        if (dt > 1) {
          const delta = energyNow - lastEnergy;
          powerW = Math.abs((delta / 1000000) * (3600 / dt));
        }
      }
      lastEnergy = energyNow;
      lastTs = nowTs;
    }

    if (powerW === null || !Number.isFinite(powerW)) {
      powerW = 0;
    }

    const color = gradientColor(capacityForColor);
    const colorCss = `color: ${color};`;

    percent.label = `${capacityDisplay}%`;
    icon.label = iconFor(capacityForColor);
    power.label = `${powerW.toFixed(1)}W`;

    if (status === 'Charging') {
      marker.label = '↑';
      marker.visible = true;
    } else if (status === 'Discharging') {
      marker.label = '↓';
      marker.visible = true;
    } else {
      marker.label = '';
      marker.visible = false;
    }

    percent.css = colorCss;
    icon.css = colorCss;
    power.css = colorCss;
    box.tooltip_text = `Battery: ${capacityDisplay}% (${status})`;
    return true;
  }

  update();
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, UPDATE_MS, update);
  return box;
}

const batteryWindow = Widget.Window({
  name: 'battery-preview',
  class_name: 'battery-window',
  anchor: ['top', 'right'],
  margins: [12, 12, 0, 0],
  layer: 'top',
  exclusivity: 'ignore',
  child: BatteryWidget(),
});

App.config({
  style: `${App.configDir}/style.css`,
  windows: [batteryWindow],
});
