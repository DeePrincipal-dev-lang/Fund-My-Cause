import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { FormField, getFieldErrorId, getFieldHelperId } from "../FormField";

describe("FormField", () => {
  it("links the label to the control it wraps", () => {
    render(
      <FormField label="Goal">{(control) => <input {...control} />}</FormField>,
    );

    expect(screen.getByLabelText("Goal")).toBeDefined();
  });

  it("marks the control invalid and points it at the error node", () => {
    render(
      <FormField label="Goal" id="goal" error="Too low">
        {(control) => <input {...control} />}
      </FormField>,
    );

    const input = screen.getByLabelText("Goal");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-errormessage")).toBe(
      getFieldErrorId("goal"),
    );
    expect(screen.getByRole("alert").textContent).toBe("Too low");
  });

  it("describes the control with helper text when there is no error", () => {
    render(
      <FormField label="Goal" id="goal" helperText="In XLM">
        {(control) => <input {...control} />}
      </FormField>,
    );

    expect(screen.getByLabelText("Goal").getAttribute("aria-describedby")).toBe(
      getFieldHelperId("goal"),
    );
  });

  it("suppresses helper text once an error is present", () => {
    render(
      <FormField label="Goal" error="Too low" helperText="In XLM">
        {(control) => <input {...control} />}
      </FormField>,
    );

    expect(screen.queryByText("In XLM")).toBeNull();
  });

  it("marks the control required and renders the indicator", () => {
    const { container } = render(
      <FormField label="Goal" required>
        {(control) => <input {...control} />}
      </FormField>,
    );

    const input = screen.getByLabelText(/Goal/);
    expect(input.hasAttribute("required")).toBe(true);
    expect(container.querySelector("label")?.textContent).toContain("*");
  });

  it("generates unique ids so repeated fields stay independently labelled", () => {
    render(
      <>
        <FormField label="First">{(c) => <input {...c} />}</FormField>
        <FormField label="Second">{(c) => <input {...c} />}</FormField>
      </>,
    );

    const first = screen.getByLabelText("First");
    const second = screen.getByLabelText("Second");
    expect(first.id).not.toBe(second.id);
  });

  // ── Negative-path tests ───────────────────────────────────────────────

  it("does not set aria-invalid when there is no error", () => {
    render(
      <FormField label="Goal" id="goal">
        {(control) => <input {...control} />}
      </FormField>,
    );

    const input = screen.getByLabelText("Goal");
    expect(input.getAttribute("aria-invalid")).toBeFalsy();
  });

  it("does not set aria-errormessage when there is no error", () => {
    render(
      <FormField label="Goal" id="goal">
        {(control) => <input {...control} />}
      </FormField>,
    );

    const input = screen.getByLabelText("Goal");
    expect(input.getAttribute("aria-errormessage")).toBeNull();
  });

  it("does not set aria-describedby when there is no helper text and no error", () => {
    render(
      <FormField label="Goal" id="goal">
        {(control) => <input {...control} />}
      </FormField>,
    );

    const input = screen.getByLabelText("Goal");
    expect(input.getAttribute("aria-describedby")).toBeNull();
  });

  it("renders error message with role alert for screen readers", () => {
    render(
      <FormField label="Email" id="email" error="Invalid email format">
        {(control) => <input {...control} type="email" />}
      </FormField>,
    );

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Invalid email format");
    expect(alert.id).toBe(getFieldErrorId("email"));
  });

  it("error message is associated with the input via aria-errormessage", () => {
    render(
      <FormField label="Password" id="password" error="Too short">
        {(control) => <input {...control} type="password" />}
      </FormField>,
    );

    const input = screen.getByLabelText("Password");
    expect(input.getAttribute("aria-errormessage")).toBe(
      getFieldErrorId("password"),
    );
  });

  it("error replaces helper text — both are not shown simultaneously", () => {
    render(
      <FormField
        label="Goal"
        id="goal"
        error="Must be positive"
        helperText="Enter amount in XLM"
      >
        {(control) => <input {...control} />}
      </FormField>,
    );

    expect(screen.getByRole("alert").textContent).toBe("Must be positive");
    expect(screen.queryByText("Enter amount in XLM")).toBeNull();
  });

  it("required indicator uses aria-hidden so screen readers skip it", () => {
    const { container } = render(
      <FormField label="Name" required>
        {(control) => <input {...control} />}
      </FormField>,
    );

    const indicator = container.querySelector("span[aria-hidden='true']");
    expect(indicator).not.toBeNull();
    expect(indicator?.textContent).toBe("*");
  });

  it("aria-required is set on the control when required is true", () => {
    render(
      <FormField label="Name" required>
        {(control) => <input {...control} />}
      </FormField>,
    );

    const input = screen.getByLabelText(/Name/);
    expect(input.getAttribute("aria-required")).toBe("true");
  });

  it("aria-required is not set when required is false", () => {
    render(
      <FormField label="Name">{(control) => <input {...control} />}</FormField>,
    );

    const input = screen.getByLabelText("Name");
    expect(input.hasAttribute("aria-required")).toBe(false);
  });

  it("focus management — user can tab to the input field", async () => {
    const user = userEvent.setup();
    render(
      <FormField label="Goal" id="goal">
        {(control) => <input {...control} />}
      </FormField>,
    );

    const input = screen.getByLabelText("Goal");
    await user.tab();
    expect(document.activeElement).toBe(input);
  });

  it("error transitions from none to error state correctly", () => {
    const { rerender } = render(
      <FormField label="Email" id="email">
        {(control) => <input {...control} />}
      </FormField>,
    );

    // Initially no error
    expect(screen.queryByRole("alert")).toBeNull();
    const input = screen.getByLabelText("Email");
    expect(input.getAttribute("aria-invalid")).toBeFalsy();

    // Transition to error state
    rerender(
      <FormField label="Email" id="email" error="Required field">
        {(control) => <input {...control} />}
      </FormField>,
    );

    expect(screen.getByRole("alert").textContent).toBe("Required field");
    expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBe(
      "true",
    );
  });

  it("error transitions from error back to valid state", () => {
    const { rerender } = render(
      <FormField label="Email" id="email" error="Invalid">
        {(control) => <input {...control} />}
      </FormField>,
    );

    expect(screen.getByRole("alert").textContent).toBe("Invalid");

    // Transition to valid
    rerender(
      <FormField label="Email" id="email">
        {(control) => <input {...control} />}
      </FormField>,
    );

    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.getByLabelText("Email").getAttribute("aria-invalid"),
    ).toBeFalsy();
  });

  it("error message renders with customizable className", () => {
    const { container } = render(
      <FormField
        label="Goal"
        id="goal"
        error="Too low"
        errorClassName="custom-error"
      >
        {(control) => <input {...control} />}
      </FormField>,
    );

    const alert = container.querySelector('[role="alert"]');
    expect(alert?.className).toContain("custom-error");
  });

  it("multiple fields can be in error state independently", () => {
    render(
      <>
        <FormField label="Name" id="name" error="Required">
          {(c) => <input {...c} />}
        </FormField>
        <FormField label="Email" id="email" error="Invalid format">
          {(c) => <input {...c} />}
        </FormField>
        <FormField label="Age" id="age">
          {(c) => <input {...c} />}
        </FormField>
      </>,
    );

    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(2);
    expect(alerts[0].textContent).toBe("Required");
    expect(alerts[1].textContent).toBe("Invalid format");

    // Age field should not be marked invalid
    expect(
      screen.getByLabelText("Age").getAttribute("aria-invalid"),
    ).toBeFalsy();
  });

  it("empty string error is treated as no error", () => {
    render(
      <FormField label="Goal" id="goal" error="">
        {(control) => <input {...control} />}
      </FormField>,
    );

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("null error is treated as no error", () => {
    render(
      <FormField label="Goal" id="goal" error={null}>
        {(control) => <input {...control} />}
      </FormField>,
    );

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("error with only whitespace is treated as truthy error", () => {
    render(
      <FormField label="Goal" id="goal" error="  ">
        {(control) => <input {...control} />}
      </FormField>,
    );

    expect(screen.getByRole("alert")).toBeDefined();
  });

  it("getFieldErrorId and getFieldHelperId produce stable, different IDs", () => {
    const errorId = getFieldErrorId("my-field");
    const helperId = getFieldHelperId("my-field");
    expect(errorId).toBe("my-field-error");
    expect(helperId).toBe("my-field-helper");
    expect(errorId).not.toBe(helperId);
  });
});
