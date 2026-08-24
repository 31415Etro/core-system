import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { Suspense } from "react"
import { AuthProvider } from "@/lib/auth-context"
import { Toaster } from "@/components/ui/toaster"
import { TextNormalizer } from "@/components/text-normalizer"

export const metadata: Metadata = {
  title: "Gênes Group | Sistema de Gestão",
  description: "Sistema interno de gestão de tarefas, chamados, clientes e financeiro",
  generator: "v0.app",
  other: {
    google: "notranslate",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" translate="no" className="notranslate">
      <body className={`notranslate font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased`} translate="no">
        <AuthProvider>
          <div className="app-bg" />
          <Suspense fallback={null}>{children}</Suspense>
          <Toaster />
          <TextNormalizer />
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
