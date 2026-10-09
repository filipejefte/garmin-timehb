# Time Híbrido → Garmin Connect

Cria e agenda no calendário do Garmin Connect os treinos das 12 semanas do plano
Time Híbrido (5 km, Iniciante Nível 2): **corrida** e **musculação**, a partir
da planilha `data/time_hibrido.xlsx`.

Há dois jeitos de usar:

- **Interface web** (abaixo) — abre no navegador, mostra os treinos da planilha,
  deixa editar e gera um script que você cola na aba do Garmin Connect já
  logada. Não precisa instalar nada nem fazer login pelo script.
- **Linha de comando / app Streamlit** (Python) — o fluxo original, descrito
  mais abaixo.

## Interface web (ver, editar e enviar pela aba do navegador)

`index.html` + `web/` formam uma página estática: roda direto no GitHub Pages
ou em qualquer servidor simples. Tudo acontece no seu navegador — a planilha
não é enviada para lugar nenhum.

**O que dá para fazer**

- Abrir o **PDF do plano do Time Híbrido** direto na página (botão *Abrir PDF ou
  planilha*): a leitura acontece no navegador, com as mesmas regras do
  `pdf_para_planilha.py`, e os exercícios já vêm ligados ao catálogo do Garmin
  pelo De-para padrão (`web/depara.js`). Lê durações em minutos e em segundos
  (`30 SEG`), prova por km e os detalhes do PDF (ex.: `( BULGARO 12 CADA PERNA )`).
  Um plano aberto por PDF começa na próxima segunda — mude no campo do topo.
  Confira os treinos depois de abrir e use *Baixar planilha* para guardar em `.xlsx`.
- **Prefixo nos nomes** (opcional): para ter dois planos no Garmin sem misturar
  (ex.: `3K S01 · Intervalado 1:1` ao lado do `S01 · Intervalado 1:1` do plano
  anterior).
- Ver os 95 treinos por semana, com a data calculada a partir da segunda-feira
  da semana 1 e dos dias da musculação (A=Sáb, B=Dom, C=Seg, D=Ter, E=Qua).
- Clicar num treino para editar: corrida (dia, tipo, repetições, tempos,
  zonas, notas) ou musculação (exercícios, blocos, séries, reps, descanso,
  aquecimento, exercício do Garmin no De-para). A prévia mostra como fica no
  relógio. As edições ficam guardadas no navegador; **Baixar planilha** gera o
  `.xlsx` atualizado para substituir o `data/time_hibrido.xlsx`.
- Selecionar o que enviar e **Gerar script**.

**Apoie o projeto** — o botão *Apoiar o projeto*, no topo, abre o Pix para
doação (valor livre). A chave e o QR ficam no topo de `web/app.js` (`PIX`) e em
`assets/pix-qr.png`.

**Enviar ao Garmin**

1. Na página, selecione os treinos (o padrão é "de hoje em diante") e clique em
   **Gerar script** → **Copiar script**.
2. Abra https://connect.garmin.com/app/calendar já logado.
3. `F12` → aba **Console** → cole → `Enter`. Se o navegador bloquear a
   colagem, digite `allow pasting` e cole de novo.
4. Quando o painel verde no canto pedir, clique na seta ‹ › do mês (ou em
   **Ano**): é assim que o script pega o token da sua sessão.

O painel mostra o progresso e, no fim, confere no Garmin se tudo ficou certo
(treinos criados, sem nome duplicado, datas no calendário).

**Opções do envio**

| Opção | O que faz |
|-------|-----------|
| Manter as datas que já estão no Garmin | Agenda só o que ainda não está no calendário; o que você moveu à mão fica onde está. |
| Colocar na data do plano | Move os selecionados para a data mostrada na página (use depois de mudar a semana 1 ou o dia de um treino). |
| Não mexer no calendário | Só cria/atualiza em "Meus treinos". |
| Se já existe: pular / substituir | Treino com o mesmo nome é reaproveitado ou recriado. Treinos editados na página são substituídos quando estão diferentes do que está no Garmin. |
| Só simular | Lista no Console o que faria, sem gravar nada. |

