# 📱 Looka Universal Remote (LookARemote)

[![CI Matrix](https://github.com/lucasmartins-ai/lookauniversalremote/actions/workflows/ci.yml/badge.svg)](https://github.com/lucasmartins-ai/lookauniversalremote/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/Rust-1.75+-orange.svg)](https://www.rust-lang.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![PWA Ready](https://img.shields.io/badge/PWA-Offline%20Ready-green.svg)](https://vite-pwa-org.netlify.app/)
[![UI Style](https://img.shields.io/badge/UI-3D%20Neumorphism%20%26%20Retro%20Buttons-ff2a55.svg)]()
[![Latency](https://img.shields.io/badge/Latency-120Hz%20%7C%20Sub--Millisecond-00f59b.svg)]()

> **O controle remoto universal definitivo de alto desempenho para Smart TVs (Samsung Tizen, LG webOS, Android/Google TV, Roku, Sony, Apple TV), Consoles de Videogame e Computadores (PC / Mac / Linux) — com interface Neomórfica 3D tátil e botões retrô físicos.**

O **LookARemote** conecta seu smartphone (iOS / Android) diretamente aos seus dispositivos via **WebRTC DataChannels binários (UDP)** com criptografia de curva elíptica de ponta a ponta (**X25519 + HMAC-SHA256**), alcançando taxas de amostragem de **120 Hz** com latência sub-milissegundo sem dependência de nuvem.

---

## 🎨 Design System: Neomorfismo 3D & Botões Retrô

A nova interface do LookARemote foi concebida com a estética de **Hardware Console Retrô & Neomorfismo 3D**:
- **Chassis 3D com Dupla Iluminação**: Relevos convexos e cavidades côncavas rebaixadas com sombras direcionais e acabamento fosco grafite.
- **Teclas e Botões Retrô Físicos**: Extrusão mecânica 3D com afundamento tátil (`translateY(3px)` no clique/toque) e feedback háptico (vibração precisa).
- **Paleta Arcade & Synth Retrô**: Vermelho Famicom/Arcade (`#ff2a55`), Ciano Synthwave (`#00e5ff`), Âmbar Vintage (`#ffb703`), Verde Fosfórico (`#00f59b`) e Roxo SNES (`#8b5cf6`).
- **LEDs Jewel Vitrificados & Visores HUD**: Indicadores de status translúcidos e displays de telemetria inspirados em instrumentos analógicos e monitores CRT.

---

## 🌟 Modos de Controle Integrados

```
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                      LOOKAREMOTE • 3D RETRO DECK 120HZ                      │
 ├─────────────────┬──────────────────┬─────────────────┬──────────────────────┤
 │   📺 SMART TV   │   🎯 AIR MOUSE   │   🎮 GAMEPAD    │   💻 PC & MAC DECK   │
 │ Rocker switches │ Retículo Radar   │ Domos Arcade 3D │ Touchpad Balístico   │
 │ Teclado Numérico│ Giroscópio 120Hz │ Analógicos Cônc.│ Teclado Mecânico     │
 │ Busca & Ditado  │ Gatilho Mecânico │ Gatilhos L2/R2  │ Deck Hi-Fi de Mídia  │
 └─────────────────┴──────────────────┴─────────────────┴──────────────────────┘
```

### 1. 📺 Modo Smart TV Universal
- **Rocker Switches 3D Táteis**: Controle ergonômico de Volume (`VOL+` / `VOL-`) e Canais (`CH+` / `CH-`) com pivô central tátil para `MUTE` e `INFO/GUIDE`.
- **D-Pad Circular 3D**: Prato direcional de 5 vias em relevo com domo central metálico `OK / Enter`.
- **Barra de Busca & Ditado por Voz**: Digitação remota instantânea e reconhecimento de fala (Web Speech API) direto para a TV.
- **Teclado Numérico 3D de Canais**: Modal retrô retrátil com teclas mecânicas (`0–9`, `Recall`, `Info`).
- **Atalhos de Streaming**: Teclas rápidas com acabamento 3D para Netflix, YouTube, Prime Video e Disney+.
- **Descoberta Automática de TVs**: Scanner de rede local via SSDP / mDNS (Samsung, LG, Google TV, Roku).

### 2. 🎯 Modo Air Mouse / Magic Pointer (Giroscópio 120 Hz)
- **Rastreamento Inercial de Alta Precisão**: Mova o cursor na tela da TV ou PC com movimentos naturais do pulso.
- **Filtros Anti-Tremor e Zona Morta**: Pipeline com calibração automática de bias para máxima estabilidade.
- **Gatilho de Clique 3D, Trava de Arrasto & Botão Centralizar**: Clique primário com visual mecânico, trava de arrasto (drag lock) e botão para centralizar o apontador instantaneamente.

### 3. 🎮 Modo Gamepad (Console & PC Gaming)
- **Dois Analógicos 3D Côncavos**: Thumbsticks emborrachados com anéis concêntricos antiderrapantes, deadzone e clique L3/R3.
- **Action Diamond com Domos Arcade 3D**: Botões `A`, `B`, `X`, `Y` com relevo convexo brilhante e alta sensibilidade.
- **D-Pad em Cruz Neomórfica**: Relevo direcional para trocas de armas, seleção em menus e jogos de luta.
- **Gatilhos Progressivos e Bumpers**: `LB`/`RB` mecânicos e `LT`/`RT` analógicos com barra de progresso em tempo real.
- **Suporte Multiplayer**: Cartuchos de jogador (P1, P2, P3, P4) com cores distintas e telemetria de bateria.

### 4. 🖱️ Modo Trackpad & Gestos (PC & Mac)
- **Superfície Rebaixada Multitoque**: Algoritmo de aceleração balística e scroll natural.
- **Botões Físicos de Mouse 3D**: Botões táteis dedicados para Clique Esquerdo, Botão do Meio e Clique Direito.
- **Gestos Suportados**: 1 dedo (cursor e toque), 2 dedos (scroll suave e clique direito), toque duplo com arrasto.

### 5. ⌨️ Modo Teclado Mecânico & Produtividade
- **Keycaps Mecânicas Retrô 3D**: Teclas de perfil alto com chanfros superiores e sombras de profundidade.
- **Modificadores com LEDs de Ativação**: Modificadores persistentes (`CTRL`, `ALT`, `SHIFT`, `WIN/CMD`) com indicadores LED individuais.
- **Atalhos e Macros de Produtividade**: Teclas para Copiar, Colar, Desfazer, Refazer, Alt+Tab, Desktop e Alt+F4.
- **Ponte com Teclado Nativo do Celular**: Campo de entrada oculto que captura pontuação, acentuação e emojis do teclado móvel.

### 6. 📼 Deck de Mídia Hi-Fi Vintage
- **Dial Master 3D de Play/Pause**: Botão circular centralizado com chanfro ciano neon.
- **Teclas de Transporte**: Faixa Anterior, Próxima Faixa, Stop e controle de volume contínuo com repetição ao segurar.

---

## 🏗️ Arquitetura de Comunicação & Performance

```
  ┌────────────────────────┐                   ┌────────────────────────┐
  │   Smartphone (PWA)     │                   │     Host Daemon (PC)   │
  │   (React + TypeScript) │                   │      (Rust Async)      │
  │   • 3D Retro UI Engine │                   │      • tokio + webrtc  │
  └───────────┬────────────┘                   └───────────┬────────────┘
              │                                            │
              │  1. Pareamento Seguro (QR Code / Token)    │
              │  Diffie-Hellman X25519 + HMAC-SHA256       │
              ├───────────────────────────────────────────>│
              │                                            │
              │  2. WebRTC DataChannel (UDP / 120Hz)       │
              │  Protocolo Binário Zero-Allocation (~12ns) │
              │===========================================>│
              │                                            │
              │  3. Injeção de Entrada Nativa no SO        │
              │                                            ├──> macOS (CoreGraphics)
              │                                            ├──> Windows (SendInput)
              │                                            └──> Linux (/dev/uinput)
              │                                            │
              │  4. Controle Direto de Smart TVs na Rede   │
              │                                            └──> SSDP / mDNS / WebSocket
```

- **Taxa de Amostragem de 120 Hz**: Loops dedicados para Gamepad e Giroscópio garantem precisão para jogos competitivos.
- **Watchdog de Segurança (100 ms)**: Libera automaticamente teclas ou eixos travados caso haja perda repentina de sinal.
- **Criptografia Zero-Knowledge**: As chaves efêmeras são geradas localmente no aparelho a cada sessão.

---

## 🚀 Guia de Início Rápido

### Pré-requisitos
- [Rust 1.75+](https://www.rust-lang.org/tools/install) (para compilar o host daemon)
- [Node.js 18+](https://nodejs.org/) (para o cliente web / PWA)

---

### Passo 1: Iniciar o Host Daemon no Computador

```bash
# Clone o repositório
git clone https://github.com/lucasmartins-ai/lookauniversalremote.git
cd lookauniversalremote

# Instale dependências e execute o Daemon
cargo run --manifest-path apps/host-daemon/Cargo.toml
```

O Daemon inicializará o servidor de sinalização e exibirá um **QR Code de Pareamento Seguro** diretamente no terminal.

---

### Passo 2: Conectar o Smartphone

1. Abra o navegador do seu celular no endereço do cliente web:
   ```
   http://<IP_DO_SEU_COMPUTADOR>:5173
   ```
   *(Ou execute `npm run dev` dentro de `apps/web-client` para rodar o cliente web)*
2. **Escaneie o QR Code** exibido no terminal ou use a aba **Manual Pair** (conexão rápida em 1 clique).
3. **Pronto!** O controle conectará instantaneamente via WebRTC DataChannel.

---

## 🧪 Testes e Validação de Qualidade

Execute a suíte completa de testes unitários e de integração:

```bash
# Executa todos os testes do monorepo (Protocolo, Criptografia, UI, Sensores)
npm test

# Validação de compilação do Web Client PWA
npm --prefix apps/web-client run build

# Validação do Host Daemon em Rust
cargo test --manifest-path apps/host-daemon/Cargo.toml
```

---

## 📦 Estrutura do Monorepo

```
LookARemote/
├── apps/
│   ├── host-daemon/           # Servidor Rust nativo (WebRTC, uinput, CoreGraphics, Smart TV SSDP)
│   └── web-client/            # PWA React + TypeScript (UI 3D Neumórfico, IMU 120Hz, Haptics)
├── packages/
│   ├── protocol/              # Encoder/Decoder binário em Rust (Zero-allocation)
│   └── protocol-types/        # Tipos e esquemas binários para TypeScript
├── docs/                      # Especificações técnicas, ADRs e roadmap
└── scripts/                   # Utilitários de build, empacotamento e release
```

---

## 📄 Licença

Distribuído sob a licença **MIT**. Consulte o arquivo [LICENSE](LICENSE) para mais detalhes.
