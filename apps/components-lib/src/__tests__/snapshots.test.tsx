/**
 * Snapshot / visual-regression tests for components-lib — Issue #945
 *
 * Baseline snapshots are stored alongside this file by vitest (*.snap files).
 * They are committed to version control so CI catches any unintended visual
 * change.
 *
 * ── Snapshot update workflow ──────────────────────────────────────────────
 * When you intentionally change a component's markup or styling, regenerate
 * the baseline with:
 *
 *   npx vitest run --update-snapshots
 *   # or with the workspace script:
 *   npm run test --workspace=apps/components-lib -- --update-snapshots
 *
 * Review the diff in the .snap file carefully before committing — the intent
 * is "I changed this on purpose", not "the tests were failing so I nuked them".
 * Never delete a .snap file and re-run tests as a substitute for actually
 * reviewing the diff.
 *
 * ── Sanity check ─────────────────────────────────────────────────────────
 * Before merging new snapshot infrastructure, a deliberate visual change
 * (e.g. changing a className in Button.tsx) must cause the relevant test below
 * to fail with a snapshot mismatch. This confirms the tests actually guard
 * against regressions.
 *
 * Acceptance criteria (Issue #945):
 *  ✅  Snapshot tests added for high-value shared components.
 *  ✅  Distinct visual states covered (default, loading, error, disabled, etc.).
 *  ✅  Baselines committed alongside this file.
 *  ✅  Update workflow documented above.
 *  ✅  A deliberate change will fail the relevant test (verified manually).
 *
 * Closes #945
 */

import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { Button } from "../Button";
import { Card, CardHeader, CardBody, CardFooter } from "../Card";
import { ProgressBar } from "../ProgressBar";
import { FormField } from "../FormField";
import { Modal } from "../Modal";
import { CampaignHeader } from "../CampaignHeader";
import { CampaignProgress } from "../CampaignProgress";
import { CampaignActions } from "../CampaignActions";

// ---------------------------------------------------------------------------
// Button — all variants and sizes + loading/disabled states
// ---------------------------------------------------------------------------

