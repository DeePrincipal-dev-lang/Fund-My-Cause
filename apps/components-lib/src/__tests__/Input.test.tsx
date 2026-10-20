import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useState } from "react";
import { Input } from "../Input";

describe("Input", () => {
  it("renders uncontrolled with a default value", () => {
    render(<Input label="Title" defaultValue="Borehole project" />);

    const input = screen.getByLabelText("Title") as HTMLInputElement;
    expect(input.value).toBe("Borehole project");

    fireEvent.change(input, { target: { value: "Edited" } });
    expect(input.value).toBe("Edited");
  });

  it("stays controlled — the value only follows the parent's state", () => {
    function Controlled() {
      const [value, setValue] = useState("a");
      return (
        <Input
          label="Title"
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
        />
      );
    }

    render(<Controlled />);
    const input = screen.getByLabelText("Title") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "ab" } });
    expect(input.value).toBe("AB");
  });

  it("surfaces the validation error and marks the control invalid", () => {
    render(<Input label="Goal" error="Must be positive" />);

    expect(screen.getByRole("alert").textContent).toBe("Must be positive");
    expect(screen.getByLabelText("Goal").getAttribute("aria-invalid")).toBe(
      "true",
    );
  });

  it("does not fire onChange while disabled", () => {
    const onChange = vi.fn();
    render(<Input label="Title" disabled value="" onChange={onChange} />);

    const input = screen.getByLabelText("Title") as HTMLInputElement;
    expect(input.disabled).toBe(true);

    fireEvent.change(input, { target: { value: "x" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("drops default styling when unstyled so the caller owns the look", () => {
    render(<Input label="Title" unstyled className="my-input" />);

    expect(screen.getByLabelText("Title").className).toBe("my-input");
  });

  it("forwards a ref to the underlying input", () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input label="Title" ref={ref} />);

    expect(ref.current?.tagName).toBe("INPUT");
  });

  // ── Negative-path tests ───────────────────────────────────────────────

  it("error message is visible in the DOM when error is set", () => {
    render(<Input label="Email" error="Invalid email" />);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Invalid email");
    expect(alert).toBeDefined();
  });

  it("error is associated with input via aria-errormessage", () => {
    render(<Input label="Email" id="email" error="Invalid email" />);

    const input = screen.getByLabelText("Email");
    expect(input.getAttribute("aria-errormessage")).toBe("email-error");
  });

  it("input has aria-invalid='true' when error is present", () => {
    render(<Input label="Password" error="Too short" />);

    const input = screen.getByLabelText("Password");
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("input does NOT have aria-invalid when error is absent", () => {
    render(<Input label="Password" />);

    const input = screen.getByLabelText("Password");
    expect(input.getAttribute("aria-invalid")).toBeFalsy();
  });

  it("helper text is hidden when error is present", () => {
    render(<Input label="Goal" error="Must be positive" helperText="In XLM" />);

    expect(screen.queryByText("In XLM")).toBeNull();
    expect(screen.getByRole("alert").textContent).toBe("Must be positive");
  });

  it("helper text is visible when error is absent", () => {
    render(<Input label="Goal" helperText="In XLM" />);

    expect(screen.getByText("In XLM")).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("error transitions from none to error state", () => {
    const { rerender } = render(<Input label="Email" />);
    expect(screen.queryByRole("alert")).toBeNull();

    rerender(<Input label="Email" error="Required" />);
    expect(screen.getByRole("alert").textContent).toBe("Required");
    expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBe(
      "true",
    );
  });

  it("error transitions from error back to valid", () => {
    const { rerender } = render(<Input label="Email" error="Invalid" />);
    expect(screen.getByRole("alert").textContent).toBe("Invalid");

    rerender(<Input label="Email" />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.getByLabelText("Email").getAttribute("aria-invalid"),
    ).toBeFalsy();
  });

  it("empty string error is treated as no error", () => {
    render(<Input label="Email" error="" />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("null error is treated as no error", () => {
    render(<Input label="Email" error={null} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("multiple inputs can have independent error states", () => {
    render(
      <>
        <Input label="Name" error="Required" />
        <Input label="Email" error="Invalid" />
        <Input label="Age" />
      </>,
    );

    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(2);

    expect(
      screen.getByLabelText("Age").getAttribute("aria-invalid"),
    ).toBeFalsy();
  });

  it("input is focusable when in error state", async () => {
    const user = userEvent.setup();
    render(<Input label="Email" error="Invalid" />);

    const input = screen.getByLabelText("Email");
    await user.tab();
    expect(document.activeElement).toBe(input);
  });

  it("disabled input still surfaces error visually but is not focusable", async () => {
    const user = userEvent.setup();
    render(<Input label="Email" disabled error="Cannot be empty" />);

    const input = screen.getByLabelText("Email") as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe("Cannot be empty");

    await user.tab();
    expect(document.activeElement).not.toBe(input);
  });

  it("input supports form submission with error state", () => {
    const onSubmit = vi.fn((e) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Input label="Email" error="Invalid" />
        <button type="submit">Submit</button>
      </form>,
    );

    fireEvent.submit(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("required input marks the control as required", () => {
    render(<Input label="Email" required />);

    const input = screen.getByLabelText(/Email/);
    expect(input.hasAttribute("required")).toBe(true);
    expect(input.getAttribute("aria-required")).toBe("true");
  });

  it("required + error sets both required and aria-invalid", () => {
    render(<Input label="Email" required error="Required field" />);

    const input = screen.getByLabelText(/Email/);
    expect(input.hasAttribute("required")).toBe(true);
    expect(input.getAttribute("aria-required")).toBe("true");
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("ref is still forwarded even with error state", () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input label="Email" error="Invalid" ref={ref} />);

    expect(ref.current?.tagName).toBe("INPUT");
    expect(ref.current?.getAttribute("aria-invalid")).toBe("true");
  });

  it("unstyled mode works with error state", () => {
    render(<Input label="Email" unstyled error="Invalid" className="custom" />);

    const input = screen.getByLabelText("Email");
    expect(input.className).toBe("custom");
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });
});
