# NFC Backend Project - NestJS & TypeORM

A professional and secure backend built using the **NestJS** framework and **TypeORM** library for database management (PostgreSQL/Supabase), with a heavy emphasis on security and data protection best practices (Security-First Architecture).

---

## 🛠️ Tech Stack

- **Framework:** NestJS (TypeScript)
- **Database & ORM:** PostgreSQL / Supabase with TypeORM
- **Authentication & Security:** JWT (JSON Web Tokens), bcrypt / SHA256 (Password Hashing), Helmet, Rate Limiting, CORS Protection.
- **Validation:** Class-Validator & Class-Transformer (for validating incoming data and preventing injection attacks).

---

## 🔒 Security Measures

This project is designed to follow top-tier security standards and backend best practices:

1. **Data Validation & Sanitization:** Utilizing `class-validator` to ensure incoming payloads strictly match expected schemas and block malicious inputs.
2. **Password Hashing:** Securing user credentials and access tokens before storing them in the database.
3. **Authentication & Authorization:** Protecting endpoints using Guards and Role-Based Access Control (RBAC).
4. **HTTP Headers Security:** Integrating `Helmet` to secure the application from common web vulnerabilities (such as Clickjacking and XSS).
5. **Rate Limiting:** Shielding the server against Brute Force attacks and excessive repetitive requests (DDoS/Spam protection).
6. **SQL Injection Protection:** Relying fully on TypeORM Prepared Statements to guarantee total protection against injection vectors.

---

## 📁 Project Architecture

The project follows a Domain-Driven Modules structure to ensure code cleanliness and maintainability:

```text
src/
├── common/                  # Shared components (Guards, Decorators, Interceptors, Filters, DTOs)
│   ├── dto/
│   ├── filters/
│   └── interceptors/
├── config/                  # Database configuration and environment variables
│   ├── app.config.ts
│   └── database.config.ts
├── modules/                 # Core system features
│   ├── users/               # Merchant & Admin user management
│   ├── orders/              # Orders management
│   └── nfc-items/           # NFC items, contents, and media management
├── app.module.ts            # Root module configuring TypeORM and wiring features
└── main.ts                  # Entry point initializing global security setups (Pipes, Filters, Interceptors)
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL Database

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Configure Environment Variables
cp .env.example .env
```

### Running the Application

```bash
# development mode
npm run start:dev

# build for production
npm run build

# production mode
npm run start:prod
```

# Merchant order creation

The merchant portal creates an order and all of its NFC items atomically:

```http
POST /api/v1/merchant/orders
Authorization: Bearer <merchant-jwt>
Content-Type: application/json

{
  "customerName": "John Doe",
  "customerPhone": "+970591234567",
  "externalOrderId": "SHOP-9921",
  "items": [
    { "productName": "Silver necklace" },
    { "productName": "Gold ring" }
  ]
}
```

The API locks the merchant quota row during creation. Limited merchants must
have one available quota unit per item; unlimited merchants are not restricted.
The customer's normalized phone number is stored once on the order. Every NFC
item is associated with that phone through its existing order relationship; NFC
items no longer store an owner email. The order, NFC items, and `usedLinks`
update commit together or roll back
together. A request can contain 1–50 items.

Every returned NFC item includes two absolute, independently configurable URLs:

- `setupUrl`, built from `NFC_SETUP_BASE_URL` and the private edit token.
- `viewUrl`, built from `NFC_VIEW_BASE_URL` and the public NFC ID.

For example:

```env
NFC_SETUP_BASE_URL=http://localhost:5173/setup
NFC_VIEW_BASE_URL=http://localhost:5173/nfc
```

Change these values to the production domains later without changing code.
Merchants can update the status of their own orders through
`PATCH /api/v1/merchant/orders/:id/status` with `{"status":"COMPLETED"}` or
`{"status":"PENDING"}`.

## External website integration API

This is intentionally separate from the portal JWT API. First, an authenticated
merchant creates an integration key. The full secret is returned once and only
its SHA-256 hash is stored:

