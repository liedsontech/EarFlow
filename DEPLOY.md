# 🚀 Guia de Deploy + AdSense — EarFlow Web

Tudo que você precisa para colocar o EarFlow no ar (gratuitamente) e começar a monetizar.

---

## Parte 1 — Publicar no Vercel (5 minutos) 🎯

### Pré-requisitos
- Conta no **GitHub** (grátis): https://github.com/signup
- Conta no **Vercel** (grátis): https://vercel.com/signup — pode entrar **com o GitHub** em 1 clique

### Passo 1: Subir o código para o GitHub

```bash
cd c:\Users\Bruna\projeto\earflow-web

git init
git add .
git commit -m "EarFlow Web - versão inicial"
```

Crie um repositório novo em https://github.com/new:
- Nome: `earflow-web`
- Visibilidade: **Public** (necessário para o tier grátis com domínio público) ou **Private**
- **NÃO** marque "Add README" / "Add .gitignore" (já temos)

Depois conecte e dê push:

```bash
git remote add origin https://github.com/SEU_USUARIO/earflow-web.git
git branch -M main
git push -u origin main
```

### Passo 2: Importar no Vercel

1. Acesse https://vercel.com/new
2. Clique em **"Import Git Repository"**
3. Selecione o repositório `earflow-web`
4. O Vercel detecta automaticamente que é um projeto **Vite + React** ✅
5. Não precisa mudar **nada** nas configurações — o `vercel.json` já está pronto
6. Clique em **"Deploy"**

⏱️ Em ~60 segundos seu site estará no ar em uma URL como:

```
https://earflow-web-seu-usuario.vercel.app
```

### Passo 3: (Opcional) Domínio personalizado

No painel do Vercel:
1. Project → **Settings** → **Domains**
2. Adicione seu domínio (ex: `earflow.com.br`)
3. Configure os DNS conforme as instruções (CNAME ou A records)

> 💡 **Domínio grátis**: você pode usar `.vercel.app` indefinidamente sem custo.

### Passo 4: Atualizações automáticas

A partir daí, **todo `git push`** para a branch `main` faz **deploy automático**:

```bash
# Faça suas alterações...
git add .
git commit -m "Nova feature"
git push
# ✅ Vercel detecta e republica em ~1 minuto
```

---

## Parte 2 — Configurar Google AdSense 💰

### Passo 1: Criar conta no AdSense

1. Acesse https://www.google.com/adsense/start/
2. Login com sua conta Google
3. Preencha:
   - URL do site: `https://earflow-web-seu-usuario.vercel.app` (ou seu domínio)
   - País: Brasil
   - Categoria: Educação / Música
4. Aceite os termos e envie

### Passo 2: Adicionar o código de verificação ao site

O AdSense vai gerar um **Publisher ID** parecido com:
```
ca-pub-1234567890123456
```

E vai pedir para colocar uma tag no `<head>` do seu site para verificação.

#### 2a) Edite `index.html`

Abra `c:\Users\Bruna\projeto\earflow-web\index.html` e localize esta linha:

```html
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX"
        crossorigin="anonymous"></script>
```

Substitua `ca-pub-XXXXXXXXXXXXXXXX` pelo **seu Publisher ID** real.

#### 2b) Edite `AdBanner.tsx`

Abra `src/components/AdBanner.tsx` e troque a constante:

```typescript
const ADSENSE_CLIENT = 'ca-pub-XXXXXXXXXXXXXXXX'; // ← cole seu Publisher ID aqui
```

#### 2c) Push para o Vercel

```bash
git add .
git commit -m "Adiciona AdSense Publisher ID"
git push
```

Espere o deploy terminar (~1 min) e clique em **"Solicitar revisão"** no painel do AdSense.

### Passo 3: Aguardar aprovação ⏳

- A revisão do AdSense leva de **3 dias a 4 semanas**
- Durante esse período seu site continua online normalmente, mas **sem anúncios** (você verá os placeholders cinza onde os ads vão aparecer)
- Você receberá um e-mail com o resultado

> ⚠️ **Dica**: o AdSense é mais facilmente aprovado se o site tiver:
> - Conteúdo original (✅ você tem)
> - Domínio próprio (não obrigatório, mas ajuda)
> - Política de Privacidade e Termos de Uso (crie páginas simples)
> - Ao menos algumas semanas de tráfego real

### Passo 4: Criar os blocos de anúncio

Após aprovação, no painel do AdSense:

1. Vá em **Anúncios** → **Por unidade de anúncio**
2. Clique em **"Criar nova unidade de anúncio"**
3. Crie **4 blocos** (são os 4 espaços que o EarFlow já tem reservados):

| Nome do bloco | Tipo | Onde aparece |
|---|---|---|
| `topo-horizontal` | Display responsivo | Acima do conteúdo |
| `rodape-horizontal` | Display responsivo | Abaixo do conteúdo |
| `lateral-esquerda` | Display vertical | Sidebar esquerda (telas grandes) |
| `lateral-direita` | Display vertical | Sidebar direita (telas grandes) |

