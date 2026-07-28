"use client";

import { useQuery } from "@tanstack/react-query";
import { getReviews } from "../actions";

export const useReviews = () => {
    return useQuery({
        queryKey: ["reviews"],
        queryFn: async () => await getReviews(),
        refetchOnWindowFocus: false,
    });
};
