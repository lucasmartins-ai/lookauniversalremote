# 📱 Looka Universal Remote (LookARemote)

[![CI Matrix](https://github.com/lucasmartins-ai/lookauniversalremote/actions/workflows/ci.yml/badge.svg)](https://github.com/lucasmartins-ai/lookauniversalremote/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/Rust-1.75+-orange.svg)](https://www.rust-lang.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![PWA Ready](https://img.shields.io/badge/PWA-Offline%20Ready-green.svg)](https://vite-pwa-org.netlify.app/)
[![Latency](https://img.shields.io/badge/Latency-Sub--Millisecond-brightgreen.svg)]()

> **Transforme qualquer smartphone (iOS / Android) em um controle universal de altíssima precisão e latência ultrabaixa para seu computador (macOS, Windows e Linux).**

O **LookARemote** utiliza comunicação direta ponto a ponto via **WebRTC DataChannels binários (UDP)** e criptografia ponta a ponta (**X25519 + HMAC-SHA256**), garantindo tempos de resposta instantâneos sem depender de servidores em nuvem ou conexões externas.

---

## 🌟 Principais Funcionalidades

```
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                           LOOKA UNIVERSAL REMOTE                            │
 ├─────────────────┬──────────────────┬─────────────────┬──────────────────────┤
 │   🎮 GAMEPAD    │   🖱️ TOUCHPAD    │  🎯 GYRO AIM    │   🧠 SMART CONTEXT   │
 │ Dual Sticks     │ Cursor Balístico │ Fusão 6-DoF     │ Detecção automática  │
 │ Gatilhos L2/R2  │ Gestos 2 Dedos   │ Calibração Auto │ de janelas e troca   │
 │ Haptic Feedback │ Scroll & Drag    │ Deadzone Curvo  │ dinâmica de perfil   │
 └─────────────────┴──────────────────┴─────────────────┴──────────────────────┘
```

### 1. 🎮 Modo Gamepad (Controle de Jogos)
- **Dois Joysticks Analógicos**: Controle com retorno ao centro elástico e zonas mortas configuráveis.
- **Gatilhos Progressivos**: Sensores de pressão analógicos para aceleração/frenagem suave em jogos de corrida.
- **D-Pad e Botões de Ação**: Layout tátil com feedback háptico por vibração (Haptic Rumble) acionado pelo Host.
- **Emulação Nativa de Controle**: Compatível com jogos da Steam, emuladores e jogos de PC.

### 2. 🖱️ Modo Touchpad & Gestos (Mouse Balístico)
- **Algoritmo de Aceleração Balística**: Movimentação fluida e precisa do cursor com inércia configurável.
- **Gestos Multitoque**:
  - Toque com 1 dedo: Clique esquerdo.
  - Toque com 2 dedos: Clique direito.
  - Deslizar 2 dedos: Scroll vertical/horizontal suave.
  - Pressionar e segurar: Arrasto e seleção (Drag & Drop).

### 3. 🎯 Modo Giroscópio & Mira IMU (Motion Aiming)
- **Fusão de Sensores 6-DoF**: Integra dados brutos do acelerômetro e giroscópio a 60–120 Hz.
- **Autocalibração de Bias**: Compensa automaticamente a deriva térmica e desvios estáticos do sensor.
- **Mira Híbrida de Precisão**: Ative a mira por movimento ao segurar um botão (estilo Nintendo Switch / Steam Deck / DualSense).

### 4. ⌨️ Modo Teclado & Produtividade
- Digitação remota em tempo real com envio de caracteres e teclas modificadoras (Shift, Ctrl, Alt, Command/Windows).
- Mapeamento universal de códigos **USB HID** convertidos diretamente para os drivers nativos do sistema.

### 5. 🎵 Modo Mídia Remota
- Painel dedicado para controle de entretenimento: Play/Pause, Próxima/Anterior, Volume +/- e Mute.

### 6. 🧠 Smart Context Engine (Detecção Inteligente)
- O Host Daemon monitora em tempo real a janela ativa no computador:
  - Abriu a **Steam** ou um jogo? 👉 O celular alterna **automaticamente** para o modo **Gamepad**.
  - Abriu o **Spotify** ou reprodutor de mídia? 👉 Alterna para o **Controle de Mídia**.
  - Voltou para o **Navegador** ou Desktop? 👉 Retorna para o **Touchpad**.

---

## 🏗️ Arquitetura do Sistema

```
  ┌────────────────────────┐                   ┌────────────────────────┐
  │   Smartphone (PWA)     │                   │     Host Daemon (PC)   │
  │   (React + TypeScript) │                   │      (Rust Async)      │
  └───────────┬────────────┘                   └───────────┬────────────┘
              │                                            │
              │  1. Pareamento Seguro (QR Code)            │
              │  Diffie-Hellman X25519 + HMAC-SHA256       │
              ├───────────────────────────────────────────>│
              │                                            │
              │  2. WebRTC DataChannel (Não-Ordenado, UDP) │
              │  Protocolo Binário Zero-Allocation (~12ns) │
              │===========================================>│
              │                                            │
              │  3. Roteamento de Entrada & Drivers        │
              │                                            ├──> macOS (CoreGraphics)
              │                                            ├──> Windows (SendInput)
              │                                            └──> Linux (/dev/uinput)
              │                                            │
              │  4. Smart Context Engine                   │
              │  Alternância automática por janela ativa  │
              │< - - - - - - - - - - - - - - - - - - - - - ┤
```

---

## 🚀 Como Usar — Guia Rápido Passo a Passo

### Pré-requisitos
- [Rust 1.75+](https://www.rust-lang.org/tools/install)
- [Node.js 18+](https://nodejs.org/)

---

### Passo 1: Iniciar o Host Daemon no Computador

No terminal do seu computador:

```bash
# Clone o repositório
git clone https://github.com/lucasmartins-ai/lookauniversalremote.git
cd lookauniversalremote

# Inicie o Host Daemon
cargo run --manifest-path apps/host-daemon/Cargo.toml
```

O Daemon iniciará o servidor de sinalização e exibirá um **QR Code de Pareamento Seguro** diretamente no terminal:

```
    ▄▄▄▄▄▄▄ ▄ ▄▄ ▄▄▄▄▄▄▄
    █ ▄▄▄ █ ▄███ █ ▄▄▄ █
    █ ███ █ █ ▄▀ █ ███ █
    █▄▄▄▄▄█ █ █▀ █▄▄▄▄▄█
    ...
  Escaneie o QR Code acima com o Web Client ou abra o link de pareamento.
```

---

### Passo 2: Acessar o Web Client no Smartphone

No smartphone (conectado na **mesma rede Wi-Fi** do computador):

1. Abra o navegador no smartphone e acerte o endereço do Web Client (ou use o servidor local de desenvolvimento):
   ```bash
   npm run dev --workspace=@lookaremote/web-client
   ```
2. No celular, toque no ícone de **Escanear QR Code** na barra superior e aponte a câmera para o terminal do PC.
3. **Pronto!** O pareamento criptográfico é concluído em milissegundos e o controle se conecta via WebRTC.

> 💡 **Dica PWA**: Toque em **"Adicionar à Tela de Início"** no navegador do seu smartphone para instalar o LookARemote como aplicativo nativo em tela cheia com funcionamento 100% offline.

---

## ⚙️ Configuração do Smart Context (`config.toml`)

O comportamento dos perfis automáticos é configurável através do arquivo [`config.toml`](config.toml):

```toml
[daemon]
poll_interval_ms = 250    # Intervalo de verificação de janela ativa
debounce_ms = 150         # Debounce para evitar trocas acidentais
default_mode = "Trackpad" # Modo padrão quando não houver perfil correspondente

# Perfil para Jogos
[[profiles]]
name = "Steam Games"
mode = "Gamepad"
process_names = ["steam", "retroarch", "heroic", "yuzu", "ryujinx"]
window_title_regex = "(?i).*(game|steam|retroarch).*"

# Perfil para Mídia
[[profiles]]
name = "Media Players"
mode = "Media"
process_names = ["spotify", "vlc", "netflix", "popcorntime"]
window_title_regex = "(?i).*(spotify|youtube|netflix|vlc).*"

# Perfil para Navegação
[[profiles]]
name = "Web Browsers"
mode = "Trackpad"
process_names = ["chrome", "firefox", "brave", "safari", "zen"]
```

---

## 💻 Suporte a Sistemas Operacionais

| Sistema | Driver de Mouse | Driver de Teclado | Driver de Gamepad | Permissões Necessárias |
| :--- | :--- | :--- | :--- | :--- |
| **macOS** | `CoreGraphics` (`CGEventPost`) | `CoreGraphics` | Emulação Virtual | Acessibilidade (TCC) |
| **Windows** | Win32 `SendInput` | Win32 `SendInput` | `ViGEmBus` | Nenhuma extra |
| **Linux** | `/dev/uinput` | `/dev/uinput` | `/dev/uinput` | Acesso udev (sem root) |

### Configuração no Linux (udev não-root)
Para permitir que o daemon crie dispositivos virtuais sem necessidade de rodar como `sudo`:
```bash
./scripts/setup-linux-udev.sh
```

### Configuração no macOS
Na primeira execução, o macOS solicitará permissão de **Acessibilidade** para o terminal/aplicativo. O daemon verifica automaticamente e avisa caso a permissão esteja pendente.

---

## ⚡ Benchmarks & Desempenho

| Componente | Medição / Métrica | Resultado |
| :--- | :--- | :--- |
| **Decodificação de Pacote Binário** | Microbenchmark Criterion | **~10 – 14 ns** |
| **Despacho Total no Host (Input Pipeline)** | Pipeline Benchmark | **< 1 µs** |
| **Latência de Rede Local (WebRTC)** | UDP DataChannel direto | **< 2 ms** |
| **Taxa de Amostragem do Giroscópio** | Acelerômetro + Giroscópio | **60 – 120 Hz** |
| **Tamanho do Pacote Binário** | Payload otimizado | **8 – 24 bytes** |

---

## 🛠️ Comandos de Desenvolvimento

```bash
# Executar todos os testes de unidade e integração do Rust
cargo test --workspace

# Executar linter do Rust com zero warnings
cargo clippy --workspace --all-targets -- -D warnings

# Executar suíte de microbenchmarks
cargo bench -p lookaremote-protocol -- --test
cargo bench -p lookaremote-host-daemon -- --test

# Executar testes do Frontend (Vitest)
npm test

# Compilar todos os pacotes (Frontend + Tipos)
npm run build --workspaces

# Gerar pacote de Release (Binário Host + PWA + Checksums SHA-256)
./scripts/package-release.sh
```

---

## 📦 Estrutura do Repositório Monorepo

```
lookauniversalremote/
├── apps/
│   ├── host-daemon/           # Host Daemon em Rust (WebRTC, Drivers nativos, Watchdog, Context Engine)
│   └── web-client/            # PWA Mobile em React + TypeScript + Tailwind + Lucide Icons
├── packages/
│   ├── protocol/              # Codecs binários zero-allocation de alto desempenho em Rust
│   └── protocol-types/        # Definições de tipos e codecs do protocolo binário em TypeScript
├── scripts/
│   ├── package-release.sh     # Script de automação de build e empacotamento de release
│   ├── setup-linux-udev.sh    # Script de configuração de regras udev para Linux
│   └── lookaremote.service    # Unidade de serviço do systemd
├── docs/                      # Documentação técnica, especificações de protocolo e instalação
├── .github/workflows/         # Pipelines de CI/CD automatizadas (Matrix Test & Release)
└── config.toml                # Configurações de perfis inteligentes e mapeamento de janelas
```

---

## 📄 Licença

Este projeto está licenciado sob a licença **MIT** — consulte o arquivo [LICENSE](LICENSE) para mais detalhes.