**Proteção contra outro plano com os mesmos nomes:** antes de gravar, o script
compara cada treino com o que já está no Garmin. Se um treino tem o mesmo nome
mas outro conteúdo (e você não o editou na página), ele **não mexe** nesse treino
e pergunta no painel se deve continuar só com os outros — a saída é usar um
prefixo nos nomes ou marcar *Substituir*.

O script é seguro para colar de novo: o que já foi feito é pulado. Se a sessão
cair no meio, recarregue a página do Garmin, entre na conta se pedir e cole o
mesmo script — ele continua de onde parou.

**Como funciona por dentro** (caminho validado em 12/08/2026)

- A página não fala direto com o Garmin (é outro domínio). O script roda na aba
  do Garmin e usa `/gc-api/...` com os cookies da sessão + o header
  `connect-csrf-token`, que ele captura interceptando uma chamada do próprio app.
- Os treinos vão compactados (gzip + base64) dentro do script; o código que
  envia fica legível em `web/uploader.js`.
- `web/builder.js` monta os treinos com as mesmas regras do projeto Python:
  corrida no formato do `th_upload_console.js` e musculação igual ao
  `montar_musculacao.py` (bi-set com descanso no botão Lap, `6 / 12` na mesma
  série, pirâmide com a sequência na descrição, aquecimento fixo). A saída foi
  conferida contra o Python: os 60 treinos de musculação e os 35 de corrida
  saem idênticos.
- O dedupe é pelo nome (`S01 · Intervalado 1:1`, `S01 A · Peito/Ombro/Tríceps`).
  Se uma edição muda o nome, o treino com o nome antigo é substituído.

**Rodar localmente**

```powershell
py -m http.server 8000
```

e abra http://localhost:8000. (Aberta direto do disco, com dois cliques no
`index.html`, a página pede para você escolher a planilha.)

**Publicar no GitHub Pages**

1. Suba o projeto para um repositório no GitHub.
2. Settings → Pages → *Build and deployment* → Source: **Deploy from a branch**
   → Branch: `main` / `(root)` → Save.
3. A página fica em `https://<seu-usuario>.github.io/<repositorio>/`.

> Num repositório **público**, a planilha `data/time_hibrido.xlsx` (o conteúdo
> do plano) fica pública junto. Se não quiser, tire `data/time_hibrido.xlsx` do
> git — a página continua funcionando e pede o arquivo na hora de abrir.

Para mudar a âncora padrão (segunda da semana 1), edite `CONFIG_PADRAO` no topo
de `web/app.js` — ou só troque a data na própria página.

## App visual Streamlit

Em vez da linha de comando, dá para usar o app local: sobe o PDF, revisa em
tabelas, escolhe os dias da musculação e publica com um clique.

```powershell
pip install -r requirements.txt
streamlit run app.py
```

Abre no navegador em `http://localhost:8501` (roda só na sua máquina). O fluxo é:
subir PDF → revisar (Corrida / Musculação / De-para) → escolher datas e os dias
de cada treino de musculação → conectar ao Garmin → publicar corrida e/ou musculação.

No primeiro login pode pedir o código MFA (campo próprio no app). Depois, use
"entrar com sessão salva" — sem senha e sem MFA.

O restante deste README documenta a **linha de comando**, que o app usa por baixo.

## Instalar

```powershell
pip install -r requirements.txt   # garminconnect (+curl_cffi), streamlit, pandas, pdfplumber, openpyxl
```

Requer Python 3.10+. No Windows, se `python` abrir a Microsoft Store, use `py`.

## Estrutura do projeto

