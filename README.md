# JMD Cart — Enterprise FMCG Wholesale & Quick-Commerce Platform

[![Production](https://img.shields.io/badge/Production-Live-22c55e?style=for-the-badge&logo=googlecloud)](https://jmdcart.com)
[![Next.js](https://img.shields.io/badge/Next.js-14_App_Router-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16_Cloud_SQL-4169e1?style=for-the-badge&logo=postgresql)](https://cloud.google.com/sql)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38bdf8?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com)

**Live Production**: [https://jmdcart.com](https://jmdcart.com)  
**Management Portal**: [https://management.jmdcart.com](https://management.jmdcart.com)

---

## 🏬 Overview

**JMD Cart** is an enterprise-grade wholesale FMCG (Fast Moving Consumer Goods) distribution and quick-commerce platform built for high-volume inventory management, depot stock tracking, tier-based volume pricing, van sales distribution, and customer-facing digital storefront.

---

## ✨ Key Capabilities

### 🛒 1. Dynamic Storefront & Bulk Wholesale Hub
- **Dynamic Category & Brand Showcase**: Real-time catalog populated from 900+ active FMCG SKUs and 26+ major manufacturers (MDH, Bikaji, Patanjali, Denver, Testo, etc.).
- **Wholesale Reorder Matrix**: Fast carton & loose bulk ordering grid with real-time stock allocation across central godown bays.
- **Dedicated Product Pages (PDP)**: Dynamic pricing slabs, carton breakdown, live stock counter, nutrition & manufacturer details, and related cross-sells.
- **B2B Checkout & Delivery Meter**: Real-time free shipping threshold meter, Saharsa depot delivery slots, cash-on-delivery and UPI modes, and GSTIN invoicing.

### 🏢 2. Depot & Inventory Management (IDMS)
- **Central Godown & Bay Allocation**: Batch tracking, MRP, purchase rate, sale rate, loose/carton conversions.
- **Van Sales Operations**: Load van, route dispatch, spot sales, digital invoice generation, and cash settlement.
- **Wholesale Price Slabs**: Automated discount tiers based on quantity order thresholds.

### 🛡️ 3. Security & Production Engineering
- **Host-Based Middleware Routing**: Strict domain separation between public storefront (`jmdcart.com`) and internal operations (`management.jmdcart.com`).
- **Role-Based Access Control (RBAC)**: Fine-grained permissions for Admin, Godown Manager, Van Sales Agent, and Customer.
- **GCP Infrastructure**: Containerized via multi-stage Docker Alpine build, deployed to Google Cloud Run, backed by Cloud SQL PostgreSQL with automated backups.
- **SEO & Performance**: Dynamic `/sitemap.xml` indexing 970+ products and brand pages, host-aware `robots.txt`, and metadata tags.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org) (App Router, Server Actions, Standalone Build)
- **Language**: TypeScript 5 (Strict Mode)
- **Database & ORM**: PostgreSQL 16 + [Prisma ORM](https://www.prisma.io)
- **Styling**: Tailwind CSS + Lucide Icons + Google Stitch Design System Tokens
- **Testing**: Vitest + Testing Library (318+ tests covering unit & integration)
- **Deployment**: Google Cloud Run, Cloud SQL, Artifact Registry, Nixpacks / Docker

---

## 🚀 Getting Started Locally

### Prerequisites
- Node.js >= 20.0.0
- pnpm >= 9.0.0
- PostgreSQL database

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/harshjaiswal-AiMl/jmd-cart.git
   cd jmd-cart
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   # Update DATABASE_URL and AUTH_SECRET in .env
   ```

4. **Initialize Database**:
   ```bash
   pnpm prisma generate
   pnpm prisma migrate dev
   pnpm prisma db seed
   ```

5. **Start Development Server**:
   ```bash
   pnpm dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the storefront.

---

## 🧪 Testing & Verification

```bash
# Typecheck TypeScript
pnpm typecheck

# Run test suite
pnpm test

# Build production bundle
pnpm build
```

---

## ☁️ Production Deployment (GCP)

```bash
# Setup GCP Infrastructure (Cloud SQL, Service Accounts, Secret Manager)
pwsh scripts/gcp-setup.ps1

# Setup Global HTTPS Load Balancer
pwsh scripts/gcp-lb.ps1

# Build, Migrate & Deploy to Cloud Run
pwsh scripts/deploy-gcp.ps1
```

---

## 📄 License
Proprietary & Confidential — © 2026 JMD Cart. All rights reserved.
