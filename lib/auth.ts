import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./db";
import { polar, checkout, portal, usage } from "@polar-sh/better-auth";
import { polarClient } from "@/module/payment/config/polar";

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    socialProviders: {
        github: {
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
            scope: ["repo"]
        }
    },
    plugins: [
        polar({
            client: polarClient,
            createCustomerOnSignUp: true,
            use: [
                checkout({
                    products: [
                        {
                            productId: process.env.POLAR_PRODUCT_PLUS ?? "79d748bb-cd19-48dd-aabf-ff088723e45e",
                            slug: "plus",
                        },
                        ...(process.env.POLAR_PRODUCT_PRO
                            ? [{ productId: process.env.POLAR_PRODUCT_PRO, slug: "pro" }]
                            : []),
                    ],
                    successUrl: process.env.POLAR_SUCCESS_URL ?? "/dashboard/subscriptions?checkout_id={CHECKOUT_ID}",
                    authenticatedUsersOnly: true,
                }),
                portal({
                    returnUrl: process.env.NEXT_PUBLIC_URL || "http://localhost:3000/dashboard",
                }),
                usage(),
            ],
        })
    ]
})
