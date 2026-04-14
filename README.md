# WhiteLabel PBX — SignalWire-Powered Multi-Tenant Phone System

A complete whitelabel PBX (Private Branch Exchange) system built on SignalWire's network. Supports multiple businesses, each with their own fully isolated phone system, branding, and management dashboard.

## Features

### Multi-Tenant Architecture
- Each business gets its own PBX with isolated data
- Per-tenant SignalWire credentials (optional — falls back to platform-level)
- Tenant-specific branding (logo, colors, custom CSS)
- Plan-based limits (extensions, phone numbers)

### PBX Features
- **Extensions** — SIP, WebRTC, or external forwarding with voicemail
- **Phone Numbers (DIDs)** — Purchase, configure, and route from SignalWire
- **IVR / Auto Attendant** — Multi-level interactive voice menus with TTS or audio greetings
- **Ring Groups** — Simultaneous, sequential, or random ring strategies
- **Call Queues** — Round-robin, longest-idle, or ring-all with hold music
- **Time Conditions** — Business hours routing (open vs. closed)
- **Voicemail** — Per-extension with optional transcription and email notification
- **Call Logs / CDR** — Full call detail records with filtering and stats
- **Call Recording** — Automatic or on-demand recording
- **Contacts** — Tenant-level phone book

### Admin Dashboard
- **Platform Admin** — Manage all tenants, view system stats
- **Tenant Admin** — Full PBX management for their business
- **Tenant User** — View own extension, voicemail, call history

### Whitelabel
- Custom brand name, logo, and color scheme per tenant
- CSS custom properties for full theme control
- Each tenant's dashboard reflects their branding

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express |
| Database | PostgreSQL via Prisma ORM |
| Telephony | SignalWire REST API + LaML |
| Frontend | React 18, Vite, Tailwind CSS |
| Auth | JWT (access + refresh tokens) |
| Containerization | Docker + Docker Compose |

## Project Structure

```
├── prisma/
│   └── schema.prisma          # Multi-tenant database schema
├── server/
│   ├── index.js               # Express server entry
│   ├── middleware/
│   │   ├── auth.js            # JWT authentication & role guards
│   │   ├── errorHandler.js    # Global error handling
│   │   ├── rateLimiter.js     # API rate limiting
│   │   └── validate.js        # Request validation
│   ├── routes/
│   │   ├── auth.js            # Login, profile, password
│   │   ├── tenants.js         # Tenant + user CRUD
│   │   ├── extensions.js      # Extension management
│   │   ├── phoneNumbers.js    # DID purchase & routing
│   │   ├── ivr.js             # IVR menu management
│   │   ├── ringGroups.js      # Ring group management
│   │   ├── callQueues.js      # Call queue management
│   │   ├── callLogs.js        # CDR + stats
│   │   ├── voicemail.js       # Voicemail inbox
│   │   ├── contacts.js        # Tenant phonebook
│   │   ├── timeConditions.js  # Business hours routing
│   │   ├── recordings.js      # Call recordings
│   │   ├── branding.js        # Whitelabel config
│   │   ├── platform.js        # Platform admin dashboard
│   │   └── webhooks.js        # SignalWire callback handlers
│   ├── services/
│   │   ├── signalwire.js      # SignalWire REST API client
│   │   ├── laml.js            # LaML/XML response builder
│   │   └── callRouter.js      # Call flow routing engine
│   └── utils/
│       ├── logger.js          # Winston logger
│       └── prisma.js          # Prisma client
├── client/
│   ├── src/
│   │   ├── App.jsx            # React router + layout
│   │   ├── stores/authStore.js
│   │   ├── api/client.js      # Axios + JWT interceptor
│   │   ├── components/
│   │   │   ├── layout/DashboardLayout.jsx
│   │   │   └── common/        # DataTable, Modal, StatusBadge
│   │   └── pages/             # All dashboard pages
│   └── index.html
├── docker-compose.yml         # PostgreSQL + Redis + App
├── Dockerfile
└── .env.example               # Configuration template
```

