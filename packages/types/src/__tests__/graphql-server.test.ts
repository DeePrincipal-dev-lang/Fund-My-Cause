import { describe, it, expect } from "vitest";
import { CAMPAIGN_STATUS_VALUES } from "../soroban";
import {
  CampaignStatus as ClientCampaignStatus,
  MilestoneStatus as ClientMilestoneStatus,
  SortDirection as ClientSortDirection,
  SortField as ClientSortField,
} from "../graphql";
import { MilestoneStatus, SortDirection, SortField } from "../graphql-server";

/**
 * Drift test: ./graphql (client codegen) vs ./graphql-server (resolvers).
 *
 * Both modules describe the same GraphQL schema and differ only in how the
 * custom `BigInt` scalar is represented — `string` for the client, `bigint` for
 * the server. Field-name parity is enforced at compile time by
 * `GraphQLFieldParity` in ../graphql-server (interfaces are erased, so it
 * cannot be checked at runtime); the enums below survive to runtime, so their
 * values are compared here.
 */
describe("graphql-server enum parity with graphql (codegen)", () => {
  it("MilestoneStatus has the same values on both sides", () => {
    expect(Object.values(MilestoneStatus).sort()).toEqual(
      Object.values(ClientMilestoneStatus).sort(),
    );
  });

  it("SortField has the same values on both sides", () => {
    expect(Object.values(SortField).sort()).toEqual(
      Object.values(ClientSortField).sort(),
    );
  });

  it("SortDirection has the same values on both sides", () => {
    expect(Object.values(SortDirection).sort()).toEqual(
      Object.values(ClientSortDirection).sort(),
    );
  });

  it("CampaignStatus is the SCREAMING_CASE form of CAMPAIGN_STATUS_VALUES", () => {
    expect(Object.values(ClientCampaignStatus).sort()).toEqual(
      CAMPAIGN_STATUS_VALUES.map((value) => value.toUpperCase()).sort(),
    );
  });
});
