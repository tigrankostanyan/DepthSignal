Trading Screener — Ամբողջական Ֆունկցիոնալ Սպեցիֆիկացիա
Վերսիա: 1.0 (Final) Կարգավիճակ: Հաստատված Scope: Crypto (Binance, Bybit, MEXC, OKX, Gate, BitGet, KuCoin, Hyperliquid, AsterDEX) + Stocks (US/global)

1. Ընդհանուր Կառուցվածք
Screener-ը բաղկացած է 3 հիմնական functional layer-ից.
Layer
Նպատակը
Market Overview
Ամբողջ շուկայի աղյուսակային տեսք, sortable/filterable
Alert Engine
Կանոնների վրա հիմնված պայմանական ծանուցումներ
Watchlist / Focus View
Ընտրված symbol-ների խորացված մոնիտորինգ


2. Market Overview — Հիմնական Filter-ներ
2.1 Գնային Filter-ներ
Գնի փոփոխություն՝ ըստ timeframe-ի (30վրկ, 1մ, 5մ, 15մ, 1ժ, 4ժ, 1օր)
Գնի range (min–max)
Distance from ATH / ATL (%)
Distance from moving average (MA20, MA50, MA200)
2.2 Ծավալային (Volume) Filter-ներ
Volume spike detection (X% ավել քան average volume-ը վերջին N period-ում)
Absolute volume threshold (USD-ով)
Volume/Market Cap հարաբերակցություն
2.3 Volatility Filter-ներ
ATR (Average True Range)
Bollinger Band width
24h high-low amplitude (%)
2.4 Սև Ցուցակ (Blacklist) — Մշտապես Բացառված Coin-ներ
Ընդհանուր, մշտական ցուցակ, որի մեջ մտնող symbol-ները երբեք չեն երևա screener-ում և չեն մասնակցի ոչ մի filter/alert-ի, անկախ նրանից՝ ինչ պայման են բավարարում։ Սա տարբերվում է alert-ի per-rule exclusion-ից. այս ցուցակը global է, կիրառվում է ամբողջ system-ի մակարդակով, մեկ անգամ configured, բոլոր user-ների կամ ամբողջ screener instance-ի համար։
Պարամետր
Տեսակ
Օրինակ
Բացատրություն
blacklistedSymbols
string[]
['LUNA','FTT']
Կոնկրետ symbol-ներ, որոնք ընդմիշտ բացառված են
blacklistedExchanges
ExchangeId[]
['mexc']
Exchange, որի տվյալները ընդհանրապես չեն մասնակցում screener-ին
blacklistedSectors
string[]
['meme-coins']
Կատեգորիա/sector-ով բացառում
reason (optional)
string
'rug pull risk', 'delisted', 'low liquidity'
Ազատ տեքստ, թե ինչու է ավելացվել — audit trail-ի համար
addedAt
string (ISO date)
—
Ե՞րբ է ավելացվել, թափանցիկության համար

Տրամաբանություն. Blacklist-ը ստուգվում է ամենավաղ փուլում, նախքան մնացած filter-ների կիրառումը (query/ingestion pipeline-ի հենց սկզբում) — բացառված symbol-ի համար ընդհանրապես connector-ը subscribe չի էլ անում tick/order-book stream-ին, որպեսզի ոչ մի resource (CPU, memory, network) իզուր չծախսվի։ Սա ոչ միայն filtering է, այլև performance optimization։
2.5 Fundamentals (Stocks-ի համար առանձին)
Market cap range
P/E, EPS
Sector/Industry filter
Earnings date proximity

