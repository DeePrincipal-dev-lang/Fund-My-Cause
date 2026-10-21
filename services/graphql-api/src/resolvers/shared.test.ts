import { describe, it, expect } from "vitest";
import { GraphQLError } from "graphql";
import { BigIntScalar } from "./shared.js";

describe("resolvers/shared", () => {
  describe("BigInt scalar", () => {
    it("serializes to a string", () => {
      expect((BigIntScalar as any).serialize(123n)).toBe("123");
    });

    it("parses a value string into a BigInt", () => {
      expect((BigIntScalar as any).parseValue("456")).toBe(456n);
    });

    it("parses an IntValue AST literal into a BigInt", () => {
      expect(
        (BigIntScalar as any).parseLiteral({
          kind: "IntValue",
          value: "789",
        }),
      ).toBe(789n);
    });

    it("throws a GraphQLError for a non-int AST literal", () => {
      expect(() =>
        (BigIntScalar as any).parseLiteral({
          kind: "StringValue",
          value: "789",
        }),
      ).toThrow(GraphQLError);
    });
  });

  // DateTime scalar tests removed in #913 — the DateTime scalar was dropped from
  // the schema because no field ever used it (all date/time fields use String!).
  // The resolver entry was removed accordingly; there is nothing left to test.
});
