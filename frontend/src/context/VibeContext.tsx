import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'

type Vibe = 'professional' | 'fun'

interface VibeContextType {
  vibe: Vibe
  setVibe: (v: Vibe) => void
}

const VibeContext = createContext<VibeContextType | null>(null)

export function VibeProvider({ children }: { children: ReactNode }) {
  const [vibe, setVibeState] = useState<Vibe>(() => {
    const param = new URLSearchParams(window.location.search).get('vibe')
    if (param === 'fun' || param === 'professional') return param
    return (localStorage.getItem('vibe') as Vibe) || 'professional'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-vibe', vibe)
    localStorage.setItem('vibe', vibe)
  }, [vibe])

  return (
    <VibeContext.Provider value={{ vibe, setVibe: setVibeState }}>
      {children}
    </VibeContext.Provider>
  )
}

export function useVibe() {
  const ctx = useContext(VibeContext)
  if (!ctx) throw new Error('useVibe must be used within VibeProvider')
  return ctx
}