```
index.html              # interface web (GitHub Pages) — ver, editar e gerar o script de envio
web/
  app.js                # interface: planilha/PDF, semanas, editor, seleção, Pix
  pdf-plano.js          # leitura do PDF do plano no navegador (port do pdf_para_planilha.py)
  depara.js             # De-para padrão exercício -> Garmin (de de_para_exercicios.py)
  builder.js            # planilha -> JSON do Garmin (mesmas regras do Python)
  uploader.js           # script que roda na aba do Garmin Connect
  style.css             # visual Time Híbrido
th_upload_console.js    # script de console original (corrida, validado em 12/08/2026)
th_limpar_calendario.js # tira do calendário os treinos do plano (sem apagar da biblioteca)
app.py                  # app visual (Streamlit)
tema.py                 # identidade visual do Time Híbrido (cores, tipografia, componentes)
garmin_time_hibrido.py  # CLI principal: prévia, publicação, exclusão
pdf_para_planilha.py    # PDF do plano → data/time_hibrido.xlsx
montar_musculacao.py    # monta os treinos de força a partir da planilha
de_para_exercicios.py   # mapeamento exercício BR → catálogo Garmin
requirements.txt        # dependências (pip install -r requirements.txt)
.streamlit/config.toml  # tema base do Streamlit (cores da marca)
assets/
  logo_time_hibrido.png # logo do jacaré, extraído do PDF
data/
  time_hibrido.xlsx     # planilha do plano (fonte dos treinos)
  garmin_exercises.json # catálogo Garmin (consulta p/ o De-para)
garmin-curl.txt         # sessão copiada do navegador (NÃO versionar — já no .gitignore)
th_preview.json         # prévia gerada pelo --start (gerado, ignorado no git)
```

Rode os comandos sempre a partir desta pasta (os caminhos padrão são relativos).

## O visual do app

O app segue a identidade do PDF do Time Híbrido, e as escolhas não são decorativas
— vieram do próprio arquivo:

- **verde-escuro** (`#042705`) nos títulos condensados em caixa alta, com o
  **marca-texto verde-neon** (`#3CFF00`) da capa sobre a palavra-chave;
- **corrida é verde, musculação é azul** — a mesma codificação que o PDF usa nas
  setas de etapa e nas faixas de cabeçalho de cada treino;
- as **setas de etapa** (Base → Consolidação → Alvo) viram os 5 passos do app, e
  acendem conforme você avança;
- **caixas creme** (`#FDF9B4`) para as notas, com a assinatura "Time Híbrido";
- o **jacaré** em marca d'água ao fundo, como nas páginas do plano.

Tudo isso mora em [tema.py](tema.py) — mexa lá para ajustar cores ou tipografia.

## Como o login funciona (importante)

O login é a única parte sujeita ao bloqueio 429 da Garmin. Por isso o script foi
montado para **logar uma vez só**:

- Na **primeira** autenticação ele usa e-mail/senha (variáveis de ambiente) e
  salva os tokens da sessão em disco.
- Em **toda execução seguinte** ele retoma a sessão pelos tokens salvos — sem
  senha e **sem acessar o endpoint de login da Garmin**, então fica imune ao 429.

Ou seja: você só precisa passar pelo login com sucesso **uma vez**.

### Credenciais (só na primeira vez)

```powershell
$env:GARMIN_EMAIL = "seu@email.com"
$env:GARMIN_PASSWORD = "sua_senha"
```

Valem só para a janela atual do PowerShell. Confira com `echo $env:GARMIN_EMAIL`.
Depois do primeiro login bem-sucedido, **não precisa mais definir isso**.

## Fluxo recomendado

**1) Teste o login (uma requisição só):**

```powershell
py garmin_time_hibrido.py --check
```

Faz o login e confirma a sessão. É o comando ideal para verificar se um bloqueio
429 já passou, sem disparar o upload inteiro. Deu certo uma vez → tokens salvos.

**2) Confira a prévia (offline, não toca no Garmin):**

```powershell
py garmin_time_hibrido.py --start 2026-07-06
```

`--start` é a **segunda-feira** da primeira semana enviada. Imprime a agenda e
grava `th_preview.json`.

**3) Aplique de verdade:**

```powershell
py garmin_time_hibrido.py --start 2026-07-06 --apply
```

Cria e agenda os treinos. Rodar de novo é seguro: os que já subiram são
**pulados** (dedup pelo nome), então dá para retomar de onde parou.

### Nomenclatura dos treinos

Corrida: **`S01 · Intervalado 1:1`** — semana + label da planilha, onde o
`1:1` é esforço:recuperação em minutos. Musculação: **`S01 A · Peito/Ombro/Tríceps`**.

