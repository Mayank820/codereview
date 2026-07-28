"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/db";
import { getUsageSummary } from "../lib/usage";
import { tierToProductId } from "../lib/subscription";
import { polarClient } from "@/module/payment/config/polar";

/**
 * Everything the subscription UI needs: current tier, subscription status, and
 * lifetime usage counts. Plan limits/pricing come from the shared `PLANS`
 * config on the client.
 */
export async function getBillingOverview() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        throw new Error("User not authenticated");
    }

    const [summary, user] = await Promise.all([
        getUsageSummary(session.user.id),
        prisma.user.findUnique({
            where: { id: session.user.id },
            select: { subscriptionStatus: true },
        }),
    ]);

    return {
        tier: summary.tier,
        subscriptionStatus: user?.subscriptionStatus ?? null,
        repositoryCount: summary.repositoryCount,
        totalReviews: summary.totalReviews,
    };
}

/**
 * Switches an existing subscription to a different paid plan (Plus <-> Pro).
 * Polar's checkout only *creates* subscriptions, so an existing subscriber must
 * *update* their subscription instead — this changes the product with proration.
 */
export async function changeSubscriptionPlan(targetTier: "PLUS" | "PRO") {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        throw new Error("User not authenticated");
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { polarSubcriptionId: true, subscriptionTier: true },
    });

    if (!user?.polarSubcriptionId) {
        return { success: false, message: "No active subscription to change. Please subscribe first." };
    }
    if (user.subscriptionTier === targetTier) {
        return { success: false, message: "You're already on this plan." };
    }

    const productId = tierToProductId(targetTier);
    if (!productId) {
        return { success: false, message: `The ${targetTier} plan is not configured (missing product id).` };
    }

    try {
        await polarClient.subscriptions.update({
            id: user.polarSubcriptionId,
            subscriptionUpdate: {
                productId,
                prorationBehavior: "invoice",
            },
        });

        // Reflect the change immediately; the subscription.updated webhook reconciles.
        await prisma.user.update({
            where: { id: session.user.id },
            data: { subscriptionTier: targetTier, subscriptionStatus: "ACTIVE" },
        });

        return { success: true, message: undefined };
    } catch (error) {
        console.error("Failed to change subscription plan:", error);
        return { success: false, message: "Could not change your plan. Please try again." };
    }
}
