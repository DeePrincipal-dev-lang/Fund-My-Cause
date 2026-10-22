import {
  xlmAmountSchema,
  optionalXlmCapSchema,
  firstSchemaError,
} from "@/lib/validationSchemas";

const messages = {
  invalid: "Enter a valid amount.",
  belowMinimum: "Amount is below the minimum.",
};

describe("xlmAmountSchema", () => {
  const schema = xlmAmountSchema(5, messages);

  it("rejects an empty string", () => {
    expect(firstSchemaError(schema, "")).toBe(messages.invalid);
  });

  it("rejects whitespace-only input", () => {
    expect(firstSchemaError(schema, "   ")).toBe(messages.invalid);
  });

  it("rejects non-numeric input", () => {
    expect(firstSchemaError(schema, "abc")).toBe(messages.invalid);
  });

  it("rejects zero", () => {
    expect(firstSchemaError(schema, "0")).toBe(messages.invalid);
  });

  it("rejects a negative amount", () => {
    expect(firstSchemaError(schema, "-1")).toBe(messages.invalid);
  });

  it("rejects a positive amount below the minimum", () => {
    expect(firstSchemaError(schema, "4.99")).toBe(messages.belowMinimum);
  });

  it("accepts an amount exactly at the minimum", () => {
    expect(firstSchemaError(schema, "5")).toBeNull();
  });

  it("accepts an amount above the minimum", () => {
    expect(firstSchemaError(schema, "10.5")).toBeNull();
  });

  it("tolerates surrounding whitespace on an otherwise valid amount", () => {
    expect(firstSchemaError(schema, "  10  ")).toBeNull();
  });
});

describe("optionalXlmCapSchema", () => {
  const schema = optionalXlmCapSchema(2, messages);

  it("treats an empty string as no limit", () => {
    expect(firstSchemaError(schema, "")).toBeNull();
  });

  it('treats "0" as no limit', () => {
    expect(firstSchemaError(schema, "0")).toBeNull();
  });

  it("rejects a negative cap", () => {
    expect(firstSchemaError(schema, "-5")).toBe(messages.invalid);
  });

  it("rejects non-numeric input", () => {
    expect(firstSchemaError(schema, "abc")).toBe(messages.invalid);
  });

  it("rejects a cap below the minimum contribution", () => {
    expect(firstSchemaError(schema, "1")).toBe(messages.belowMinimum);
  });

  it("accepts a cap at or above the minimum contribution", () => {
    expect(firstSchemaError(schema, "2")).toBeNull();
    expect(firstSchemaError(schema, "100")).toBeNull();
  });
});
