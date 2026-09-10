# MyScreener — Տեխնիկական Աուդիտ և Handover Փաստաթուղթ

> Վիճակը՝ 2026-09, հիմնված է կոդի ամբողջական ընթերցման վրա (backend + frontend + ինֆրա)։
> Աուդիտը read-only է եղել. ոչ մի ֆայլ չի փոփոխվել։

---

## 1. Ինչ է սա

Crypto **order-book screener + liquidity wall detection + alerts** հարթակ։

| Մաս | Ինչ է |
|---|---|
| `server/` | Express + Sequelize (MySQL) + Redis (ոպցիոն) API. 21 model, 10 repository, 14 route, 15 controller, 11 service |
| `web/` | Next.js 15 (App Router) + React 19 + TypeScript + Tailwind 4. 18 էջ |
| Ինտեգրացիաներ | 10 բորսա (իրական WS/REST connector-ներ), Telegram, Google OAuth, Stripe/Binance Pay (չօգտագործված), Manual QR վճարում |
| Մուտքի կետ (API) | `server/server.ts` (պորտ **3002**, hardcoded) |
| Մուտքի կետ (web) | `web/src/app` (պորտ 3001) |

**Կարևոր ճշտում.** Աուդիտի ընթացքում ստուգվել է հարցը՝ «live են արդյոք ticker/wall-երը»։
**Պատասխան՝ այո, live են։** `server/server.ts:72-77`-ը ամեն **400ms** ուղարկում է `tickers_batch`
SSE event, իսկ `web/src/lib/realtime/sse.ts:65-71`-ը ստանում է այն։ Wall-երը՝ `wall_event`-ով
(`server/server.ts:54`)։ Այս փաստը պետք է հաշվի առնել handover-ի ժամանակ, որպեսզի չկրկնվի
սխալ «live տվյալ չկա» ենթադրությունը։

---

## 2. Ինչպես գործարկել (ներկա վիճակ)

```bash
# արմատում (server)
npm install
npm run dev            # tsx server/server.ts  → http://localhost:3002

# web
cd web
npm install
npm run dev            # next dev -p 3001       → http://localhost:3001
```

- API base-ը web-ից proxy է արվում `web/next.config.ts`-ի rewrites-ով → `http://localhost:3002`
- Env՝ `server/.env` (dev)։ **Prod bundle-ում (`dist/server.cjs`) env-ը կարդացվում է արմատի `./.env`-ից** — ուղիների անհամապատասխանություն կա (`server/src/env.ts`)
- Build՝ `npm run build` (esbuild → `dist/server.cjs`), `npm --prefix web run build`

**Կոտրված/խնդրահարույց script-եր**
- `npm run start:all` → կանչում է `node scripts/start-prod.js`, որը **գոյություն չունի**
- `npm run clean` → `rm -rf dist server.js` (Unix-only, Windows-ում չի աշխատում)
- `web`-ի `lint` → `next lint` Next 15-ից հեռացված է, `eslint`-ը նույնիսկ dependency չէ

---

## 3. Ինչ արդեն աշխատում է (ուժեղ կողմեր)

- **Իրական connector-ներ**՝ Binance (`BinanceConnector.ts`), Bybit/OKX/MEXC/Gate/Bitget/KuCoin/Hyperliquid/AsterDex (`OtherConnectors.ts`) — WS + REST fallback, reconnect/heartbeat
- **Wall Engine + SpoofingDetector + Alert Engine** (`server/src/services/wall-engine`, `alert-engine`)
- **Live SSE**՝ `tickers_batch` (400ms), `wall_event`, `alert_trigger`, `subscription_updated`
  - `server/src/services/realtime/sseManager.ts` — 500 ընդհանուր / 5 մեկ օգտատիրոջ, heartbeat 15 վրկ
- **Manual QR վճարման ամբողջական շղթա**՝ pricing էջ → receipt upload → admin ակտիվացում → DB upgrade
  - `web/src/app/(app)/pricing/page.tsx`, `web/src/components/Admin/AdminReceiptsTab.tsx`
  - backend՝ `PaymentProof` model + repository + `POST/GET /api/billing/receipts`, `POST /api/admin/receipts/:id/activate|reject`
