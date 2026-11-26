# Mapa Mental — notas para o Claude

App de mapas mentais (PWA) com a identidade visual do **Grasshopper** (Rhino). O
usuário fala **português do Brasil**, usa Grasshopper e manda prints dele como
referência: a fidelidade ao visual e ao comportamento do Grasshopper é prioridade.
Ele não é programador — prefere que o Claude execute as configurações (Supabase,
GitHub) pelo navegador, pedindo autorização antes de mudanças em contas.

## Estrutura
- `www/` — o app inteiro (sem build): `index.html`, `styles.css`, `app.js`
  (um único IIFE), `sw.js` (offline), `manifest.webmanifest`, `config.js`
  (endereço e chave **pública** do Supabase), `icons/`.
- `supabase/schema.sql` — tabelas, RLS por papel (owner/editor/commenter/viewer),
  `join_map_by_link`, `map_people`, autorização do Realtime. Idempotente.
- `server.js` — servidor local (`npm start` → http://localhost:5173).
- `tools/make-icons.js` — gera os PNGs dos ícones (`npm run icons`).
- `.github/workflows/pages.yml` — publica `www/` no GitHub Pages a cada push na `main`.

## Onde está publicado
- Site: https://aciole-pereira.github.io/mapa-mental/ (repositório público
  aciole-pereira/mapa-mental). `git push` atualiza em ~1 min.
- Supabase: projeto `hbnzgwxyscephskkuqfh`. Auth → URL Configuration tem o Site
  URL do GitHub Pages e as Redirect URLs `https://aciole-pereira.github.io/mapa-mental/**`
  e `http://localhost:5173/**`.
- IA: cada pessoa usa a própria chave da Anthropic (salva só no aparelho, em
  `localStorage['mm.ai']`), SDK oficial carregado por CDN.

## Convenções
- Ao mudar arquivos de `www/`, aumentar `VERSION` em `www/sw.js` (cache offline).
- `checkpoint()` antes de toda mutação (é também o bloqueio de "somente leitura");
  `changed()` depois (sincroniza com a nuvem e salva).
- Textos da interface em português.
- **Pastas:** uma ideia vira pasta com 3 cliques. Objetos dentro têm `n.parent = id`
  da ideia; `makeNode` preenche isso com a pasta aberta (`currentFolder`). A
  visibilidade (caminho até a pasta + conteúdo) entra em `computeHidden()`, então
  tudo que já respeita `isHidden()` funciona por nível. Apagar/copiar uma pasta leva
  o conteúdo junto (`withFolderContents`).
- **Travado** (`n.locked`) tem a aparência do "Disable" do Grasshopper.
- **Texto formatado dos painéis:** `n.rich` (parágrafos com `align/list/ind` e trechos
  `{t,b,i,u,s,f,z,c,h}`), editado por um `contenteditable` (`openRich`/`htmlToRich`) e
  desenhado no canvas por `drawRich`. `n.text` segue com o texto puro; se ele mudar por outro
  caminho e não bater mais com o `rich`, o `rich` é ignorado (`richOf`). Validação em `normRich`.

## Testes no navegador (importante)
Testar sempre numa **aba nova**, com um **mapa de teste** criado via JS e aberto
pela lista "Meus mapas" (sem recarregar a página); no fim, apagar o mapa de teste
e restaurar `mm.current`. **Nunca** usar `localStorage.clear()` nem digitar atalhos
na aba que o usuário está usando — ele usa o mesmo painel enquanto o Claude trabalha.
Para medir a posição de um elemento que aparece durante um arraste (ex.: a
lixeira), medir **depois** que ele aparece.
