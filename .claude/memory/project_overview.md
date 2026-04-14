---
name: Carpool App Project Overview
description: State of the carpool app — what's built, what's missing, tech stack
type: project
---

Spring Boot 3.2.3 (Java 17) + Expo/React Native carpool app. Full context is in `/Users/sarasrikanth/carpool-app/CLAUDE.md` — read that first.

**Why:** App for managing group carpools — users join groups, post/request rides, get notifications.

**Backend: COMPLETE** — all services, controllers, security (JWT), Flyway migrations (V1–V12), application.yml, Dockerfile.

**Mobile: MOSTLY COMPLETE** — auth, tabs (dashboard/groups/rides/notifications), group detail, application review, ride detail, new ride, preferences.

**Missing (mobile only):**
- `src/api/chat.ts` — chat API client
- `app/rides/chat/[rideId].tsx` — in-ride chat screen (backend `/rides/{rideId}/chat` is ready)
- `app/(tabs)/profile.tsx` — profile/account screen (backend `PATCH /api/v1/users/me` is ready)

**How to apply:** Read CLAUDE.md for full layer-by-layer detail before touching any file. Next work is mobile-only: chat screen + profile screen.
