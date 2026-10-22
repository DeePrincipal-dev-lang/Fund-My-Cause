import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReceiptModal } from "./ReceiptModal";
import type { ContributionReceipt } from "./ReceiptModal";

const mockReceipt: ContributionReceipt = {
  campaignTitle: "Test Campaign",
  amount: 100.5,
  txHash: "abc123def456ghi789",
  timestamp: new Date("2026-06-27T12:00:00Z"),
  contractId: "CTEST123",
  contributorAddress: "GCONTRIBUTOR123",
};

describe("ReceiptModal", () => {
  it("should render receipt details", () => {
    const onClose = vi.fn();
    render(<ReceiptModal receipt={mockReceipt} onClose={onClose} />);

    expect(screen.getByText("Contribution Receipt")).toBeInTheDocument();
    expect(screen.getByText("Test Campaign")).toBeInTheDocument();
    expect(screen.getByText("100.50 XLM")).toBeInTheDocument();
    expect(screen.getByText(/abc123def456ghi789/)).toBeInTheDocument();
  });

  it("should display formatted date and time", () => {
    const onClose = vi.fn();
    render(<ReceiptModal receipt={mockReceipt} onClose={onClose} />);

    expect(screen.getByText(/Jun 27, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/12:00/)).toBeInTheDocument();
  });

  it("should call onClose when close button clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ReceiptModal receipt={mockReceipt} onClose={onClose} />);

    const closeButton = screen.getByRole("button", { name: "Close" });
    await user.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it("should generate correct explorer URL", () => {
    const onClose = vi.fn();
    const customExplorer = (hash: string) => `https://explorer.test/${hash}`;

    render(
      <ReceiptModal
        receipt={mockReceipt}
        onClose={onClose}
        explorerUrl={customExplorer}
      />
    );

    const explorerLink = screen.getByRole("link", {
      name: "View on Block Explorer",
    });
    expect(explorerLink).toHaveAttribute(
      "href",
      "https://explorer.test/abc123def456ghi789"
    );
  });

  it("should have download buttons", () => {
    const onClose = vi.fn();
    render(<ReceiptModal receipt={mockReceipt} onClose={onClose} />);

    expect(screen.getByRole("button", { name: /PDF/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /PNG/ })).toBeInTheDocument();
  });
});