3. Order Book Wall Detection — Մանրամասն Սպեցիֆիկացիա
Սա հատուկ, ոչ-ստանդարտ alert type է, որը պահանջում է order book-ի շարունակական մոնիտորինգ, ոչ միայն tick data։
3.1 Ինչ է անում
Օգտատերը սահմանում է կանոն.
"Ինձ ծանուցրու, երբ որևէ symbol-ի order book-ում կա X ծավալի order, որը գտնվում է market գնից Y% հեռավորության վրա (վերև կամ ներքև), և այդ order-ը կանգնած է առնվազն Z ժամանակ"
3.2 Կոնֆիգուրացվող Պարամետրեր
Պարամետր
Տեսակ
Օրինակ
Բացատրություն
distancePercent
number
3
Հեռավորությունը market price-ից (%)
direction
enum
above | below | both
Order-ը գնի վերևո՞ւմ է թե ներքևում
minVolumeUsd
number
500000
Նվազագույն ծավալ (quote currency-ով, օր. USDT)
minDurationSeconds
number
300
Ինչքան ժամանակ պիտի կանգնի order-ը, որ համարվի "wall"
symbols
string[]
['BTC','ETH']կամ '*'
Կոնկրետ symbol-ներ, թե ամբողջ market
exchanges
string[]
['binance','bybit']
Որ բորսաներում ստուգել
orderBookDepth
number
50
Քանի level խորությամբ scan անել order book-ը
notifyOnRemoval
boolean
true
Ծանուցել նաև երբ wall-ը հանվում է (spoofing signal)
crossExchangeAggregation
boolean
false (default)
Եթե false — ամեն exchange-ը ստուգվում է ամբողջությամբ առանձին, wall-ը trigger է լինում միայն եթե կոնկրետ մեկ exchange-ում order-ը հասնում է minVolumeUsd-ին։ Եթե true — մի քանի exchange-ի order-ները (նույն symbol, նույն distance range) գումարվում են մեկ ընդհանուր ծավալի մեջ

3.3 Ալգորիթմի Տրամաբանություն (High-Level)
Snapshot polling: Order book snapshot վերցնել յուրաքանչյուր exchange-ից (WebSocket diff-depth stream, ոչ թե full REST poll — performance-ի համար)
Threshold detection: Ամեն update-ի ժամանակ scan անել order book levels-ը, որոնք entrer են distancePercent range-ի մեջ
Volume aggregation: Եթե մի քանի order կանգնած է նույն price level-ում, հանրագումարել
State tracking: Պահել { symbol, exchange, priceLevel, volume, firstSeenAt } state-ը in-memory (Redis)
Duration check: Յուրաքանչյուր tick-ի ժամանակ ստուգել՝ now - firstSeenAt >= minDurationSeconds
Trigger: Եթե պայմանը բավարարվում է և դեռ trigger չի եղել այս wall-ի համար → ուղարկել alert
Wall disappearance tracking: Եթե wall-ը հանկարծ անհետանում է մինչև duration-ի լրանալը → սա հաճախ spoofing նշան է (fake wall), կարելի է առանձին ֆլագով նշել
3.4 Կարևոր Edge Case-եր, Որոնք Պիտի Հաշվի Առնվեն
Partial fills: Wall-ի ծավալը կարող է աստիճանաբար նվազել (իրական execution) vs մեկանգամից անհետանալ (spoofing/cancel) — երկուսը տարբեր signal են, պիտի տարբերակել
Price movement: Եթե market price-ը շարժվում է, distancePercent-ը recalculate պիտի լինի ամեն tick-ում, ոչ թե fixed price level-ի նկատմամբ
Multiple walls same alert: Եթե մեկից ավել wall entrer է պայմանի մեջ միաժամանակ, պիտի խմբավորված ծանուցում ուղարկվի, ոչ թե spam
Cross-exchange aggregation: Optional mode (crossExchangeAggregation, default false), երբ նույն symbol-ի total wall volume-ը հաշվարկվում է մի քանի exchange-ի գումարով։ Default վարքագիծը՝ ամեն exchange-ը ստուգվում է ամբողջությամբ առանձին (per-exchange state, առանձին firstSeenAt, առանձին threshold check), որպեսզի Binance-ի wall-ը երբեք չխառնվի Bybit-ի wall-ի հետ, եթե user-ը հստակ չի միացրել aggregation-ը
Spot vs futures reference price: Futures/perpetual-ի համար distancePercent-ը պիտի հաշվարկվի mark price-ի նկատմամբ, ոչ թե last traded price-ի, քանի որ mark price-ն է, որ liquidation-ների հիմքն է և ավելի կայուն է manipulation-ի դեմ. last price-ը կարող է կարճաժամանակ small order-ով արհեստականորեն շարժվել
3.5 Spot vs Futures/Perpetual — Առանձնահատկություններ
Wall detection-ը աշխատում է երկուսի համար էլ (marketType: 'spot' | 'futures' | 'both'), սակայն futures/perpetual market-ը ունի լրացուցիչ նրբություններ, որոնք պիտի հաշվի առնվեն.
Ասպեկտ
Spot
Futures/Perpetual
Reference գին
Last traded price
Mark price (ոչ թե last price)
Լրացուցիչ context
—
Funding rate-ը կարող է լրացուցիչ signal տալ (եթե wall + բարձր funding rate համընկնում են, ուժեղացնում է signal-ը)
Order book characteristics
Սովորաբար ավելի thin (քիչ liquidity)
Սովորաբար ավելի deep, բայց leverage-ի պատճառով walls-ը կարող են ավելի արագ shift-վել
Connector-ի endpoint
Spot WebSocket endpoint
Առանձին futures WebSocket endpoint (exchange-ների մեծ մասում spot և futures-ը լիովին առանձին API/connection են)