- **Աուտենտի֖իկացիա**՝ JWT + Google OAuth, lockout, cookie session, 7-օրյա validity
- **Անվտանգության շերտեր**՝ Zod validation, SSRF validator, CORS allowlist, security headers, correlation id, structured logging, error handler
- **Server-ի թեստեր**՝ `server/tests/` 7 suite (`npm test`, `npm run test:domain`, `npm run test:comprehensive`)
- **Dockerfile**՝ 3-փուլանի multi-stage (server bundle + Next build + runtime)

---

## 4. Բացթողումներ

### 4.1 🔴 Կրիտիկական — Անվտանգություն

| # | Խնդիր | Տեղ | Ազդեցություն |
|---|---|---|---|
| 1 | `JWT_SECRET`-ի անապահով fallback `'your-secret-key-change-in-production'`, **և JWT_SECRET բացակայում է `.env`-ից** | `server/src/services/auth/JWTService.ts:5` | Production-ում բոլոր token-ները կեղծելի են |
| 2 | `.env`-ը պարունակում է **իրական տեսք ունեցող բանալիներ** (Google OAuth client ID, Telegram bot token, Finnhub/Polygon keys, Stripe test key). `.env.example`-ը **բացակայում է աշխատանքային ծառից** (git-ում tracked է, ֆայլը ջնջված է) | `server/.env`, `.gitignore:7` | Գաղտնիքների արտահոսք + onboarding բլոկեր |
| 3 | `GET /api/run-tests` — **առանց աութենտիֆիկացիայի** հրապարակային endpoint, որը կարող է կենդանի միացումներ բացել բորսաներին | `server/src/routes/systemRoutes.ts:14` | DoS/ռեսուրսային չարաշահում |
| 4 | `requireActiveAccess`-ը **bypass է անում `NODE_ENV === 'development'`-ում** | `server/src/security/accessMiddleware.ts:12` | Եթե prod-ում NODE_ENV սխալ դրվի, վճարովի access-ը բաց է բոլորի համար |
| 5 | Rate limiter-ը **in-memory** է (ոչ Redis) | `server/src/security/rateLimiter.ts` | Multi-instance-ում չի աշխատում, restart-ով զրոյանում է |
| 6 | `tickers_batch`-ը **ամբողջ տիեզերքը** է ուղարկում բոլորին 400ms-ով, առանց per-user exchange իրավունքների ֆիլտրի | `server/server.ts:72-77` | Բեռ + FREE օգտատերը տեսնում է բոլոր բորսաները |
| 7 | CSP-ն միայն **Report-Only**, enforced տարբերակը commented out | `server/src/security/securityMiddlewares.ts:54` | XSS-ի պաշտպանությունը թույլ |
| 8 | Fingerprint drift-ը **երբեք չի revoke անում** session-ը (միայն log) | `server/src/security/authMiddleware.ts:89-91` | Գողացված session-ները չեն չեղարկվում |

### 4.2 🟠 Բարձր — Ինֆրա / Handover

- **Չկա CI/CD, docker-compose, nginx/reverse-proxy, pm2, deploy pipeline** — միայն `Dockerfile`
- **Չկա README, setup guide, architecture/API փաստաթուղթ**։
  - `docs/`-ի 14 ֆայլերը «ցանկալի» security փլաններ են (ASVS, pentest, monitoring) և հղում են **գոյություն չունեցող** `infrastructure/`, `init-ssl.sh`, `.env.production`, `docker-compose`-ին
- **Չկա migration համակարգ**՝ schema-ն ավտոմատ sync է արվում (`server/src/db/database.ts:329-375`, additive-only)։ Չկա versioning/rollback/backup
- **Port-ը hardcoded է 3002** (`server/server.ts:22`) — container/cloud port-injection-ը կկոտրվի
- **Graceful shutdown չկա** (SIGTERM/SIGINT, SSE/DB փակում)
- **Email ալերտները stub են**՝ միայն log են անում. իրական SMTP transport չկա (`server/src/services/notifications/Notifiers.ts:59`, `ResilientNotifiers.ts:57-66`)
- **Env dev/prod ուղիների անհամապատասխանություն** (`server/src/env.ts`)
- **Observability**՝ միայն console logs + `/api/health`։ Չկա metrics, error tracking (Sentry), log aggregation

