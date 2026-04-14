# Carpool App — Claude Context

## Memory Files

Project memory is stored in `.claude/memory/` (version-controlled in this repo). Read these at the start of every session:

- `.claude/memory/MEMORY.md` — index of all memory entries
- `.claude/memory/project_overview.md` — current app state: what's built, what's missing
- `.claude/memory/feedback_baseline_rules.md` — non-negotiable baseline rules for every change

After completing any task, update the relevant memory file(s) in `.claude/memory/` to reflect the new state, then commit and push them along with the code changes.

---

## Frontend Requirements (mobile-app — non-negotiable)

1. **No `KeyboardAvoidingView`** — never use it anywhere. Use `ScrollView` with `keyboardShouldPersistTaps="handled"` instead.
2. **Image uploads must offer Camera + Photo Library** — always use the shared `src/utils/pickImage.ts` → `pickAndUploadImage()`. Never inline a new `ImagePicker` call.
3. **5 MB image size limit** — `pickAndUploadImage()` enforces this. Do not bypass it.

Full detail: `.claude/memory/frontend_requirements.md`

---

## Baseline Rules (apply to EVERY change)

1. **Swagger** — any new or modified endpoint must have its `@Operation`, `@Tag`, and response annotations updated. Run `./mvnw spring-boot:run` mentally against the OpenAPI spec; if the contract changed, the annotation changed.
2. **Git / Bitbucket** — after every task, stage relevant files, write a clear commit message, and push to the Bitbucket remote (`origin`). Never leave finished work uncommitted.
3. **No regressions** — before touching existing code, read the current implementation. Changes must not break existing endpoints, mobile screens, or DB migrations. Flyway migrations are append-only (never edit existing V*.sql files).

## Project Structure

```
carpool-app/
├── backend/          Spring Boot 3.2.3 (Java 17) REST API
├── mobile-app/       Expo + React Native (expo-router) mobile app
├── terraform/        AWS infra (ECS, RDS, ElastiCache, ALB, ECR, VPC)
└── docker-compose.yml
```

## Backend (`backend/`)

**Stack:** Spring Boot 3.2.3, Java 17, PostgreSQL 16, Redis 7, Flyway, Lombok, Spring Security (JWT), SpringDoc/Swagger

**Package root:** `com.carpool`

**Layer layout:**
```
model/         JPA entities
repository/    Spring Data JPA repos
service/       Business logic
controller/    REST controllers (@RequestMapping /api/v1/...)
dto/
  request/     Inbound payloads
  response/    Outbound payloads
security/      JwtUtil, JwtAuthFilter, JwtProperties, UserDetailsServiceImpl
config/        SecurityConfig, WebConfig, OpenApiConfig, TraceIdFilter, DataInitializer
exception/     GlobalExceptionHandler + custom exceptions
enums/         RideStatus, RequestStatus, MembershipStatus, MembershipRole, NotificationType, GroupFieldType, UserRole
```

**Entities:**
- `User` — id (UUID), email, name, passwordHash, phone, avatarUrl, role (UserRole), canDrive
- `Group` — id, name, description, inviteCode, isPrivate, owner (User), locations, fields
- `GroupLocation` — id, name, lat, lng, group
- `GroupField` — id, label, fieldType (GroupFieldType), required, displayOrder, group
- `GroupMembership` — id, user, group, role (MembershipRole), status (MembershipStatus), fieldValues, comments
- `MembershipFieldValue` — id, membership, field, value
- `MembershipComment` — id, membership, author, content, attachmentUrl, parent, replies
- `Ride` — id, driver, group, originLocation, destinationLocation, intermediateStops, departureTime, totalSeats, availableSeats, price, notes, status (RideStatus)
- `RideRequest` — id, ride, rider, status (RequestStatus), seatsRequested, pickupLocation, dropoffLocation, message
- `RideMessage` — id, ride, sender, content, mentions, createdAt
- `RidePreference` — id, user, tag, group, originLocation, destinationLocation, intermediateStops, totalSeats, price, notes
- `Notification` — id, recipient, type (NotificationType), title, body, read, metadata (JSON)

**API base:** `http://localhost:8080/api/v1`

