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

export const CLIENT_DOCUMENT_KINDS = { contract: "contratos", "boas-vindas": "apresentacoes/boas-vindas", cronograma: "apresentacoes/cronograma", documento: "documentos" } as const
export type ClientDocumentKind = keyof typeof CLIENT_DOCUMENT_KINDS

// Gera uma URL assinada para o navegador subir o PDF direto no Supabase Storage.
// Necessário porque funções serverless da Vercel têm limite de 4.5MB por requisição
// e essas apresentações costumam ser arquivos pesados — o arquivo nunca passa pela nossa rota.
export async function createClientDocumentUploadUrl(clientId: string, kind: ClientDocumentKind, fileName: string) {
  const supabase = createAdminClient()
  const path = `${CLIENT_DOCUMENT_KINDS[kind]}/${clientId}/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`
  const { data, error } = await supabase.storage.from(CLIENT_CONTRACTS_BUCKET).createSignedUploadUrl(path)
  if (error) throw new Error(`Falha ao gerar link de upload: ${error.message}`)
  return { path, token: data.token, bucket: CLIENT_CONTRACTS_BUCKET }
}

export async function getSignedClientDocumentUrl(storagePath: string, expiresInSeconds = 300) {
  const supabase = createAdminClient()
  const { data, error } = await supabase.storage
    .from(CLIENT_CONTRACTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds)
  if (error) throw new Error(`Falha ao gerar link do arquivo: ${error.message}`)
  return data.signedUrl
}

export async function removeClientDocument(storagePath: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.storage.from(CLIENT_CONTRACTS_BUCKET).remove([storagePath])
  if (error) throw new Error(`Falha ao remover arquivo: ${error.message}`)
}
