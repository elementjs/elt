import { $observe, o, Renderable } from "elt"
import "elt/ui"


// A Conversion strategy is just
export type ConversionStrategies = {
  [id: string]: string // renderable instead to display the names of the strategies ? Because thats what the second part is for
}

export class Factory<Options> {
  constructor(public options: Options) {  }

  // Renderable or a more complex class that lets us hook into their error for validation purposes ? Who handles errors ? Is it the factory itself, since it's going to be queried by the column ? Does "Either" need to know about errors ? (I would think yes)
  render(_: o.Observable<boolean>): RenderableWidget {
    return null
  }

  // UI uses canHandle to present the user with choices
  // Either uses canHandle to pick a matching candidate
  // If returns null ; no conversion is possible to that type.
  canHandle(_: unknown): ConversionStrategies | null {
    return null
  }

  // If this widget is to be forcefully chosen and there are no ConversionStrategies ; what value should it start with
  defaultValue(): unknown {
    return null
  }
  
}

export interface RenderableWidget {
  render(): Renderable

  // The error code the widget is currently in. Those are codes that will be transformed to renderables with some i18n stuff that is still unspecified. In v1 we'll just draw the code
  // Some widgets, like Object/Array will be tasked to display their children's errors in the places they have allocated for them
  // 
  o_error: o.ReadonlyObservable<string | null>
}

export interface EitherOptions {
  options: Factory<unknown>[]
}

export interface UndefinedOptions { }

export interface PropertyOption {
  name?: string | RegExp
  type: Factory<unknown>
  required?: boolean // defaults to true
}

export interface ObjectOptions {
  // unclear : will it be enough to have a list, especially
  properties?: PropertyOption[]
}

export interface ArrayOptions {
  mode: "auto" | "table" | "list"
  values: Factory<unknown>

  allow_insert?: boolean
  allow_delete?: boolean
  allow_reorder?: boolean

}

export interface StringOptions {
  multiline?: boolean
}

export interface NumberOptions {
  maximumFractionDigits?: number
  max?: number
  min?: number
  // step ?
}

export interface DatetimeOptions {
  time?: boolean
  date?: boolean
  nullable?: boolean // will allow the control to clear the date which will put it to null
}

export const null_factory = new class NullFactory extends Factory<{}> { } ({})
export const oo_no_error = o(null as string | null)

// necessary to do recursion.
export function forward<O>(fn: () => Factory<O>): Factory<O> {
  let factory: null | Factory<O>
  return {} // factory shaped object where all methods get replaced once called for the first time without forgetting to return the result of the proxied object }

export type FactoryOptions<Fact> = Fact extends Factory<infer Opts> ? Opts : never

export class ObjectFactory extends Factory<ObjectOptions> {
}

export function object(opts: ObjectOptions = {
  properties: []
}) {
  return new ObjectFactory(opts)
}

export class EitherFactory extends Factory<EitherOptions> {

  // The currently selected factory
  o_current_factory = o(null_factory)
  o_error = o.proxy(this.o_current_factory.p("o_error"))
  
  render(o_value: o.Observable<unknown>) {
    return <e-flex>
      {$observe(o_value, (val, old) => {
        if (old !== o.NoValue && is_same_type(val, old)) {
          return
        }
        // if val has changed type, we need to check the different options to know what to render next
        // we will typically recreate a new factory that will the go to this.o_current_factory
        
      })}
    </e-flex>
  }
}

export class ArrayFactory extends Factory<ArrayOptions> {

  o_show_table = o(false)

  // Renders either a table or a list of items, based
  render(o_value: o.Observable<unknown>) {
    if (this.options.mode !== "list") {
      // maybe we could also verify that this.options.values allows objects, no real point of evaling a table
      this.evalAutoTable(o_value.get())
    }
    return <e-flex>
      {/* todo: If() to either show the table or do a list */}
    </e-flex>
  }

  evalAutoTable(values: unknown) {
    // scan the first rows to see if they're objects with the same properties
  }
  
}

//////////////// Functions instantiators

export function either(opts: FactoryOptions<EitherFactory>) {
  // Either returns a factory that creates a parent widget that continuously scans for the type of the object to change its widget if it doesn't fit the current factory anymore.
  return new EitherFactory(opts)
}

export function array(): Factory {

}

export function string(): Factory {

}

export function number(): Factory {

}

export function boolean(): Factory {
  return {
    canHandle() {
      return {"": ""}
    }
  }
}

export function nullLiteral(): Factory { }

const any_rec = forward(() => anything)
export const anything: Factory = either(
  object({ properties: [] }),
  array({ values: any_rec }),

  boolean(),
  color(),
  date(),
  string(),
  number(),
  nullLiteral(),
)