### 4.3 🟡 Թրեյդերին պակասող (product)

- **Իրական առևտուր չկա — ծրագիրը միայն monitor/screener է**։
  - Չկա՝ order placement, positions, PnL, portfolio, margin/leverage, exchange API-key կառավարում
  - Focus էջի գրաֆիկները (`OrderBookL2`, `TradeTape`, `DepthChart`, `CandlestickChart`) միայն դիտելու են
- **Միացված են միայն 4 բորսա**՝ `server/server.ts:68` → `['BINANCE','BYBIT','OKX','MEXC']` (գրանցված է 10)
  - Stock Exchange-ը key-gated է (`FINNHUB_API_KEY` / `POLYGON_API_KEY`)
- **Hyperliquid connector-ը թերի է**՝ `percentageChange` միշտ 0, `volumeUsd` = 0 (`OtherConnectors.ts:1894,1896`)
- **`GenericExchangeAdapter`-ը stub է** (`'UNIMPLEMENTED'`, `OtherConnectors.ts:2282`)
- **Bybit-ի `unsubscribeSymbols`-ը դատարկ է** (`OtherConnectors.ts:114`)
- **UI-ի անավարտ մասեր**՝
  - Screener-ի Prev/Next կոճակներն **անգործուն են** (`web/src/components/Screener/ScreenerBottomBar.tsx:30-35`)
  - Exchange healthը ցույց է տալիս **միայն Binance** (`web/src/components/layout/ExchangeHealthBadges.tsx:11`)
  - **Թեմայի toggle-ը** անիմաստ է — dark-ը հարկադրված է (`web/src/providers/AppProviders.tsx:201-206`)
  - «Simulate Alert» developer-գործիքը տեսանելի է վերջնական օգտատիրոջը (`RightControls.tsx`)
- Չկա backtesting, i18n, պորտֆելի վերլուծություն

### 4.4 🟢 Միջին/Ցածր — Որակ և гигиена

- **Frontend-ի թեստեր ընդհանրապես չկան** (ոչ framework, ոչ script)
- Չկա `error.tsx` / `not-found.tsx` / `loading.tsx` (էջի մակարդակի boundary-ներ)
- Չկա eslint/prettier կոն֖իգուրացիա; արմատային `tsconfig.json`-ը `strict` չէ
- **Git гигиена**՝
  - index-ում կան stale tracked ֆայլեր, որոնք ջնջված են սկավառակից (Vite/Prisma ժառանգություն՝ `src/App.tsx`, `prisma/schema.prisma`, `server/src/models/UserSession.ts` և այլն)
  - `.gitignore`-ը չի ծածկում `web/.next/`-ը և `*.tsbuildinfo`-ը (աշխատանքային ծառում հարյուրավոր build ֆայլեր կան)
  - անվանումների քաոս՝ `react-example` (root package), `quantscreen-web` (web package), «QuantScreen» (Dockerfile/docs), «MyScreener» (brand), `DepthSignal` (git remote)
- **Կրկնօրինակ/մահացած կոդ**՝
  - `AccountLockoutService.ts` (Redis) չի օգտագործվում, օգտագործվում է in-memory `LockoutService.ts`-ը
  - `database.ts:389-391` — `schedulePersist`/`persistToDisk` դատարկ no-op (SQLite ժառանգություն)
  - `alertController.ts:110-126` — hardcoded sample ticker
  - `SpoofingDetector.ts:227` — `WASH_TRADING` pattern-ը անավարտ («Additional logic can be added»)