**Endpoints summary:**
| Controller | Prefix | Key operations |
|---|---|---|
| AuthController | `/auth` | POST /login, /register |
| UserController | `/users` | GET/PATCH /me |
| GroupController | `/groups` | CRUD groups, join (inviteCode), members, requests, approve/reject, locations, fields, comments |
| RideController | `/rides` | CRUD rides, start/complete/cancel, request seat, confirm/decline requests |
| RideChatController | `/rides/{rideId}/chat` | POST (send), GET (messages), GET /participants |
| RidePreferenceController | `/preferences` | CRUD preferences, POST /{id}/post (post ride from preference) |
| NotificationController | `/notifications` | GET all/unread, PATCH /{id}/read, POST /read-all |
| UploadController | `/upload` | POST (multipart file upload → returns URL) |
| AdminController | `/admin` | user management, global membership management |

**Auth:** JWT Bearer token. `JwtUtil` signs/validates. `JwtAuthFilter` runs on every request. Public routes: `/auth/**`, `/v3/api-docs/**`, `/swagger-ui/**`, `/actuator/**`, `/uploads/**`.

**Flyway migrations** (`src/main/resources/db/migration/`): V1–V12 covering full schema including ride stops, locations, price, preferences, group fields/applications, chat.

**Config file:** `src/main/resources/application.yml` — datasource, JPA (ddl-auto=validate), Flyway, JWT, upload dir, SpringDoc, management endpoints.

**Dockerfile:** present at `backend/Dockerfile`.

---

## Mobile App (`mobile-app/`)

**Stack:** Expo ~54, React Native 0.81.5, expo-router ~6 (file-based routing), TypeScript, Zustand, Axios, AsyncStorage

**Entry:** `"main": "expo-router/entry"` — `App.tsx` is unused boilerplate.

**Source layout:**
```
app/                    expo-router screens
  _layout.tsx           Root layout — auth guard (hydrate → redirect to /(auth) or /(tabs))
  (auth)/
    _layout.tsx
    login.tsx
    register.tsx
  (tabs)/
    _layout.tsx         Bottom tab bar (Dashboard, Groups, Rides, Notifications)
    index.tsx           Dashboard — current/upcoming rides, pending group approvals
    groups.tsx          Groups list + create/join flow
    rides.tsx           Ride browse/booked/driving tabs
    notifications.tsx   Notification list with mark-read
  groups/
    [groupId].tsx       Group detail — members, requests, locations, fields, admin actions
    application/
      [membershipId].tsx  Application review — field values + comments thread
  rides/
    [rideId].tsx        Ride detail — book seat modal, driver request management
    new.tsx             Post new ride form (or save as preference)
  preferences/
    index.tsx           Saved preferences — post ride from preference

src/
  api/
    client.ts           Axios instance, token interceptor, extractError()
    auth.ts             login, register
    groups.ts           Full groups API
    rides.ts            Full rides API
    notifications.ts    Full notifications API
    preferences.ts      Full preferences API
    upload.ts           uploadFile() helper (multipart)
  store/
    authStore.ts        Zustand store — user, isAuthenticated, hydrated, login/register/logout/setUser
  types/
    index.ts            All TypeScript types (User, Group, Ride, RideRequest, Notification, etc.)
  components/
    layout/             (empty — reserved)
    ui/                 (empty — reserved)
```

**API base URL:** `http://192.168.31.67:8080/api/v1` (LAN IP for physical device testing — change in `src/api/client.ts`)

**Auth flow:** `app/_layout.tsx` calls `hydrate()` on mount → reads token+user from AsyncStorage → redirects unauthenticated users to `/(auth)/login`, authenticated users away from auth screens.

**What is NOT yet built in mobile:**
- `src/api/chat.ts` — no chat API client
- `app/rides/chat/[rideId].tsx` — no chat screen (backend ready, UI missing)
- `app/(tabs)/profile.tsx` — no profile/account screen (backend PATCH /users/me ready, UI missing)

---

## Docker Compose

Services: `postgres` (5432), `redis` (6379), `backend` (8080), `frontend` (3000→80, unused — project uses mobile-app instead).

## Terraform

AWS modules: VPC, RDS (PostgreSQL), ElastiCache (Redis), ECR (two repos: backend + frontend), ECS (Fargate), ALB.
Variables in `terraform/terraform.tfvars.example`.

---

## Development Notes

- Backend runs on port **8080**; Swagger UI at `http://localhost:8080/swagger-ui.html`
- Mobile runs via `expo start` from `mobile-app/` — use Expo Go or dev build
- Physical device testing: update `API_BASE_URL` in `src/api/client.ts` to your Mac's LAN IP
- iOS Simulator: use `localhost`; Android Emulator: use `10.0.2.2`
- JWT secret defaults to a dev value; set `JWT_SECRET` env var in production
- File uploads stored locally in `uploads/` dir (not S3 — swap `UploadService` for S3 in prod)
