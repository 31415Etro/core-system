"use client"

import type React from "react"
import { useCallback, useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { CommandPalette } from "@/components/core/command-palette"
import { MobileSidebar, Sidebar, SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_WIDTH } from "@/components/core/sidebar"
import { Topbar } from "@/components/core/topbar"
import { invalidateApi } from "@/lib/use-api"

const COLLAPSE_KEY = "core-sidebar-collapsed"

/** Desktop (≥1280px) começa com a sidebar aberta; tablet, recolhida. A escolha do usuário é lembrada. */
function useSidebarState() {
  const [pref, setPref] = useState<boolean | null>(null)
  const [isDesktop, setIsDesktop] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(COLLAPSE_KEY)
      if (saved !== null) setPref(saved === "1")
    } catch {}
    const desktop = window.matchMedia("(min-width: 1280px)")
    const mobile = window.matchMedia("(max-width: 767px)")
    const sync = () => { setIsDesktop(desktop.matches); setIsMobile(mobile.matches) }
    sync()
    desktop.addEventListener("change", sync)
    mobile.addEventListener("change", sync)
    return () => { desktop.removeEventListener("change", sync); mobile.removeEventListener("change", sync) }
  }, [])

  const collapsed = pref ?? !isDesktop
  const toggle = useCallback(() => {
    setPref((p) => {
      const next = !(p ?? !isDesktop)
      try { localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0") } catch {}
      return next
    })
  }, [isDesktop])

  return { collapsed, toggle, isMobile }
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { collapsed, toggle, isMobile } = useSidebarState()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const pathname = usePathname()

  // Cada página parte de dados frescos; o cache só deduplica requisições dentro da mesma tela.
  useEffect(() => { invalidateApi("") }, [pathname])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return
      const key = e.key.toLowerCase()
      if (key === "k") { e.preventDefault(); setPaletteOpen((o) => !o) }
      if (key === "b") { e.preventDefault(); toggle() }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [toggle])

  const offset = isMobile ? 0 : (collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH) + 12

  return (
    <div className="min-h-[100dvh]">
      <a href="#conteudo" className="sr-only z-[60] rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Pular para o conteúdo
      </a>
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <MobileSidebar open={mobileOpen} onOpenChange={setMobileOpen} />
      <div className="transition-[padding] duration-200 ease-out" style={{ paddingLeft: offset }}>
        <Topbar onOpenMenu={() => setMobileOpen(true)} onOpenSearch={() => setPaletteOpen(true)} />
        <main id="conteudo" className="px-4 pb-10 pt-6 md:px-6 md:pt-8">{children}</main>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  )
}
