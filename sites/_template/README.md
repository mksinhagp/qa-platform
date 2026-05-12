# Site Template

This directory is a copy-paste scaffold for onboarding a new site into the
QA Automation Platform.  It mirrors the structure of `sites/yugal-kunj/`
and every file is pre-annotated with `// TODO:` comments that guide you
through the site-specific values to fill in.

## Quick Start

```bash
# 1. Copy the template to a new directory named after your site ID.
#    The site ID must match the regex: ^[a-z0-9][a-z0-9_-]*$
#    Good: my-camp-site, acme_portal, portal2
#    Bad:  My Site, _private, 2ndsite

cp -r sites/_template sites/your-site-id

# 2. Fill in every TODO in the five TypeScript files (see checklist below).

# 3. Build — the runner loads rules.js (compiled), not rules.ts.
pnpm build

# 4. Register the site in the dashboard and run a smoke test.
#    See docs/runbooks/site-onboarding.md for the full DB and dashboard steps.
```

## File Map

| File | Purpose |
|---|---|
| `rules.ts` | Business rules and selectors validated by the Zod schema |
| `api-endpoints.ts` | Manual API endpoint stubs for Phase 6 API testing |
| `flows/index.ts` | Exports the flow map consumed by the runner |
| `flows/browse.ts` | Read-only browse / listing flow |
| `flows/registration.ts` | Approval-gated registration form flow |
| `flows/checkout.ts` | Approval-gated payment flow |

## TODO Checklist

Work through this list in order.  Every item corresponds to a `// TODO:` comment
in the template files.

### `rules.ts`
- [ ] `site_id` — unique slug matching your `sites/` directory name
- [ ] `display_name` — human-readable name for the dashboard
- [ ] `base_url` — absolute staging URL including protocol
- [ ] `capacity` fields — max attendees, waitlist settings
- [ ] `age_restriction` fields — min/max age, guardian threshold
- [ ] `coupon` fields — enable/disable, discount percentages
- [ ] `payment` fields — sandbox mode, accepted methods
- [ ] `cancellation` fields — window hours, refund percentages
- [ ] `registration` fields — waiver, multi-attendee, email confirmation pattern
- [ ] `admin` URLs — login, dashboard, bookings, registrations, reporting paths
- [ ] `selectors` — all CSS/ARIA selectors (use browser DevTools or `npx playwright codegen`)
- [ ] `elevated_approval_categories` — remove any that do not apply
- [ ] `notes` — free-form description of site quirks

### `api-endpoints.ts`
- [ ] Replace stub URLs with actual endpoints observed in DevTools Network tab
- [ ] Update `response_fields` to match real response JSON shapes
- [ ] Remove or comment out endpoints that do not exist for this site
- [ ] Add admin endpoints if Phase 7 admin flows are being implemented

### `flows/browse.ts`
- [ ] `navigate_to_site` — listing page URL
- [ ] `wait_for_listing` — listing item CSS selector
- [ ] `verify_listing_not_empty` — listing item CSS selector
- [ ] `hover_first_item` — listing item CSS selector
- [ ] `click_first_item` — clickable link/button inside the listing card

### `flows/registration.ts`
- [ ] `navigate_to_listing` — listing page URL
- [ ] `select_first_listing` — listing item and register button selectors
- [ ] `find_register_button` — prominent CTA button text/selector
- [ ] `fill_registration_form` — all field selectors (first name, last name, email, phone, DOB)
- [ ] Remove field blocks for fields the site does not collect
- [ ] `submit_registration` — submit button selector
- [ ] `verify_confirmation` — success and error message selectors

### `flows/checkout.ts`
- [ ] `FALLBACK_SANDBOX_CARD.number` — correct sandbox card for the payment processor
- [ ] `find_checkout_entry` — cart/checkout button selector
- [ ] `verify_order_summary` — order total container selector
- [ ] `fill_payment_form` — choose Option A (Stripe iframe) or Option B (plain inputs)
  - Option A: verify iframe title/name attributes
  - Option B: card number, expiry, CVV, name, ZIP selectors
- [ ] `submit_payment` — Pay/Confirm button selector
- [ ] `verify_payment_confirmation` — confirmation and error selectors

## Build Note

TypeScript files are compiled to `.js` before the runner loads them.
Always run `pnpm build` (or `pnpm typecheck` to check for errors without
emitting) after editing any `.ts` file.  The loader resolves
`sites/{siteId}/rules.js`, not `rules.ts`.

## Full Onboarding Steps

This template covers only the code files.  The full process also requires:

- Registering the site in the dashboard (Step 1)
- Configuring environments (Step 2)
- Bootstrapping the vault and adding credentials (Steps 3–4)
- Setting up email inbox and payment profile (Steps 5–6)
- Configuring approval policies (Step 7)
- Running a smoke test (Step 11)

See **`docs/runbooks/site-onboarding.md`** for the complete step-by-step guide.
