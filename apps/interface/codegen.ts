import type { CodegenConfig } from "@graphql-codegen/cli";

// Schema is loaded straight from the graphql-api service's source (the
// `gql` tagged template it exports) rather than by introspecting a running
// server — services/graphql-api isn't normally running in local dev.
const SCALARS = {
  // BigInt is serialized as a string on the wire — see
  // services/graphql-api/src/resolvers.ts's BigInt resolver.
  // DateTime scalar was removed in #913 — it was defined in the schema but
  // never used by any field (all date/time fields use String!).
  BigInt: "string",
};

const config: CodegenConfig = {
  schema: "../../services/graphql-api/src/schema.ts",
  documents: "src/lib/graphql/operations/**/*.graphql",
  ignoreNoDocuments: true,
  generates: {
    // Schema-level types shared with any other TypeScript consumer
    // (e.g. services/graphql-api's own resolvers, other frontends).
    "../../packages/types/src/graphql.ts": {
      plugins: ["typescript"],
      config: { scalars: SCALARS },
    },
    // apps/interface's typed operations + a graphql-request SDK bound to them.
    "src/lib/graphql/generated.ts": {
      plugins: [
        "typescript",
        "typescript-operations",
        "typescript-graphql-request",
      ],
      config: { scalars: SCALARS, rawRequest: false },
    },
  },
  hooks: {
    afterAllFileWrite: ["prettier --write"],
  },
};

export default config;
