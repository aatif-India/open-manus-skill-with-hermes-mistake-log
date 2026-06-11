<div align="center">

<img src="https://img.shields.io/badge/RIPLE%20AI-v4.0.0-FF6B35?style=for-the-badge&logo=android&logoColor=white" alt="Riple AI">

<br>

<img src="https://img.shields.io/badge/Platform-Android-3DDC84?style=flat-square&logo=android" alt="Android">
<img src="https://img.shields.io/badge/Language-Kotlin-7F52FF?style=flat-square&logo=kotlin" alt="Kotlin">
<img src="https://img.shields.io/badge/UI-Compose-4285F4?style=flat-square&logo=jetpackcompose" alt="Compose">
<img src="https://img.shields.io/badge/AI-Multi--Provider-FF6B35?style=flat-square" alt="AI">
<img src="https://img.shields.io/badge/Terminal-System%20Shell-0D9488?style=flat-square&logo=linux" alt="Terminal">
<img src="https://img.shields.io/badge/License-MIT-10B981?style=flat-square" alt="MIT">

<br><br>

<h3>The Terminal-Native AI Coding Agent for Android</h3>

<p>
Multi-provider LLM orchestration • Embedded Linux terminal • Modular skills system • 100% Jetpack Compose UI
</p>

<br>

</div>

---

## Overview

Riple AI is a native Android application that brings terminal-grade AI coding capabilities to mobile devices. It combines multi-provider LLM orchestration, an embedded Linux terminal, and a modular skills system into a single, performant interface built entirely with Jetpack Compose.

<br>

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        RIPLE AI v4.0.0                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Chat UI     │  │  Terminal    │  │  Skills System       │  │
│  │  (Compose)   │  │  (System /   │  │  (OpenClaw Format)   │  │
│  │              │  │   Alpine)    │  │                      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│  ┌──────▼─────────────────▼──────────────────────▼───────────┐  │
│  │                    Core Engine                            │  │
│  │  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │  │
│  │  │ Context │  │ Planning │  │ Tool     │  │ Local     │  │  │
│  │  │ Opt.    │  │ Engine   │  │ Registry │  │ Inference │  │  │
│  │  └─────────┘  └──────────┘  └──────────┘  └───────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                 Passive Skills (Always On)                │  │
│  │  Caveman (output)  •  Graphify (input)  •  RepoMap       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Providers                              │  │
│  │  Ollama • Groq • NVIDIA NIM • Google • OpenAI • Mistral   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

<br>

## Chat Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **OpenManus** | Plan + tools, structured execution | Complex multi-step tasks |
| **Hermes Agent** | Fast direct LLM, no planning overhead | Quick questions, simple edits |

<br>

## Key Features

<table>
<tr>
<td width="50%" valign="top">

### AI Capabilities

| Feature | Description |
|---------|-------------|
| Multi-Provider | 7+ LLM providers with smart fallback |
| Local LLM | On-device inference via Ollama |
| Tool Calling | File, code, web, shell, memory tools |
| Context Opt. | Smart compression & RepoMap |
| Token Stats | Real-time usage tracking |

</td>
<td width="50%" valign="top">

### Terminal & Skills

| Feature | Description |
|---------|-------------|
| System Shell | Universal terminal via `/bin/sh` |
| Alpine Linux | Full terminal (arm64 only) |
| OpenClaw Skills | Modular skill system with YAML frontmatter |
| Passive Skills | Always-on optimizers (Caveman, Graphify) |
| Adaptive Icons | Dynamic vector-based app icons |

</td>
</tr>
</table>

<br>

## Passive Token Optimizers

Always-on skills that optimize tokens without triggering:

| Skill | Type | What It Does |
|-------|------|--------------|
| **Caveman** | Output | Compresses verbose responses |
| **Graphify** | Input | Compresses context before sending |
| **RepoMap** | Input | Project structure awareness |

<br>

## Security

| Feature | Implementation |
|---------|----------------|
| API Keys | Android Keystore encryption |
| SSRF Protection | URL validation in `ApiKeyVault` |
| OOM Guards | File read caps (1MB), HTTP response caps (64KB) |
| Recursion Cap | Tool-call depth limited to 5 |
| Atomic Writes | `tmp + renameTo` with delete fallback |

<br>

## Native Libraries

| Library | Purpose | Platforms |
|---------|---------|-----------|
| `libllama.so` | On-device LLM inference | arm64-v8a, armeabi-v7a, x86_64 |
| `libproot.so` | Alpine Linux environment | arm64-v8a |
| `librust_agents.so` | Native agent execution | arm64-v8a, x86_64 |

<br>

## Providers

| Provider | Free Tier | Notes |
|----------|-----------|-------|
| Ollama | Unlimited | Local, on-device |
| Groq | ✅ | Fast inference |
| NVIDIA NIM | ✅ | Cloud |
| Google | ✅ | Gemini |
| OpenAI | ❌ | GPT-4 |
| Anthropic | ❌ | Claude |
| Mistral | ✅ | Mixtral |

<br>

## Tech Stack

```
Language:    Kotlin 1.9.24
UI:          Jetpack Compose (Material 3)
Architecture: MVVM + Clean Architecture
Database:    Room (v2 schema)
DI:          Hilt
Terminal:    System Shell (universal) / Alpine (arm64)
Build:       Gradle 8.5.2 + AGP 8.5.2
NDK:         26.1.10909125
Min SDK:     26 (Android 8.0)
Target SDK:  34 (Android 14)
```

<br>

## Build

```bash
# Clone
git clone https://github.com/RipleAI/Riple.git
cd Riple

# Build debug APK
./gradlew assembleDebug

# Output
app/build/outputs/apk/debug/app-debug.apk
```

<br>

## Configuration

Create `local.properties`:

```properties
sdk.dir=/path/to/android/sdk
```

<br>

## License

MIT License — see [LICENSE](LICENSE) for details.

<br>

---

<div align="center">

<img src="https://img.shields.io/badge/Built_with-%E2%9D%A4%EF%B8%8F-FF6B35?style=for-the-badge" alt="Made with love">

</div>
