
import { _encode, type ServiceParams } from "./params"
import { type ServiceBuilder } from "./service"
import { type RouteOptions } from "./app"
import { type Router } from "./router"

export class Route<T extends ServiceParams = {}> {
    error?: Route<any>

    constructor(
      public router: Router,
      public name: string,
      public path: string | null,
      public builder: () => ServiceBuilder<any, T>,
      public options: RouteOptions = {}
    ) {
      if (path != null) {
        let def = path.replace(/:[a-zA-Z_$0-9]+\b/g, (rep) => {
          return `(?<${rep.slice(1)}>[^\b]+)`
        })
        this.regexp = new RegExp("^" + def + "$")
      }
    }

    url() {
      return `${window.location.origin}${window.location.pathname}#${this.path}`
    }

    urlFor(params: T) {
      const pr = {...params}
      const replaced = this.path?.replace(/:[a-zA-Z_$0-9]+\b/g, rep => {
        const res = _encode(pr[rep.slice(1)])
        delete pr[rep.slice(1)]
        return res
      })
      const query_part = Object.entries(pr).map(([key, value]) => `${key}=${_encode(value)}`).join("&")
      return `${window.location.origin}${window.location.pathname}#${replaced}${query_part.length > 0 ? "?" + query_part : ""}`
    }

    regexp: RegExp | null = null

    updateHash(keys: Set<string>, params: ServiceParams) {
      // Do not update the hash if this route is silent.
      if (this.options.silent) {
        return
      }

      this.router.__hash_lock(() => {
        let hash = this.path
        if (typeof hash !== "string") return

        const entries: string[] = []

        for (let key of keys) {
          if (params[key] === undefined) {
            continue
          }
          const value = _encode(params[key])

          let re = new RegExp(":" + key + "\\b")
          if (re.test(hash)) {
            // replace the variable in the hash
            hash = hash.replace(re, value)
          } else {
            entries.push(
              `${encodeURIComponent(key)}${
                !value ? "" : "=" + encodeURIComponent(value)
              }`
            )
          }
        }

        hash = hash.replace(/:[a-zA-Z0-9_$]+\b/g, "~u")
        if (hash.includes("~u")) {
          throw new Error("service params had an undefined value")
        }

        // if there are variables, add them
        if (entries.length > 0) {
          hash = hash + "?" + entries.join("&")
        }

        if (hash.trim() === document.location.hash.slice(1).trim()) {
          return
        }

        if (window.location.hash !== hash) {
          window.location.hash = hash
          this.router._last_hash = hash
        }
      })
    }

    async _activateWithParams(params: T): Promise<void> {
      const full_params = Object.assign({}, this.options.defaults, params)
      this.router.__last_activated_route = this
      try {
        await this.router.app._activate(this.builder(), full_params)
        this.router.app.o_current_route.set(this)
        this.router.o_active_route.set(this)
      } catch (e) {
        if (this.error) {
          await this.error.activate({ __error__: e })
        } else {
          console.error(e)
          throw e
        }
      }
    }

    async activateWithParams(params: T): Promise<void> {
      const full_params = Object.assign({}, this.options.defaults, params)
      const current_route = this.router.o_active_route.get()
      if (current_route === this) {
        const current_service = this.router.app.o_active_service.get()

        // Do not reactivate if the params are not invalidating and just set them on the application.
        if (!current_service?.areParamsInvalidating(full_params as any)) {
          this.router.app.o_params.set(full_params)
          return
        }
      }


      return this._activateWithParams(params)
    }

    async activate(..._params: {} extends T ? [] | [T] : [T]): Promise<void> {
      const params: T = Object.assign(
        {},
        this.router.app.o_params.get(),
        _params[0] as T
      )

      return this.activateWithParams(params)
    }
  }
