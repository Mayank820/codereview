"use client";

import { useQuery } from "@tanstack/react-query";
import { getBillingOverview } from "../actions";

export const useBilling = () => {
    return useQuery({
        queryKey: ["billing"],
        queryFn: async () => await getBillingOverview(),
        refetchOnWindowFocus: false,
    });
};
