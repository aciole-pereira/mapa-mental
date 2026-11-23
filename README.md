# Mapa Mental

Editor de mapas mentais com a linguagem visual de programação por nós e fios:
canvas cinza com grade, ideias como "componentes" com bolinhas de entrada/saída,
conexões em curva, seleção em verde, painéis amarelos de notas, grupos coloridos
e estados (normal, aviso, erro, desativado).

É um **PWA** (Progressive Web App): um único código que se **instala** no
computador (Windows/Mac/Linux), no Android e no iPhone/iPad, abre em janela
própria com ícone e **funciona sem internet**. Os mapas ficam salvos no próprio
aparelho.

## Rodar no computador (teste local)

Precisa do [Node.js](https://nodejs.org) (nenhuma outra dependência).

```powershell
npm start
```

Abra http://localhost:5173 no Chrome ou Edge.

## Instalar

O app precisa ser servido por **HTTPS** para ser instalável nos celulares
(no computador, `localhost` já funciona). Veja "Publicar" abaixo.

| Dispositivo | Como instalar |
|---|---|
| **Windows / Mac** (Chrome ou Edge) | Botão **Instalar app** no topo, ou ícone de instalar na barra de endereço |
| **Android** (Chrome) | Botão **Instalar app**, ou menu ⋮ → **Instalar app** |
| **iPhone / iPad** (Safari) | **Compartilhar** → **Adicionar à Tela de Início** |

## Site publicado

**https://aciole-pereira.github.io/mapa-mental/** — publicado pelo GitHub Pages
(fluxo em `.github/workflows/pages.yml`). Para atualizar o site, basta enviar
as mudanças: `git push` (a publicação leva cerca de 1 minuto).

## Publicar (para instalar nos celulares)

Publique só a pasta `www/` em qualquer hospedagem estática com HTTPS gratuita:

- **Netlify Drop**: arraste a pasta `www` em https://app.netlify.com/drop
- **GitHub Pages**: suba o projeto num repositório e publique a pasta `www`
- **Cloudflare Pages** / **Vercel**: diretório de saída = `www`

Ao publicar uma nova versão, aumente `VERSION` em `www/sw.js` para que os
aparelhos baixem a atualização.

## Como usar

| Ação | Mouse / teclado | Toque |
|---|---|---|
| Criar ideia | Duplo clique no fundo | Toque duplo no fundo, ou botão **+** |
| Conectar | Arraste da bolinha direita até outra ideia | Igual |
| Criar já conectada | Arraste da bolinha e solte no vazio | Igual |
| Ideia filha / irmã | `Tab` / `Enter` | Botão **+** com uma ideia selecionada |
| Editar texto | Duplo clique ou `F2` | Toque duplo |
| Menu (estado, cor, excluir…) | Botão direito | Segurar o dedo |
| Mover o canvas | Arrastar com botão direito ou do meio | Arrastar o fundo |
| Zoom | Roda do mouse, `+` `-` `0` | Pinça com dois dedos |
| Seleção por caixa | Arrastar o fundo (→ dentro, ← cruzando) | Ative **Exibir → Seleção** |
| Desfazer / refazer | `Ctrl+Z` / `Ctrl+Y` | Aba **Editar** |
| Copiar / colar / duplicar | `Ctrl+C` / `Ctrl+V` / `Ctrl+D` | Menu de contexto |
| Agrupar | `Ctrl+G` | Aba **Criar → Grupo** |
| Ajustar à tela | `F` | **Exibir → Ajustar** |

Exportação (menu **Arquivo**): .json (backup ou passar a outro aparelho e usar
**Importar**), imagem PNG (fundo transparente, sem a grade) e PDF (fundo branco). Se houver objetos selecionados, a imagem e o
PDF saem só com a seleção.

### Outros recursos

| Recurso | Onde |
|---|---|
| Lápis (desenho livre, cor e espessura) | **Criar → Anotações → Lápis** · tecla `P` (Esc sai) |
| Nota / texto / ideia rápidos | Teclas `N` / `T` / `I` |
| Fios com cor, tracejado, seta e rótulo | Botão direito no fio · duplo clique edita o rótulo |
| Ícones nas ideias e cor por ramo | Botão direito na ideia |
| Modelos (mapa mental, SWOT, retrospectiva, roadmap, jornada, kanban, brainstorm) | **Criar → Modelos** |
| Texto → mapa (lista com recuos vira mapa) | **Criar → Texto→mapa** |
| Buscar no mapa | `Ctrl+F` |
| Histórico de versões (automático a cada 10 min) | **Arquivo → Histórico de versões** |
| Travar objetos | `Ctrl+L` ou botão direito |
| Camadas: mostrar/ocultar grupos | **Exibir → Camadas** |
| Apresentação grupo a grupo | **Exibir → Apresentar** (← → navegam, Esc sai) |
| Timer e votação com pontinhos | **Exibir → Reunião** |

### Inteligência artificial (com a chave de cada pessoa)

Menu **IA** ou aba **Criar → IA**: gerar um mapa a partir de um tema, expandir a
ideia selecionada, resumir o mapa (ou a seleção) num painel e agrupar notas por
tema.

Cada pessoa usa a **própria chave de API da Anthropic** (criada em
console.anthropic.com — é separada da assinatura Claude Pro). A chave fica salva
só no aparelho, vai direto do navegador para a API da Anthropic e nunca é
exportada com o mapa; cada pessoa paga apenas o próprio uso. A Anthropic não
permite que apps de terceiros usem o login/assinatura do claude.ai.
Modelos: Claude Opus 5.5 (padrão), Sonnet 5.5 ou Haiku 5.5.

### Conta, sincronização e colaboração (Supabase)

Botão **Entrar** no topo: e-mail e senha (com "Criar conta" e "Esqueci a senha")
ou link de acesso por e-mail. A sessão fica salva em cada aparelho/navegador.
Com a conta aberta, os mapas são salvos na nuvem, podem ser **compartilhados por
link** (ver, comentar ou editar), editados **em tempo real** com os cursores de
cada pessoa e recebem **comentários com @menções**.
Configuração: `www/config.js` (endereço e chave pública do projeto) e
`supabase/schema.sql` (tabelas e regras de permissão).

## Estrutura

```
www/                  ← o app (é só isso que vai para a hospedagem)
  index.html
  styles.css
  app.js              ← editor (canvas, nós, fios, salvamento, desfazer)
  sw.js               ← funcionamento offline
  manifest.webmanifest← nome, cores e ícones do app instalado
  icons/
server.js             ← servidor local para testes
tools/make-icons.js   ← gera os PNGs dos ícones (npm run icons)
```

## Próximos passos possíveis

- **Lojas (Google Play / App Store / Microsoft Store)**: empacotar a pasta
  `www` com [Capacitor](https://capacitorjs.com) ou [PWABuilder](https://www.pwabuilder.com).
  A App Store exige conta de desenvolvedor Apple e um Mac para compilar.
- **Sincronizar entre aparelhos**: hoje cada aparelho guarda seus mapas; dá para
  adicionar login + nuvem (ex.: Supabase/Firebase) ou sincronizar pelo arquivo .json.

Inspirado na estética de editores de programação visual; não usa marcas,
logotipos ou arquivos de terceiros.