Կարևոր. connector-ի architecture-ում (packages/connectors) յուրաքանչյուր exchange-ի համար պիտի լինեն երկու առանձին subscription path (spot և futures), նույնիսկ եթե connector class-ը մեկն է — endpoint URL-ները, symbol format-ները և message schema-ները տարբեր են exchange-ների մեծամասնությունում։
3.6 Historical Persistence (Backtesting/Վիճակագրություն)
Wall data-ն չի ջնջվում wall-ի "removed"/"filled" դառնալուց հետո. այն տեղափոխվում է Redis-ի (hot, in-memory, ակտիվ wall-երի համար) state-ից դեպի persistent storage՝ պատմության պահպանման համար։
Ինչ է պահվում. ամեն DetectedWall record-ի ամբողջական lifecycle-ը (firstSeenAt → lastSeenAt, ինչպես փոխվեց ծավալը ժամանակի ընթացքում, վերջնական status)
Ինչի՞ համար է պետք. (1) backtesting — «եթե այս rule-ը ակտիվ լիներ վերջին 3 ամիս, քանի՞ անգամ կտրիգերվեր», (2) statistics dashboard — wall-երի հաճախականություն ըստ symbol/exchange, (3) spoofing pattern-երի պատմական վերլուծություն
Ինչու ոչ Redis-ում մշտապես. Redis-ը in-memory է, թանկ է մեծ ծավալի historical data պահելու համար. պիտի ունենալ առանձին persistent DB (time-series բնույթի տվյալ է, հետևաբար հարմար է TimescaleDB կամ ClickHouse-ի պես DB, ոչ սովորական relational table)
Retention policy. պիտի հստակեցվի, թե որքան ժամանակ են պահվում raw wall records-ը (օր. 6 ամիս raw, հետո aggregated/downsampled տվյալ ավելի երկար ժամանակահատվածի համար)
3.7 Տվյալների Մոդել (Type-level)
interface OrderBookWallRule {
  id: string;
  userId: string;
  symbols: string[] | '*';
  exchanges: ExchangeId[];
  marketType: 'spot' | 'futures' | 'both'; // wall alert-ը կիրառվում է spot-ի, futures/perpetual-ի, թե երկուսի order book-ի վրա
  direction: 'above' | 'below' | 'both';
  distancePercent: number;
  minVolumeUsd: number;
  minDurationSeconds: number;
  orderBookDepth: number;
  notifyOnRemoval: boolean;
  crossExchangeAggregation: boolean; // default: false — ամեն exchange ստուգվում է առանձին
  isActive: boolean;
  createdAt: string;
}

