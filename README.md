# Vendii

Recovers unclaimed dividends for Nigerian shareholders and estates. The shareholder gives us every spelling of their name, we search the registers, they sign a limited power of attorney and a NIBSS fee mandate, a person here reviews the pack, we file and chase, and the registrar pays the shareholder directly. We debit 10% of what arrived. Vendii never holds client money.

**Language and stack.** TypeScript throughout. Next.js 14 (App Router) with React 18 for the pages, Next.js route handlers for the server, and Firebase for sign-in (Auth), data (Firestore) and uploads (Storage). It deploys to Vercel as-is. Font is Space Grotesk; brand colours navy `#295D8F` and gold `#C59F56`.

The data layer runs two ways, picked by `NEXT_PUBLIC_DATA_SOURCE`: `mock` keeps everything in the browser with no accounts or keys, `firebase` is the real thing.

## Run it

You need Node.js 20 or later.

```bash
npm install
npm run dev          # http://localhost:3000, mock mode by default
npm test             # domain rules, claim lifecycle, and the API routes
npm run typecheck
npm run build
```

In mock mode the one-time code is always `123456`. Sign in with any Nigerian mobile number or email. Four demo staff are built in: `ops@vendii.ng` (admin), `reviewer@vendii.ng`, `agent@vendii.ng` and `finance@vendii.ng`. The **Demo** button (bottom right, mock mode only) fills sample details, loads a shareholder's claim history, loads admin demo data (22 claims across 10 registrars in every state), signs you in as any role, and resets everything.

Two walkthroughs. **Shareholder:** start a claim from the landing page, use Demo to fill sample details, search, file. **Admin portal:** Demo, Load admin demo data, then switch between the four roles from the same panel and watch the rooms and buttons change.

## How it's put together

```
app/                    pages
  page.tsx              landing
  sign-in/              phone code by SMS, or an email sign-in link
  auth/callback/        where email sign-in links land
  claim/                the wizard: name, variants, identity, [authority], bank,
                        search, results, authorize (POA), mandate, filed
  dashboard/            shareholder tracking and claim timelines
  ops/                  the admin portal: queue, claim review, registrars, money,
                        team, audit log, settings
  api/claims/bulk/      the same staff action on many claims
  api/ops/filing/[id]/  audited view of a filing's ID documents
  api/admin/            registrar edits, settings, team roles
  forms/                fill every registrar's mandate form from one set of details
  api/search/           register search (server)
  api/claims/file/      files a claim pack (server)
  api/claims/[id]/      every change to a claim after filing (server)
components/             shared UI (wizard shell, signature pad, timeline, warrant)
lib/domain/             pure rules, no framework: state machine, claim actions,
                        fees, name normalisation, validation, registrar contacts
lib/data/               Repository interface, mock and Firebase implementations,
                        and the Firestore document shapes
lib/auth/               AuthService interface, mock and Firebase implementations
lib/firebase/           browser and server (service account) Firebase setup
lib/server/             token check, role check, error handling for the routes
firestore.rules         who can read what; nobody writes from the browser
storage.rules           upload folders per user, no overwrites or deletes
scripts/                seed the demo register, grant the ops role
tests/                  Vitest
```

Pages only ever call `repo.*` and `auth.*`. Nothing else in the UI knows which backend it's on.

## Rules the code enforces

**Every claim ends in one of three places.** Paid, rejected with a written reason, or an exception that names what the shareholder must do. The state machine lives in `lib/domain/claimStatus.ts` and every move goes through `lib/domain/actions.ts`, which the browser mock and the server routes both call. There is one copy of the rules. A test checks every open status can still reach a terminal one.

```
draft ─▶ review ─▶ submitted ─▶ chasing ─▶ collected ─▶ paid
   │        │          │           │
   └▶ hold  └──────────┴───────────┴──▶ exception ─▶ (review | chasing)
                                   any open status ─▶ rejected (reason required)
```

**Every pack is reviewed by a person before it's filed.** Filing puts claims in `review`. Only ops can move them to `submitted`. This is BRD FR-5.2, and it stays until the pilot tells us the name-matching error rate.

**The fee is taken only after the money arrives.** `collected ─▶ paid` is the only route to paid, the fee is computed on the server from the stored claim amount, and the debit record's ID is the claim ID, so a second debit on the same claim fails inside the transaction.

