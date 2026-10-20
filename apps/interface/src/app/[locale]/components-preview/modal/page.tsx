"use client";
/**
 * Component preview page: Modal
 *
 * Rendered at /[locale]/components-preview/modal
 *
 * Used exclusively by the Playwright visual regression suite (Issue #1172).
 * Each button opens a different Modal configuration so tests can screenshot
 * each size variant and option combination independently.
 */

import React, { useState } from "react";
import { Modal, Button } from "@fund-my-cause/components";

type ModalVariant =
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "with-footer"
  | "no-title"
  | null;

export default function ModalPreviewPage() {
  const [open, setOpen] = useState<ModalVariant>(null);

  const close = () => setOpen(null);

  return (
    <div className="min-h-screen bg-gray-50 p-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Modal — component preview</h1>

      <p className="text-gray-600">
        Click a button to open the corresponding Modal variant. Each button
        has a stable <code>data-testid</code> so Playwright tests can trigger
        individual scenarios.
      </p>

      {/* ── Trigger buttons ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <Button data-testid="open-modal-sm" onClick={() => setOpen("sm")}>
          Open sm
        </Button>
        <Button data-testid="open-modal-md" onClick={() => setOpen("md")}>
          Open md (default)
        </Button>
        <Button data-testid="open-modal-lg" onClick={() => setOpen("lg")}>
          Open lg
        </Button>
        <Button data-testid="open-modal-xl" onClick={() => setOpen("xl")}>
          Open xl
        </Button>
        <Button
          data-testid="open-modal-with-footer"
          onClick={() => setOpen("with-footer")}
        >
          Open with footer
        </Button>
        <Button
          data-testid="open-modal-no-title"
          onClick={() => setOpen("no-title")}
        >
          Open without title
        </Button>
      </div>

      {/* ── sm ─────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={open === "sm"}
        onClose={close}
        title="Small modal"
        size="sm"
      >
        <p className="text-gray-700">
          This is a small modal. Useful for quick confirmations.
        </p>
      </Modal>

      {/* ── md ─────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={open === "md"}
        onClose={close}
        title="Medium modal (default)"
        size="md"
      >
        <p className="text-gray-700">
          This is the default medium-size modal. Most dialogs should use this
          size unless there is a specific reason to go larger or smaller.
        </p>
      </Modal>

      {/* ── lg ─────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={open === "lg"}
        onClose={close}
        title="Large modal"
        size="lg"
      >
        <p className="text-gray-700">
          Large modals are suited for content-heavy flows such as campaign
          creation wizards or detailed contribution breakdowns.
        </p>
      </Modal>

      {/* ── xl ─────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={open === "xl"}
        onClose={close}
        title="Extra-large modal"
        size="xl"
      >
        <p className="text-gray-700">
          The xl variant provides maximum horizontal space. Use it sparingly —
          typically only for wide tables or complex multi-column forms.
        </p>
      </Modal>

      {/* ── with footer ────────────────────────────────────────────────── */}
      <Modal
        isOpen={open === "with-footer"}
        onClose={close}
        title="Modal with footer"
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" onClick={close}>
              Confirm
            </Button>
          </div>
        }
      >
        <p className="text-gray-700">
          This modal has a footer section with action buttons. The footer is
          rendered below the content area and above the bottom edge of the
          dialog panel.
        </p>
      </Modal>

      {/* ── no title ───────────────────────────────────────────────────── */}
      <Modal
        isOpen={open === "no-title"}
        onClose={close}
        size="md"
      >
        <p className="text-gray-700">
          This modal has no title prop. The header bar is still rendered (for
          the close button) but the title slot is empty.
        </p>
      </Modal>
    </div>
  );
}
