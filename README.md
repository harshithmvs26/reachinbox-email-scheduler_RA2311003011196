# 🚀 ReachInbox Hiring Assignment – Full-Stack Email Job Scheduler

A production-grade distributed email scheduling and dispatch service built with **Express.js, TypeScript, BullMQ, Redis, PostgreSQL (Prisma), Elasticsearch, Nodemailer (Ethereal SMTP), and React (Vite + Tailwind CSS)**.

---

## 📑 Table of Contents
1. [System Architecture Overview](#-system-architecture-overview)
2. [Key Features & Requirements Mapping](#-key-features--requirements-mapping)
3. [Concurrency, Throttling & Rate Limiting Design](#-concurrency-throttling--rate-limiting-design)
4. [Persistence & Crash Recovery (No Cron)](#-persistence--crash-recovery-no-cron)
5. [Slack OAuth & Live Rate-Limit Notifications](#-slack-oauth--live-rate-limit-notifications)
6. [Elasticsearch Search Engine](#-elasticsearch-search-engine)
7. [Environment Variables Setup](#-environment-variables-setup)
8. [Local Development Guide](#-local-development-guide)
9. [Deployment Guide (Cloud Hosting)](#-deployment-guide-cloud-hosting)
10. [Assumptions, Trade-Offs & Design Choices](#-assumptions-trade-offs--design-choices)
11. [Demo Video Checklist](#-demo-video-checklist)

---

## 🏛 System Architecture Overview

```
                      +---------------------------------------+
                      |   React + Vite Frontend (Port 5173)   |
                      |  - Google OAuth Login (No Mock)       |
                      |  - Lead CSV Upload & Scheduler UI     |
                      |  - Scheduled & Sent Email Tables      |
                      +-------------------+-------------------+
                                          | REST API
                                          v
                      +---------------------------------------+
                      |      Express.js Backend (Port 5000)   |
                      |  - REST Endpoints (/api/emails, etc.) |
                      |  - Slack OAuth Flow (/api/slack/*)    |
                      |  - Bull Board Admin UI (/admin/queues)|
                      +-------+-------------------+-----------+
                              |                   |
            +-----------------+                   +-----------------+
            |                                                       |
            v                                                       v
+-----------------------+                               +-----------------------+
|  PostgreSQL Database  |                               |     Redis Instance    |
|  - Users, OAuth tokens|                               |  - BullMQ Queue State |
|  - Scheduled & Sent   |                               |  - Delayed Jobs Store |
|    Email records      |                               |  - Hourly Rate Limits |
+-----------^-----------+                               +-----------^-----------+
            |                                                       |
            +-----------------------+   +---------------------------+
                                    |   |
                                    v   v
                      +---------------------------------------+
                      |       BullMQ Background Worker        |
                      |  - Configurable Concurrency           |
                      |  - Provider Throttling Delay          |
                      |  - Dynamic Rate-Limit Rescheduler     |
                      +-------+-------------------+-----------+
                              |                   |
             Dispatches Email |                   | Indexes Data
                              v                   v
                   +---------------------+     +---------------------+
                   |   Ethereal Email    |     |    Elasticsearch    |
                   |   (Fake SMTP Hub)   |     | (Full-text Search)  |
                   +---------------------+     +---------------------+
```

---

## ✅ Key Features & Requirements Mapping

### Backend Requirements
| Requirement | Status | Implementation Details |
|---|---|---|
| **Express + TypeScript** | ✅ Implemented | Modular architecture with strict typing, Prisma ORM, and REST endpoints. |
| **No Cron Jobs** | ✅ Strict Compliance | Zero `node-cron`, `agenda`, or OS crontabs. Scheduling is handled natively by Redis-backed BullMQ delayed jobs. |
| **Database Persistence** | ✅ Implemented | PostgreSQL tracks Users, Scheduled, Sent, and Failed emails. |
| **BullMQ + Redis Queue** | ✅ Implemented | Distributed worker processing with automatic delayed job triggers. |
| **Worker Concurrency** | ✅ Configurable | Controlled via `WORKER_CONCURRENCY` env variable (e.g. 5 concurrent sends). |
| **Email Throttling Delay** | ✅ Configurable | Enforces `MIN_DELAY_BETWEEN_EMAILS_MS` (e.g., 2000ms delay between consecutive dispatches). |
| **Per-Sender Hourly Rate Limiting** | ✅ Implemented | Redis atomic counter (`rate_limit:<userId>:<hour_window>`). Exceeded jobs are delayed to the next hour with order preserved. |
| **Slack OAuth on Rate Limit Hit** | ✅ Real OAuth Flow | Real Slack OAuth authorization flow (`/api/slack/connect` & `/callback`). Sends live Slack webhook notification immediately when sender limit is reached. |
| **Elasticsearch Search Indexing** | ✅ Implemented | Automatic indexing of all scheduled and sent emails into Elasticsearch index `emails` for instant full-text search. |
| **Live BullMQ Queue Dashboard** | ✅ Implemented | Mounted at `http://localhost:5000/admin/queues` via `@bull-board/express`. |
| **Idempotency & Restarts** | ✅ Implemented | Unique BullMQ Job IDs match Database UUIDs; no duplicate sends upon server reboot. |

### Frontend Requirements
| Requirement | Status | Implementation Details |
|---|---|---|
| **Google Login** | ✅ Real OAuth | Built with `@react-oauth/google` and `jwt-decode`. Displays name, email, avatar, and logout option. |
| **Dashboard Layout** | ✅ Figma Aligned | Tabbed view for **Scheduled Emails** and **Sent / Failed Emails** with search bar and action buttons. |
| **Compose New Email** | ✅ Modal | Subject, Body, Start Time (`datetime-local`), Delay interval, and CSV Leads file upload. |
| **CSV Lead Parser** | ✅ Implemented | Parses CSV files, detects emails automatically, and dispatches them as sequential delayed jobs. |
| **Empty & Loading States** | ✅ Implemented | Clean spinners and empty states for scheduled and sent lists. |
| **Elasticsearch Search Bar** | ✅ Implemented | Instant search across subject, recipient, and body text using backend Elasticsearch API. |

---

## ⚙️ Concurrency, Throttling & Rate Limiting Design

### 1. Worker Concurrency
- The BullMQ worker is instantiated with `{ concurrency: config.scheduler.concurrency }`.
- Multiple jobs are pulled and processed simultaneously across worker threads without race conditions.

### 2. Provider Throttling (Inter-Email Delay)
- Email providers (Google, SendGrid, AWS SES) flag rapid burst traffic.
- We enforce a minimum delay via `MIN_DELAY_BETWEEN_EMAILS_MS` (default: `2000ms`).
- In addition, the scheduler staggers batch submissions so `job[i]` is delayed by `i * delayMs`.

### 3. Hourly Rate Limiting (Sender Level)
- Enforced atomically using Redis:
  $$\text{Key} = \text{rate\_limit}:\{\text{userId}\}:\{\text{YYYY-MM-DDTHH}\}$$
- On each job execution:
  1. Worker executes `INCR rateLimitKey`.
  2. If count equals 1, sets TTL to 3600 seconds (`EXPIRE`).
  3. If $\text{count} > \text{MAX\_EMAILS\_PER\_HOUR\_PER\_SENDER}$:
     - Calculates milliseconds remaining until the top of the next hour.
     - Calls `await job.moveToDelayed(Date.now() + delayTime, job.token)` so the job is **not dropped or marked failed**.
     - If this was the first job to breach the threshold, dispatches a **live Slack notification** to the tenant's webhook.

---

## 🔄 Persistence & Crash Recovery (No Cron)

- **Job Storage**: All delayed job timestamps, payloads, and states are stored in Redis heap structures (sorted sets sorted by trigger timestamp).
- **Restart Resilience**: If the Express server or Worker process crashes or restarts:
  1. In-flight jobs return to Redis.
  2. Future delayed jobs remain scheduled with their absolute trigger timestamps intact.
  3. Completed jobs remain marked as completed.
  4. Upon restarting `npm run worker`, the worker seamlessly picks up pending and upcoming jobs without duplication or re-triggering from Day 1.

---

## 💬 Slack OAuth & Live Rate-Limit Notifications

1. User clicks **"Connect Slack"** on the dashboard.
2. User is redirected to `https://slack.com/oauth/v2/authorize` with scope `incoming-webhook`.
3. Upon approval, Slack redirects to `http://localhost:5000/api/slack/callback`.
4. The backend exchanges the temporary authorization code for an incoming webhook URL and stores it on the user record in PostgreSQL.
5. If the user hits their hourly sending threshold, the worker calls the webhook with:
   > ⚠️ *Rate limit exceeded! We have delayed your emails until the next hour.*
6. Disconnecting or having no Slack connected fails gracefully without throwing unhandled exceptions.

---

## 🔎 Elasticsearch Search Engine

All email events trigger an Elasticsearch document write:
- **Index**: `emails`
- **Search Query**: Multi-match wildcard query across `subject`, `toEmail`, and `body`.
- **API Endpoint**: `GET /api/emails/search?userId=<id>&q=<query>`

---

## 🔐 Environment Variables Setup

### Backend (`backend/.env`)
```env
PORT=5000
DATABASE_URL="postgresql://user:password@localhost:5432/outbox_db?schema=public"
REDIS_HOST=localhost
REDIS_PORT=6379
ELASTICSEARCH_NODE="http://localhost:9200"

# Ethereal Fake SMTP
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=kian49@ethereal.email
SMTP_PASS=7c6QynXkrmfCS6VYw5

# Slack OAuth App
SLACK_CLIENT_ID=12176355017831.12189824891430
SLACK_CLIENT_SECRET=1afaab05682ce7cf691baa0de58e2c07
SLACK_REDIRECT_URI=http://localhost:5000/api/slack/callback

# Scheduler Behavior
MAX_EMAILS_PER_HOUR_PER_SENDER=10
WORKER_CONCURRENCY=5
MIN_DELAY_BETWEEN_EMAILS_MS=2000
```

### Frontend (`frontend/src/main.tsx`)
```ts
const GOOGLE_CLIENT_ID = '1027927827056-32dc6777o6ppuga5h3ed81l5tbr0fjjb.apps.googleusercontent.com';
```

---

## 🛠 Local Development Guide

### Step 1: Start Databases & Message Broker
```bash
docker compose up -d
```
*(Starts PostgreSQL on `5432`, Redis on `6379`, and Elasticsearch on `9200`)*

### Step 2: Initialize & Run Backend Server
```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

### Step 3: Run Queue Worker
In a new terminal window:
```bash
cd backend
npm run worker
```

### Step 4: Run Frontend Dashboard
In a third terminal window:
```bash
cd frontend
npm install
npm run dev
```
Open **`http://localhost:5173`** in your browser.

### Step 5: BullMQ Queue Visualizer
Visit: **`http://localhost:5000/admin/queues`**

---

## ☁️ Deployment Guide (Cloud Hosting)

To deploy this project to the cloud for free/low cost:

### 1. Database & Cache (Managed)
- **PostgreSQL**: Spin up a free database on [Neon.tech](https://neon.tech) or [Supabase](https://supabase.com). Copy the connection URI into `DATABASE_URL`.
- **Redis**: Spin up a free Redis database on [Upstash](https://upstash.com) or [Render](https://render.com). Copy the host/port/credentials.
- **Elasticsearch**: Use [Elastic Cloud](https://cloud.elastic.co) 14-day free trial or run as a container on [Railway](https://railway.app).

### 2. Backend & Worker (Render / Railway)
- **Web Service**: Deploy `backend/` on [Render](https://render.com) or [Railway](https://railway.app).
  - Build Command: `npm install && npm run build && npm run prisma:generate`
  - Start Command: `npm start`
- **Background Worker**: Deploy a second service pointing to the same repo.
  - Start Command: `npm run worker`
- Add all `.env` variables in the platform dashboard.

### 3. Frontend (Vercel / Netlify)
- Deploy `frontend/` on [Vercel](https://vercel.com).
- Framework Preset: **Vite**.
- Root directory: `frontend`.
- Set Environment Variable `VITE_API_URL` pointing to your deployed backend URL.

---

## ⚖️ Assumptions, Trade-Offs & Design Choices

1. **BullMQ delayed jobs vs Custom DB Polling**: We opted for BullMQ delayed jobs over custom PostgreSQL polling loops. BullMQ utilizes Redis sorted sets (`ZSET`) with high-resolution timers, providing millisecond-level scheduling precision without putting read-lock strain on relational tables.
2. **Atomic Rate Limiter**: Rate limits use Redis atomic increments with 1-hour rolling keys. This prevents worker thread contention and allows scaling horizontally to 10+ worker nodes without double-sending.
3. **Ethereal Mailbox**: Used as the fake SMTP provider to avoid burning domain reputation during high-throughput load tests. Ethereal allows inspecting generated messages directly in their web UI.

---

## 🎥 Demo Video Checklist (Max 5 Minutes)

When recording your submission walkthrough:
- [ ] **Google Login**: Sign in via Google OAuth on `http://localhost:5173`.
- [ ] **Connect Slack**: Click "Connect Slack" and authorize the workspace channel.
- [ ] **Compose & Schedule**: Upload a lead CSV, set start time and inter-email delay (e.g. 2s), and schedule.
- [ ] **Inspect Tables**: Show the newly scheduled items appearing in the "Scheduled Emails" tab.
- [ ] **Queue Visibility**: Open `http://localhost:5000/admin/queues` to show jobs moving from Delayed $\rightarrow$ Active $\rightarrow$ Completed.
- [ ] **Persistence on Server Restart**: Kill the worker/server terminal (`Ctrl+C`), wait 10 seconds, restart it, and show that scheduled jobs resume without loss.
- [ ] **Rate Limiting & Slack Alert**: Set limit to a small number (e.g. 2/hr), trigger 5 emails, and show the Slack notification popping up with remaining jobs delayed.