Sem prefixo e sem o dia da semana: o contexto completo (semana, etapa e a
estrutura do treino) vai na **descrição**, que aparece no relógio. A semana
é obrigatória no nome porque sem ela os nomes colidem — `Intervalado 1:1` é
14, 15 e 16 tiros nas semanas 1, 2 e 3.

> O dedup usa o nome, então mudar esse formato faz o script não reconhecer o
> que já está no Garmin e criar duplicatas. Se mudar, rode `--delete-th` antes.

### Passo 0 — gerar a planilha a partir do PDF

O `pdf_para_planilha.py` lê um PDF do Time Híbrido e gera a planilha de treinos:

```powershell
py pdf_para_planilha.py "planilha-treinos.pdf"
```

Isso cria `data/time_hibrido.xlsx` com quatro abas:

- **Corrida** — os 35 treinos (já publicáveis no Garmin).
- **Musculação** — todos os exercícios extraídos (série/reps/técnica), um por
  linha; bi-set e super-set aparecem como linhas seguidas com o mesmo `bloco`.
- **De-para** — cada exercício mapeado para o catálogo do Garmin, no par
  `(garmin_category / garmin_exercise)`. A coluna `confianca` marca os casos a
  revisar (máquinas BR sem equivalente exato). Consulte `data/garmin_exercises.json`
  para ver todos os pares válidos do catálogo.
- **Leia-me** — instruções e legenda de zonas.

A publicação da musculação no Garmin está em construção (próxima fase).

A leitura é heurística (offline), então **confira a planilha** antes de publicar
— qualquer linha é fácil de ajustar. Ciclo novo = rode isso no PDF novo.

### Usando a planilha como fonte (recomendado a partir de agora)

Em vez do plano fixo no código, o script pode ler tudo de uma planilha
(`data/time_hibrido.xlsx`). Aponte com `--sheet`:

```powershell
py garmin_time_hibrido.py --sheet data/time_hibrido.xlsx --start 2026-07-06
py garmin_time_hibrido.py --sheet data/time_hibrido.xlsx --start 2026-07-06 --apply
```

Cada linha da aba **Corrida** é um treino. Colunas principais:

- `tipo`: `intervalado` (usa reps, esforço e recuperação), `contínuo` (usa só
  esforço) ou `prova` (usa distância).
- `esforco_min` / `esforco_zona`, `recuperacao_min` / `recuperacao_zona`,
  `reps`, `aquecimento_min`, `desaquecimento_min`, `distancia_km`.
- `notas`: texto livre que aparece na descrição do treino no relógio.

As colunas de dia, tipo, etapa e zona têm **lista suspensa** para evitar erro de
digitação. A aba **Leia-me** traz as instruções e a legenda de zonas.

**Ciclo novo:** substitua as linhas pela nova planilha (mesmo formato) e rode
com `--sheet`. Não precisa mexer no código.

**Edição em massa:** troque exercícios/valores direto na planilha (localizar-e-
substituir, preencher pra baixo) e rode de novo.

### Começar de uma semana específica

`--from-week N` envia só a partir da semana N. Nesse caso `--start` é a segunda
da primeira semana enviada. Ex.: semana 5 na semana de 06/07:

```powershell
py garmin_time_hibrido.py --start 2026-07-06 --from-week 5 --apply
```

## Sobre o erro 429 (limite de login)

> **Contexto (mar/2026):** a Garmin passou a bloquear via Cloudflare o login
> das bibliotecas não oficiais antigas. O contorno que funciona é o
> `garminconnect >= 0.3.2` **com `curl_cffi` instalado** (estratégia
> "widget+cffi", que evita o rate limit por clientId). Os dois já estão no
> `requirements.txt`; o script confere isso antes de tentar logar. O login por
> essa estratégia espera 30–45 s de propósito — não interrompa.

Se aparecer `429 / rate limited`: o bloqueio é **na sua conta, não no seu IP** —
trocar de rede não resolve. Ele é disparado por tentativas de login seguidas.

- **Pare de tentar.** Cada tentativa **renova** o bloqueio. Pode levar de 1h a
  vários dias para liberar.
- O script tem uma **trava local**: depois de um 429, ele bloqueia novas
  tentativas de login por ~1h para você não piorar o quadro. Para ignorar a
  trava (quando tiver certeza de que já liberou), use `--force`.
