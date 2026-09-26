function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const appConfig = {
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  defaultPageSize: positiveInteger(process.env.DEFAULT_PAGE_SIZE, 20),
  maxPageSize: positiveInteger(process.env.MAX_PAGE_SIZE, 100),
  compactPageSize: positiveInteger(process.env.COMPACT_PAGE_SIZE, 10),
  productMovementLimit: positiveInteger(process.env.PRODUCT_MOVEMENT_LIMIT, 10),
  summaryNoteLimit: positiveInteger(process.env.CUSTOMER_SUMMARY_NOTE_LIMIT, 10),
  summaryChallanLimit: positiveInteger(process.env.CUSTOMER_SUMMARY_CHALLAN_LIMIT, 5),
  transactionTimeoutMs: positiveInteger(process.env.TRANSACTION_TIMEOUT_MS, 10000),
  customerSummaryCacheSeconds: positiveInteger(process.env.CUSTOMER_SUMMARY_CACHE_SECONDS, 300),
  customerSummaryMaxRequestsPerMinute: positiveInteger(process.env.CUSTOMER_SUMMARY_RATE_LIMIT, 5),
  customerSummaryMaxInputCharacters: positiveInteger(
    process.env.CUSTOMER_SUMMARY_MAX_INPUT_CHARACTERS,
    8000
  ),
  customerSummaryMaxCacheEntries: positiveInteger(
    process.env.CUSTOMER_SUMMARY_MAX_CACHE_ENTRIES,
    500
  ),
  rateLimitWindowMs: 60_000,
  llmApiKey: process.env.ANTHROPIC_API_KEY,
  llmApiUrl: "https://api.anthropic.com/v1/messages",
  anthropicApiVersion: "2023-06-01",
  llmModel: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
  llmRequestTimeoutMs: positiveInteger(process.env.LLM_REQUEST_TIMEOUT_MS, 12000),
  llmMaxOutputTokens: positiveInteger(process.env.LLM_MAX_OUTPUT_TOKENS, 180)
} as const;
