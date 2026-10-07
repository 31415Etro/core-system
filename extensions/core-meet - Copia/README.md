# CORE Meet — extensão do Chrome

Grava reuniões do Google Meet (áudio e, se quiser, **vídeo**) e envia para a CORE. **Não precisa de legendas nem de Google Meet pago.**

Ao finalizar a reunião:
1. A CORE **transcreve o áudio de graça**, com o Whisper (aberto) rodando no próprio servidor.
2. Só depois disso a IA (Claude) escreve a **ata**, as **tarefas**, as **pendências** (nossas e do cliente), a **próxima reunião** e, em reunião com lead, as **informações comerciais**, que entram direto no histórico do lead.

## Instalar

1. No Chrome, abra `chrome://extensions`.
2. Ative o **Modo do desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** e escolha esta pasta (`extensions/core-meet`).
4. Fixe o ícone da CORE Meet na barra do Chrome (ícone de quebra-cabeça → alfinete).

## Conectar à CORE

1. Na CORE, vá em **Reuniões → Conectar extensão** e clique em **Gerar token**.
2. Clique no ícone da CORE Meet. O **endereço da CORE** já vem preenchido (`https://core.179-236-244-221.sslip.io`); cole o **token**. Use sempre `https://`: se você digitar `http://`, a extensão corrige sozinha.
3. O Chrome pede permissão para a extensão acessar esse endereço: aceite.
4. Na primeira gravação, clique em **Permitir** ao lado de "Microfone". Abre uma aba que pede o microfone uma única vez. **Sem o microfone, a sua voz não é gravada**, porque o Meet não devolve o seu próprio áudio para a aba.

## Gravar uma reunião

1. Entre na chamada do Google Meet (de preferência **com fone de ouvido**, para o áudio sair mais limpo).
2. Clique na CORE Meet e escolha o tipo:
   - **Equipe**: reunião interna do time.
   - **Cliente**: escolha um cliente cadastrado na CORE. As tarefas já vêm sugeridas como tarefas de projeto desse cliente.
   - **Lead**: escolha um lead cadastrado. A ata, os próximos passos e a próxima reunião entram no histórico do lead, e o lead avança para "Reunião realizada".
3. Se quiser guardar o vídeo, ative **Gravar vídeo da reunião**. A opção fica lembrada para as próximas.
4. Clique em **Iniciar gravação**. Aparece o selo "CORE Meet gravando" no topo da chamada.
5. Ao terminar, clique em **Finalizar**. A ata aparece em **CORE → Reuniões** assim que a transcrição termina. O vídeo fica no botão **Assistir vídeo** da reunião e na aba **Gravações**.

## Como funciona

| Parte | O que faz |
|---|---|
| `popup.*` | Tela da extensão: conectar, escolher tipo/cliente/lead, gravar, pausar, finalizar. |
| `offscreen.*` | Grava **seu microfone** e o **som da reunião** em **faixas separadas** (Opus, ~15 MB/h por faixa) e, se ativado, o **vídeo da aba** (720p, 15 fps, ~360 MB/h, com o som misturado), tudo em partes de 5 min enviadas durante a reunião. O som da reunião continua tocando para você. |
| `background.js` | Orquestra a gravação e conversa com a API da CORE (`/api/meet/ext/*`) usando o token. |
| `vendor/fix-webm-duration.js` | Biblioteca aberta (MIT) que grava a duração nos arquivos, para o player conseguir avançar. |
| `content.js` | Só mostra o selo "gravando" dentro do Meet. |

- **Quem falou:** as falas do microfone saem com o seu nome e as do som da reunião como "Participante". A IA deduz os nomes pelo contexto (ex.: "Boa tarde, Ana!"). Se o seu microfone captar o som do alto-falante, a CORE remove essas falas duplicadas.
- **Partes de 5 minutos:** cada parte é transcrita rápido, e se a internet cair só se perde a parte em andamento. No vídeo, as partes tocam em sequência, como um vídeo só.
- **Vídeo:** é só para assistir, porque a ata vem do áudio. Grava a aba do Meet (quem está na tela e o que for compartilhado). Uma reunião de 1 hora ocupa cerca de 360 MB no servidor.
- **Segurança:** o token fica só no armazenamento local da extensão e o servidor guarda apenas o hash dele. O áudio vai para um armazenamento privado da CORE. Revogue um token a qualquer momento em **Reuniões → Conectar extensão**.
- **Fechou a aba do Meet sem finalizar?** A gravação é encerrada e enviada automaticamente.

## Transcrição gratuita (configuração do servidor da CORE)

A transcrição usa o **Whisper** (modelo aberto de reconhecimento de fala) rodando **no próprio servidor da CORE**, via [speaches](https://github.com/speaches-ai/speaches). É 100% gratuita, não exige conta nem tem limite, e o áudio não sai do servidor.

No servidor provisório isso já está instalado (container `core-whisper`, modelo `Systran/faster-whisper-small`). Em outro servidor, suba o container `ghcr.io/speaches-ai/speaches:latest-cpu`, baixe o modelo (`POST /v1/models/Systran/faster-whisper-small`) e configure no `.env` da CORE:
```
TRANSCRIPTION_BASE_URL=http://whisper:8000/v1
TRANSCRIPTION_MODEL=Systran/faster-whisper-small
```

**Velocidade:** sem placa de vídeo, numa VPS de 2 núcleos, o modelo `small` transcreve cerca de 3,6 vezes mais rápido que o tempo real. Uma reunião de 1 hora fica pronta em uns 15 a 30 minutos. O `deepdml/faster-whisper-large-v3-turbo-ct2` é um pouco mais preciso, mas cerca de 2,5 vezes mais lento.

## Problemas comuns

- **"Transcrição não configurada no servidor"**: siga a seção acima e use **Reprocessar com IA** na reunião.
- **Minha voz não aparece na ata**: o microfone estava bloqueado. Libere em **Permitir** (popup) ou em `chrome://settings/content/microphone`.
- **"Não foi possível acessar…"**: confira se a CORE está no ar e se o endereço está certo (sem barra no final).
- **"O serviço de transcrição não respondeu"**: o container do Whisper parou. No servidor, rode `docker compose up -d whisper` e use **Reprocessar com IA**.
