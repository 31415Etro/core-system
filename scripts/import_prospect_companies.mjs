// Importa empresas de SC nos CNAEs alvo a partir da base aberta de CNPJ da Receita Federal.
// Fonte: compartilhamento Nextcloud público em arquivos.receitafederal.gov.br (WebDAV, Basic Auth com token de share).
// Uso: node --env-file=.env.local scripts/import_prospect_companies.mjs
import fs from "node:fs"
import path from "node:path"
import readline from "node:readline"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { fileURLToPath } from "node:url"
import unzipper from "unzipper"
import { createClient } from "@supabase/supabase-js"

const execFileAsync = promisify(execFile)

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SHARE_TOKEN = "YggdBLfdninEJX9"
const AUTH_HEADER = "Basic " + Buffer.from(`${SHARE_TOKEN}:`).toString("base64")
const MONTH = process.env.RF_MONTH || "2026-08"
const BASE = `https://arquivos.receitafederal.gov.br/public.php/webdav/${MONTH}/`
const UF_TARGET = "SC"
const SITUACAO_ATIVA = "02"

// CNAEs informados pelo usuário, sem pontuação.
const TARGET_CNAES = new Set(["4672900", "4679699", "4673700", "4693100", "2593400", "5250802", "7020400", "5250804", "8630504"])

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados")
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

const municipiosSc = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "municipios_sc.json"), "utf8"))
const normalizeName = s => s.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z]/g, "")

// Fora da pasta do projeto (que é sincronizada pelo OneDrive) para evitar contenção de I/O em escritas frequentes/grandes.
const CHECKPOINT_DIR = process.env.RF_CHECKPOINT_DIR || process.env.TEMP || __dirname
const CHECKPOINT_PATH = path.join(CHECKPOINT_DIR, "waycore_import_checkpoint.json")

function loadCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_PATH)) return null
  try { return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, "utf8")) } catch { return null }
}

function saveCheckpoint(state) {
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(state))
}

process.on("unhandledRejection", err => { console.error("[import] unhandledRejection:", err); process.exit(1) })
process.on("uncaughtException", err => { console.error("[import] uncaughtException:", err); process.exit(1) })

// Baixa via curl (mais resiliente que o https nativo do Node para downloads longos/grandes,
// confirmado empiricamente nesta máquina) para um arquivo local fora do OneDrive, processa e apaga.
async function downloadToFile(fileName) {
  const dest = path.join(CHECKPOINT_DIR, `waycore_rf_${process.pid}_${Math.random().toString(36).slice(2)}_${fileName}`)
  await execFileAsync("curl", [
    "-s", "-o", dest, "--retry", "5", "--retry-delay", "5", "--fail", "--limit-rate", "2M",
    "-H", `Authorization: ${AUTH_HEADER}`, BASE + fileName,
  ], { maxBuffer: 1024 * 1024 * 10 })
  return dest
}

function parseLine(line) {
  const trimmed = line.replace(/\r$/, "")
  if (!trimmed) return null
  return trimmed.slice(1, -1).split('";"')
}

async function streamZipRows(fileName, onRow) {
  const localPath = await downloadToFile(fileName)
  let rowCount = 0
  try {
    await new Promise((resolve, reject) => {
      let settled = false
      const fail = error => { if (!settled) { settled = true; reject(error) } }
      const succeed = () => { if (!settled) { settled = true; resolve() } }
      fs.createReadStream(localPath)
        .on("error", fail)
        .pipe(unzipper.Parse())
        .on("entry", entry => {
          if (entry.type !== "File") { entry.autodrain(); return }
          entry.setEncoding("latin1")
          // Zip corrompido (bit flip no meio do stream comprimido) lança erro de zlib direto na
          // entrada — precisa de handler explícito aqui, o .on("error") só na ponta do pipe não pega.
          entry.on("error", fail)
          const rl = readline.createInterface({ input: entry, crlfDelay: Infinity })
          rl.on("line", line => {
            const fields = parseLine(line)
            if (fields) { rowCount++; onRow(fields) }
          })
        })
        .on("close", succeed)
        .on("error", fail)
    })
  } finally {
    fs.rm(localPath, () => {})
  }
  return rowCount
}