## Quick Start

### 1. Prerequisites
- Node.js 18+
- PostgreSQL 14+
- A [SignalWire](https://signalwire.com) account

### 2. Clone and Install

```bash
git clone <repo-url>
cd galilee-mbc

# Install server dependencies
npm install

# Install client dependencies
cd client && npm install && cd ..
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your database URL and SignalWire credentials
```

Key settings:
- `DATABASE_URL` — PostgreSQL connection string
- `SIGNALWIRE_PROJECT_ID` — From your SignalWire dashboard
- `SIGNALWIRE_API_TOKEN` — From your SignalWire dashboard
- `SIGNALWIRE_SPACE_URL` — Your SignalWire space (e.g., `yourspace.signalwire.com`)
- `WEBHOOK_BASE_URL` — Publicly accessible URL for SignalWire callbacks
- `JWT_SECRET` — Random secret for JWT signing

### 4. Set Up Database

```bash
npx prisma migrate dev --name init
npm run db:seed
```

### 5. Run

```bash
# Development (server + client)
npm run dev

# Production
npm run build:client
npm start
```

### 6. Docker (Alternative)

```bash
docker-compose up -d
```

## Default Login Credentials

After seeding:

| Account | Email | Password | Tenant Slug |
|---------|-------|----------|-------------|
| Platform Admin | admin@pbxplatform.com | Admin123! | — |
| Acme Corp Admin | admin@acmecorp.com | Password123! | acme-corp |
| Acme Corp User | jane@acmecorp.com | Password123! | acme-corp |
| Springfield Med | admin@springfieldmed.com | Password123! | springfield-medical |

## Call Flow

```
Incoming Call → Phone Number Lookup
  → Time Condition Check (business hours?)
    → IVR Menu (press 1 for sales, 2 for support...)
      → Extension Dial (ring SIP phone)
        → If no answer → Call Forwarding
          → If still no answer → Voicemail
```

## SignalWire Webhook Endpoints

Configure your SignalWire phone numbers to point to:

| Webhook | URL |
|---------|-----|
| Voice URL | `{WEBHOOK_BASE_URL}/inbound-call` |
| Status Callback | `{WEBHOOK_BASE_URL}/call-status` |

The system automatically handles IVR input, dial results, voicemail recording, and status updates through internal webhook chaining.

## API Endpoints

### Authentication
- `POST /api/auth/login` — Tenant user login
- `POST /api/auth/platform-login` — Platform admin login
- `GET /api/auth/me` — Current user profile
- `POST /api/auth/change-password`

### Platform Admin
- `GET /api/platform/dashboard` — System stats
- `GET/POST /api/platform/admins` — Platform admin management
- `GET/POST/PUT/DELETE /api/tenants` — Tenant CRUD
- `GET/POST/PUT/DELETE /api/tenants/:id/users` — Tenant user management

### Tenant Resources (requires auth)
- `/api/extensions` — Extension CRUD
- `/api/phone-numbers` — DID management + purchase
- `/api/ivr` — IVR menu management
- `/api/ring-groups` — Ring group management
- `/api/call-queues` — Call queue management
- `/api/time-conditions` — Business hours routing
- `/api/call-logs` — Call history + stats
- `/api/voicemail` — Voicemail inbox
- `/api/contacts` — Phone book
- `/api/recordings` — Call recordings
- `/api/branding` — Whitelabel settings

## Adding a New Tenant

1. Login as Platform Admin
2. Navigate to Tenants → New Tenant
3. Fill in business name, admin user credentials, and optional SignalWire credentials
4. The tenant admin can then login and configure their PBX:
   - Create extensions for employees
   - Purchase phone numbers
   - Set up IVR menus
   - Configure ring groups and call routing
   - Set business hours
   - Customize branding

## Part Of

[KMGI Hub](https://github.com/MoshiuK/kmgi-hub) — Knox Media Group Central Command
