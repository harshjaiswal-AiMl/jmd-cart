# PROMPT #19 — Send every bill to the customer by WhatsApp and SMS, fix the PRO login that does nothing, and make the existing native Android Godown app keep order alerts on and ringing even when the app is closed (looping, self-verifying)

Save as `docs/prompts/19-bill-messaging-pro-login-native-alerts.md` and paste everything below the line to the agent. **Do not create new doc files** (the Android project folder and config files are code, not docs). Update existing `docs/*.md` in place. This is an **update of the live system**: every existing flow must keep working.

---

## WHAT THE OWNER ASKED
1. **Bill messaging:** for every bill made in **Shop POS** or by a **marketing van**, send the bill to the **customer's phone by WhatsApp or by message (SMS)**. For WhatsApp, use the **open-wa** GitHub project. For messages, use **our own system** that sends directly to the customer (no outside SMS vendor).
2. **PRO login bug:** after assigning the new **PRO** role to a user, opening that ID does not work: on login there is **no response at all**.
3. **Godown alerts must stay on:** today staff must switch alerts on every time the app opens. The notification **and ring** must be **always on**, and must **push and ring even when the app is closed**. **The owner has already built a native Godown app (not a PWA).** Extend and fix that app; do not create a new one.

## ROLE
You are the engineer updating JMD Cart (Next.js 14 App Router, Prisma, Postgres, Cloud Run + Cloud SQL, `management.jmdcart.com` and `jmdcart.com`). Fix and build the three items, prove them with several independent test layers, deploy, and re-verify. "Done" means built, run on real devices where the work needs them, measured and verified, not "it compiles".

Follow `CLAUDE.md` and `docs/rules.md`. **Never open, print or log `.env`, `.env.deploy` or any secret.** Migrations are **additive only**. **Never create or edit real invoices, orders or stock in production** (gapless numbers, real money). Messages and alerts in production go **only to clearly marked test numbers/devices** during verification.

## PART 0 — SYNC GATE (nothing is edited until this passes)
Run exactly the sync gate from `docs/prompts/11-invoice-print-agent-code.md` Part 0: `git fetch`, clean tree, fast-forward to the latest `origin/main`, confirm the commit running on **Cloud Run (100% traffic revision)** is contained in your code and production migrations all exist in the repo, work on a new branch, record the baseline of `pnpm typecheck / lint / test / build`. If branches diverged, the deployed code is not in git, or the tree is dirty: stop with `WAITING_FOR_HUMAN` and show the difference. Never reset, force-push or overwrite anyone's work. Review `git diff --stat` at the end and justify every changed file in `docs/memory.md`.

