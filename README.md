# ReachInbox Email Job Scheduler

A full-stack application for scheduling and sending emails at scale, built for the ReachInbox Hiring Assignment.

## Architecture & Features

- **Backend**: Node.js, Express, TypeScript, Prisma (PostgreSQL).
- **Queue/Scheduler**: BullMQ + Redis for robust, persistent delayed job scheduling (No cron jobs used).
- **Database**: PostgreSQL for persistent storage of Users and Email jobs.
- **Search**: Elasticsearch for fast search across scheduled and sent emails.
- **Email Delivery**: Nodemailer + Ethereal Email (Mock SMTP).
- **Frontend**: React, Vite, TypeScript, TailwindCSS.

### Implemented Requirements

#### Backend
- ✅ **API**: Accepts email scheduling requests via REST API (CSV upload support).
- ✅ **Scheduler**: Uses BullMQ delayed jobs to schedule emails securely and persistently.
- ✅ **Persistence**: Safe against server restarts. Jobs remain in Redis/Postgres and are executed at the correct time upon restart.
- ✅ **Concurrency**: Configured via `WORKER_CONCURRENCY` in `.env`.
- ✅ **Rate Limiting**: Enforced per sender per hour using Redis counters (`rate_limit:<userId>:<hour>`).
- ✅ **Delay Between Emails**: Built-in delay in the worker loop and via BullMQ job scheduling intervals.
- ✅ **Slack Notification**: Triggers when the rate limit is hit, using actual Slack OAuth integration.
- ✅ **Elasticsearch**: Emails are indexed and searchable.
- ✅ **Dashboard**: Exposes `@bull-board/express` at `/admin/queues` for real-time queue visibility.

#### Frontend
- ✅ **Google Login**: Real OAuth login using `@react-oauth/google`.
- ✅ **Dashboard**: Clean UI matching Figma, with tabs for Scheduled and Sent emails.
- ✅ **Compose**: Modal to create emails, upload CSVs, and set delays.

## Setup Instructions

### Prerequisites
- Docker & Docker Compose
- Node.js (v18+)

### 1. Start Infrastructure
Run the following from the root directory to start Postgres, Redis, and Elasticsearch:
```bash
docker-compose up -d
```

### 2. Backend Setup
```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

In a separate terminal, start the worker:
```bash
cd backend
npm run worker
```

**Environment Variables (`backend/.env`)**
Ensure you have set `SMTP_USER`, `SMTP_PASS`, and your Slack App credentials in `backend/.env`.

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

**Environment Variables**
Update the `GOOGLE_CLIENT_ID` in `frontend/src/main.tsx` with your actual Google OAuth Client ID.

## Rate Limiting & Concurrency Design

When the hourly limit is reached (`MAX_EMAILS_PER_HOUR_PER_SENDER`), the worker catches this by checking the Redis counter. It immediately stops processing the current job and uses `job.moveToDelayed()` to push the job to the next hour's timestamp. This ensures jobs are not dropped, order is preserved, and the system easily handles thousands of queued jobs without crashing.
