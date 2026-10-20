"use client";

import { useState } from "react";

/**
 * Client-side paging for a long list — pairs with <PaginationFooter>. Keeps
 * the page in range when the list shrinks (e.g. after a filter), and
 * `pageStart` gives the 0-based offset for numbering rows across pages.
 */
export function usePagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  return {
    page: currentPage,
    setPage,
    totalPages,
    pageStart,
    pageItems: items.slice(pageStart, pageStart + pageSize),
  };
}
