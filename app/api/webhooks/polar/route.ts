import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import {
    handleSubscriptionActive,
    handleSubscriptionUpdated,
    handleSubscriptionCanceled,
    handleSubscriptionRevoked,
} from "@/module/payment/lib/subscription";

/**
 * Standalone Polar webhook endpoint.
 *
 * Configure this URL in the Polar dashboard:
 *   https://<host>/api/webhooks/polar
 * using a signing secret that matches POLAR_WEBHOOK_SECRET.
 *
 * The Better Auth polar plugin's `webhooks()` sub-plugin is intentionally NOT
 * used, so this route is the single source of truth for subscription sync.
 */
export async function POST(request: Request) {
    const body = await request.text(); // verify against the RAW body
    const headers = Object.fromEntries(request.headers.entries());

    let event;
    try {
        event = validateEvent(body, headers, process.env.POLAR_WEBHOOK_SECRET ?? "");
    } catch (error) {
        if (error instanceof WebhookVerificationError) {
            return new Response("Invalid signature", { status: 403 });
        }
        console.error("Polar webhook parse error:", error);
        return new Response("Bad request", { status: 400 });
    }

    try {
        switch (event.type) {
            case "subscription.active":
                await handleSubscriptionActive(event.data);
                break;
            case "subscription.updated":
                await handleSubscriptionUpdated(event.data);
                break;
            case "subscription.canceled":
                await handleSubscriptionCanceled(event.data);
                break;
            case "subscription.revoked":
                await handleSubscriptionRevoked(event.data);
                break;
            default:
                // Other events (order.paid, customer.*, etc.) are ignored for now.
                break;
        }
    } catch (error) {
        console.error(`Failed to process Polar event "${event.type}":`, error);
        return new Response("Handler error", { status: 500 });
    }

    return new Response(null, { status: 202 });
}
