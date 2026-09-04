/**
 * Checkout redirect helpers.
 *
 * The Pricing page used to call `window.open(url, "_blank")` after awaiting the
 * edge function. Because that happens across an async boundary, browsers treat
 * it as an unsolicited popup and block it silently — the return value was
 * ignored, so the user saw a spinner and then nothing.
 *
 * These helpers validate the URL returned by the server and perform a
 * same-tab navigation that cannot silently fail: any problem throws an Error
 * with a user-meaningful message.
 */

const ALLOWED_CHECKOUT_HOSTS = ["checkout.stripe.com", "billing.stripe.com"];

/** True when `url` is an https Stripe-hosted Checkout URL. */
export function isValidCheckoutUrl(url: unknown): url is string {
  if (typeof url !== "string" || url.length === 0) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) return false;
  return ALLOWED_CHECKOUT_HOSTS.includes(parsed.hostname);
}

export interface CheckoutNavigator {
  /** Navigate the current (or top-level) browsing context. */
  assign: (url: string) => void;
}

/**
 * Resolve the navigator to use. When the app runs inside an iframe (Lovable
 * preview) we try to navigate the top-level window so Stripe is not framed;
 * cross-origin access throws, in which case we fall back to this window.
 */
export function resolveCheckoutNavigator(win: Window = window): CheckoutNavigator {
  try {
    const top = win.top;
    if (top && top !== win) {
      // Touching top.location throws on cross-origin embedders.
      void top.location.href;
      return { assign: (url: string) => top.location.assign(url) };
    }
  } catch {
    /* cross-origin parent: navigate this frame instead */
  }
  return { assign: (url: string) => win.location.assign(url) };
}

/**
 * Navigate to a validated Stripe Checkout URL.
 * Throws an Error with a user-facing message when the URL is missing/invalid
 * or the navigation call itself fails.
 */
export function redirectToCheckout(
  url: unknown,
  navigator: CheckoutNavigator = resolveCheckoutNavigator(),
): void {
  if (!isValidCheckoutUrl(url)) {
    throw new Error(
      "We couldn't start checkout because the payment page link was missing or invalid. Please try again.",
    );
  }
  try {
    navigator.assign(url);
  } catch {
    throw new Error(
      "We couldn't open the Stripe checkout page in this browser. Please disable any pop-up or redirect blockers and try again.",
    );
  }
}
