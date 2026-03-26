import { useEffect, useState } from 'react'

/**
 * Debounces a value by the given delay (ms).
 * Use for search inputs to avoid firing a request on every keystroke.
 */
export function useDebounce<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])

  return debounced
}