- **Չօգտագործված endpoint-ներ** (backend-ում կան, frontend-ից չեն կանչվում)՝
  `POST /api/billing/binance/checkout`, `POST /api/billing/binance/webhook`, `POST /api/billing/webhook`,
  `GET /api/billing/sandbox/checkout`, `GET /api/audit/logs`, `GET /api/walls/config`,
  `POST /api/watchlists`, `DELETE /api/watchlists/:id`, `DELETE /api/presets/:id`, `POST /api/telegram/webhook`
- **Չօգտագործված frontend API ֆունկցիաներ**՝ `fetchBillingOverview`, `createCheckout`, `createPortalSession`, `fetchBillingEvents`, `exportUserData`

---

## 5. Environment փոփոխականներ (ամբողջական ցանկ)

| Փոփոխական | Որտեղ է օգտագործվում |
|---|---|
| `NODE_ENV` | `accessMiddleware.ts:12`, `securityMiddlewares.ts:21`, `authMiddleware.ts:56`, `authController.ts:5`, `errorHandler.ts:41`, `ssrfValidator.ts:34` |
| `PORT` | `config/index.ts:34` (fallback 3000) — **`server.ts:22`-ում անտեսվում է (hardcoded 3002)** |
| `LOG_LEVEL` | `utils/logger.ts:1` |
| `APP_DOMAIN`, `API_DOMAIN`, `CORS_ORIGINS` | `app.ts:33-35`, `securityMiddlewares.ts:35-36` |
| `JWT_SECRET` | `services/auth/JWTService.ts:5` (**`.env`-ում բացակայում է**) |
| `GOOGLE_CLIENT_ID` | `env.ts:21`, `authController.ts:189`, `AuthService.ts:13,305` |
| `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_POOL_MAX`, `MYSQL_POOL_MIN` | `db/sequelize.ts:9-35` |
| `REDIS_ENABLED`, `REDIS_URL`, `REDIS_KEY_PREFIX`, `REDIS_WALL_TTL_SECONDS`, `REDIS_TICKER_TTL_SECONDS`, `REDIS_ORDERBOOK_TTL_SECONDS`, `REDIS_TRADE_TTL_SECONDS` | `config/index.ts:36-42` |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` | `TelegramLinkingService.ts:217,313,349`, `ResilientNotifiers.ts:103` |
| `SMTP_HOST`, `EMAIL_FROM`, `WEBHOOK_SIGNING_SECRET` | `ResilientNotifiers.ts:57-58,199` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_*_PRICE_ID` | `StripeBillingProvider.ts:25-26,66-67,158` |
| `BINANCE_PAY_*` (KEY/SECRET/API_BASE/WEBHOOK_URL/WEBHOOK_PUBLIC_KEY) | `BinancePayProvider.ts:66-70` |
| `MANUAL_PAYMENT_QR_VALUE`, `MANUAL_PAYMENT_QR_IMAGE_URL`, `MANUAL_PAYMENT_INSTRUCTIONS`, `MANUAL_PAYMENT_RECIPIENT`, `MANUAL_PAYMENT_NETWORK` | `manualPaymentConfig.ts:21-34` |
| `FINNHUB_API_KEY`, `POLYGON_API_KEY` | `OtherConnectors.ts:2357-2358` |
| `DB_FILE_PATH` | `db/migrate.ts:9` (legacy SQLite migration script) |

**Նշում.** `.env`-ում կան նաև `REDIS_PASSWORD`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `APP_URL`, `MYSQL_LOGGING`, `DOTENV_DISABLE` փոփոխականներ, որոնք **կոդում չեն օգտագործվում**։ `.env`-ում կան կրկնվող բանալիներ (`REDIS_ENABLED`, `APP_DOMAIN`, `CORS_ORIGINS`)։

---

## 6. Արտաքին ծառայություններ (պահանջվող)

| Ծառայություն | Պարտադիր | Նշում |
|---|---|---|
| MySQL | Այո | Sequelize dialect; pool max 20/min 2 |
| Redis | Ոչ | Օպցիոն. fallback՝ in-memory Map |
| Google OAuth | Այո (Google login-ի համար) | `GOOGLE_CLIENT_ID` |
| Telegram Bot | Ալերտների համար | `TELEGRAM_BOT_TOKEN` (BotFather) |
| Stripe / Binance Pay | Ոչ | Չօգտագործված է. փոխարինված է Manual QR-ով |
| Finnhub / Polygon | Ոչ | Միայն Stock Exchange-ի համար |