```http
POST /api/v1/merchant/integration-keys
Authorization: Bearer <merchant-jwt>
Content-Type: application/json

{ "label": "Production webshop" }
```

Active keys can be listed with `GET /api/v1/merchant/integration-keys` and
revoked with `DELETE /api/v1/merchant/integration-keys/:id`.

The merchant's website can then create an order through the versioned endpoint:

```bash
curl --request POST 'http://localhost:3000/api/v1/integrations/v1/orders' \
  --header 'X-API-Key: ulfa_live_...' \
  --header 'Idempotency-Key: webshop-order-9921' \
  --header 'Content-Type: application/json' \
  --data '{
    "customerName": "John Doe",
    "customerPhone": "+970591234567",
    "externalOrderId": "SHOP-9921",
    "items": [
      { "productName": "Silver necklace" }
    ]
  }'
```

`Idempotency-Key` is required (maximum 128 characters). Retrying with the same
key returns the original order without consuming quota twice. API keys inherit
the merchant's active/inactive status and quota rules. Never expose an API key
in browser-side JavaScript; call this endpoint from the website's server.

When the website cancels its order or takes it back as a return, it cancels the
Ulfa order by the same `Idempotency-Key`:

```bash
curl --request POST 'http://localhost:3000/api/v1/integrations/v1/orders/cancel'   --header 'X-API-Key: ulfa_live_...'   --header 'Content-Type: application/json'   --data '{ "idempotencyKey": "webshop-order-9921" }'
```

Cancelling locks the order's links and returns their quota, exactly like
cancelling from the merchant portal. Repeating the call is harmless; an unknown
key answers `404 ORDER_NOT_FOUND`.

## Customer phone schema migration

For an existing database with `DB_SYNCHRONIZE=false`, run
`migrations/20260812_move_nfc_owner_email_to_order_phone.sql` once before
deploying this version. It adds `orders.customer_phone`, indexes it, and removes
`nfc_items.owner_email`. Existing orders remain valid with a null phone; every
new order requires one of these international mobile formats:

- `+970` or `+972`, followed by 9 digits starting with `5`.
- `+962`, followed by 9 digits starting with `7` (`+962 7X XXX XXXX`).

## Configurable NFC section schema migration

For an existing database with `DB_SYNCHRONIZE=false`, run
`migrations/20261003_add_sections_and_item_sections.sql` once after the earlier
migrations. It creates the shared `sections` catalog and `item_sections`, which
stores per-NFC-item section visibility and display order. It does not create
any section records.

## Lock reason and shared links migration

For an existing database with `DB_SYNCHRONIZE=false`, run
`migrations/20261011_add_lock_reason_and_gift_count.sql` once. It adds
`nfc_items.lock_reason` (optional note shown to the buyer and the recipient
while an item is locked) and `nfc_items.gift_count` (how many gifts share an
item's link). Orders created with `"linkMode": "SHARED"` get one link for all
their items and use one quota unit; omitting `linkMode` keeps one link per item.

## Order cancellation migration

For an existing database with `DB_SYNCHRONIZE=false`, run
`migrations/20261012_add_order_cancellation.sql` once. It adds the `CANCELLED`
order status, `orders.cancelled_at`, `orders.content_purged_at`,
`nfc_items.quota_charged` and `nfc_items.locked_by_cancel`.

Cancelling an order (merchant: `PATCH /merchant/orders/:id/status` with
`"status": "CANCELLED"`) locks every link and gives back the quota units its
items used. Setting the status back to `PENDING` or `COMPLETED` within
`CANCELLED_CONTENT_RETENTION_HOURS` (default 72) restores it: the quota is
charged again (refused with `NFC_QUOTA_EXCEEDED` when there is not enough), the
links the cancellation locked are unlocked, and the scheduled deletion is
dropped. After that window an hourly job deletes the buyer's photos, videos,
recordings and letter from storage and the database, and the order can no
longer be restored (`RESTORE_WINDOW_PASSED`). The order and its items stay for
the records.
