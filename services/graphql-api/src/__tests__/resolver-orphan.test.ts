/**
 * Resolver-orphan audit for issue #1124.
 *
 * Cross-references every field resolver implemented in resolvers.ts against
 * the GraphQL schema SDL from schema.ts. Any resolver that implements a field
 * not present in the schema is an orphaned resolver — dead code that should
 * be removed.
 *
 * Conversely, any field that exists in the schema but has NO custom resolver
 * relies on the default property resolver; those are intentional and fine
 * (default resolvers are not flagged).
 *
 * What counts as an "orphaned resolver":
 *   A key under `resolvers.<TypeName>.<fieldName>` where the GraphQL schema
 *   has no type named <TypeName> or no field named <fieldName> on that type.
 *
 * Special resolver keys that are intentionally NOT schema fields:
 *   - BigInt (scalar)
 *   - CampaignStatus (enum value map)
 *
 * If this test fails, the developer should:
 *   1. Remove the orphaned resolver from resolvers.ts.
 *   2. Update any snapshot tests that referenced the removed resolver.
 *
 * To run:
 *   npx vitest run services/graphql-api/src/__tests__/resolver-orphan.test.ts
 */

import { describe, it, expect } from "vitest";
import { buildASTSchema } from "graphql";
import { typeDefs } from "../schema.js";
import { resolvers } from "../resolvers.js";

const schema = buildASTSchema(typeDefs);

// Scalar and enum resolvers are not GraphQL object-type field resolvers;
// skip them in the orphan check.
const NON_FIELD_RESOLVER_KEYS = new Set(["BigInt", "CampaignStatus"]);

describe("Resolver-orphan audit (#1124)", () => {
  it("every top-level resolver key corresponds to a type in the schema", () => {
    const orphanedTypes: string[] = [];

    for (const typeName of Object.keys(resolvers)) {
      if (NON_FIELD_RESOLVER_KEYS.has(typeName)) continue;
      if (!schema.getType(typeName)) {
        orphanedTypes.push(typeName);
      }
    }

    expect(orphanedTypes).toHaveLength(0);
    if (orphanedTypes.length > 0) {
      throw new Error(
        `Orphaned resolver type(s) found in resolvers.ts — remove or add to schema (#1124):\n` +
          orphanedTypes.map((t) => `  • ${t}`).join("\n"),
      );
    }
  });

  it("every field resolver corresponds to an existing field on its parent type", () => {
    const orphanedFields: string[] = [];

    for (const [typeName, typeResolvers] of Object.entries(resolvers)) {
      if (NON_FIELD_RESOLVER_KEYS.has(typeName)) continue;
      if (typeof typeResolvers !== "object" || typeResolvers === null) continue;

      const schemaType = schema.getType(typeName) as any;
      if (!schemaType) continue; // already caught by the previous test

      // Only object types have getFields()
      if (typeof schemaType.getFields !== "function") continue;

      const schemaFields = schemaType.getFields() as Record<string, unknown>;

      for (const fieldName of Object.keys(typeResolvers as object)) {
        if (!(fieldName in schemaFields)) {
          orphanedFields.push(`${typeName}.${fieldName}`);
        }
      }
    }

    expect(orphanedFields).toHaveLength(0);
    if (orphanedFields.length > 0) {
      throw new Error(
        `Orphaned field resolver(s) found in resolvers.ts — remove them (#1124):\n` +
          orphanedFields.map((f) => `  • ${f}`).join("\n"),
      );
    }
  });

  it("schema has no @deprecated directive on any field (all deprecated fields removed)", () => {
    // Walk every named type and every field; fail if any carries @deprecated.
    const typeMap = schema.getTypeMap();
    const deprecatedFields: string[] = [];

    for (const [typeName, namedType] of Object.entries(typeMap)) {
      // Skip built-in types
      if (typeName.startsWith("__")) continue;
      if (typeof (namedType as any).getFields !== "function") continue;

      const fields = (namedType as any).getFields() as Record<
        string,
        { deprecationReason?: string | null }
      >;
      for (const [fieldName, field] of Object.entries(fields)) {
        if (field.deprecationReason) {
          deprecatedFields.push(`${typeName}.${fieldName}: ${field.deprecationReason}`);
        }
      }
    }

    expect(deprecatedFields).toHaveLength(0);
    if (deprecatedFields.length > 0) {
      throw new Error(
        `Deprecated field(s) still present in schema — remove them (#1124):\n` +
          deprecatedFields.map((f) => `  • ${f}`).join("\n"),
      );
    }
  });

  it("all Query fields have a corresponding resolver implementation", () => {
    const queryType = schema.getQueryType();
    expect(queryType).not.toBeNull();

    const queryResolvers = (resolvers as any).Query ?? {};
    const schemaQueryFields = Object.keys(queryType!.getFields());
    const missingResolvers: string[] = [];

    for (const field of schemaQueryFields) {
      if (!(field in queryResolvers)) {
        missingResolvers.push(`Query.${field}`);
      }
    }

    // It's acceptable for some query fields to rely on default resolvers;
    // this test is informational rather than a hard failure. We assert it as
    // a snapshot so any future addition or removal is explicitly reviewed.
    // For now, all Query fields have explicit resolvers.
    expect(missingResolvers).toHaveLength(0);
  });

  it("all Mutation fields have a corresponding resolver implementation", () => {
    const mutationType = schema.getMutationType();
    expect(mutationType).not.toBeNull();

    const mutationResolvers = (resolvers as any).Mutation ?? {};
    const schemaMutationFields = Object.keys(mutationType!.getFields());
    const missingResolvers: string[] = [];

    for (const field of schemaMutationFields) {
      if (!(field in mutationResolvers)) {
        missingResolvers.push(`Mutation.${field}`);
      }
    }

    expect(missingResolvers).toHaveLength(0);
  });
});