interface DetectedWall {
  ruleId: string;
  symbol: string;
  exchange: ExchangeId;
  marketType: 'spot' | 'futures';
  side: 'bid' | 'ask';
  priceLevel: number;
  volumeUsd: number;
  distanceFromMarketPercent: number;
  firstSeenAt: string;
  lastSeenAt: string;
  status: 'forming' | 'confirmed' | 'removed' | 'filled';
}


4. Ընդհանուր Alert Engine
4.1 Alert Type-ներ
Price threshold crossing
Volume spike
Order book wall (section 3)
Technical indicator signal (RSI, MACD crossover)
Percentage change over timeframe
New listing detection
Funding rate anomaly (futures-ի համար)
4.2 Notification Channels
In-app (WebSocket push)
Email
Telegram bot
Webhook (custom integration-ների համար)
4.3 Rule Combination Logic
AND / OR logic մի քանի պայմանների միջև
Cooldown period (նույն alert-ը կրկին չուղարկել X ժամանակ)

5. Watchlist / Focus View
Real-time order book visualization (depth chart)
Recent trades tape
Active alerts կոնկրետ symbol-ի համար
Multi-timeframe chart embedding

6. Օգտատիրոջ Կարգավորումներ (Settings)
Կատեգորիա
Կարգավորումներ
Display
Dark/light theme, decimal precision, currency display (USD/USDT)
Data refresh
WebSocket vs polling interval (advanced users-ի համար)
Default filters
Saved filter presets, default screener view
Alert defaults
Default cooldown, default notification channel
Exchange selection
Ո՞ր exchange-երն են ակտիվ user-ի համար


7. Հստակեցված Որոշումներ
#
Հարց
Որոշում
1
Order book wall alert-ը spot-ի՞ համար միայն, թե՞ նաև futures/perpetual
Երկուսի համար (marketType: 'spot' | 'futures' | 'both', տես §3.5)
2
Historical wall data պահպանվու՞մ է
Այո — persistent storage-ում, backtesting և վիճակագրության համար (տես §3.6)
3
Cross-exchange aggregation default enabled՞, թե opt-in
Opt-in, default false — ամեն exchange ստուգվում է ամբողջությամբ առանձին (տես §3.2, §3.4)
4
Rate limit-երը ինչպե՞ս են կառավարվում
Per-connector configurable limit, ոչ թե hardcoded թիվ։ Ամեն exchange connector-ն ունի իր rateLimitConfig-ը (maxConnectionsPerIp, maxSubscriptionsPerConnection, reconnectBackoffMs), որը կարդացվում է connector-ի config ֆայլից, ոչ թե կոդի մեջ hardcode։ Պատճառը՝ exchange-ների limit-երը փոխվում են ժամանակի ընթացքում, և hardcoded արժեքը արագ outdated կդառնա, կոտրելով production-ը։ orderBookDepth-ի max արժեքը ինքնաբերաբար սահմանափակվում է այս config-ով connector-ի մակարդակում, alert rule ստեղծելիս validation անելով դրա դեմ
5
Retention policy historical wall data-ի համար
90 օր raw տվյալ, դրանից հետո daily-aggregated summary (wall count, avg volume, avg duration ըստ symbol/exchange/օր) պահվում է անժամկետ։ Raw record-ը ջնջվում է cron job-ով 90 օր հետո, aggregate-ը՝ երբեք
6
Funding rate-ը միանու՞մ է wall detection-ին, թե առանձին մնում
Առանձին մնում է (§4.1-ում արդեն ինքնուրույն alert type է)։ Դրանք չեն միավորվում մեկ rule-ի մեջ՝ պարզության և single-responsibility-ի համար. wall detection engine-ը պատասխանատու է միայն order book-ի համար, funding rate engine-ը՝ իր տվյալի համար։ Correlation-ը (եթե ապագայում պետք լինի) կլինի separate, higher-level "composite alert" feature, ոչ թե այս MVP-ի մասը