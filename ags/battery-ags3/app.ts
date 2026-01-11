import app from "ags/gtk3/app"
import style from "./style.scss"
import Battery from "./widget/Battery"

app.start({
  css: style,
  main() {
    const monitors = app.get_monitors()
    if (monitors.length === 0) return
    Battery(monitors[0])
  },
})
