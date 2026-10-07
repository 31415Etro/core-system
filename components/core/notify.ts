import { toast } from "@/hooks/use-toast"

/** Feedback padronizado (toast dark glass). */
export const notify = {
  success: (title: string, description?: string) => toast({ title, description, variant: "success" }),
  error: (title: string, description?: string) => toast({ title, description, variant: "destructive" }),
  info: (title: string, description?: string) => toast({ title, description }),
}
