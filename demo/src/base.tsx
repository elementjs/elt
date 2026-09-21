import { $bind, $click, $scrollable, App, css, o, tf_equals, view, Service } from "elt"
import { popup, theme } from "elt/ui"
import * as P from "elt-phosphor"

import { app, route_names, widget_menu } from "./routes"

export type FontStyle = {
  fontFamily: string,
  fontWeight?: string,
  letterSpacing?: string,
}

export default class Base extends Service({}) {

  fonts = {
    cantarell: { fontFamily: "Cantarell", fontWeight: "400", },
    inter: { fontFamily: "Inter", fontWeight: "400" },
    google_sans: { fontFamily: "Google Sans", fontWeight: "400" },
    open_sans: { fontFamily: "Open Sans", fontWeight: "400" },
    noto_sans: { fontFamily: "Noto Sans", fontWeight: "400" },
    roboto: { fontFamily: "Roboto", fontWeight: "400" },
    public_sans: { fontFamily: "Public Sans", fontWeight: "400" },
    ubuntu: { fontFamily: "Ubuntu", fontWeight: "400" },
    deja_vu_sans: { fontFamily: "DejaVu Sans", fontWeight: "400" },
    ibm_plex_sans: { fontFamily: "IBM Plex Sans", fontWeight: "400" },
    segoe_ui: { fontFamily: "Segoe UI", fontWeight: "400" },
    sf_pro: { fontFamily: "SF Pro", fontWeight: "400" },
  } satisfies Record<string, FontStyle>


  o_font_style = o(this.fonts.public_sans as FontStyle)

  oo_style = o.expression(get => {
    const ft = get(this.o_font_style)
    return {
      ...ft,
      fontWeight: ft.fontWeight ?? "400",
      letterSpacing: ft.letterSpacing ?? undefined,
      fontFamily: `"${ft.fontFamily}", system-ui`,
    }
  })

  DisplayTitle() {
    return app.o_current_route.tf(act => {
      if (!act) return null
      const label = route_names.get(act)
      if (!label) return null
      return <h1>{label}</h1>
    })
  }

  FontChooser = () => {
    return <button>
      <P.TextAa /> {this.o_font_style.tf(ft => ft.fontFamily)}
      {$click(ev => {
        const btn = (font: keyof typeof this.fonts) => {
          const tfed = this.o_font_style.tf(tf_equals(this.fonts[font]))
          return <label style={font}><input type="checkbox">{$bind.boolean(tfed)}</input> {this.fonts[font].fontFamily}</label>
        }
        popup(ev.currentTarget, fut =>
          <e-row>
            <e-column pad="component">
              <label><P.WindowsLogo /> Windows</label>
              {btn("segoe_ui")}
              <hr />
              <label><P.AppleLogo /> MacOS</label>
              {btn("sf_pro")}
              <hr />
              <label><P.GoogleLogo /> Google</label>
              {btn("google_sans")}
              {btn("open_sans")}
              {btn("noto_sans")}
              {btn("roboto")}
            </e-column><e-column pad="component">
              <label><P.LinuxLogo /> Linux</label>
              {btn("inter")}
              {btn("cantarell")}
              {btn("ubuntu")}
              {btn("deja_vu_sans")}
              <label>Other</label>
              {btn("ibm_plex_sans")}
              {btn("public_sans")}
            </e-column>


          </e-row>
          , { arrow: true })
      })}
    </button>
  }

  @view
  Main() {
    return <e-column class={[cls_fullscreen]} style={this.oo_style}>
      <e-row grow class={cls_main} align="stretch">
        <nav class={cls_aside_nav} aria-label="Main navigation">
          {$scrollable}
          <e-column touching="component" align="stretch">
            {widget_menu()}
          </e-column>
        </nav>
        <e-column grow>
          {$scrollable}
          {this.srv.DisplayView("Content")}
        </e-column>
      </e-row>
    </e-column>
  }

}

const cls_aside_nav = css`.aside_nav {
  width: 240px;
  border-right: 1px solid ${theme.colors.text.mid};

  & button {
    border: none;
    text-align: start;
  }

  & h3 {
    margin: 0;
    font-size: 0.875em;
    font-weight: bold;
    color: ${theme.colors.text.faded};
  }

  & hr {
    margin: 0;
  }
}`

const cls_main = css`.main {
  height: 100%;
  overflow: hidden;
}`

const cls_fullscreen = css`.fullscreen {
  width: 100%;
  height: 100%;
}`

const cls_header = css`.header {
  display: flex;
  width: 100%;
}`
