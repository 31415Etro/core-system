// Página aberta uma vez para conceder o microfone à extensão
// (o documento offscreen que grava não consegue exibir o pedido de permissão).
const status = document.getElementById("status")
document.getElementById("allow").addEventListener("click", async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((t) => t.stop())
    status.textContent = "Pronto! Microfone liberado. Pode fechar esta aba e voltar ao Meet."
    setTimeout(() => window.close(), 1800)
  } catch {
    status.textContent = "Permissão negada. Clique no cadeado da barra de endereço, libere o microfone e tente de novo."
  }
})
