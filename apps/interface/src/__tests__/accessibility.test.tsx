// Canonical accessibility test file.
//
// This file contains two layers of coverage:
//   1. axe / jest-axe violation checks (component-level ARIA correctness)
//   2. DOM structural markup checks (heading hierarchy, ARIA roles, labels)
//
// The structural checks were previously in src/test/accessibility.test.tsx
// and have been consolidated here (see issue #1175).
// src/test/accessibility.test.tsx is now a stub that redirects here.

import React from "react";
import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

// ---------------------------------------------------------------------------
// Layer 1: axe / jest-axe violation checks
// ---------------------------------------------------------------------------

describe("Accessibility (a11y) Regression Test Suite", () => {
  it("should pass accessibility checks for standard Button component", async () => {
    const { container } = render(
      <button type="button" className="btn btn-primary" aria-label="Submit contribution">
        Donate Now
      </button>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("should pass accessibility checks for form inputs with proper labels and associations", async () => {
    const { container } = render(
      <form aria-label="Donation form">
        <label htmlFor="donation-amount">Donation Amount (XLM)</label>
        <input
          id="donation-amount"
          name="amount"
          type="number"
          min="1"
          placeholder="Enter amount"
          aria-required="true"
        />
        <button type="submit">Confirm Donation</button>
      </form>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("should pass accessibility checks for Navigation bar with landmark roles", async () => {
    const { container } = render(
      <nav aria-label="Main Navigation">
        <ul>
          <li>
            <a href="/campaigns">Explore Campaigns</a>
          </li>
          <li>
            <a href="/create">Start a Campaign</a>
          </li>
          <li>
            <a href="/about">About Us</a>
          </li>
        </ul>
      </nav>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("should pass accessibility checks for Campaign Card component with semantic markup", async () => {
    const { container } = render(
      <article aria-labelledby="campaign-title-1">
        <header>
          <h2 id="campaign-title-1">Clean Water Initiative</h2>
          <p>Help provide clean drinking water to remote villages.</p>
        </header>
        <section aria-label="Campaign Progress">
          <progress value="75" max="100" aria-label="75% of funding goal reached">
            75%
          </progress>
          <span>750 / 1000 XLM Raised</span>
        </section>
        <footer>
          <a href="/campaign/clean-water" aria-label="View details for Clean Water Initiative">
            View Campaign
          </a>
        </footer>
      </article>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("should pass accessibility checks for Modal Dialog with accessible title and description", async () => {
    const { container } = render(
      <div role="dialog" aria-modal="true" aria-labelledby="modal-heading" aria-describedby="modal-desc">
        <h2 id="modal-heading">Confirm Transaction</h2>
        <p id="modal-desc">Are you sure you want to pledge 500 XLM to this campaign?</p>
        <div>
          <button type="button">Cancel</button>
          <button type="button" className="btn-confirm">
            Confirm
          </button>
        </div>
      </div>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ---------------------------------------------------------------------------
// Layer 2: DOM structural markup checks
// Migrated from src/test/accessibility.test.tsx (issue #1175).
// These verify heading hierarchy, ARIA roles, labels, and form structure
// at the DOM level — complementary to, not redundant with, axe checks above.
// ---------------------------------------------------------------------------

describe("Accessibility - Navbar", () => {
  it("should have proper heading hierarchy", () => {
    render(
      <div>
        <h1>Fund My Cause</h1>
        <h2>Featured Campaigns</h2>
      </div>
    );
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
  });

  it("should have proper button labels", () => {
    render(
      <button aria-label="Connect wallet">
        <span>Connect</span>
      </button>
    );
    expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
  });

  it("should have semantic navigation", () => {
    render(
      <nav role="navigation" aria-label="Main navigation">
        <button aria-label="Menu">Menu</button>
        <a href="/">Home</a>
      </nav>
    );
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });
});

describe("Accessibility - Forms", () => {
  it("should have associated labels with inputs", () => {
    render(
      <div>
        <label htmlFor="amount">Amount</label>
        <input id="amount" type="number" />
      </div>
    );
    expect(screen.getByLabelText("Amount")).toBeInTheDocument();
  });

  it("should have proper form structure", () => {
    render(
      <form>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" required />
        <button type="submit">Submit</button>
      </form>
    );
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("should have error messages linked to inputs", () => {
    render(
      <div>
        <label htmlFor="amount">Amount</label>
        <input id="amount" type="number" aria-describedby="amount-error" />
        <span id="amount-error" role="alert">Amount must be positive</span>
      </div>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

describe("Accessibility - Interactive Elements", () => {
  it("should have proper ARIA roles", () => {
    render(
      <div role="region" aria-label="Campaign progress">
        <div role="progressbar" aria-valuenow={50} aria-valuemin={0} aria-valuemax={100} />
      </div>
    );
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("should have proper link text", () => {
    render(
      <a href="/campaign/1" aria-label="View campaign: Clean Water Initiative">
        View Campaign
      </a>
    );
    expect(screen.getByRole("link")).toHaveAccessibleName();
  });
});
