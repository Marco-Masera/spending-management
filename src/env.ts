import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    // Full CouchDB database URL, including credentials if needed.
    // Example: https://user:pass@example.com:5984/spending
    VITE_DEFAULT_COUCHDB_URL: z.string().url().optional().default(""),
  },
  emptyStringAsUndefined: true,
  runtimeEnvStrict: {
    VITE_DEFAULT_COUCHDB_URL: import.meta.env.VITE_DEFAULT_COUCHDB_URL,
  },
});