**Amounts come from the register, never the browser.** `/api/claims/file` takes register entry IDs only and copies company, units and amount from `registerEntries`. Each entry must match one of the names on the filing, so guessing someone else's entry ID gets you an error, not their dividend.

**Clients can't write to Firestore at all.** `firestore.rules` gives shareholders read access to their own filings and claims, gives staff read access to everything, and denies every write. All changes go through three Next.js routes under `app/api`, which verify the Firebase ID token, read the role from a custom claim the client can't set, and run the change in a transaction. `tests/api.test.ts` runs those routes against an in-memory Firestore and tries a forged token, approving as a shareholder, chasing someone else's claim, filing an entry that belongs to a different name, attaching another user's passport photo, and debiting a fee twice. Each one fails.

**Name matching** strips accents and punctuation and collapses spacing, so "A. B. Ogunyemi", "A.B. OGUNYEMI" and "a b ogunyemi" meet. Every register entry stores `holderNameNorm`, so search is an exact lookup on the normalised spelling. Re-run `npm run seed` (or re-ingest) if `normalizeName()` ever changes.

## Admin portal

Six rooms under `/ops`, each shown only to the roles that can use it. The server enforces the same rules, so hiding a button is never the only protection.

**Queue.** Opens on "mine" when you have assigned work, otherwise everything open, overdue first. Every claim has an owner, the time it entered its current state, and a deadline in working days (Lagos time, weekends skipped). A chase restarts the clock. A shareholder's check-in request pulls the deadline in to the next working day. Claims chasing longer than the escalation threshold are flagged with the registrar's named contact. Bulk actions: take, assign, and approve. Bulk approve covers confirmed matches only; weaker matches have to be opened and approved one at a time.

**Registrars.** All 21, ranked by overdue work, with open value, oldest open claim, median days from filing to payment, acceptance rate and rejection reasons. Each has an acceptance matrix (accepts our POA, accepts email, wet-ink signature, bank stamp, affidavit for name variants, notarised POA) where every answer is yes, no or unknown. It starts unknown and fills in as registrars confirm things. This is the evidence base for SEC and for training new staff.

**Money.** Fees from the moment a registrar pays until the money is on our statement: to debit, in progress, failed (with a retry date three working days out), collected, or waived. A failed debit tells the shareholder nothing was taken and when we'll retry. Bulk debit requests. Ledger export as CSV. Reconciliation: drop in the fee account's bank statement as CSV and each credit is matched to a fee by its `VND-` reference, or by exact amount if the bank dropped it. It lists anything marked collected that never reached the statement, which is the gap that costs money.

**Team.** Give, change or remove staff roles. Takes effect at once (Firebase revokes the old session). You can't change your own role.

**Audit log.** Every claim change, every view of someone's ID documents, every forms download, registrar edit, role change and settings change. On Firebase each entry is written in the same transaction as the change, and no client can write or edit it. Filter by person, action or claim; export as CSV.

**Settings.** The SLA policy, in working days. Not the fee rate: that's written into the mandate each shareholder signs, so changing it is a legal change, not a setting. To charge less on one claim, waive the fee; that's logged with a reason.

### Roles

| Role | Can |
|---|---|
| Agent | Work claims: record receipts, write chases, take unassigned claims or let go of their own. Sees ID documents. |
| Reviewer | Everything an agent can, plus approve, reject, raise exceptions, assign anyone's work, edit registrar requirements. |
| Finance | Record registrar payments, request and record fee debits, retry, reconcile. Can't approve claims and never sees ID documents. |
| Admin | Everything, plus waiving fees, the team, the audit log and settings. |

Two rules hold whatever the role. Whoever approved a claim can't debit or waive its fee. And staff never read filings or ID documents straight from the database: `/api/ops/filing` logs each view and returns photos, signatures and probate documents as links that expire after 15 minutes. Opening a claim doesn't load them; the reviewer clicks "Show ID documents", so the log records deliberate views, not every page load.

The old single "ops" role still works and is read as admin.

## Registrar forms

