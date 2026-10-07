import { redirect } from "next/navigation"

// A prospecção agora é uma aba de Leads.
export default function Page() {
  redirect("/leads?aba=prospeccao")
}