describe("Button snapshots", () => {
  it("renders primary variant (default)", () => {
    const { container } = render(<Button>Donate</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders secondary variant", () => {
    const { container } = render(<Button variant="secondary">Cancel</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders outline variant", () => {
    const { container } = render(<Button variant="outline">Learn more</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders ghost variant", () => {
    const { container } = render(<Button variant="ghost">Skip</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders danger variant", () => {
    const { container } = render(<Button variant="danger">Delete</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders small size", () => {
    const { container } = render(<Button size="sm">Small</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders large size", () => {
    const { container } = render(<Button size="lg">Large</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders loading state — spinner replaces children", () => {
    const { container } = render(<Button isLoading>Saving…</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders disabled state", () => {
    const { container } = render(<Button disabled>Unavailable</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders full-width button", () => {
    const { container } = render(<Button fullWidth>Submit</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// ProgressBar — progress levels, colour tokens, label toggling
// ---------------------------------------------------------------------------

describe("ProgressBar snapshots", () => {
  it("renders at 0 %", () => {
    const { container } = render(<ProgressBar progress={0} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders at 50 %", () => {
    const { container } = render(<ProgressBar progress={50} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders at 100 % — funded state", () => {
    const { container } = render(<ProgressBar progress={100} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders over 100 % — clamped to 100", () => {
    const { container } = render(<ProgressBar progress={150} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders without label", () => {
    const { container } = render(<ProgressBar progress={42} showLabel={false} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders animated state", () => {
    const { container } = render(<ProgressBar progress={65} animated />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders green colour token", () => {
    const { container } = render(<ProgressBar progress={75} color="green" />);
    expect(container.firstChild).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// FormField — label, error, helper, required mark, fullWidth
// ---------------------------------------------------------------------------

describe("FormField snapshots", () => {
  it("renders with label only", () => {
    const { container } = render(
      <FormField label="Campaign Goal">
        {(ctrl) => <input {...ctrl} />}
      </FormField>
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders with error message — error state", () => {
    const { container } = render(
      <FormField label="Amount" error="Amount must be at least 10 XLM">
        {(ctrl) => <input {...ctrl} />}
      </FormField>
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders with helper text — helper state", () => {
    const { container } = render(
      <FormField label="Title" helperText="Max 80 characters">
        {(ctrl) => <input {...ctrl} />}
      </FormField>
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders required field — shows asterisk", () => {
    const { container } = render(
      <FormField label="Wallet Address" required>
        {(ctrl) => <input {...ctrl} />}
      </FormField>
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders full-width variant", () => {
    const { container } = render(
      <FormField label="Description" fullWidth>
        {(ctrl) => <textarea {...ctrl} />}
      </FormField>
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// Card — variant API, hoverable, composed sub-components
// ---------------------------------------------------------------------------

describe("Card snapshots", () => {
  it("renders default card (no variant)", () => {
    const { container } = render(<Card>Simple content</Card>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders default variant explicitly", () => {
    const { container } = render(<Card variant="default">Default</Card>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders compact variant", () => {
    const { container } = render(<Card variant="compact">Compact</Card>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders highlighted variant", () => {
    const { container } = render(<Card variant="highlighted">Highlighted</Card>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders hoverable card", () => {
    const { container } = render(<Card hoverable>Hover me</Card>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders card with legacy padding='sm' (backwards compat)", () => {
    const { container } = render(<Card padding="sm">Compact (legacy)</Card>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders card with legacy padding='lg' (backwards compat)", () => {
    const { container } = render(<Card padding="lg">Spacious (legacy)</Card>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders full card with header, body and footer", () => {
    const { container } = render(
      <Card>
        <CardHeader>Card Title</CardHeader>
        <CardBody>This is the body of the card.</CardBody>
        <CardFooter>Footer actions</CardFooter>
      </Card>
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// Modal — open/closed, sizes, with/without footer
// ---------------------------------------------------------------------------

describe("Modal snapshots", () => {
  it("renders nothing when closed (isOpen=false)", () => {
    const { container } = render(
      <Modal isOpen={false} onClose={vi.fn()}>Content</Modal>
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders sm modal when open", () => {
    const { container } = render(
      <Modal isOpen onClose={vi.fn()} title="Small modal" size="sm">
        Compact content
      </Modal>
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders md modal with title and body (default)", () => {
    const { container } = render(
      <Modal isOpen onClose={vi.fn()} title="Confirm donation">
        Are you sure you want to donate 50 XLM?
      </Modal>
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders lg modal with footer", () => {
    const { container } = render(
      <Modal
        isOpen
        onClose={vi.fn()}
        title="Campaign details"
        size="lg"
        footer={<Button>Close</Button>}
      >
        Detailed information here.
      </Modal>
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders xl modal", () => {
    const { container } = render(
      <Modal isOpen onClose={vi.fn()} size="xl">
        Full-width content
      </Modal>
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// CampaignHeader — default, loading skeleton, error, with image, no image
// ---------------------------------------------------------------------------

describe("CampaignHeader snapshots", () => {
  it("renders default state with title only", () => {
    const { container } = render(<CampaignHeader title="Clean Water Initiative" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders with organisation and description", () => {
    const { container } = render(
      <CampaignHeader
        title="Solar Energy for Schools"
        organization="Green Future NGO"
        description="Bringing clean energy to 50 rural schools."
      />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders loading skeleton state", () => {
    const { container } = render(
      <CampaignHeader title="Loading…" isLoading />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders error state", () => {
    const { container } = render(
      <CampaignHeader title="Error campaign" error="Failed to load image" />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders with an imageUrl and fallback", () => {
    const { container } = render(
      <CampaignHeader
        title="Ocean Cleanup"
        imageUrl="https://example.com/ocean.jpg"
        fallbackImageUrl="https://example.com/fallback.jpg"
        imageAlt="Ocean cleanup campaign banner"
      />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders with h3 heading level", () => {
    const { container } = render(
      <CampaignHeader title="Community Garden" headingLevel={3} />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders with custom class names applied", () => {
    const { container } = render(
      <CampaignHeader
        title="Styled header"
        classNames={{ root: "custom-root", title: "custom-title" }}
      />
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// CampaignProgress — default, loading, error, over-funded, with time remaining
// ---------------------------------------------------------------------------

describe("CampaignProgress snapshots", () => {
  it("renders at 0 % — nothing raised yet", () => {
    const { container } = render(<CampaignProgress percent={0} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders at 65 % with raised and goal text", () => {
    const { container } = render(
      <CampaignProgress
        percent={65}
        raisedText="6,500 XLM raised"
        goalText="10,000 XLM goal"
      />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders at 100 % — fully funded", () => {
    const { container } = render(
      <CampaignProgress
        percent={100}
        raisedText="10,000 XLM raised"
        goalText="10,000 XLM goal"
      />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders over-funded state (percent > 100)", () => {
    const { container } = render(
      <CampaignProgress percent={130} raisedText="13,000 XLM raised" goalText="10,000 XLM goal" />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders loading skeleton state", () => {
    const { container } = render(<CampaignProgress percent={0} isLoading />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders error state", () => {
    const { container } = render(
      <CampaignProgress percent={0} error="Could not load progress" />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders with time remaining element", () => {
    const { container } = render(
      <CampaignProgress
        percent={40}
        raisedText="4,000 XLM"
        goalText="10,000 XLM"
        timeRemaining={<span>12 days left</span>}
      />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders animated bar", () => {
    const { container } = render(<CampaignProgress percent={50} animated />);
    expect(container.firstChild).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// CampaignActions — inline / stacked layouts, saved state, loading, error
// ---------------------------------------------------------------------------

describe("CampaignActions snapshots", () => {
  it("renders stacked layout with donate button (default)", () => {
    const { container } = render(
      <CampaignActions onDonate={vi.fn()} donateLabel="Donate now" />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders inline layout with share and save buttons", () => {
    const { container } = render(
      <CampaignActions layout="inline" onShare={vi.fn()} onSave={vi.fn()} />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders saved state — bookmark icon is active", () => {
    const { container } = render(
      <CampaignActions onSave={vi.fn()} saved />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders unsaved state", () => {
    const { container } = render(
      <CampaignActions onSave={vi.fn()} saved={false} />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders loading state — all buttons disabled", () => {
    const { container } = render(
      <CampaignActions onDonate={vi.fn()} donateLabel="Donate" isLoading />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders error state", () => {
    const { container } = render(
      <CampaignActions onDonate={vi.fn()} error="Campaign is closed" />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders donate disabled state", () => {
    const { container } = render(
      <CampaignActions
        onDonate={vi.fn()}
        donateLabel="Goal reached"
        donateDisabled
      />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders full action set — donate + share + save", () => {
    const { container } = render(
      <CampaignActions
        onDonate={vi.fn()}
        donateLabel="Back this project"
        onShare={vi.fn()}
        onSave={vi.fn()}
      />
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