Cada bloco gera um **slot ID** (10 dígitos), tipo `1234567890`.

### Passo 5: Conectar os slots no código

Abra `src/App.tsx` e substitua os slots placeholder pelos reais:

```tsx
{/* Banner topo */}
<AdBanner slot="SEU_SLOT_TOPO" format="horizontal" className="w-full" />

{/* Skyscraper esquerdo */}
<AdBanner slot="SEU_SLOT_ESQUERDA" format="vertical" className="w-[160px] h-[600px]" />

{/* Skyscraper direito */}
<AdBanner slot="SEU_SLOT_DIREITA" format="vertical" className="w-[160px] h-[600px]" />

{/* Banner rodapé */}
<AdBanner slot="SEU_SLOT_RODAPE" format="horizontal" className="w-full" />
```

Push para o Vercel:

```bash
git add .
git commit -m "Configura slots reais do AdSense"
git push
```

✅ Em ~1 minuto os anúncios começam a aparecer!

---

## Parte 3 — Boas práticas para AdSense não te banir 🛡️

### O que **fazer**:
- ✅ Conteúdo original e útil (você já tem - exercícios musicais)
- ✅ Política de Privacidade no rodapé (exigido pela LGPD/GDPR)
- ✅ Avisar sobre cookies (use uma lib como `react-cookie-consent`)
- ✅ Espaçar os anúncios — **nunca** ter mais ad do que conteúdo na tela
- ✅ Fazer marketing honesto (compartilhar em grupos de músicos, redes sociais)

### O que **NÃO fazer**:
- ❌ **Nunca** clicar nos próprios anúncios (banimento na hora)
- ❌ **Nunca** pedir para amigos clicarem
- ❌ **Não** usar tráfego pago para AdSense (Google detecta)
- ❌ **Não** colocar ad em popup ou cobrindo conteúdo
- ❌ **Não** ter mais de 3 anúncios na primeira dobra

### Quanto você ganha?
- **CPM** (custo por mil impressões): R$ 1 a R$ 10 no Brasil
- **CPC** (custo por clique): R$ 0,10 a R$ 1
- Sites de educação/música tendem a ter **CPC mais alto**
- Pagamento mínimo: **US$ 100** (você só recebe quando bate esse valor)

---

## Parte 4 — Páginas legais (Privacidade + Termos) 📄

O AdSense **exige** que seu site tenha pelo menos uma página de **Política de Privacidade**. Crie uma rota simples:

### Crie `src/components/PrivacyPolicy.tsx`

```tsx
export function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto p-6 prose">
      <h1>Política de Privacidade</h1>
      <p>Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

      <h2>1. Dados coletados</h2>
      <p>O EarFlow é um aplicativo local-first. Seus dados de prática
      (acertos, erros, preferências) ficam armazenados <strong>apenas no
      seu navegador</strong> (localStorage). Nada é enviado para nossos servidores.</p>

      <h2>2. Cookies e anúncios</h2>
      <p>Utilizamos o Google AdSense para exibir anúncios. O AdSense pode
      utilizar cookies para personalizar anúncios. Você pode desativar
      esses cookies em <a href="https://www.google.com/settings/ads">
      Configurações de anúncios do Google</a>.</p>

      <h2>3. MIDI</h2>
      <p>Acessamos seu dispositivo MIDI apenas após sua permissão explícita
      no navegador. Os dados MIDI não são gravados nem transmitidos.</p>

      <h2>4. Contato</h2>
      <p>Dúvidas? <a href="mailto:liedsonalves067@gmail.com">liedsonalves067@gmail.com</a></p>
    </div>
  );
}
```

E adicione um link no footer do `App.tsx`.

---

## ✅ Checklist final

- [ ] Repositório no GitHub criado e código enviado
- [ ] Site no ar via Vercel
- [ ] Conta AdSense criada e site enviado para revisão
- [ ] Publisher ID substituído em `index.html` e `AdBanner.tsx`
- [ ] Política de Privacidade criada e linkada no footer
- [ ] (Após aprovação) Slots reais configurados em `App.tsx`
- [ ] Domínio próprio configurado (opcional)

---

## 🆘 Problemas comuns

| Problema | Solução |
|---|---|
| **Build falha no Vercel** | Verifique se `npm run build` funciona localmente |
| **MIDI não funciona em produção** | Vercel já fornece HTTPS — recarregue e dê permissão |
| **Anúncios aparecem em branco** | Normal nas primeiras horas após aprovação. Aguarde 24h |
| **Site lento** | Vercel é CDN global, deve ser rápido. Verifique se está no plano Hobby (grátis) |
| **AdSense rejeitado** | Adicione mais conteúdo, política de privacidade, e tente de novo após 30 dias |

---

## 📞 Suporte

- **Vercel**: https://vercel.com/help
- **AdSense**: https://support.google.com/adsense
- **EarFlow**: liedsonalves067@gmail.com

🎵 **Sucesso! Bora colocar o EarFlow no mundo.** 🚀
