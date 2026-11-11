import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import Stripe from "stripe";
import { LEGAL_VERSION } from "../client/src/lib/legal";
import { plusE2ePreflight } from "./support/plusSubscriptionPreflight";
import {
  attachSignedPlayback, postWebhook, startPlusHarness, stripeEventsForCustomer, stripeSignature,
  verificationLinkFor, verifiedPlaybackClaims, waitForStripeEvents, type PlusHarness,
} from "./support/plusSubscriptionHarness";

/**
 * The whole Plus subscription, end to end, against **Stripe test mode** and a
 * throwaway local database:
 *
 *   guest sees the Plus lock → signs up and verifies → Stripe Checkout (test
 *   card) → the webhook grants Plus → signed playback → cancel in the Stripe
 *   Customer Portal → access until the period end → access removed → a
 *   repeated webhook changes nothing.
 *
 * What is real: the Stripe API (test mode), Stripe's hosted Checkout and
 * Customer Portal pages, every webhook event (Stripe's own objects, read back
 * through the Events API), signature verification, the app server, Postgres.
 *
 * What is necessarily arranged, and why:
 * - **Webhook delivery is relayed.** Stripe cannot call 127.0.0.1, so the test
 *   fetches the events Stripe generated and POSTs them to the server signed
 *   with the signing secret the server was started with.
 * - **The period end is brought forward.** A subscription cannot be aged a
 *   month from outside, so after the portal cancellation the test ends the
 *   subscription through the Stripe API. Stripe then emits the same
 *   `customer.subscription.deleted` it sends when the period really ends.
 * - **Playback tokens are verified, not streamed.** The server signs with a
 *   throwaway RSA key, so the test checks the token's signature and claims;
 *   Mux would only stream for a real Mux signing key, and its hosts are
 *   blocked here.
 *
 * Without Stripe test keys and a local Postgres this is skipped and says so —
 * see `plusE2ePreflight`. It never falls back to mocks.
 */
const preflight = plusE2ePreflight();

const PLUS_CLASS = "steady-strength-flow";
const PLAYBACK_ID = "plusE2eSignedPlaybackId";
const PASSWORD = "plus-e2e-Passw0rd";

