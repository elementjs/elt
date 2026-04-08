
export function stop_animations(node: Element) {
  return Promise.all(
    node.getAnimations().map(animation => {
      return new Promise(resolve => {
        const handleAnimationEvent = requestAnimationFrame(resolve);

        animation.addEventListener('cancel', () => handleAnimationEvent, { once: true });
        animation.addEventListener('finish', () => handleAnimationEvent, { once: true });
        animation.cancel();
      })
    })
  )
}

/** Tells if the user has enabled the "reduced motion" setting in their browser or OS. */
export function prefers_reduced_motion() {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  return query.matches;
}

export function animate(el: HTMLElement, keyframes: Keyframe[], options?: KeyframeAnimationOptions) {
  return new Promise(resolve => {
    if (options?.duration === Infinity) {
      throw new Error('Promise-based animations must be finite.');
    }

    const animation = el.animate(keyframes, {
      ...options,
      duration: prefers_reduced_motion() ? 0 : options!.duration
    })

    animation.addEventListener('cancel', resolve, { once: true });
    animation.addEventListener('finish', resolve, { once: true });
  })
}


export const animate_show: Keyframe[] = [
  { opacity: 0, scale: 0.6, },
  { opacity: 1, scale: 1 }
]

export const animate_hide: Keyframe[] = [
  { opacity: 1, scale: 1 },
  { opacity: 0, scale: 0.6 }
]