import { redirect } from "next/navigation"

// O pipeline agora é uma aba de Leads.
export default function Page() {
  redirect("/leads?aba=pipeline")
}
