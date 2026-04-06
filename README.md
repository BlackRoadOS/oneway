# OneWay

*Your data leaves when you say. Never look back.*

Permanent one-way data export through a single custom API you control forever. Forward-only, RoadChain-verified.

## The Ride

OneWay packs the trunk. All your data, exported, organized, routed through one API you set up once and never touch again. It only goes forward. Your stuff, your way, no looking back.

## What It Does

Scheduled or on-demand export of all your BlackRoad data — conversations, files, memories, credentials, chain history — delivered to any endpoint you choose. One-way only. No inbound access. Full audit trail.

## Integrations

| Service | Role |
|---------|------|
| **Cloudflare Workers** | Export job runner at the edge |
| **Cloudflare D1** | Export manifest and audit log |
| **Cloudflare R2** | Staged export bundles before delivery |
| **RoadChain** | Cryptographic verification of every export |
| **AWS S3** | Supported export destination |
| **MinIO** | Self-hosted S3-compatible destination (Cecilia) |
| **Any HTTP endpoint** | Webhook delivery to user's own server |

## Features

- One-time setup of a personal outbound API key
- Automatic nightly or on-demand export
- Structured JSON + raw files to your chosen endpoint
- Forward-only flow — no inbound access possible
- Full audit log of every byte that left the platform
- Built-in redaction tools for sensitive fields
- Compatible with any database, S3 bucket, or personal server
- RoadChain-stamped export manifest with cryptographic proof

## Status

**PLANNED**

## How It Powers The BlackRoad

OneWay packs the trunk so you can drive away from any platform without ever looking back. Your data is yours. Always.

---

Part of [BlackRoad OS](https://blackroad.io) — Remember the Road. Pave Tomorrow.