if (!preflight.ok) {
  // The reason is in the title so it shows in every reporter, not only the HTML one.
  test(`Plus subscription end to end — SKIPPED, nothing was run or verified: ${preflight.reason}`, () => {
    test.skip(true, preflight.reason);
  });
} else {
  const config = preflight.config;
  const stripe = new Stripe(config.stripeSecretKey);
  let harness: PlusHarness;
  const createdCustomers: string[] = [];

  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    // Before anything is created: the key must be a test-mode key *according
    // to Stripe*, not just by its prefix, and both prices must be test prices.
    for (const id of [config.priceMonthly, config.priceYearly]) {
      const price = await stripe.prices.retrieve(id);
      expect(price.livemode, `${id} must be a test-mode price`).toBe(false);
    }
    harness = await startPlusHarness(config);
    await attachSignedPlayback(harness, PLUS_CLASS, PLAYBACK_ID);
  });

  test.afterAll(async () => {
    // Leave the Stripe test account as it was found.
    for (const customer of createdCustomers) await stripe.customers.del(customer).catch(() => undefined);
    await harness?.stop();
  });

  /** Fail if any secret the server holds shows up in anything the browser received from the app. */
  function watchForSecrets(context: BrowserContext, leaks: string[]) {
    const secrets = Object.entries(harness.serverSecrets);
    const shapes: Array<[string, RegExp]> = [
      ["a Stripe secret key", /\b(?:sk|rk)_(?:test|live)_[A-Za-z0-9]{10,}/],
      ["a webhook signing secret", /\bwhsec_[A-Za-z0-9]{10,}/],
      ["a private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
    ];
    context.on("response", async (response) => {
      if (!response.url().startsWith(harness.baseUrl)) return;
      const type = response.headers()["content-type"] ?? "";
      if (!/json|html|javascript|text|xml/.test(type)) return;
      const body = await response.text().catch(() => "");
      const headers = JSON.stringify(response.headers());
      for (const [name, value] of secrets) {
        if (body.includes(value) || headers.includes(value)) leaks.push(`${name} in ${response.url()}`);
      }
      for (const [label, shape] of shapes) if (shape.test(body)) leaks.push(`${label} in ${response.url()}`);
    });
  }

  async function me(page: Page) {
    return (await (await page.request.get(`${harness.baseUrl}/api/auth/me`)).json()) as { user: { id: number; plan: string; emailVerified: boolean } | null };
  }
  async function classDetail(page: Page) {
    const res = await page.request.get(`${harness.baseUrl}/api/classes/${PLUS_CLASS}`);
    return { status: res.status(), text: await res.text() };
  }
  async function entitlement(page: Page) {
    return (await (await page.request.get(`${harness.baseUrl}/api/billing/entitlement`)).json()) as Record<string, unknown>;
  }
  async function ledger() {
    const count = async (table: string) => Number((await harness.db.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n);
    return {
      purchases: await count("billing_purchases"),
      consentAudits: await count("billing_consent_audit"),
      stripeEvents: await count("stripe_events"),
      plusUsers: Number((await harness.db.query("SELECT count(*)::int AS n FROM users WHERE plan = 'plus'")).rows[0].n),
      emails: harness.emails.length,
    };
  }

  /** Stripe's hosted Checkout page (test mode): pay with the 4242 test card. */
  async function payOnStripeCheckout(page: Page, email: string) {
    await page.waitForURL(/^https:\/\/checkout\.stripe\.com\//, { timeout: 30_000 });
    expect(page.url(), "a test-mode Checkout Session").toContain("cs_test_");
    const card = page.locator("#cardNumber");
    if (!(await card.isVisible().catch(() => false))) {
      // Some accounts show a payment-method list first.
      await page.locator('[data-testid="card-accordion-item-button"], #payment-method-accordion-item-title-card').first().click({ timeout: 15_000 }).catch(() => undefined);
    }
    await card.fill("4242 4242 4242 4242", { timeout: 30_000 });
    await page.locator("#cardExpiry").fill("12 / 34");
    await page.locator("#cardCvc").fill("123");
    await page.locator("#billingName").fill("Plus E2E Test");
    const country = page.locator("#billingCountry");
    if (await country.isVisible().catch(() => false)) await country.selectOption("US");
    const postal = page.locator("#billingPostalCode");
    if (await postal.isVisible().catch(() => false)) await postal.fill("94107");
    const emailField = page.locator("#email");
    if (await emailField.isEditable().catch(() => false)) await emailField.fill(email);
    await page.locator('[data-testid="hosted-payment-submit-button"], button[type="submit"]').first().click();
    await page.waitForURL(`${harness.baseUrl}/plus?checkout=success`, { timeout: 90_000 });
  }

  /** Stripe's hosted Customer Portal (test mode): cancel the subscription. */
  async function cancelInStripePortal(page: Page) {
    await page.waitForURL(/^https:\/\/billing\.stripe\.com\//, { timeout: 30_000 });
    await page.locator('[data-test="cancel-subscription"]').or(page.getByRole("link", { name: /cancel subscription/i })).or(page.getByRole("button", { name: /cancel subscription/i })).first().click({ timeout: 30_000 });
    await page.locator('[data-test="confirm"]').or(page.getByRole("button", { name: /^cancel subscription$/i })).first().click({ timeout: 30_000 });
    // An optional "why are you cancelling?" survey; dismiss it if this account shows one.
    await page.getByRole("button", { name: /no thanks|skip|submit/i }).first().click({ timeout: 5_000 }).catch(() => undefined);
  }

  test("guest lock → signup → Checkout → webhook grants Plus → signed playback → portal cancel → access ends at period end; repeated webhooks change nothing", async ({ browser }) => {
    test.setTimeout(8 * 60_000);
    const startedAt = Math.floor(Date.now() / 1000) - 5;
    const email = `plus-e2e-${Date.now().toString(36)}@example.com`;
    const leaks: string[] = [];
    const context = await browser.newContext();
    watchForSecrets(context, leaks);
    await context.addInitScript((version) => {
      localStorage.setItem("sadhana.legalAck", JSON.stringify({ version, acceptedAt: new Date().toISOString() }));
      localStorage.setItem("sadhana.welcome.seen", "1");
    }, LEGAL_VERSION);
    // The throwaway signing key is not a Mux key; nothing to gain from asking Mux.
    await context.route(/^https:\/\/([a-z0-9-]+\.)*(mux\.com|litix\.io)\//, (route) => route.abort());
    const page = await context.newPage();
    let customerId = "";
    let subscriptionId = "";
    const delivered = new Map<string, string>();

    /** Relay every not-yet-delivered Stripe event for the customer, correctly signed, and return the server's answers. */
    const relayNewEvents = async (events: Stripe.Event[]) => {
      const results: Array<{ type: string; status: number; duplicate: boolean | undefined }> = [];
      for (const event of events) {
        if (delivered.has(event.id)) continue;
        expect(event.livemode, "only test-mode events are relayed").toBe(false);
        const payload = JSON.stringify(event);
        const res = await postWebhook(harness, payload, stripeSignature(payload, harness.webhookSecret));
        expect(res.status, `${event.type} (${event.id}) → ${JSON.stringify(res.body)}`).toBe(200);
        delivered.set(event.id, payload);
        results.push({ type: event.type, status: res.status, duplicate: typeof res.body === "object" ? res.body.duplicate : undefined });
      }
      return results;
    };

    await test.step("a guest sees the Plus lock and receives no playback", async () => {
      await page.goto(`${harness.baseUrl}/classes/${PLUS_CLASS}`);
      await expect(page.getByTestId("class-player-locked")).toBeVisible();
      await expect(page.getByTestId("class-player-unlock")).toBeVisible();
      await expect(page.locator("mux-player")).toHaveCount(0);
      const detail = await classDetail(page);
      expect(JSON.parse(detail.text).class).toMatchObject({ locked: true, playback: null });
      expect(detail.text).not.toContain(PLAYBACK_ID);
      expect(detail.text).not.toMatch(/eyJ/);
    });

    await test.step("signs up and verifies the email from the message the server sent", async () => {
      await page.goto(`${harness.baseUrl}/account`);
      await page.getByTestId("tab-signup").click();
      await page.getByTestId("signup-email").fill(email);
      await page.getByTestId("signup-password").fill(PASSWORD);
      await page.getByTestId("signup-confirm").fill(PASSWORD);
      await page.getByTestId("signup-legal-ack").check();
      await page.getByTestId("signup-submit").click();
      const link = await verificationLinkFor(harness, email);
      expect(link.startsWith(harness.baseUrl)).toBe(true);
      await page.goto(link);
      await expect(page.getByTestId("verify-success")).toBeVisible();
      expect((await me(page)).user).toMatchObject({ plan: "free", emailVerified: true });
    });

    await test.step("subscribes through Stripe Checkout with a test card", async () => {
      await page.goto(`${harness.baseUrl}/plus`);
      await page.getByRole("button", { name: "Monthly", exact: true }).click();
      await page.getByTestId("plan-select-plus").click();
      await payOnStripeCheckout(page, email);
      const customers = await stripe.customers.list({ email, limit: 2 });
      expect(customers.data, "exactly one Stripe test customer for this account").toHaveLength(1);
      customerId = customers.data[0]!.id;
      createdCustomers.push(customerId);
      expect(customers.data[0]!.livemode).toBe(false);
    });

    await test.step("the success URL alone grants nothing", async () => {
      await expect(page.getByTestId("plus-account-status")).toContainText("Waiting for subscription confirmation");
      expect((await me(page)).user?.plan).toBe("free");
      expect(JSON.parse((await classDetail(page)).text).class).toMatchObject({ locked: true, playback: null });
    });

    let checkoutEvents: Stripe.Event[] = [];
    await test.step("webhooks with a missing, wrong or tampered signature are rejected", async () => {
      checkoutEvents = await waitForStripeEvents(stripe, customerId, startedAt, ["checkout.session.completed", "invoice.paid"]);
      const completed = checkoutEvents.find((e) => e.type === "checkout.session.completed")!;
      const payload = JSON.stringify(completed);
      const good = stripeSignature(payload, harness.webhookSecret);
      const rejected = [
        ["no signature", await postWebhook(harness, payload, null)],
        ["signed with another secret", await postWebhook(harness, payload, stripeSignature(payload, "whsec_not_the_configured_secret"))],
        ["body changed after signing", await postWebhook(harness, payload.replace(completed.id, `${completed.id}x`), good)],
        ["a ten-minute-old timestamp", await postWebhook(harness, payload, stripeSignature(payload, harness.webhookSecret, Math.floor(Date.now() / 1000) - 600))],
      ] as const;
      for (const [label, res] of rejected) expect(res.status, label).toBe(400);
      expect((await me(page)).user?.plan, "rejected webhooks grant nothing").toBe("free");
      expect((await ledger()).stripeEvents).toBe(0);
    });

    await test.step("the signed webhook grants Plus", async () => {
      const results = await relayNewEvents(checkoutEvents);
      expect(results.map((r) => r.type)).toContain("checkout.session.completed");
      for (const result of results) expect(result.duplicate, `${result.type} applied once`).toBe(false);
      expect((await me(page)).user?.plan).toBe("plus");
      const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: "active" });
      expect(subscriptions.data).toHaveLength(1);
      subscriptionId = subscriptions.data[0]!.id;
      expect(await ledger()).toMatchObject({ purchases: 1, consentAudits: 1, plusUsers: 1 });
      await page.goto(`${harness.baseUrl}/plus`);
      await expect(page.getByTestId("plus-account-status")).toHaveText("Your account has Plus access.");
    });

    await test.step("a repeated webhook does not double-apply", async () => {
      const before = { ledger: await ledger(), entitlement: await entitlement(page), plan: (await me(page)).user?.plan };
      for (const [id, payload] of delivered) {
        const res = await postWebhook(harness, payload, stripeSignature(payload, harness.webhookSecret));
        expect(res.status, id).toBe(200);
        expect(res.body, `${id} is recognised as a duplicate`).toMatchObject({ received: true, duplicate: true });
      }
      expect({ ledger: await ledger(), entitlement: await entitlement(page), plan: (await me(page)).user?.plan }).toEqual(before);
    });

    await test.step("signed Plus playback is issued to the member, and only to the member", async () => {
      const detail = JSON.parse((await classDetail(page)).text).class as { locked: boolean; playback: { policy: string; playbackId: string; tokens: Record<string, string>; expiresAt: number } };
      expect(detail.locked).toBe(false);
      expect(detail.playback).toMatchObject({ policy: "signed", playbackId: PLAYBACK_ID });
      const now = Math.floor(Date.now() / 1000);
      for (const [name, audience] of [["playback", "v"], ["thumbnail", "t"], ["storyboard", "s"]] as const) {
        const claims = verifiedPlaybackClaims(harness, detail.playback.tokens[name]!);
        expect(claims, `${name} token`).toMatchObject({ sub: PLAYBACK_ID, aud: audience });
        expect(Number(claims.exp)).toBeGreaterThan(now);
      }
      await page.goto(`${harness.baseUrl}/classes/${PLUS_CLASS}`);
      const player = page.locator("mux-player");
      await expect(player).toBeAttached();
      await expect(page.getByTestId("class-player-locked")).toHaveCount(0);
      await expect(page.getByTestId("class-player-resume")).toHaveAttribute("data-policy", "signed");
      expect(await player.getAttribute("playback-id")).toBe(PLAYBACK_ID);
      // The page fetched its own token (a second later, so not byte-identical):
      // what the player holds must itself verify and name this class's video.
      expect(verifiedPlaybackClaims(harness, (await player.getAttribute("playback-token")) ?? "")).toMatchObject({ sub: PLAYBACK_ID, aud: "v" });

      const guest = await browser.newContext();
      const guestDetail = await (await guest.request.get(`${harness.baseUrl}/api/classes/${PLUS_CLASS}`)).text();
      expect(JSON.parse(guestDetail).class).toMatchObject({ locked: true, playback: null });
      expect(guestDetail).not.toContain(PLAYBACK_ID);
      await guest.close();
    });

    let accessUntil = "";
    await test.step("cancelling in the Stripe Customer Portal keeps access until the period end", async () => {
      const cancelStartedAt = Math.floor(Date.now() / 1000) - 5;
      await page.goto(`${harness.baseUrl}/plus`);
      await page.getByTestId("billing-portal").click();
      await cancelInStripePortal(page);
      // Trust Stripe, not the portal's UI, for whether the cancellation happened.
      await expect.poll(async () => {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        return sub.cancel_at_period_end || sub.cancel_at !== null;
      }, { timeout: 60_000, message: "Stripe never recorded the portal cancellation — check the test account's Customer Portal settings allow cancelling" }).toBe(true);
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      expect(sub.status, "still active until the period ends").toBe("active");
      const periodEnd = sub.cancel_at ?? sub.items.data[0]?.current_period_end ?? null;
      expect(periodEnd).not.toBeNull();

      const events = await waitForStripeEvents(stripe, customerId, cancelStartedAt, ["customer.subscription.updated"]);
      for (const result of await relayNewEvents(events)) expect(result.duplicate).toBe(false);

      const state = await entitlement(page);
      expect(state).toMatchObject({ plan: "plus", cancelAtPeriodEnd: true });
      accessUntil = String(state.accessUntil);
      expect(Math.floor(Date.parse(accessUntil) / 1000), "access runs to Stripe's period end").toBe(periodEnd);
      expect(Date.parse(accessUntil)).toBeGreaterThan(Date.now());
      // Cancelled is not expired: still Plus, still playable.
      expect((await me(page)).user?.plan).toBe("plus");
      expect(JSON.parse((await classDetail(page)).text).class).toMatchObject({ locked: false });
    });

    await test.step("when the period ends, access is removed (period end brought forward through the Stripe API)", async () => {
      const endStartedAt = Math.floor(Date.now() / 1000) - 5;
      await stripe.subscriptions.cancel(subscriptionId);
      const events = await waitForStripeEvents(stripe, customerId, endStartedAt, ["customer.subscription.deleted"]);
      const results = await relayNewEvents(events);
      expect(results.map((r) => r.type)).toContain("customer.subscription.deleted");

      expect((await me(page)).user?.plan).toBe("free");
      const detail = await classDetail(page);
      expect(JSON.parse(detail.text).class).toMatchObject({ locked: true, playback: null });
      expect(detail.text).not.toContain(PLAYBACK_ID);
      await page.goto(`${harness.baseUrl}/classes/${PLUS_CLASS}`);
      await expect(page.getByTestId("class-player-locked")).toBeVisible();
      await expect(page.locator("mux-player")).toHaveCount(0);

      // The end-of-subscription event is idempotent too.
      const before = await ledger();
      const deleted = events.find((e) => e.type === "customer.subscription.deleted")!;
      const payload = delivered.get(deleted.id)!;
      expect((await postWebhook(harness, payload, stripeSignature(payload, harness.webhookSecret))).body).toMatchObject({ duplicate: true });
      expect(await ledger()).toEqual(before);
      expect((await me(page)).user?.plan).toBe("free");
    });

    await test.step("the browser never received a secret key", async () => {
      const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, html: document.documentElement.outerHTML }));
      const cookies = JSON.stringify(await context.cookies());
      for (const [name, value] of Object.entries(harness.serverSecrets)) {
        expect(storage.includes(value), `${name} in page storage or DOM`).toBe(false);
        expect(cookies.includes(value), `${name} in cookies`).toBe(false);
      }
      expect(leaks, "secrets in responses the browser received from the app").toEqual([]);
      // Every relayed event belonged to this run's customer and to test mode.
      for (const event of await stripeEventsForCustomer(stripe, customerId, startedAt)) expect(event.livemode).toBe(false);
    });

    await context.close();
  });
}
