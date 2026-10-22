import React from "react";
import { render, screen, act } from "@testing-library/react";
import {
  LoadingSkeleton,
  LoadingSkeletonGrid,
  TableRowSkeleton,
  StatCardSkeleton,
  FormFieldSkeleton,
} from "./LoadingSkeleton";
import { Spinner } from "./Spinner";
import { TransactionStatus } from "./TransactionStatus";

// ── LoadingSkeleton ───────────────────────────────────────────────────────────

describe("LoadingSkeleton", () => {
  it("renders with aria-busy", () => {
    const { container } = render(<LoadingSkeleton />);
    expect(container.firstChild).toHaveAttribute("aria-busy", "true");
  });
});

describe("LoadingSkeletonGrid", () => {
  it("renders default 6 skeletons", () => {
    const { getAllByLabelText } = render(<LoadingSkeletonGrid />);
    expect(getAllByLabelText("Loading campaign")).toHaveLength(6);
  });

  it("renders custom count", () => {
    const { getAllByLabelText } = render(<LoadingSkeletonGrid count={3} />);
    expect(getAllByLabelText("Loading campaign")).toHaveLength(3);
  });
});

describe("TableRowSkeleton", () => {
  it("renders correct number of columns", () => {
    const { container } = render(
      <table>
        <tbody>
          <TableRowSkeleton cols={5} />
        </tbody>
      </table>,
    );
    expect(container.querySelectorAll("td")).toHaveLength(5);
  });
});

describe("StatCardSkeleton", () => {
  it("renders with aria-busy", () => {
    render(<StatCardSkeleton />);
    expect(screen.getByLabelText("Loading stat")).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });
});

describe("FormFieldSkeleton", () => {
  it("renders with aria-busy", () => {
    render(<FormFieldSkeleton />);
    expect(screen.getByLabelText("Loading field")).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });
});

// ── Spinner ───────────────────────────────────────────────────────────────────

describe("Spinner", () => {
  it("renders with default label", () => {
    render(<Spinner />);
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      "Loading…",
    );
  });

  it("renders with custom label", () => {
    render(<Spinner label="Submitting…" />);
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      "Submitting…",
    );
  });
});

// ── TransactionStatus ─────────────────────────────────────────────────────────

describe("TransactionStatus", () => {
  it("renders nothing when idle", () => {
    const { container } = render(<TransactionStatus status="idle" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders step list when signing", () => {
    render(<TransactionStatus status="signing" />);
    expect(screen.getByText("Signing")).toBeInTheDocument();
  });

  it("shows success state", () => {
    render(<TransactionStatus status="success" txHash="abc123" />);
    expect(screen.getByText("Transaction Successful")).toBeInTheDocument();
    expect(screen.getByText("View on Stellar Expert →")).toBeInTheDocument();
  });

  it("shows error state with message", () => {
    render(
      <TransactionStatus status="error" errorMessage="Insufficient funds" />,
    );
    expect(screen.getByText("Transaction Failed")).toBeInTheDocument();
    expect(screen.getByText("Insufficient funds")).toBeInTheDocument();
  });

  it("calls onDismiss when dismiss button clicked", () => {
    const onDismiss = jest.fn();
    render(<TransactionStatus status="error" onDismiss={onDismiss} />);
    screen.getByLabelText("Dismiss transaction error").click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("auto-dismisses success after 5 seconds", () => {
    jest.useFakeTimers();
    const onDismiss = jest.fn();
    render(<TransactionStatus status="success" onDismiss={onDismiss} />);
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
