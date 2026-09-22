import { $bind, $click, $observe, $on, $scrollable, App, css, o, tf_equals, view, Service } from "elt"
import { animate, popup, theme } from "elt/ui"
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

  o_drawer_open = o(false)

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
      <P.TextAa /> {this.o_font_style.tf(ft => ft.fontFamily)} <P.CaretDown/>
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

  NavDrawer() {
    return <dialog id="main-nav-drawer" class={cls_nav_drawer} aria-label="Main navigation">
      {$observe(this.o_drawer_open, async (open, old, dialog: HTMLDialogElement) => {
        if (old === o.NoValue) return
        if (open) {
          dialog.showModal()
          await animate(dialog, drawer_show, { duration: 200 })
        } else {
          await animate(dialog, drawer_hide, { duration: 200 })
          dialog.close()
        }
      })}
      {/* Escape closes natively and instantly by default — intercept it so the close still animates,
          matching how ui/dialog.tsx handles the same native "cancel" event. */}
      {$on("cancel", (ev) => {
        ev.preventDefault()
        this.o_drawer_open.set(false)
      })}
      {$on("click", (ev) => {
        const rect = (ev.currentTarget as HTMLDialogElement).getBoundingClientRect()
        const clicked_backdrop = ev.clientX < rect.left || ev.clientX > rect.right || ev.clientY < rect.top || ev.clientY > rect.bottom
        if (clicked_backdrop) this.o_drawer_open.set(false)
      })}
      {$observe(app.o_current_route, () => {
        if (this.o_drawer_open.get()) this.o_drawer_open.set(false)
      })}
      <e-column touching="component" pad="component" align="stretch" class={cls_menu_items}>
        {widget_menu()}
      </e-column>
    </dialog>
  }

  @view
  Main() {
    return <e-column class={[cls_fullscreen]} style={this.oo_style}>
      <header class={cls_mobile_bar}>
        <button aria-label="Open navigation menu" aria-expanded={this.o_drawer_open.tf(String)} aria-controls="main-nav-drawer">
          {$click(() => this.o_drawer_open.set(true))}
          <P.List />
        </button>
      </header>
      <e-row grow class={cls_main} align="stretch">
        <nav class={cls_aside_nav} aria-label="Main navigation">
          {$scrollable}
          <e-column touching="component" pad="component" align="stretch" class={cls_menu_items}>
            {widget_menu()}
          </e-column>
        </nav>
        <e-column grow>
          {$scrollable}
          {this.srv.DisplayView("Content")}
        </e-column>
      </e-row>
      {this.NavDrawer()}
    </e-column>
  }

}

const cls_nav_drawer = css`.nav-drawer {
  position: fixed;
  inset: 0;
  margin: 0;
  width: 240px;
  max-width: 80vw;
  height: 100%;
  max-height: 100%;
  border: none;
  border-right: 1px solid ${theme.colors.text.mid};
  /* Overrides ui/dialog.tsx's global dialog { border-radius: ... } — a panel flush against the
     top/left/bottom edges of the viewport shouldn't round any of the corners actually touching it. */
  border-radius: 0;
  background: var(--e-color-bg);
  padding: 0;

  &::backdrop {
    background: rgba(0, 0, 0, 0.4);
  }

  @media (min-width: 769px) {
    display: none;
  }
}`

const drawer_show: Keyframe[] = [{ transform: "translateX(-100%)" }, { transform: "translateX(0)" }]
const drawer_hide: Keyframe[] = [{ transform: "translateX(0)" }, { transform: "translateX(-100%)" }]

/* Shared by the desktop sidebar (.aside_nav) and the mobile drawer (.nav-drawer) — both render the
   same widget_menu() content and must look identical, not just structurally similar. */
const cls_menu_items = css`.menu-items {
  & button {
    border: none;
    text-align: start;
  }

  & h3 {
    margin: 0;
    font-size: 0.6em;
    font-weight: bold;
    color: ${theme.colors.text.faded};
  }
}`

const cls_aside_nav = css`.aside_nav {
  width: 240px;
  border-right: 1px solid ${theme.colors.text.mid};

  @media (max-width: 768px) {
    display: none;
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

const cls_mobile_bar = css`.mobile-bar {
  display: none;
  width: 100%;

  @media (max-width: 768px) {
    display: flex;
  }
}`
