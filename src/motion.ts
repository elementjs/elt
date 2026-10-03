/**
 * Enter and leave motions: what `$enter` / `$leave` play, built on the protocol of `node_on_enter` /
 * `node_on_leave` (dom.ts). Documentation: docs/md/motion.md.
 */
import { motion_is_enabled, node_on_enter, node_on_leave, type EnterOptions, type LeaveOptions } from "./dom"
import type { Decorator } from "./types"

/**
 * A motion described as data: what presets are.
 *
 * @group Motion
 */
export interface MotionSpec {
  keyframes: Keyframe[]
  /** In milliseconds. Defaults to the duration of {@link motion_defaults} for the same direction. */
  duration?: number
  /** Any CSS easing function. Defaults to the easing of {@link motion_defaults} for the same direction. */
  easing?: string
  /**
   * The keyframes played when motion is reduced ; `null` for none (instant). When absent, `keyframes`
   * are played without their movement properties (see {@link motion_reduced}).
   */
  reduced?: Keyframe[] | null
}

/**
 * What `$enter` / `$leave` play: keyframes (with the default duration and easing), a {@link MotionSpec},
 * or a function. For `$leave`, a function returning a promise keeps the node in the page until it
 * settles ; returning nothing removes it at once. For `$enter`, its result is ignored.
 *
 * @group Motion
 */
export type Motion = Keyframe[] | MotionSpec | ((node: Element) => PromiseLike<unknown> | void)

/**
 * What `$enter()` / `$leave()` play without argument, and the duration and easing used by keyframes or
 * specs that don't give theirs. `elt/ui`'s theme replaces them with its tokens.
 *
 * The leave keyframes have no starting keyframe: the exit starts from the node's current opacity, which
 * matters when it leaves while still entering.
 *
 * @group Motion
 */
export const motion_defaults: {
  enter: Required<Omit<MotionSpec, "reduced">>
  leave: Required<Omit<MotionSpec, "reduced">>
} = {
  enter: { keyframes: [{ opacity: 0 }, { opacity: 1 }], duration: 120, easing: "ease-out" },
  leave: { keyframes: [{ opacity: 0 }], duration: 120, easing: "ease-out" },
}

let _reduced: boolean | null = null
let _reduced_query: MediaQueryList | null = null

/**
 * Force reduced motion on (`true`) or off (`false`), or follow the user's setting (`null`, the default:
 * the `prefers-reduced-motion` media query).
 *
 * Under reduced motion, a spec's `reduced` keyframes are played instead of its keyframes ; without
 * them, keyframes are played without their movement properties (`transform`, `translate`, `rotate`,
 * `scale`, `offset*`), and the motion is instant when nothing is left. Fades stay. Functions are
 * called as usual: they decide for themselves.
 *
 * @group Motion
 */
export function motion_reduced(reduced: boolean | null) {
  _reduced = reduced
}

/** Whether motion is currently reduced. @group Motion */
export function motion_is_reduced(): boolean {
  if (_reduced != null) return _reduced
  _reduced_query ??= window.matchMedia("(prefers-reduced-motion: reduce)")
  return _reduced_query.matches
}

/** Keyframe properties that move things, dropped under reduced motion. */
const MOVEMENT = new Set(["transform", "translate", "rotate", "scale", "offsetPath", "offsetDistance", "offsetRotate"])
/** Keyframe keys that are not animated properties. */
const NOT_ANIMATED = new Set(["offset", "easing", "composite"])

/** `keyframes` without their movement properties, or `null` if nothing animated is left. */
function without_movement(keyframes: Keyframe[]): Keyframe[] | null {
  let animated = false
  const out = keyframes.map((kf) => {
    const res: Keyframe = {}
    for (const key in kf) {
      if (MOVEMENT.has(key)) continue
      res[key] = kf[key]
      if (!NOT_ANIMATED.has(key)) animated = true
    }
    return res
  })
  return animated ? out : null
}

/** The animation to play for a keyframes / spec motion, or `null` when it is reduced to nothing. */
function resolve(motion: Keyframe[] | MotionSpec | undefined, dir: "enter" | "leave") {
  const def = motion_defaults[dir]
  const spec: MotionSpec = motion == null ? def : Array.isArray(motion) ? { keyframes: motion } : motion
  let keyframes: Keyframe[] | null = spec.keyframes
  if (motion_is_reduced()) keyframes = spec.reduced !== undefined ? spec.reduced : without_movement(spec.keyframes)
  if (keyframes == null || keyframes.length === 0) return null
  return { keyframes, duration: spec.duration ?? def.duration, easing: spec.easing ?? def.easing }
}

