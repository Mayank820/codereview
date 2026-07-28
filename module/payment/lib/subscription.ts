import prisma from "@/lib/db";
import type { Tier } from "./plans";

/**
 * Subscription controller. Maps Polar products to our tiers and syncs Polar
 * webhook events onto the User record. Called from the Better Auth Polar
 * webhook handlers in `lib/auth.ts`.
 */

// Configure the real Polar product ids via env. The default keeps the product
// that was already wired in lib/auth.ts as the Plus plan.
const PLUS_PRODUCT_ID = process.env.POLAR_PRODUCT_PLUS ?? "79d748bb-cd19-48dd-aabf-ff088723e45e";
const PRO_PRODUCT_ID = process.env.POLAR_PRODUCT_PRO ?? "";

export function productToTier(productId?: string | null): Tier {
    if (!productId) return "FREE";
    if (PRO_PRODUCT_ID && productId === PRO_PRODUCT_ID) return "PRO";
    if (productId === PLUS_PRODUCT_ID) return "PLUS";
    return "FREE";
}

/** Reverse mapping: the Polar product id to switch an existing subscription to. */
export function tierToProductId(tier: Tier): string | null {
    if (tier === "PRO") return PRO_PRODUCT_ID || null;
    if (tier === "PLUS") return PLUS_PRODUCT_ID || null;
    return null;
}

// Minimal structural view of the Polar subscription payload we consume.
interface PolarSubscription {
    id?: string;
    productId?: string;
    customerId?: string;
    customer?: { externalId?: string | null } | null;
}

// With `createCustomerOnSignUp: true`, the Polar customer's externalId is our
// user id. Fall back to a stored polarCustomerId if externalId is absent.
async function resolveUserId(sub: PolarSubscription): Promise<string | undefined> {
    const externalId = sub.customer?.externalId;
    if (externalId) return externalId;

    if (sub.customerId) {
        const user = await prisma.user.findFirst({
            where: { polarCustomerId: sub.customerId },
            select: { id: true },
        });
        if (user) return user.id;
    }
    return undefined;
}

export async function handleSubscriptionActive(sub: PolarSubscription) {
    const userId = await resolveUserId(sub);
    if (!userId) return;

    await prisma.user.updateMany({
        where: { id: userId },
        data: {
            subscriptionTier: productToTier(sub.productId),
            subscriptionStatus: "ACTIVE",
            polarCustomerId: sub.customerId ?? undefined,
            polarSubcriptionId: sub.id ?? undefined,
        },
    });
}

// Fired when an existing subscription changes (e.g. a Plus → Pro plan switch).
// Re-derive the tier from the new product; leave status untouched so a pending
// cancellation isn't reverted to ACTIVE.
export async function handleSubscriptionUpdated(sub: PolarSubscription) {
    const userId = await resolveUserId(sub);
    if (!userId) return;

    await prisma.user.updateMany({
        where: { id: userId },
        data: {
            subscriptionTier: productToTier(sub.productId),
            polarCustomerId: sub.customerId ?? undefined,
            polarSubcriptionId: sub.id ?? undefined,
        },
    });
}

export async function handleSubscriptionCanceled(sub: PolarSubscription) {
    // Canceled but retains access until the period ends — just flag the status.
    const userId = await resolveUserId(sub);
    if (!userId) return;

    await prisma.user.updateMany({
        where: { id: userId },
        data: { subscriptionStatus: "CANCELLED" },
    });
}

export async function handleSubscriptionRevoked(sub: PolarSubscription) {
    // Access has ended — downgrade to the free plan.
    const userId = await resolveUserId(sub);
    if (!userId) return;

    await prisma.user.updateMany({
        where: { id: userId },
        data: {
            subscriptionTier: "FREE",
            subscriptionStatus: "EXPIRED",
            polarSubcriptionId: null,
        },
    });
}