- Sua conta continua funcionando normalmente no app e no site — eles usam um
  canal separado que não é limitado.
- Lembre: assim que você passar do login **uma vez**, os tokens ficam salvos e
  esse problema não volta.

## Zonas de FC

Os treinos usam **alvo por Zona de FC** (Z1 aquecimento/recuperação, Z3 esforço,
Z4 na prova). O relógio segue as zonas da **sua conta** Garmin. Para bater com o
plano, configure as zonas por **% da FCmáx**:

| Zona | % FCmáx |
|------|---------|
| Z1   | 50–59%  |
| Z2   | 60–69%  |
| Z3   | 70–79%  |
| Z4   | 80–89%  |
| Z5   | 90–95%  |

(Garmin Connect → Configurações → Frequência cardíaca → Zonas de FC → base "% FCmáx".)

## Recomeçar do zero

```powershell
py garmin_time_hibrido.py --delete-th --apply
```

Apaga só os treinos do Time Híbrido — os `S01 · ...` / `S01 A · ...` e também
os do formato antigo `TH ...` (pede confirmação e lista os nomes antes).
Treinos seus que não seguem esse padrão não são tocados.

## Todos os comandos

| Comando | O que faz |
|---------|-----------|
| `--check` | Testa o login (1 requisição) e sai |
| `--sheet ARQ.xlsx` | Lê o plano da planilha em vez do plano embutido |
| `--start DATA` | Prévia offline a partir daquela segunda-feira |
| `--start DATA --apply` | Cria e agenda no Garmin |
| `--from-week N` | Começa da semana N (com `--start` = 1ª semana enviada) |
| `--sheet X --musculacao` | Prévia dos treinos de musculação |
| `--sheet X --musculacao --apply` | Cria os treinos de musculação no Garmin |
| `--delete-th --apply` | Apaga os treinos `S01 · ...` e `TH ...` (corrida e musculação) |
| `--force` | Ignora a trava local de espera pós-429 |

## Ajustar o plano

A estrutura das 12 semanas está na lista `PROGRAMA`, em uma DSL curta:

```python
intervalado(reps, min_esforço, min_recuperação)   # ex.: intervalado(14, 1, 1)
continuo(minutos)                                  # ex.: continuo(20)
prova_5km()                                        # aquec + 5 km Z4 + desaq
```

## Publicar a musculação

Depois de revisar as abas **Musculação** e **De-para** da planilha:

```powershell
py garmin_time_hibrido.py --sheet data/time_hibrido.xlsx --musculacao            # prévia
py garmin_time_hibrido.py --sheet data/time_hibrido.xlsx --musculacao --apply     # cria no Garmin
```

Isso monta um treino de força por dia (Semana × Treino A–E, 60 no total) e cria
na sua biblioteca do Garmin (Connect › Treinos). Como o PDF não fixa qual dia da
semana é cada treino, eles são criados **sem agendar** — você agenda no calendário
ou escolhe o Treino A–E no relógio a cada dia de academia.

Como funciona a montagem:

- Cada exercício usa o par `(category, exercise)` da aba De-para.
- Séries iguais (4×15) viram um grupo de repetição; pirâmide (15-12-10-8-6) vira
  uma série por valor de rep; bi-set/super-set ficam em sequência com descanso ao final.
- O **nome original do PDF + a técnica** (drop-set, bi-set, pirâmide…) vão na
  descrição de cada exercício, preservando o que o Garmin não representa nativamente.
- `descanso_seg` da planilha vira o timer de descanso entre séries.

> Importante: a montagem foi validada offline (estrutura e catálogo), mas a
> publicação de treino de força por esta API é menos testada que a de corrida.
> Confirme o primeiro treino no app após criar.

## Limitações

- Técnicas como bi-set/drop-set/pirâmide não têm equivalente nativo no Garmin —
  viram exercícios em sequência; a técnica fica registrada na nota do exercício.
- Usa a mesma API interna do app web do Garmin (via `garminconnect`), não a API
  oficial de parceiros. Funciona bem, mas é engenharia reversa — pode quebrar se
  o Garmin mudar algo.