/**
 * Start `motion` on `node`, or return `null` when it is reduced to nothing. An exit that would never
 * end (an infinite duration) plays nothing: its node would never be removed.
 */
function play(
  node: Element,
  motion: Keyframe[] | MotionSpec | undefined,
  dir: "enter" | "leave",
  opts?: { pseudoElement?: string; fill?: FillMode },
): Animation | null {
  const r = resolve(motion, dir)
  if (r == null) return null
  const a = node.animate(r.keyframes, { duration: r.duration, easing: r.easing, ...opts })
  if (dir === "leave" && a.effect?.getComputedTiming().endTime === Infinity) {
    a.cancel()
    console.warn("an exit motion must end: it was not played, the node goes at once", node)
    return null
  }
  return a
}

/** Settles when `a` finishes or is cancelled (the browser restarting it, a cut). */
function done(a: Animation | null): Promise<void> {
  if (a == null) return Promise.resolve()
  return a.finished.then(
    () => {},
    () => {},
  )
}

/**
 * Play `motion` on `node` now, following the same rules as `$enter` / `$leave`: nothing while motion is
 * off ({@link motion_enabled}), reduced motion ({@link motion_reduced}), and the duration and easing of
 * {@link motion_defaults} (`opts.dir`, `"enter"` by default) when the motion has none. Settles when
 * done, or at once when nothing plays.
 *
 * For what `$enter` / `$leave` can't express: a pseudo-element (`opts.pseudoElement`), or several
 * animations in a leave function.
 *
 * @group Motion
 */
export function animate(
  node: Element,
  motion: Keyframe[] | MotionSpec,
  opts?: { dir?: "enter" | "leave"; pseudoElement?: string; fill?: FillMode },
): Promise<void> {
  if (!motion_is_enabled()) return Promise.resolve()
  const { dir = "enter", ...rest } = opts ?? {}
  return done(play(node, motion, dir, rest))
}

/** Enter animations still running, cancelled when their node starts leaving. */
const _entering = new WeakMap<Element, Animation>()

/**
 * Stop the enter animation of `node`, keeping the node where the animation had brought it: a leave
 * motion without a starting keyframe then continues from there.
 */
function stop_entering(node: Element) {
  const a = _entering.get(node)
  if (a == null) return
  _entering.delete(node)
  if (a.playState !== "running") return
  try {
    a.commitStyles()
  } catch {
    // not rendered: nothing to keep
  }
  a.cancel()
}

/**
 * Play `motion` when the node enters the page with an update of its verb (see {@link node_on_enter}):
 * the update inserts it or an ancestor of it ; not on a verb's first render, nor on moves.
 * `opts.always`: on every connection. Without `motion`, {@link motion_defaults}.enter.
 *
 * @group Motion
 */
export function $enter<N extends Element>(motion?: Motion, opts?: EnterOptions): Decorator<N> {
  return (node: N) => {
    node_on_enter(
      node,
      (n) => {
        if (typeof motion === "function") return motion(n)
        const a = play(n, motion, "enter")
        if (a == null) return
        _entering.set(n, a)
        // The node may have left meanwhile (its entry cancelled): only forget our own animation.
        done(a).then(() => {
          if (_entering.get(n) === a) _entering.delete(n)
        })
      },
      opts,
    )
  }
}

/**
 * Play `motion` when the node leaves the page with an update of its verb (see {@link node_on_leave}):
 * it stays in the page, disconnected and out of the layout (unless `opts.flow`), until its motion and
 * its descendants' are done. Without `motion`, {@link motion_defaults}.leave ; with `null`, no motion
 * of its own: it waits for its descendants' exits.
 *
 * @group Motion
 */
export function $leave<N extends Element>(motion?: Motion | null, opts?: LeaveOptions): Decorator<N> {
  return (node: N) => {
    node_on_leave(
      node,
      (n) => {
        stop_entering(n)
        if (motion === null) return
        if (typeof motion === "function") return motion(n)
        // forwards: the node must not flash back to its natural style before it is removed
        const a = play(n, motion, "leave", { fill: "forwards" })
        return a == null ? undefined : done(a)
      },
      opts,
    )
  }
}
