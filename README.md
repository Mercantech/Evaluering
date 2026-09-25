# MAGS Evaluering

Evaluering af forløb – anonymt Forms-agtigt værktøj til undervisere og elever.

## Stack

- **Frontend:** Next.js (`apps/web`)
- **Backend:** NestJS + Prisma (`apps/api`)
- **Database:** PostgreSQL
- **Drift:** Docker Compose + Dokploy/Traefik

## Domæner (produktion)

- https://eval.mercantec.tech
- https://eval.mags.dk

Begge peger på samme app via to Traefik-routere. Kun frontend eksponeres; API og database er interne. Browseren kalder `/api/*`, som Next.js rewriter til API-containeren.

## Hurtig start (lokalt)

1. Kopiér miljøfil:

```bash
cp .env.example .env
```

2. Start med lokale host-porte:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

3. Åbn:
- Elev / kode-side: http://localhost:3080
- Underviser-login: http://localhost:3080/login
- API (kun lokalt eksponeret): http://localhost:3081/health

> Porte: **3080** (web), **3081** (api), **5433** (postgres).

### Demo-underviser (seed)

- E-mail: `underviser@mags.local`
- Adgangskode: `changeme123`

Skift værdierne i `.env` før produktion — især `JWT_SECRET` og `SEED_TEACHER_PASSWORD`.

## Dokploy / produktion

```bash
# På serveren (Dokploy): dokploy-network skal findes
docker compose up -d --build
```

Kræver:

1. Cloudflare: `eval.mercantec.tech` (+ evt. `*.mercantec.tech`) og `eval.mags.dk` → tunnel
2. Tunnel ingress → Traefik (`localhost:80`)
3. Eksternt Docker-netværk: `dokploy-network`
4. Hemmeligheder i miljøet: `JWT_SECRET`, DB-password, `OPENAI_API_KEY` / `AI_API_KEY`
5. DNS: begge hostnames (`eval.mercantec.tech` og `eval.mags.dk`) skal pege ind via Cloudflare-tunnel → Traefik

## Brug (V1)

### Underviser

1. Log ind
2. Opret evaluering – gerne fra en **skabelon** (Midtvejs / Slutevaluering)
3. Tilpas titel, klasse-label og spørgsmål til holdet
4. Åbn evalueringen for svar
5. Del **kode** eller **link** (`/s/KODE`)
6. Se resultater under **Samlet** og **Enkelte**
7. Under **Skabeloner** kan du redigere fælles skabeloner eller gemme en hold-evaluering som ny skabelon

### Elev

1. Gå til forsiden og indtast kode, eller åbn det delte link
2. Besvar anonymt og send

### Skabeloner

- Seedet: **Midtvejs evaluering**, **Slutevaluering**, **GF2 Programmering – midtvejs**
- Ved oprettelse kopieres skabelonens sektioner/spørgsmål ind i den nye evaluering
- Efterfølgende ændringer på holdet påvirker ikke skabelonen
- “Gem som skabelon” på en evaluering opretter en ny skabelon fra den gemte struktur

## Udvikling uden fuld Docker-web

```bash
# Terminal 1 – database (+ evt. api via compose)
docker compose -f docker-compose.yml -f docker-compose.local.yml up db api

# Terminal 2 – Web (host)
cd apps/web
# Peg direkte på lokal API (uden /api-rewrite)
echo NEXT_PUBLIC_API_URL=http://localhost:3081 > .env.local
npm run dev
```

Til API på host: sæt `DATABASE_URL=postgresql://evaluering:evaluering@localhost:5433/evaluering?schema=public` i `apps/api/.env`.

## V1-afgrænsning

- Anonyme svar (ingen elev-login)
- Klasse = label (ingen klasselister endnu)
- Spørgsmålstyper: skala (matrix), fri tekst, enkelt-/flervalg, ja/nej
- Skabeloner til genbrug på tværs af hold
- Stub-login til underviser (klar til ekstern auth-platform senere via `Teacher.externalId`)
