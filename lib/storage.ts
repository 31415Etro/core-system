import { createAdminClient } from "@/lib/supabase/server"

const TASK_PHOTOS_BUCKET = "chamado-fotos"
const TASK_AUDIOS_BUCKET = "chamado-audios"
const CLIENT_CONTRACTS_BUCKET = "contratos-clientes"

function sanitizeFileName(name: string) {
  return name.normalize("NFKD").replace(/[^\w.\-]+/g, "-").replace(/-+/g, "-").slice(-80)
}

export async function uploadTaskPhoto(taskId: string, file: File) {
  const supabase = createAdminClient()
  const path = `chamados/${taskId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`
  const { error } = await supabase.storage
    .from(TASK_PHOTOS_BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false })
  if (error) throw new Error(`Falha ao enviar foto: ${error.message}`)

  const { data } = supabase.storage.from(TASK_PHOTOS_BUCKET).getPublicUrl(path)
  return {
    file_name: file.name,
    storage_path: path,
    public_url: data.publicUrl,
    mime_type: file.type || null,
    file_size_bytes: file.size,
  }
}

export async function uploadTaskAudio(taskId: string, file: File) {
  const supabase = createAdminClient()
  const path = `chamados/${taskId}/${crypto.randomUUID()}-${sanitizeFileName(file.name || "audio.webm")}`
  const { error } = await supabase.storage
    .from(TASK_AUDIOS_BUCKET)
    .upload(path, file, { contentType: file.type || "audio/webm", upsert: false })
  if (error) throw new Error(`Falha ao enviar áudio: ${error.message}`)

  const { data } = supabase.storage.from(TASK_AUDIOS_BUCKET).getPublicUrl(path)
  return {
    file_name: file.name || "audio.webm",
    storage_path: path,
    public_url: data.publicUrl,
    mime_type: file.type || null,
    file_size_bytes: file.size,
  }
}

export async function uploadClientContract(clientId: string, file: File) {
  const supabase = createAdminClient()
  const path = `contratos/${clientId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`
  const { error } = await supabase.storage
    .from(CLIENT_CONTRACTS_BUCKET)
    .upload(path, file, { contentType: file.type || "application/pdf", upsert: false })
  if (error) throw new Error(`Falha ao enviar contrato: ${error.message}`)

  return { file_name: file.name, storage_path: path }
}

export async function getSignedContractUrl(storagePath: string, expiresInSeconds = 300) {
  const supabase = createAdminClient()
  const { data, error } = await supabase.storage
    .from(CLIENT_CONTRACTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds)
  if (error) throw new Error(`Falha ao gerar link do contrato: ${error.message}`)
  return data.signedUrl
}