---

## 7. Handover Checklist

1. **Գաղտնիքների rotation** — `.env`-ում եղած բոլոր բանալիները համարվում են արտահոսած՝ Google OAuth client, Telegram bot token, Finnhub/Polygon keys, Stripe key։ Ստեղծել նորերը
2. **Վերստեղծել `.env.example`** — վերոնշյալ աղյուսակի բոլոր փոփոխականներով
3. **Գրել README + setup + architecture/API փաստաթղթեր** (ներկայումս չկան)
4. **Կարգավորել CI/CD** + docker-compose + nginx + secret management (Vault/Secrets Manager)
5. **Ներդնել migration strategy** (versioned migrations, rollback) + backup/restore
6. **Ուղղել կոտրված script-երը**՝ `start:all`, `clean`, web lint (eslint setup)
7. **Մաքրել git state**՝ stale tracked ֆայլեր, `.gitignore`-ում ավելացնել `web/.next/` և `*.tsbuildinfo`
8. **Որոշել product ուղղությունը**՝ մնում է monitor/screener, թե՞ ավելանում է **trading execution** շերտը

---

## 8. Առաջարկվող առաջնահերթություններ

### Փուլ 1 — Անվտանգության փակում (առանց սրա production չի կարելի)
- `JWT_SECRET` պարտադիր env + fallback-ի հեռացում
- `.env`-ի rotation + `.env.example`
- `/api/run-tests`-ը դարձնել auth-guarded (կամ հեռացնել prod-ից)
- `accessMiddleware`-ից dev-bypass-ը հանել կամ պայմանավորել հստակ env flag-ով
- Rate limiter-ը տեղափոխել Redis
- `tickers_batch`-ում per-user exchange entitlements ֆիլտր
- CSP-ն դարձնել enforced

### Փուլ 2 — Հանձնման ենթակառուցվածք
- README/setup/architecture փաստաթղթեր
- CI/CD + docker-compose + reverse proxy
- Migrations + backup/restore
- Script-երի ուղղում, git մաքրում, անվանումների միասնականացում

### Փուլ 3 — Տվյալների ճիշտ ռեժիմ և արտադրողականություն
- 400ms full-universe broadcast-ի օպտիմիզացիա (delta/փոփոխված դաշտեր, per-plan հատում)
- Միացնել մնացած 6 բորսաները, լրացնել Hyperliquid-ի դաշտերը
- Frontend-ի թեստեր + error/404/loading boundary-ներ
- Observability (metrics, error tracking)

### Փուլ 4 — Product (ըստ որոշման)
- **Trading execution** մոդուլ (եթե թրեյդերներին պետք է իրական առևտուր)՝ exchange API keys, order placement, positions, PnL
- **կամ** խորացնել screener/alerts-ը (backtesting, ավելի շատ alert ուղիներ, portfolio analytics)

---

## 9. Ապացույցների քարտեզ (ըստ բացթողումների)

| Թեմա | Ֆայլ |
|---|---|
| Live SSE emit | `server/server.ts:50-77` |
| JWT fallback | `server/src/services/auth/JWTService.ts:5` |
| Access dev bypass | `server/src/security/accessMiddleware.ts:12` |
| Unauthenticated tests endpoint | `server/src/routes/systemRoutes.ts:14` |
| Rate limiter (in-memory) | `server/src/security/rateLimiter.ts` |
| Schema auto-sync (ոչ migrations) | `server/src/db/database.ts:329-375` |
| Email stub | `server/src/services/notifications/Notifiers.ts:59` |
| Email stub (resilient) | `server/src/services/notifications/ResilientNotifiers.ts:57-66` |
| Generic adapter stub | `server/src/services/connectors/OtherConnectors.ts:2282` |
| Hyperliquid զրո դաշտեր | `server/src/services/connectors/OtherConnectors.ts:1894,1896` |
| Started exchanges (4/10) | `server/server.ts:68` |
| Hardcoded port | `server/server.ts:22` |
| Prev/Next անգործուն | `web/src/components/Screener/ScreenerBottomBar.tsx:30-35` |
| Binance-only health | `web/src/components/layout/ExchangeHealthBadges.tsx:11` |
| Dark-ը հարկադրված | `web/src/providers/AppProviders.tsx:201-206` |
| Manual QR pricing flow | `web/src/app/(app)/pricing/page.tsx` |
| Admin receipt review | `web/src/components/Admin/AdminReceiptsTab.tsx` |

