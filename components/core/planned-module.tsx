"use client"

import { Construction, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { GlassCard } from "@/components/core/glass-card"
import { PageContainer, PageHeader } from "@/components/core/page-header"
import { StatusBadge } from "@/components/core/status-badge"
import { EmptyState } from "@/components/core/states"
import { PageLayout } from "@/components/page-layout"
import { moduleBySlug, PHASES } from "@/lib/modules"

export const phaseLabel = (phase: number | null) => (phase ? `Fase ${phase}` : "Em breve")

/** Botão de ação de um recurso que ainda não existe: visível, mas desabilitado e explicado. */
export function PlannedButton({ label, phase, variant = "default", size }: { label: string; phase: number | null; variant?: "default" | "outline"; size?: "sm" | "default" }) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-flex rounded-[10px] focus-visible:outline-2 focus-visible:outline-ring">
            <Button variant={variant} size={size} disabled aria-disabled="true" className="pointer-events-none">
              <Plus /> {label}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Disponível na {phaseLabel(phase)}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/** Módulo principal em construção: header, ação principal e a estrutura de abas definida. */
export function PlannedModulePage({ slug }: { slug: string }) {
  const mod = moduleBySlug(slug)!
  return (
    <PageLayout>
      <PageContainer>
        <PageHeader
          title={mod.title}
          description={mod.description}
          actions={<>
            <StatusBadge tone="primary">Em construção · {phaseLabel(mod.phase)}</StatusBadge>
            {mod.action && <PlannedButton label={mod.action} phase={mod.phase} />}
          </>}
        />
        <Tabs defaultValue={mod.tabs[0].id}>
          <TabsList>
            {mod.tabs.map((t) => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}
          </TabsList>
          {mod.tabs.map((t) => (
            <TabsContent key={t.id} value={t.id} className="mt-4">
              <GlassCard>
                <EmptyState
                  icon={Construction}
                  title={`${t.label} — ${phaseLabel(mod.phase)}`}
                  description={t.description}
                  className="border-white/[0.06] py-14"
                />
              </GlassCard>
            </TabsContent>
          ))}
        </Tabs>
        {mod.phase && <p className="text-xs text-subtle">Fase {mod.phase}: {PHASES[mod.phase]}.</p>}
      </PageContainer>
    </PageLayout>
  )
}
