
# 💰 Money Log 

Self‑hosted personal finance tracker with a responsive desktop/mobile UI, built on Next.js, tRPC, Prisma/Postgres, NextAuth, and ECharts.

## Key Features
### Dashboard
Year/month analytics with spend filters and effective net (spend − income).
  <table>
    <tr>
      <td><img src="https://github.com/user-attachments/assets/f77a3336-62da-4826-ba86-f57007acf483" width="660" alt="Dashboard
  (Year)" /></td>
      <td><img src="https://github.com/user-attachments/assets/04d63bb5-dfae-4df3-ac37-2f73d3b987c0" width="640" alt="Dashboard
  (Month)" /></td>
    </tr>
  </table>

### Spend (Quick Add)
Dual-price tracking (gross/discount/net), card attribution, tags, and notes.
<p align="center">
  <img src="https://github.com/user-attachments/assets/47292c76-2da0-49f2-8581-9f505be06254" width="860" alt="Spend" />
</p>

### Income
Separate income flow with revenue, cost, and net, plus optional card attribution.
<p align="center">
  <img src="https://github.com/user-attachments/assets/eab9aa03-9785-4029-8337-c397819d53c7" width="860" alt="Income" />
</p>

### Review
Filters, summaries, and grouped recent entries.
<table>
  <tr>
    <td><img src="https://github.com/user-attachments/assets/5a980359-f39e-4bf1-84af-deb56f4b8603" width="500" alt="Dashboard
(Year)" /></td>
    <td><img src="https://github.com/user-attachments/assets/42783c80-a5d1-465d-9a1d-d937389acc07" width="640" alt="Dashboard
(Month)" /></td>
  </tr>
</table>

## Overview
- Single Next.js app serving both UI and API (tRPC).
- Prisma ORM + Postgres for a unified ledger.
- NextAuth Credentials + JWT for login.
- Docker Compose on TrueNAS; Cloudflare Tunnel for remote access.


## Tech Stack
- Next.js 16 (App Router), React 19, Tailwind CSS
- tRPC v11, Zod, React Query, superjson
- Prisma ORM, Postgres 16
- NextAuth (Credentials, JWT sessions)
- ECharts
- Docker Compose, Cloudflare Tunnel

## Architecture
```
Browser (React UI)
  └─ tRPC client (typed hooks)
        |
        v
Next.js app (UI + API + Auth)
  └─ Prisma Client
        |
        v
Postgres
```

## Data Model (Core Entities)
- Transaction: date, merchant, gross/discount/net, category, payment method, tags, notes
- IncomeEvent: date, revenue, cost, net, card (optional)
- Category, Tag
- Card, PaymentMethod (card-linked or cash)
- User (email + password hash for login)

## App Pages / UX Flow
- Spend: quick add with optional discount, tags, notes.
- Income: revenue + cost, optional card.
- Review: recent entries + filters + summaries.
- Dashboard: year/month analytics and charting.

## Environment Variables
See `.env.example` and `.env.production.example`.

Required:
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`

Optional:
- `PORT` (default 3000 inside container)

## Local Development
1) Start Postgres:
```bash
docker compose -f docker-compose.dev.yml up -d
```

2) Configure env:
```bash
cp .env.example .env
```

3) Install + migrate:
```bash
npm install
npx prisma migrate dev --name init
```

4) Run:
```bash
npm run dev
```

Open http://localhost:3000.

## Deployment (TrueNAS + Cloudflare Tunnel)
1) Copy repo to TrueNAS (no `node_modules`):
```
/mnt/pool/APP_Configs/money-log/app
```

2) Create a Postgres dataset:
```
/mnt/pool/APP_Configs/money-log/pgdata
```

3) Update `docker-compose.prod.yml` volume:
```yaml
db:
  volumes:
    - /mnt/pool/APP_Configs/money-log/pgdata:/var/lib/postgresql/data
```

4) Set env:
```bash
cp .env.production.example .env.production
```
Fill in values and set `NEXTAUTH_URL` to your public domain.

5) Build and run:
```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

6) Migrations:
```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec app npx prisma migrate deploy
```

7) Cloudflare Tunnel:
- Add a published application route:
  - `money.cpark.dev` -> `http://<TRUENAS_LAN_IP>:<HOST_PORT>`

## Database Migrations
- Dev: `npx prisma migrate dev --name <name>`
- Prod: `npx prisma migrate deploy`

## Auth Bootstrap (First User)
Generate hash:
```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec app \
  node -e "const bcrypt=require('bcryptjs'); console.log(bcrypt.hashSync('YOUR_PASSWORD',12));"
```

Create user:
```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec app \
  node -e "const {PrismaClient}=require('@prisma/client'); const db=new PrismaClient(); (async()=>{ await db.user.create({data:{email:'you@example.com', passwordHash:'<HASH>'}}); await db.\$disconnect(); })().catch(console.error);"
```

## License
The MIT License (MIT)

Copyright (c) 2026 Chaehyun Park