---

## 10. Փուլ 1 — Անվտանգության ուղղումների կարգավիճակ

Կատարված է և ստուգված (server-ը boot է անում, health=200, `npm run lint` և `web` typecheck անցնում են)։

| # | Խնդիր | Կարգավիճակ | Լուծում |
|---|---|---|---|
| 1 | `JWT_SECRET`-ի անապահով fallback | ✅ Ուղղված | `JWTService.ts` — secret-ը պարտադիր է (>=32 նիշ). Production-ը **չի բoot-վում** առանց դրա. dev-ում միայն ակնհայտ նախազգուշացմամբ: `server/.env`-ում ավելացված է 64-նիշանոց random արժեք |
| 2 | `.env.example` բացակայում էր | ✅ Ուղղված | Վերստեղծվել է արմատում՝ բոլոր 31+ փոփոխականներով, առանց իրական գաղտնիքների |
| 3 | `GET /api/run-tests` առանց աութենտիֿիկացիայի | ✅ Ուղղված | `systemRoutes.ts` — այժմ `requireAuth + requireRole('ADMIN')` (ստուգված է. 401 առանց token-ի) |
| 4 | Dev access-bypass՝ ըստ `NODE_ENV`-ի | ✅ Ուղղված | `accessMiddleware.ts` — բայփասը միայն բացահայտ `ALLOW_DEV_ACCESS_BYPASS=true`-ով և **երբեք** production-ում։ `server/.env`-ում դրված է `true` (dev-ը չի կոտրվում) |
| 5 | Rate limiter in-memory | ✅ Ուղղված | `RedisService.incrWithTtl()` (ատոմային INCR+TTL) + `rateLimiter.ts`-ը Redis-առաջնահերթ է՝ in-process fallback-ով |
| 6 | `tickers_batch`-ը ամբողջ տիեզերքը բոլորին | ✅ Ուղղված | `sseManager.broadcastTickers()` + `realtimeRoutes.ts` (per-plan `allowedExchanges`, admin = բոլորը) + `marketController`-ում REST-ի համապատասխան ֆիլտր |
| 7 | CSP Report-Only | ✅ Ուղղված | Production-ում enforced, dev-ում՝ report-only։ **Նշում.** Այժմ CSP-ն պարունակում է `'unsafe-inline'` (Next.js inline script/style-ների պատճառով) — ամբողջական ամրացման համար անհրաժեշտ են nonce-ներ (առանձին աշխատանք) |
| 8 | Fingerprint drift-ը չի revoke անում | ⏳ Մնացած | Գիտակցված որոշում է եղել (օգտատիրոջը լոգինից դուրս չգցելու համար)։ Առաջարկվում է հետագայում անել «փափուկ» չեղարկում՝ անոմալիայի դեպքում step-up աութենտիֿիկացիա |

### Վերագրության մեջ մնացած (Փուլ 2+)
- `.gitignore`-ում `web/.next/` և `*.tsbuildinfo`-ի ավելացում, stale tracked ֆայլերի մաքրում
- Գաղտնիքների **rotation** (`.env`-ում եղած բոլոր բանալիները համարել արտահոսած) — կատարվում է ձեռքով
- README/setup/architecture փաստաթղթեր, CI/CD, docker-compose, migrations, backup
- Թեստային միջավայրի ուղղում. `server/tests/*`-ը `.env`-ը չի բեռնում → DB-ի միացումը ձախողվում է (`Access denied ... using password: NO`)

