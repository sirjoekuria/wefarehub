# RiderHub 360 — Project Structure

This document details the code organization, folder responsibilities, and architectural boundaries of the RiderHub 360 codebase.

```
welfare/
├── .data/                                  # Local embedded database state
│   └── pgdata.tar                          # Serialized PGlite snapshot (ROCS CREW pre-seeded)
├── drizzle/                                # Drizzle migration artifacts
│   └── 0000_dusty_moondragon.sql           # Generated 20+ table PostgreSQL migration
├── scripts/                                # Maintenance & deployment scripts
│   ├── setup-db.js                         # Database schema build & real data snapshot generator
│   └── seed.ts                             # Legacy demo data generator
├── src/
│   ├── app/                                # Next.js 16 App Router
│   │   ├── api/                            # Server-side Route Handlers (36+ endpoints)
│   │   │   ├── announcements/              # Broadcast notice endpoints
│   │   │   ├── applications/               # Two-stage membership approval API
│   │   │   │   ├── [id]/decide/            # STAGE 2: Association final approval
│   │   │   │   └── [id]/recommend/         # STAGE 1: Chairperson stage recommendation
│   │   │   ├── auth/                       # Login, logout, session verification
│   │   │   ├── fields/                     # Custom form builder CRUD API
│   │   │   ├── join/                       # Public registration submission
│   │   │   ├── members/                    # Member directory & profile API
│   │   │   ├── org/                        # Association dashboard, settings, audit
│   │   │   ├── plans/                      # SaaS subscription tier management
│   │   │   ├── platform/                   # Super Admin tenant & payment controls
│   │   │   ├── reports/                    # CSV/PDF data export API
│   │   │   ├── stations/                   # Pickup station management & invitations
│   │   │   ├── transfers/                  # Inter-station rider transfers
│   │   │   ├── verify/                     # Public QR code verification API
│   │   │   └── webhooks/                   # External payment & M-Pesa webhooks
│   │   │
│   │   ├── card/[memberId]/                # Digital membership card view & print page
│   │   ├── join/[token]/                   # Public stage registration intake portal
│   │   ├── login/                          # Redesigned dark-theme authentication page
│   │   ├── platform/                       # Platform Super Admin Console (with Welfare embed)
│   │   ├── verify/[id]/                    # Public QR digital card verification screen
│   │   ├── w/[slug]/                       # Tenant Association Workspace (ROCS, GKA, etc.)
│   │   ├── welfare/                        # Standalone Welfare Contribution System portal
│   │   ├── layout.tsx                      # Root layout with Space Grotesk & Manrope typography
│   │   └── page.tsx                        # 2-in-1 landing page (RiderHub 360 + Welfare)
│   │
│   ├── components/                         # React UI Component Library
│   │   ├── icons.tsx                       # Complete SVG icon set (Bikes, Shields, Users, etc.)
│   │   ├── rh-ui.tsx                       # RiderHub UI design system (Modals, StatCards, Pills)
│   │   ├── admin-shell.tsx                 # Existing Welfare Contribution System UI shell
│   │   ├── PrintButton.tsx                 # Client-side printable card generator
│   │   ├── platform/                       # Super Admin Console components
│   │   │   └── PlatformConsole.tsx         # Console dashboard with Welfare System tab embed
│   │   └── workspace/                      # Association workspace components
│   │       ├── Applications.tsx            # Two-stage approval queue
│   │       ├── Dashboard.tsx               # Association metrics & charts
│   │       ├── Fields.tsx                  # Dynamic custom form builder interface
│   │       ├── Members.tsx                 # Master rider register & search
│   │       ├── Reports.tsx                 # Statistical reports & CSV downloads
│   │       ├── Settings.tsx                # Branding & color theme editor
│   │       ├── Stations.tsx                # Pickup station management & invite generator
│   │       ├── SuspendedCard.tsx           # Subscription past-due modal lock
│   │       └── Workspace.tsx               # Association master layout & navigation
│   │
│   ├── db/                                 # Database Access Layer
│   │   ├── index.ts                        # Singleton PGlite connection with snapshot loader
│   │   ├── schema.ts                       # Welfare system schema (Supabase compatibility)
│   │   ├── rh-schema.ts                    # RiderHub 360 multi-tenant Drizzle schema
│   │   └── seed.ts                         # Pilot seed definitions
│   │
│   ├── lib/                                # Core Business Logic & Helpers
│   │   ├── authz.ts                        # RBAC & RLS authorization engine (requireUser, etc.)
│   │   ├── rh-api.ts                       # Standard JSON response & query parameter parsers
│   │   ├── rh-types.ts                     # TypeScript interfaces across all RiderHub entities
│   │   ├── password.ts                     # Scrypt secure password hashing & verification
│   │   └── identity.ts                     # Public QR payload encoders & crypto helpers
│   │
│   └── middleware.ts                       # Next.js edge route protection & tenant routing
│
├── next.config.ts                          # Next.js 16 configuration with serverExternalPackages
├── tailwind.config.ts                      # Tailwind CSS styling configuration
└── tsconfig.json                           # TypeScript compiler configuration
```