Every registrar has its own e-dividend mandate form. Vendii fills them from one set of details: the shareholder's name, BVN, bank, address, contact details, passport photo and signature go onto the right boxes of each registrar's form, and the companies they hold are ticked. Several companies on one registrar share one form.

Two ways in:

- **`/forms`** (the "Registrar forms" link in the app bar). The shareholder searches company names ("Coronation Insurance" finds Coronation Registrars), enters details once, adds a photo, signs, and downloads one PDF with a filled page per registrar.
- **Ops review screen.** "Download registrar forms" on any claim builds every form for its filing from what was filed, including the photo and the signature from the authority. On Firebase this runs server-side and reads the images from Storage.

How it's built:

```
lib/forms/templates.json   21 registrar templates: field boxes, photo box, signature box, 439 company tick positions
lib/forms/pdf/             the 21 blank forms as the registrars issue them
lib/forms/registry.ts      company search, company-to-registrar lookup, register-name matching
lib/forms/fill.ts          the filler (pdf-lib, server only)
app/api/forms/             POST details + holdings, get the PDF back
app/api/forms/filing/[id]/ staff only: forms for a filed claim pack
tools/form-mapping/        how the templates were mapped, and how to add a registrar
```

The filler's rules:

- Text is written in block capitals in blue-black, and shrinks to fit its box.
- Digit fields go one character per printed box.
- A number never loses digits. If a form prints too few boxes (Africa Prudential has 10 for an 11-digit BVN), the extra digits continue past the last box and the report says so.
- On the three forms that pre-print the "C" of the CHN (Cordros, Africa Prudential, PAC), the "C" isn't written twice.
- Photos and signatures scale to fit their frames.

A company is ticked only on a confident match: every word typed must appear, and at least half of the listed name must be accounted for. A holding the form doesn't print is never ticked. It comes back in the report as "add by hand", and the rest of the form is still filled. A test checks all 439 listed names match themselves and nothing else.

What the forms can't do for the shareholder: the bank stamp and the authorised bank signatory, the account opening date (left blank on purpose), and the shareholder account number column beside each company (not mapped yet).

Known gaps in the forms themselves:

- **First Registrars** lists FBN's funds and bonds but not FBN Holdings. Ask them which form FBN Holdings shareholders use.
- **Centurion's** form is a letter for C&I Leasing only, with no photo box and no company list.
- **Cordros, PAC and Veritas** print one box per letter for email. Long email addresses are cut at the last box, and the report says so.
- **Estates:** the forms carry the deceased's name, because that's whose name is on the register. The contact details, photo and signature are the administrator's. Registrars usually want a transmission request alongside, so check with each one before relying on the mandate alone.

## Setting up Firebase

1. **Create the project** at console.firebase.google.com. Put it on the **Blaze** (pay as you go) plan: real SMS codes and a Storage bucket both need it on new projects. Set a budget alert while you're there.
2. **Add a web app** (Project settings, General, Your apps, the `</>` icon). Copy the config values into `.env.local` as the `NEXT_PUBLIC_FIREBASE_*` variables from `.env.example`.
3. **Turn on sign-in** (Authentication, Sign-in method):
   - **Phone.** Under Settings, SMS region policy, allow Nigeria. For development, add a test number such as `+234 803 123 4567` with code `123456` so you aren't paying for texts.
   - **Email/Password**, then switch on **Email link (passwordless sign-in)**.
4. **Create Firestore** (Build, Firestore Database) in production mode. Pick the location closest to Lagos that your project offers. You can't change it later.
5. **Create Storage** (Build, Storage) in the same location.
6. **Deploy the rules:**
   ```bash
   npx firebase-tools login
   npx firebase-tools use --add          # pick the project
   npm run deploy:rules
   ```
7. **Add the server key.** Project settings, Service accounts, Generate new private key. From the downloaded JSON copy `project_id`, `client_email` and `private_key` into `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` in `.env.local`. Delete the JSON file afterwards. This key can read and write everything, so it only ever lives in server env vars.
8. Set `NEXT_PUBLIC_DATA_SOURCE=firebase`, then:
   ```bash
   npm run seed                                   # demo register entries
   npm run dev                                    # sign in once as yourself
   npm run set-role -- you@vendii.ng admin "Your Name"   # or your +234 number
   ```
   Reload the app and the Admin link appears. From then on, add the rest of the team from Admin, Team; the script is only needed for the first admin.