## STEP 1 — READ, MAP, HUMAN INPUTS
Read `CLAUDE.md`, `docs/memory.md`, `tasks.md`, `rules.md`, `design.md`, `prisma/schema.prisma` (role enum, Party, Invoice, push tables), auth/login code and middleware, role-to-home-route mapping, `nav.config`, the PRO role and PRO app (Prompt #18), the Godown app, service worker and push code (Prompt #18 Part F), Shop POS and Van counter, invoice print and the shared invoice view-model, settings, storage adapter, `Dockerfile` and `scripts/deploy-gcp.ps1`.

Ask the human ONCE (one message, then continue):
1. **WhatsApp number and risk acceptance.** open-wa is an **unofficial** WhatsApp Web automation library. It breaks WhatsApp's terms and the number can be **banned**. Confirm the owner accepts the risk, uses a **dedicated business number** (not his personal one), and will scan the QR code when asked. Mention the official alternative (WhatsApp Business Cloud API: approved templates, per-message cost, business verification) and offer to build that driver later.
2. **Always-on host for the WhatsApp gateway:** it needs a browser session that stays logged in, so it cannot live on scale-to-zero Cloud Run. Ask for approval of one small always-on Compute Engine VM in `asia-south1` (with a persistent disk) and give a monthly cost estimate first.
3. **SMS:** the in-house sender is an **Android phone with its own SIM** running an SMS gateway app; ask which phone and plan will be used, and note that carriers and TRAI rules limit bulk or automated SMS from ordinary SIMs, so keep it to short transactional bill messages at low volume.
4. **Where is the existing native Godown app?** Ask for its location (folder in this repo, or a separate repo/path), its stack (Kotlin, Capacitor, Flutter, React Native, other), its package id, and how it is built and installed today. Locate it yourself first (search for `AndroidManifest.xml`, `android/`, `capacitor.config`, `pubspec.yaml`, `google-services.json`) and only ask if you cannot find it.
5. **Firebase/FCM, build tools and signing:** use whatever the existing app already has. Ask only for what is **missing**: a Firebase project with Cloud Messaging enabled and the Android app registered, `google-services.json`, JDK 17 and the Android SDK on the build machine, and the release keystore (the human keeps it safe; never commit it). The server uses its Cloud Run runtime service account for FCM (no key files).
6. **Real test phones:** at least one Android 13+ and one Android 14+ phone (and one Xiaomi/Oppo/Vivo-class phone if available) for the Part C checklist.
7. Dependency approval (one batch): a Web Push/FCM server library if not already present, and whatever the Android project needs.

---

## PART A — PRO LOGIN DOES NOTHING (root cause first)
1. **Reproduce** locally with a user whose role is `PRO` and record exactly what happens (no network call? server action error swallowed? redirect loop? 404 after redirect? cookie not set?). Also read-only on production: Cloud Logging for the login request of a PRO user, and a read-only check that the production database enum actually contains the `PRO` value (the migration may not have applied, or `ALTER TYPE ... ADD VALUE` may have been run in a way that left the value unusable). Write the root cause in `docs/memory.md` before fixing.
2. **Likely causes to check:** the role-to-home-route map and session callback do not know `PRO` (undefined redirect), middleware or route guard sends PRO to a route that does not exist or bounces back to `/login`, the `/app/pro` route group or manifest missing in production, the enum value missing in the production DB, the login action throwing and the UI showing nothing.
3. **Fix forward** (never edit an applied migration; add a new one if the enum or data needs it). Then harden:
   - The login form must **always give feedback**: a visible loading state and a plain-language error for any failure (wrong credentials, inactive user, server error, unknown role), never a silent no-op. Server errors are logged with a request id, and the UI shows that id.
   - A **compile-time exhaustiveness check** over the role enum: every role must have a home route, a nav definition, a route-guard entry and a permission set; adding a role without them fails type-check.
   - A **login test for every role** (iterating the enum): correct credentials land on the role's home, wrong credentials show an error, inactive user shows an error, and the landing page renders without redirect loops.
   - The PRO app opens and works for a PRO user (Parties, Punch Order, My Orders, Today) with server-side guards.
**Gate A:** failing reproduction test written first, then green; the all-roles login suite green; production verification read-only (enum value present, route returns 200 for a PRO session in a staging-style check or a sample session created only in the test database).

## PART B — SEND BILLS TO CUSTOMERS BY WHATSAPP AND SMS
**B1. Architecture (adapters, queue, no blocking of billing).**
- `MessageProvider` interface with drivers: **`WhatsAppOpenWaGateway`** (open-wa, as the owner asked), **`SmsAndroidGateway`** (own phone/SIM), **`WaMeLink`** (a `https://wa.me/<number>?text=…` click-to-chat link opened by the cashier: zero ban risk, manual send, always available as a fallback and the default until a gateway is configured), and a stub for the official WhatsApp Cloud API. Provider choice, per channel priority and fallbacks are settings.
- A durable `OutboundMessage` table (invoice, party, phone, channel, template, status QUEUED / SENDING / SENT / DELIVERED / FAILED / SKIPPED, attempts, error, timestamps, idempotency key `invoice+channel+event`) and a worker with **retry and backoff, rate limiting (default 20 per minute, daily cap), random 2 to 6 second spacing**, and automatic **fallback** (WhatsApp failed → SMS → show the cashier a `wa.me` button). **Billing never waits for or fails because of messaging.**
- Messaging only for **transactional bill messages** to numbers the customer gave at billing. No marketing broadcasts. Walk-ins without a phone are skipped silently.

**B2. open-wa gateway (separate always-on service).**
- First **verify the current state of the open-wa repository** (maintenance status, license terms including any paid/licensed features, supported Node version, how login and the REST/webhook API work) and write it in `docs/memory.md`. If it is archived, unmaintained or its terms do not allow this use, say so and use the closest equivalent behind the same driver (for example Baileys or whatsapp-web.js), then report.
- Run it as a **Dockerised service on the approved Compute Engine VM** with a persistent disk for the session, restart-on-failure, and automatic update strategy that does not drop the session. The app reaches it only over an **authenticated private path** (shared secret header plus IP allowlist or VPC); never exposed publicly.
- **Gateway health in the admin UI** (Settings → Messaging): connected / needs QR scan (show the QR to an admin securely, expiring) / disconnected, last message time, queue length, failures, and a **Send test message** button (to a number typed by the admin). Alerts to the admin when the session drops.
- Inbound webhook: handle **STOP/opt-out** replies by flagging the phone as opted out (`MessagingOptOut`), which the worker always respects.

**B3. Own SMS system.**
- A self-hosted **Android SMS gateway** on the owner's phone using a well-known open-source gateway app (agent to research the current best self-hostable option and licence, for example an Apache-2.0 project that can poll a server or accept webhooks), configured to **pull queued messages from our API over HTTPS with a per-device token**, send them with the phone's own SIM, and report delivery status back. Document phone setup (battery optimisation off, SIM selection, daily limits). Health indicator in Settings → Messaging like the WhatsApp one. If a self-hosted option cannot be made reliable, record that and keep the `wa.me` link fallback.

**B4. The bill itself.**
- A **secure customer bill link** `https://jmdcart.com/b/<token>`: opaque 128-bit random token stored hashed, expiry (default 90 days, setting), revocable, rate-limited, `noindex`, server-rendered, fast and mobile friendly, shows the customer-facing invoice (the correct format by payment mode and GST/retail type from Prompt #17, no agent code, no internal fields, no other customers' data) with a print/PDF button. The link works even if WhatsApp/SMS is not configured.
- **Templates** (editable in settings, English and Hinglish defaults), for example: `Namaste {name}, JMD Cart se aapka bill {invoice_no} ₹{amount} ka. Bill dekhein: {link}. Dhanyavaad! Bharosa Ghar Tak.`; credit bills add the new balance; pending payments add the amount due; GST bills say so. Placeholders are validated. Message length kept short (SMS segments counted).
- Optional P1: attach a **PDF** to the WhatsApp message (needs PDF generation; do only if a light, approved approach exists).

**B5. Where it appears.**
- **Shop POS:** after Save, a small panel "Send bill to customer" with **WhatsApp** and **SMS** toggles (defaults from settings), the phone number (editable, validated, from the party or walk-in field), a send status chip (Queued / Sent / Delivered / Failed) that updates live, and **Resend** and the `wa.me` fallback button. Works from the keyboard (`Alt+W`, `Alt+M` suggestions). Also available later from the invoice detail page and Invoice Edit ("send updated bill" is optional and off by default).
- **Van counter / app:** same, with big buttons in the 3-step flow's receipt screen.
- Per-party preference (send automatically / ask / never) and a global default; opt-outs enforced everywhere.
- Audit: who sent what to whom and when.
**Gate B:** tests: idempotency (a bill is never sent twice for the same event), retry/backoff/rate limit with fake timers, fallback chain, opt-out respected, skipped when no phone, billing succeeds when the gateway is down, token security (unguessable, expiry, revocation, no data leakage, noindex), template rendering and length, status updates, permissions, no agent code or internal fields on the public bill page. A **fake gateway** is used in automated tests (no network). Production verification only to a test number.

---

## PART C — EXISTING NATIVE GODOWN APP: ALERTS ALWAYS ON, RINGING EVEN WHEN CLOSED
The owner built the native Godown app already. **Audit it against the checklist below, find every gap, and fix the gaps in place** (same stack, same package id, same signing, no rewrite). Keep everything that already works.

**C0. Audit first (write findings in `docs/memory.md` before changing code):**
- Locate the app and record its stack, package id, minSdk/targetSdk, permissions, services and receivers, how it receives notifications today (FCM data or notification messages, Web Push inside a WebView, polling), how the alert is rung (in-app audio, notification sound, foreground service), and how login/session is stored.
- Reproduce the owner's complaints on a real or emulated device: (1) alerts must be switched on again each time the app opens, (2) no ring when the app is closed. State the **root cause** of each (for example: the ring is played by web audio inside the WebView, which needs a tap each session and stops when the app is closed; or the server sends FCM *notification* messages that the OS shows silently without waking custom code; or the service is not a foreground service and is killed; or nothing restarts after reboot).

**C1. Required behaviour (acceptance checklist; implement whatever is missing, in the app's own stack with native code where needed):**
1. **FCM high-priority data messages** are received by a messaging service even when the app is closed (not notification-only messages), and start the alert.
2. **Looping alarm:** a foreground service plays a **looping ring on the alarm audio stream** (`USAGE_ALARM`, repeating until accepted, snoozed or timed out, default 2 minutes) at a safe volume, with a **repeating vibration pattern**; the insistent, high-importance notification channel is the fallback.
3. **Full-screen alert** over the lock screen that turns the screen on, with big **Accept**, **Snooze 1 min** and **Open order**; heads-up notification fallback when full-screen intent is not allowed.
4. **Accept** calls the acknowledge API with a **device token** (long-lived, scoped only to register, heartbeat, acknowledge, snooze, test and version; revocable; stored in encrypted storage), stops the ring, and opens the order's packing screen. If another warehouse manager accepts first, the server sends a **"cancel alert"** message and the ring stops on every device.
5. **Always on, nothing to switch:** the alert service starts automatically after login, **restarts after reboot** (`BOOT_COMPLETED`) and after app updates, and there is **no per-session toggle**. Logout unregisters the device. A persistent low-priority notification "Order alerts ON" keeps the process reliable (foreground service type correct for the target API level).
6. **Permission and reliability onboarding**, shown at first run and whenever health degrades: notification permission (Android 13+), full-screen intent permission (Android 14+: check `canUseFullScreenIntent()` and deep link to the setting), battery-optimisation exemption, Do Not Disturb guidance, and **OEM-specific steps** for Xiaomi/Redmi, Oppo/Realme, Vivo, Samsung, OnePlus (auto-start, background activity, lock in recents), plus a **Test alert** button that rings like a real order. Verify each Android API requirement against the current Android documentation before relying on it.
7. **Heartbeat and health:** periodic heartbeat (WorkManager, plus on every FCM receive) reporting online status, app version, notification/full-screen/battery-optimisation state and the last acknowledgement. An admin **"Alert health"** screen lists each warehouse device (online/offline, last seen, permission problems) and an alert goes to the admin when a warehouse phone is unreachable or its permissions are broken.
8. **Update and install:** version-check endpoint, in-app "Update available" prompt, and the signed release APK downloadable only by logged-in staff from `management.jmdcart.com/app/godown/install` (stored in the private storage bucket) with plain steps for "install unknown apps". Keep the app's existing distribution method if it already has one and add only what is missing.
9. **Security:** no secrets in the APK, cleartext traffic forbidden, WebView debugging off in release, release signing with the owner's keystore, minification on.

**C2. Server side (additive to Prompt #18 Part F).**
- `PushSubscription` gains `type` (WEB | NATIVE), device label, app version and health fields; `OrderAlert` keeps the state machine and escalation (re-alert every 60 s until accepted, escalate to admin after 3 minutes, stop on accept, idempotent per order).
- Send through FCM HTTP v1 using the Cloud Run runtime service account: high priority, short TTL, per-order collapse key, a separate cancel message, invalid tokens removed automatically. Web Push stays for web subscribers. **One alert chain per order** regardless of how many devices.
- Endpoints (device-token authenticated, rate-limited, audited): register, heartbeat, acknowledge, snooze, test alert, version. Admin endpoints for Alert health.

**C3. PWA users** (other roles): remember "alerts enabled" across sessions, resume without re-toggling where the browser allows, and show a clear banner about browser limits with a link to install the native app where one exists for that role.

**Gate C:** the audit and root causes are written; server tests with a mocked FCM sender (payload shape, data-only high priority, collapse key, escalation timeline with fake timers, stop on accept, cancel message, invalid-token cleanup, device-token scope, health state machine); the app's own unit tests for the alert state machine and registration; the **release build succeeds and produces a signed APK** with the documented permission set; lint/static checks. A **manual real-device checklist** recorded in `docs/memory.md` on the phones from Step 1: install over the existing app (data and login preserved), permissions, **app swiped away + screen locked → create a test order → the phone rings in a loop and shows the full-screen alert**, Accept stops it, ignoring it re-alerts then escalates, reboot → still active, airplane mode off → delayed alert arrives, Alert health shows the device correctly. If a physical device is not available, print `WAITING_FOR_HUMAN: real-device test` with exact steps and do not claim Part C complete.

---

## PART D — VERIFICATION (multiple independent layers; none may be weakened)
1. **Parity:** feature inventory shows nothing was removed; API contract changes additive.
2. **Behaviour:** all existing suites pass unchanged; new tests for Parts A to C.
3. **Roles:** login and landing for every role; role matrix and server guards unchanged; PRO flows work.
4. **Messaging:** fake-gateway end-to-end for POS and Van (bill saved → message queued → sent → status shown), fallback and opt-out paths, public bill page security and speed, no leakage of agent code or internal fields.
5. **Alerts:** server escalation tests, the native app's unit tests, release build, and the real-device checklist.
6. **Accessibility** (axe zero serious/critical on new web screens: login errors, messaging settings, Alert health, public bill page) and **responsive** at 360, 768, 1366 px.
7. **Data integrity:** stock never negative, ledger sums, numbering gapless, GST paise-exact: unchanged by this work.
8. **Stability:** run the whole suite twice, then once after a clean install and fresh DB; results identical.

## PART E — DEPLOY AND VERIFY
1. Gate before deploy: Part D green, `git diff --stat` justified, migrations additive, secrets in Secret Manager.
2. Provision the approved gateway VM and deploy the open-wa service (private path only); run additive migrations through the existing migration job; deploy a new revision with the existing script (labelled with the commit SHA); run `scripts/smoke-prod.ts` (extend it: public bill route with an invalid token returns 404, messaging health endpoint is staff-only, alert endpoints reject missing device tokens); roll back automatically on failure.
3. Production checks without real transactions: a PRO test login in the test DB flow and read-only checks in production, gateway health shows "connected" after the QR scan, **one test WhatsApp and one test SMS to the owner's test number**, one **test alert to the owner's registered test phone**. Re-run verification once more from a clean checkout of the deployed commit.
4. Update in place: `docs/architecture.md` (messaging pipeline and gateways, bill link, native alert app, FCM flow, health), `docs/rules.md` (billing never blocks on messaging; transactional messages only; opt-out always respected; bill links are tokenised and expire; role enum exhaustiveness; device tokens scoped), `docs/design.md`, `docs/tasks.md`, `docs/memory.md` (root cause of the PRO login bug, open-wa status findings, decisions, device checklist results, open items).

## LOOP (follow strictly)
```
Part 0 sync gate → Step 1 → for each of Parts A to C:
  find root cause or define the invariant → write tests (failing first for bugs) → implement the smallest correct change
  → run: pnpm typecheck; pnpm lint; pnpm test; pnpm build (and the native app's release build for Part C) → run the app / device, screenshot
  → if anything fails: root-cause it, fix, rerun from the top of the part
  → proceed only when the part's gate is green and demonstrated
Then Part D (twice) → Part E → re-verify everything once more end to end.
```
- Never claim success without running the check and reading the output; quote key results in `docs/memory.md`.
- Never weaken or delete a failing test, never remove an existing feature, never send messages or alerts to real customers or staff during testing, never commit secrets or the keystore, never force-push.
- Same failure 5 times: write hypotheses and evidence in `docs/memory.md`, try a different approach. Ask the human only after 3 different approaches fail, with the exact error.
- When blocked on a human action (WhatsApp QR scan, VM approval, Firebase setup, Android tools, real-device test, diverged git), print `WAITING_FOR_HUMAN: <what>` with exact steps and keep working on whatever does not depend on it.
- Local tests use the isolated test DB. Never run destructive scripts against production.

## FINISH
Only when all gates pass, print exactly:

`PROMPT 19 COMPLETE — PRO login PASS — bill messaging PASS — native always-on alerts PASS — real-device checklist PASS — production PASS`

then: the commit live before and after, the PRO login root cause, the open-wa repository findings, gateway and SMS setup summary with costs, the alert-health screenshots, the real-device checklist results, honest limits (WhatsApp ban risk, SMS carrier limits, OEM battery settings, Play Store policy on full-screen intents), files changed with reasons, open items (official WhatsApp Cloud API driver, PDF attachment, Play Store publishing). If you cannot reach that state, print `PROMPT 19 BLOCKED` with the exact blocker.
