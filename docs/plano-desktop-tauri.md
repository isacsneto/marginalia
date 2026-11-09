# Plano: executável desktop (Windows e Mac) com Rust

> **Status: adiado.** Ideia registrada em 2026-11-09. Nada disso foi implementado. A versão web (`node server.js`) continua sendo a oficial.

## Decisão recomendada: Tauri 2

O backend passa a ser Rust e a interface atual (`public/`) continua igual, rodando no navegador interno do sistema (WebView2 no Windows, WebKit no Mac). O instalador fica com ~8–12 MB.

| Opção | Veredito |
|---|---|
| **Tauri 2** (Rust no backend, UI atual) | ✅ Reaproveita as ~1.500 linhas da UI. Esforço de ~1 semana. |
| UI 100% Rust (iced, egui, Slint, Dioxus) | ⚠️ Exige reescrever a UI inteira, e o visual atual é difícil de reproduzir. Esforço de 3–4 semanas. |
| Ratatui (terminal) | ❌ Não mostra capas nem imagens. |
| Node empacotado (SEA), sem Rust | Funciona, mas fica com ~80 MB, abre no navegador e não usa Rust. |

## Arquitetura alvo

```
┌─────────── App Tauri (.exe / .app) ───────────┐
│  Navegador interno: public/ (praticamente igual)│
│        │  invoke("classify", …)  (sem HTTP)      │
│  Rust:  storage · importer · covers · ai         │
│        │                                         │
│  claude / codex / cursor (CLI)  ·  APIs via HTTP │
└──────────────────────────────────────────────────┘
Dados: %APPDATA%\BibliotecaBud  |  ~/Library/Application Support/BibliotecaBud
```

O app não abre porta local, então as checagens de Host, Origin e Content-Type (proteção contra CSRF e DNS rebinding) deixam de ser necessárias.

## O que muda em cada arquivo

O backend atual tem ~970 linhas de JS.

| Hoje (Node) | Em Rust | Crates |
|---|---|---|
| `server.js`: rotas, gravação atômica, backups diários, 409 por `savedAt` | `#[tauri::command]`, com um `Mutex` no lugar da fila `serial()` | `tauri`, `serde_json`, `chrono` |
| `lib/importer.js` | Tradução direta, com os mesmos testes | `regex` |
| `lib/prompts.js` | Textos em `const` / `format!` | — |
| `lib/ai.js`: CLIs | Execução com timeout, encerrando o processo e seus filhos | `tokio::process`, `which` |
| `lib/ai.js`: APIs | HTTP direto (não há SDK oficial da Anthropic para Rust); manter o header beta e o fallback | `reqwest` (rustls) |
| `lib/covers.js` | Bing, Google Books e Open Library; dimensões da imagem | `reqwest`, `regex`, `imagesize` |
| `public/app.js` | Só a função `api()` muda: vira um adaptador rota → `invoke(...)` | `window.__TAURI__` |
| `/covers/…` | Esquema próprio `covers://`; continuar salvando `/covers/x.jpg` no JSON e traduzir na hora de exibir | `register_uri_scheme_protocol` |
| Exportar/restaurar backup, links externos | Diálogo nativo de arquivo e abertura no navegador padrão | `tauri-plugin-dialog`, `tauri-plugin-opener` |

## Fases

0. **Ambiente (~1h).**
   - Instalar o Rust (`winget install Rustlang.Rustup`) e o VS Build Tools com o componente "Desktop C++".
   - Criar `src-tauri/` com `npm create tauri-app`, numa branch separada.
1. **Casca (~½ dia).**
   - Configurar `frontendDist` apontando para `public/`.
   - Baixar as fontes Fraunces e Inter para dentro do app (funcionar offline e respeitar a CSP).
   - Escrever o adaptador `api()` → `invoke`.
2. **Armazenamento (~1 dia).**
   - Biblioteca e configurações com gravação atômica, backups diários (7 dias) e conflito de versão (409).
   - Na primeira execução, migrar a pasta `data/` atual, com livros e capas.
3. **Importador e capas (~1–2 dias).**
   - Traduzir o importador e os testes (`#[cfg(test)]`).
   - Busca automática de capas, lista de opções, envio de imagem e remoção.
4. **IA (~2 dias).**
   - Detectar os provedores.
   - Claude CLI, incluindo imagens via stream-json; Codex; Cursor.
   - APIs da Anthropic e da OpenAI; teste de conexão.
5. **Acabamento (~1 dia).**
   - Ícone e janela que lembra tamanho e posição.
   - Opcional: API keys no cofre do sistema (`keyring`).
   - Opcional: atualização automática (`tauri-plugin-updater`).
6. **Build.**
   - Windows: `cargo tauri build` gera o instalador NSIS `.exe` e um `.msi`.
   - Mac: precisa de uma máquina macOS. O caminho prático é o GitHub Actions com `tauri-action` (matriz Windows + macOS), gerando o alvo `universal-apple-darwin`.

## Pontos de atenção

1. **PATH no Mac:** um app aberto pelo Finder não herda o PATH do shell, então `claude` e `codex` não seriam encontrados. Corrigir com `fix-path-env` ou lendo `$SHELL -ilc 'echo $PATH'`.
2. **Janelas de console no Windows:** usar `CREATE_NO_WINDOW` ao chamar os CLIs. Os atalhos `.cmd` continuam precisando de `cmd /C`.
3. **Assinatura digital:**
   - Mac: sem assinatura, aparece o aviso "app danificado". Para uso pessoal, basta `xattr -cr App.app`. Para distribuir, é preciso Apple Developer (US$ 99/ano) e notarização.
   - Windows: sem certificado, aparece o aviso do SmartScreen. Para uso pessoal, não tem problema.
4. **Busca de capas pelo Bing:** continua frágil. Se o Bing mudar a página, é preciso lançar uma versão nova do app, ou ter o atualizador automático ligado.
5. **Compatibilidade de dados:** manter o mesmo formato de JSON, para que os backups da versão web e da desktop sejam intercambiáveis.
