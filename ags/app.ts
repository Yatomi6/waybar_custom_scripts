import app from "ags/gtk3/app"
import style from "./style.scss"
import Bar from "./widget/Bar"

app.start({
  css: style,
  main() {
    const monitors = app.get_monitors()
    if (monitors.length === 0) return
    monitors.forEach(Bar)
  },
})
