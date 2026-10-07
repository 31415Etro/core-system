"use client"

import type React from "react"
import { useId } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type FieldShellProps = {
  label: string
  helper?: string
  error?: string
  required?: boolean
  className?: string
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => React.ReactNode
}

/** Estrutura comum: label + controle + helper text / erro, com aria ligado. */
export function Field({ label, helper, error, required, className, children }: FieldShellProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const describedBy = error || helper ? hintId : undefined
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-[13px] font-medium text-zinc-300">
        {label}
        {required && <span className="text-primary" aria-hidden="true">*</span>}
      </Label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {(error || helper) && (
        <p id={hintId} className={cn("text-xs", error ? "text-red-400" : "text-subtle")}>{error || helper}</p>
      )}
    </div>
  )
}

type InputFieldProps = Omit<React.ComponentProps<typeof Input>, "id"> & { label: string; helper?: string; error?: string; fieldClassName?: string }

export function InputField({ label, helper, error, required, fieldClassName, ...props }: InputFieldProps) {
  return (
    <Field label={label} helper={helper} error={error} required={required} className={fieldClassName}>
      {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} required={required} {...props} />}
    </Field>
  )
}

type TextareaFieldProps = Omit<React.ComponentProps<typeof Textarea>, "id"> & { label: string; helper?: string; error?: string; fieldClassName?: string }

export function TextareaField({ label, helper, error, required, fieldClassName, ...props }: TextareaFieldProps) {
  return (
    <Field label={label} helper={helper} error={error} required={required} className={fieldClassName}>
      {({ id, describedBy, invalid }) => <Textarea id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} required={required} {...props} />}
    </Field>
  )
}

export type SelectOption = { value: string; label: string }

export function SelectField({
  label,
  helper,
  error,
  required,
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Selecione",
  name,
  disabled,
  className,
}: {
  label: string
  helper?: string
  error?: string
  required?: boolean
  options: SelectOption[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  name?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <Field label={label} helper={helper} error={error} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <Select value={value} defaultValue={defaultValue} onValueChange={onValueChange} name={name} disabled={disabled}>
          <SelectTrigger id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} className="w-full">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </Field>
  )
}

/** Agrupa campos por contexto (Dados principais, Endereço, ...) em grid responsivo. */
export function FormSection({ title, description, columns = 2, children }: { title: string; description?: string; columns?: 2 | 3; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">{title}</span>
        {description && <span className="mt-1 block text-xs text-muted-foreground">{description}</span>}
      </legend>
      <div className={cn("grid gap-4", columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2")}>{children}</div>
    </fieldset>
  )
}
