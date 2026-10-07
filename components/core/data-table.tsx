"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Columns3, Download, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState, TableSkeleton } from "@/components/core/states"
import { cn } from "@/lib/utils"

export type DataTableColumn<T> = {
  id: string
  header: string
  cell: (row: T) => React.ReactNode
  /** Valor usado para ordenação e exportação. Sem ele a coluna não ordena. */
  value?: (row: T) => string | number | null | undefined
  align?: "left" | "right"
  className?: string
  /** Começa oculta (pode ser exibida pelo menu de colunas). */
  hidden?: boolean
}

type DataTableProps<T> = {
  data: T[]
  columns: DataTableColumn<T>[]
  getRowId: (row: T) => string
  loading?: boolean
  searchPlaceholder?: string
  /** Texto pesquisável da linha. Sem ele a busca não aparece. */
  searchText?: (row: T) => string
  /** Filtros extras renderizados ao lado da busca. */
  toolbar?: React.ReactNode
  pageSize?: number
  selectable?: boolean
  bulkActions?: (selected: T[], clear: () => void) => React.ReactNode
  rowActions?: (row: T) => React.ReactNode
  onRowClick?: (row: T) => void
  exportFileName?: string
  empty?: { title: string; description?: string; action?: React.ReactNode }
  className?: string
  /** Remove a moldura de vidro (quando já está dentro de um card). */
  bare?: boolean
}

function toCsv<T>(rows: T[], columns: DataTableColumn<T>[]) {
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`
  const cols = columns.filter((c) => c.value)
  return [cols.map((c) => escape(c.header)).join(";"), ...rows.map((r) => cols.map((c) => escape(c.value!(r))).join(";"))].join("\n")
}

export function DataTable<T>({
  data,
  columns,
  getRowId,
  loading,
  searchPlaceholder = "Buscar...",
  searchText,
  toolbar,
  pageSize = 10,
  selectable,
  bulkActions,
  rowActions,
  onRowClick,
  exportFileName,
  empty = { title: "Nenhum registro encontrado" },
  className,
  bare,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<{ id: string; dir: "asc" | "desc" } | null>(null)
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(columns.filter((c) => c.hidden).map((c) => c.id)))

  const visibleColumns = columns.filter((c) => !hidden.has(c.id))

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR")
    let rows = q && searchText ? data.filter((r) => searchText(r).toLocaleLowerCase("pt-BR").includes(q)) : data
    const col = sort && columns.find((c) => c.id === sort.id)
    if (col?.value) {
      const factor = sort!.dir === "asc" ? 1 : -1
      rows = [...rows].sort((a, b) => {
        const va = col.value!(a), vb = col.value!(b)
        if (va == null) return 1
        if (vb == null) return -1
        return (typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR")) * factor
      })
    }
    return rows
  }, [data, query, searchText, sort, columns])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  useEffect(() => { if (page > pageCount - 1) setPage(0) }, [page, pageCount])
  const pageRows = filtered.slice(page * pageSize, page * pageSize + pageSize)

  const selectedRows = data.filter((r) => selected.has(getRowId(r)))
  const allOnPage = pageRows.length > 0 && pageRows.every((r) => selected.has(getRowId(r)))
  const clear = () => setSelected(new Set())

  function toggleSort(id: string) {
    setSort((s) => (s?.id !== id ? { id, dir: "asc" } : s.dir === "asc" ? { id, dir: "desc" } : null))
  }

  function exportCsv() {
    const blob = new Blob(["﻿" + toCsv(filtered, visibleColumns)], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${exportFileName}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const showToolbar = searchText || toolbar || exportFileName || columns.length > 4

  return (
    <div className={cn(!bare && "glass overflow-hidden rounded-[20px]", className)}>
      {showToolbar && (
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
          {searchText && (
            <div className="relative w-full lg:max-w-xs">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
              <Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(0) }} placeholder={searchPlaceholder} aria-label={searchPlaceholder} className="h-10 pl-10" />
            </div>
          )}
          {toolbar && <div className="flex flex-1 flex-wrap items-center gap-2">{toolbar}</div>}
          <div className="flex items-center gap-2 lg:ml-auto">
            {columns.length > 4 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10"><Columns3 /> Colunas</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="text-xs text-subtle">Colunas visíveis</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {columns.map((c) => (
                    <DropdownMenuCheckboxItem
                      key={c.id}
                      checked={!hidden.has(c.id)}
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={(v) => setHidden((h) => { const n = new Set(h); if (v) n.delete(c.id); else n.add(c.id); return n })}
                    >
                      {c.header}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {exportFileName && <Button variant="outline" size="sm" className="h-10" onClick={exportCsv}><Download /> Exportar</Button>}
          </div>
        </div>
      )}

      {selectable && selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-primary/20 bg-primary/[0.06] px-4 py-2.5 text-sm">
          <span className="font-medium text-primary">{selectedRows.length} selecionado(s)</span>
          {bulkActions?.(selectedRows, clear)}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={clear}>Limpar seleção</Button>
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={Math.min(pageSize, 6)} />
      ) : filtered.length === 0 ? (
        <div className="p-6"><EmptyState title={query ? "Nenhum resultado para a busca" : empty.title} description={query ? "Tente outro termo ou limpe os filtros." : empty.description} action={query ? undefined : empty.action} /></div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Selecionar todos da página"
                    checked={allOnPage}
                    onCheckedChange={(v) => setSelected((s) => { const n = new Set(s); pageRows.forEach((r) => (v ? n.add(getRowId(r)) : n.delete(getRowId(r)))); return n })}
                  />
                </TableHead>
              )}
              {visibleColumns.map((c) => {
                const active = sort?.id === c.id
                const SortIcon = !active ? ChevronsUpDown : sort!.dir === "asc" ? ArrowUp : ArrowDown
                return (
                  <TableHead key={c.id} className={cn(c.align === "right" && "text-right", c.className)} aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}>
                    {c.value ? (
                      <button type="button" onClick={() => toggleSort(c.id)} className={cn("inline-flex items-center gap-1 rounded uppercase tracking-wider transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring", active && "text-foreground", c.align === "right" && "flex-row-reverse")}>
                        {c.header}
                        <SortIcon className={cn("size-3", !active && "opacity-40")} />
                      </button>
                    ) : c.header}
                  </TableHead>
                )
              })}
              {rowActions && <TableHead className="w-12"><span className="sr-only">Ações</span></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((row) => {
              const id = getRowId(row)
              return (
                <TableRow
                  key={id}
                  data-state={selected.has(id) ? "selected" : undefined}
                  className={cn(onRowClick && "cursor-pointer")}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (e) => { if (e.key === "Enter") onRowClick(row) } : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                >
                  {selectable && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox aria-label="Selecionar linha" checked={selected.has(id)} onCheckedChange={(v) => setSelected((s) => { const n = new Set(s); if (v) n.add(id); else n.delete(id); return n })} />
                    </TableCell>
                  )}
                  {visibleColumns.map((c) => <TableCell key={c.id} className={cn(c.align === "right" && "text-right tabular-nums", c.className)}>{c.cell(row)}</TableCell>)}
                  {rowActions && <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>{rowActions(row)}</TableCell>}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      {!loading && filtered.length > pageSize && (
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-subtle">
          <span>
            {page * pageSize + 1}–{Math.min(filtered.length, (page + 1) * pageSize)} de {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Página anterior" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft /></Button>
            <span className="px-2 tabular-nums">{page + 1} / {pageCount}</span>
            <Button variant="ghost" size="icon-sm" aria-label="Próxima página" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}><ChevronRight /></Button>
          </div>
        </div>
      )}
    </div>
  )
}