## Putting it on Vercel

To show the demo without any backend, deploy with `NEXT_PUBLIC_DATA_SOURCE=mock` and skip the Firebase variables. For the real thing:

1. **Put the code on GitHub.**
   ```bash
   git init && git add . && git commit -m "Vendii"
   git branch -M main
   git remote add origin https://github.com/<you>/vendii.git
   git push -u origin main
   ```
   `.gitignore` already keeps `.env.local` and service account files out.
2. **Import it.** On vercel.com, Add New, Project, pick the repo. Vercel detects Next.js; leave the build settings alone.
3. **Add the environment variables** before the first deploy. Open Environment Variables and paste the whole contents of `.env.local`; Vercel splits it into keys. Check `NEXT_PUBLIC_DATA_SOURCE` is `firebase` and that `FIREBASE_PRIVATE_KEY` still has its `\n` sequences.
4. **Deploy**, then copy your URL (for example `vendii.vercel.app`).
5. **Authorise the domain in Firebase.** Authentication, Settings, Authorized domains, add the Vercel URL and any custom domain. Without this, phone codes and email links fail with an unauthorised-domain error.
6. Every push to `main` now redeploys. Other branches get preview URLs; add those to Authorized domains too if you want to sign in on them.

If you change an environment variable later, redeploy from the Deployments tab. `NEXT_PUBLIC_` values are baked in at build time.

## Not built yet

- **Sending chase emails.** Staff messages are queued in `outboundMessages`; nothing sends them yet. Until a sender exists, "Log as sent" records the chase and restarts the clock, and the screen tells staff to send it from the team inbox. This is the most important gap in the portal.
- **The mandate provider's webhook.** Today finance records a debit's success or failure by hand. When Fincra (or similar) is connected, its webhook should call the same `runClaimAction` with `debitFee` or `failDebit`, under a system actor, so the audit log shows the provider rather than a person.
- **Public holidays** in the SLA clock. Expect a few false overdues around them.
- **Pagination.** The queue and money room load up to 1,000 claims, and the audit page the latest 1,000 entries. Fine for the pilot; past that they need server-side paging.


- **Register data.** `registerEntries` holds the demo seed only. It needs an ingestion job for the SEC unclaimed dividend portal and registrar lists, with a `source` and refresh date per entry.
- **The mandate provider.** Mandates are stored as `pending` with the shareholder's acknowledgements. Creating the real NIBSS mandate (Fincra or similar) and receiving debit webhooks belongs in a new route under `app/api` that applies the `debitFee` action when the provider confirms. Today ops records it by hand.
- **WhatsApp codes.** Firebase Auth sends SMS only. WhatsApp through a Nigerian provider such as Termii means a small route that sends and checks the code, then signs the user in with a Firebase custom token. The sign-in screen already shows the WhatsApp option when the auth service says it's available.
- **Attaching forms automatically.** Forms are generated on demand from the ops screen. Saving a copy to Storage when a claim is approved, so the filed pack is frozen, is a small next step.
- **Fee notice before debit.** The timeline records it; the SMS or email itself isn't sent yet.
- **Revoking the POA** from the shareholder's side. The field exists (`poa.revokedAt` on the filing); the screen doesn't.
- **Rules tests on the emulator.** The API routes are tested; `firestore.rules` and `storage.rules` are short and deny all client writes, but they haven't been run against the Firebase emulator yet.

## Known limits

- Mock mode stores photos and signatures as resized data URLs in `localStorage`. If storage fills, filings are kept without the images.
- The Firebase SDK is in the bundle even in mock mode (about 130 kB on the pages that touch data). Split it out with a dynamic import before launch.
- Ops views uploaded documents through Firebase download URLs. Anyone holding one of those links can open that file, so don't paste them into chat or email. Switching to short-lived signed URLs from a server route is a small change.
- Account numbers are checked for 10 digits only. The NUBAN check digit needs the bank code; the mandate provider verifies it.
- Registrar contact emails are as printed on their forms, including Centurion's `cusomercare@` spelling. Confirm before sending real mail.
- Two people can file on the same register entry if both give the same spelling. Human review is the check for that in Phase 1.