// Re-tenta a função inteira do zero em caso de falha de rede/stream. `fn` só deve gravar no estado
// compartilhado (state.*) DEPOIS de terminar com sucesso — nunca dentro do callback de streamZipRows —
// para que uma tentativa parcial que falhou no meio nunca deixe linhas duplicadas.
async function withRetries(fn, label, retries = 4) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      console.error(`[import] falha em ${label} (tentativa ${attempt}/${retries}): ${error.message}`)
      if (attempt === retries) throw error
      await new Promise(r => setTimeout(r, attempt * 5000))
    }
  }
}

async function run() {
  console.log(`[import] mês=${MONTH} cnaes=${[...TARGET_CNAES].join(",")}`)

  let state = loadCheckpoint()
  if (state) {
    console.log(`[import] retomando checkpoint: fase="${state.phase}", ${state.matches.length} empresas já encontradas`)
  } else {
    state = {
      phase: "municipios", municipioCodeToName: {}, matches: [], matchedBasicos: [],
      estabShardsDone: [], razaoSocialByBasico: {}, empresasShardsDone: [], sociosByBasico: {}, sociosShardsDone: [],
    }
  }
  if (state.phase === "done") { console.log("[import] checkpoint já concluído (delete scripts/.import_checkpoint.json para refazer do zero)"); return }

  if (state.phase === "municipios") {
    console.log("[import] baixando Municipios.zip...")
    await withRetries(async () => {
      const codeToName = {}
      await streamZipRows("Municipios.zip", f => { codeToName[f[0]] = f[1] })
      state.municipioCodeToName = codeToName
    }, "Municipios.zip")
    console.log(`[import] ${Object.keys(state.municipioCodeToName).length} municípios carregados`)
    state.phase = "estabelecimentos"
    saveCheckpoint(state)
  }

  const matchedBasicos = new Set(state.matchedBasicos)

  if (state.phase === "estabelecimentos") {
    for (let i = 0; i <= 9; i++) {
      if (state.estabShardsDone.includes(i)) continue
      const file = `Estabelecimentos${i}.zip`
      console.log(`[import] processando ${file}...`)
      await withRetries(async () => {
        const shardMatches = []
        const shardBasicos = new Set()
        const rows = await streamZipRows(file, f => {
          const [cnpjBasico, cnpjOrdem, cnpjDv, , nomeFantasia, situacao, , , , , , cnaePrincipal, ,
            tipoLogradouro, logradouro, numero, complemento, bairro, cep, uf, municipioCodigo,
            ddd1, telefone1, , , , , email] = f
          if (uf !== UF_TARGET || situacao !== SITUACAO_ATIVA) return
          // Só CNAE principal (não secundária) — atividade secundária costuma ser ruído (registrada mas não exercida de fato).
          if (!TARGET_CNAES.has(cnaePrincipal)) return
          shardBasicos.add(cnpjBasico)
          shardMatches.push({
            cnpjBasico, cnpj: `${cnpjBasico}${cnpjOrdem}${cnpjDv}`,
            nomeFantasia: nomeFantasia || null, cnaePrincipal, situacao,
            logradouro: [tipoLogradouro, logradouro].filter(Boolean).join(" ") || null,
            numero: numero || null, complemento: complemento || null, bairro: bairro || null, cep: cep || null,
            uf, municipioCodigo, telefone: telefone1 ? (ddd1 ? `(${ddd1}) ${telefone1}` : telefone1) : null,
            email: email || null,
          })
        })
        // Só grava no estado compartilhado depois que o shard inteiro processou sem erro.
        for (const m of shardMatches) state.matches.push(m)
        for (const b of shardBasicos) matchedBasicos.add(b)
        state.matchedBasicos = [...matchedBasicos]
        state.estabShardsDone.push(i)
        saveCheckpoint(state)
        console.log(`[import] ${file}: ${rows} linhas, ${shardMatches.length} encontradas (total acumulado: ${state.matches.length})`)
      }, file)
    }
    state.phase = "empresas"
    saveCheckpoint(state)
  }

  if (state.phase === "empresas") {
    for (let i = 0; i <= 9; i++) {
      if (state.empresasShardsDone.includes(i)) continue
      const file = `Empresas${i}.zip`
      console.log(`[import] processando ${file}...`)
      await withRetries(async () => {
        const shardRazaoSocial = {}
        await streamZipRows(file, f => {
          const [cnpjBasico, razaoSocial] = f
          if (matchedBasicos.has(cnpjBasico)) shardRazaoSocial[cnpjBasico] = razaoSocial
        })
        Object.assign(state.razaoSocialByBasico, shardRazaoSocial)
        state.empresasShardsDone.push(i)
        saveCheckpoint(state)
      }, file)
    }
    state.phase = "socios"
    saveCheckpoint(state)
  }

  if (state.phase === "socios") {
    for (let i = 0; i <= 9; i++) {
      if (state.sociosShardsDone.includes(i)) continue
      const file = `Socios${i}.zip`
      console.log(`[import] processando ${file}...`)
      await withRetries(async () => {
        const shardSocios = {}
        await streamZipRows(file, f => {
          const [cnpjBasico, , nomeSocio] = f
          if (!matchedBasicos.has(cnpjBasico) || !nomeSocio) return
          if (!shardSocios[cnpjBasico]) shardSocios[cnpjBasico] = []
          shardSocios[cnpjBasico].push(nomeSocio)
        })
        for (const [cnpjBasico, nomes] of Object.entries(shardSocios)) {
          if (!state.sociosByBasico[cnpjBasico]) state.sociosByBasico[cnpjBasico] = []
          state.sociosByBasico[cnpjBasico].push(...nomes)
        }
        state.sociosShardsDone.push(i)
        saveCheckpoint(state)
      }, file)
      saveCheckpoint(state)
    }
    state.phase = "upsert"
    saveCheckpoint(state)
  }

  const { matches, municipioCodeToName, razaoSocialByBasico, sociosByBasico } = state

  let withCoords = 0
  const finalRows = matches.map(m => {
    const municipioNome = municipioCodeToName[m.municipioCodigo] || null
    const geo = municipioNome ? municipiosSc[normalizeName(municipioNome)] : null
    if (geo) withCoords++
    return {
      cnpj: m.cnpj,
      company_name: razaoSocialByBasico[m.cnpjBasico] || m.nomeFantasia || `CNPJ ${m.cnpj}`,
      trade_name: m.nomeFantasia,
      cnae_principal: m.cnaePrincipal,
      situacao_cadastral: m.situacao,
      logradouro: m.logradouro, numero: m.numero, complemento: m.complemento, bairro: m.bairro,
      cep: m.cep, municipio: municipioNome, uf: m.uf,
      telefone: m.telefone, email: m.email,
      socios: sociosByBasico[m.cnpjBasico] || [],
      latitude: geo ? geo.lat : null, longitude: geo ? geo.lng : null,
      geocode_source: geo ? "municipio_centroid" : null,
    }
  })

  console.log(`[import] ${finalRows.length} empresas para upsert (${withCoords} com coordenadas)`)

  const BATCH = 500
  for (let i = 0; i < finalRows.length; i += BATCH) {
    const batch = finalRows.slice(i, i + BATCH)
    const { error } = await supabase.from("prospect_companies").upsert(batch, { onConflict: "cnpj" })
    if (error) throw error
    console.log(`[import] upsert ${Math.min(i + BATCH, finalRows.length)}/${finalRows.length}`)
  }

  const byCnae = {}
  for (const row of finalRows) byCnae[row.cnae_principal] = (byCnae[row.cnae_principal] || 0) + 1

  const report = {
    month: MONTH, target_cnaes: [...TARGET_CNAES], uf: UF_TARGET,
    total_matched: finalRows.length, with_coordinates: withCoords, without_coordinates: finalRows.length - withCoords,
    by_cnae_principal: byCnae,
  }
  fs.writeFileSync(path.join(__dirname, "import_prospect_companies_report.json"), JSON.stringify(report, null, 2))
  console.log("[import] concluído:", report)

  state.phase = "done"
  saveCheckpoint(state)
}

run().catch(error => { console.error("[import] ERRO:", error); process.exit(1) })
