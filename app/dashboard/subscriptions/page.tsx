"use client";

import React from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Check } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PLANS, TIER_ORDER, type Tier, type Plan } from "@/module/payment/lib/plans";
import { useBilling } from "@/module/payment/hooks/use-billing";
import { changeSubscriptionPlan } from "@/module/payment/actions";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

const UsageMeter = ({
    label,
    used,
    limit,
}: {
    label: string;
    used: number;
    limit: number | null;
}) => {
    const unlimited = limit === null;
    const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">
                    {used} / {unlimited ? "∞" : limit}
                </span>
            </div>
            {!unlimited && <Progress value={pct} />}
        </div>
    );
};

const SubscriptionsPage = () => {
    const { data, isLoading } = useBilling();
    const queryClient = useQueryClient();
    const [pending, setPending] = React.useState<string | null>(null);

    const currentTier = (data?.tier ?? "FREE") as Tier;
    const currentPlan = PLANS[currentTier];

    // Free -> paid: start a brand-new Polar checkout.
    const handleCheckout = async (slug: "plus" | "pro", tierId: Tier) => {
        try {
            setPending(tierId);
            await authClient.checkout({ slug });
        } catch (error) {
            console.error("Checkout failed:", error);
            toast.error("Could not start checkout. Billing may not be fully configured.");
            setPending(null);
        }
    };

    const handlePortal = async () => {
        try {
            setPending("portal");
            await authClient.customer.portal();
        } catch (error) {
            console.error("Portal failed:", error);
            toast.error("Could not open the billing portal.");
            setPending(null);
        }
    };

    // Paid -> paid: switch the existing subscription's product (with proration).
    const changePlan = useMutation({
        mutationFn: (tier: "PLUS" | "PRO") => changeSubscriptionPlan(tier),
        onSuccess: (res) => {
            if (res.success) {
                toast.success("Your plan has been updated.");
                queryClient.invalidateQueries({ queryKey: ["billing"] });
            } else {
                toast.error(res.message ?? "Could not change your plan.");
            }
            setPending(null);
        },
        onError: () => {
            toast.error("Could not change your plan.");
            setPending(null);
        },
    });

    const handlePlanAction = (plan: Plan) => {
        if (plan.id === currentTier) return;
        if (plan.slug === null) {
            // Downgrade to Free — cancel via the Polar portal.
            handlePortal();
            return;
        }
        if (currentTier === "FREE") {
            handleCheckout(plan.slug, plan.id);
            return;
        }
        // Already on a paid plan — switch the existing subscription.
        setPending(plan.id);
        changePlan.mutate(plan.id as "PLUS" | "PRO");
    };

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Spinner />
            </div>
        );
    }

    const currentIdx = TIER_ORDER.indexOf(currentTier);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Subscription</h1>
                <p className="text-muted-foreground">Manage your plan and track your usage</p>
            </div>

            {/* Current plan + usage */}
            <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                            Current plan
                            <Badge variant={currentTier === "FREE" ? "outline" : "secondary"}>
                                {currentPlan.name}
                            </Badge>
                            {data?.subscriptionStatus && data.subscriptionStatus !== "ACTIVE" && (
                                <Badge variant="destructive">{data.subscriptionStatus}</Badge>
                            )}
                        </CardTitle>
                        <CardDescription>Your lifetime usage on the current plan</CardDescription>
                    </div>
                    {currentTier !== "FREE" && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handlePortal}
                            disabled={pending !== null}
                        >
                            {pending === "portal" ? "Opening..." : "Manage billing"}
                        </Button>
                    )}
                </CardHeader>
                <CardContent className="grid gap-6 sm:grid-cols-2">
                    <UsageMeter
                        label="Repositories connected"
                        used={data?.repositoryCount ?? 0}
                        limit={currentPlan.repoLimit}
                    />
                    <UsageMeter
                        label="Pull request reviews"
                        used={data?.totalReviews ?? 0}
                        limit={currentPlan.reviewLimit}
                    />
                </CardContent>
            </Card>

            {/* Plan cards */}
            <div className="grid gap-4 md:grid-cols-3">
                {TIER_ORDER.map((tier) => {
                    const plan = PLANS[tier];
                    const isCurrent = tier === currentTier;
                    const isDowngrade = TIER_ORDER.indexOf(tier) < currentIdx;

                    const actionLabel =
                        pending === plan.id
                            ? "Please wait…"
                            : plan.slug === null
                              ? "Downgrade to Free"
                              : currentTier === "FREE"
                                ? `Upgrade to ${plan.name}`
                                : isDowngrade
                                  ? `Switch to ${plan.name}`
                                  : `Upgrade to ${plan.name}`;

                    return (
                        <Card
                            key={tier}
                            className={
                                isCurrent
                                    ? "border-primary shadow-[0_0_30px_rgba(99,102,241,0.15)]"
                                    : ""
                            }
                        >
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    {plan.name}
                                    {isCurrent && <Badge>Current</Badge>}
                                </CardTitle>
                                <div className="mt-1">
                                    {plan.priceInr === 0 ? (
                                        <span className="text-lg font-semibold text-foreground">
                                            Free forever
                                        </span>
                                    ) : (
                                        <div className="text-foreground">
                                            <span className="text-2xl font-bold">
                                                ₹{plan.priceInr.toLocaleString("en-IN")}
                                            </span>
                                            <span className="text-muted-foreground"> / mo + taxes</span>
                                            <span className="block text-xs text-muted-foreground">
                                                ${plan.priceUsd} USD + taxes
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {plan.features.map((feature) => (
                                    <div key={feature} className="flex items-center gap-2 text-sm">
                                        <Check className="h-4 w-4 shrink-0 text-primary" />
                                        <span>{feature}</span>
                                    </div>
                                ))}
                            </CardContent>
                            <CardFooter>
                                {isCurrent ? (
                                    <Button className="w-full" variant="outline" disabled>
                                        Current plan
                                    </Button>
                                ) : (
                                    <Button
                                        className="w-full"
                                        variant={isDowngrade ? "outline" : "default"}
                                        onClick={() => handlePlanAction(plan)}
                                        disabled={pending !== null || changePlan.isPending}
                                    >
                                        {actionLabel}
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};

export default SubscriptionsPage;
