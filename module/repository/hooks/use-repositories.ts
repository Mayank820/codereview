"use client"

import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchRepositories } from "../actions/index";

export const useRepositories = () => {
    const PAGE_SIZE = 10;

    return useInfiniteQuery({
        queryKey: ["repositories"],
        queryFn: async ({ pageParam = 1 }) => {
            const data = await fetchRepositories(pageParam, PAGE_SIZE)
            return data
        },
        getNextPageParam: (lastPage, allPages) => {
            if (lastPage.length < PAGE_SIZE) return undefined
            return allPages.length + 1
        },
        initialPageParam: 1
    })
}