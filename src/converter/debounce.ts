export function createDebounced<T extends unknown[]>(
  fn: (...args: T) => void,
  delay: number
): { call: (...args: T) => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null

  return {
    call(...args: T) {
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        fn(...args)
      }, delay)
    },
    cancel() {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    },
  }
}
