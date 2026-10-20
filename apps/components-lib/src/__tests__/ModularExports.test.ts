import { describe, it, expect } from "vitest";

// Test suite for modularized component library exports
describe("Components Library Modularization - Exports", () => {
  describe("Core exports", () => {
    it("should export core components from index", async () => {
      const module = await import("../index");

      // Button component
      expect(module).toHaveProperty("Button");
      expect(module).toHaveProperty("ButtonProps");

      // Modal component
      expect(module).toHaveProperty("Modal");
      expect(module).toHaveProperty("ModalProps");

      // Card component
      expect(module).toHaveProperty("Card");
      expect(module).toHaveProperty("CardHeader");
      expect(module).toHaveProperty("CardBody");
      expect(module).toHaveProperty("CardFooter");
    });

    it("should export form primitives", async () => {
      const module = await import("../index");

      expect(module).toHaveProperty("FormField");
      expect(module).toHaveProperty("Input");
      expect(module).toHaveProperty("Select");
      expect(module).toHaveProperty("Textarea");
    });

    it("should export progress components", async () => {
      const module = await import("../index");

      expect(module).toHaveProperty("ProgressBar");
      expect(module).toHaveProperty("CampaignProgress");
    });

    it("should export campaign header components", async () => {
      const module = await import("../index");

      expect(module).toHaveProperty("CampaignHeader");
      expect(module).toHaveProperty("CampaignHeaderTitle");
      expect(module).toHaveProperty("CampaignHeaderMeta");
      expect(module).toHaveProperty("CampaignHeaderActions");
    });

    it("should export error handling components", async () => {
      const module = await import("../index");

      expect(module).toHaveProperty("ErrorBoundary");
      expect(module).toHaveProperty("ErrorFallback");
    });

    it("should export empty and error state components", async () => {
      const module = await import("../index");

      expect(module).toHaveProperty("EmptyState");
      expect(module).toHaveProperty("ErrorState");
    });
  });

  describe("Utility exports", () => {
    it("should export utility functions", async () => {
      const module = await import("../index");

      expect(module).toHaveProperty("calculateProgress");
      expect(module).toHaveProperty("clampProgress");
      expect(module).toHaveProperty("isProgressFunded");
      expect(module).toHaveProperty("formatCampaignCard");
      expect(module).toHaveProperty("cn");
    });
  });

  describe("Theme context exports", () => {
    it("should export theme provider and hook", async () => {
      const module = await import("../index");

      expect(module).toHaveProperty("ThemeProvider");
      expect(module).toHaveProperty("useTheme");
    });
  });

  describe("Type exports", () => {
    it("should export type definitions", async () => {
      const module = await import("../index");

      expect(module).toHaveProperty("ButtonProps");
      expect(module).toHaveProperty("ModalProps");
      expect(module).toHaveProperty("CardProps");
      expect(module).toHaveProperty("FormFieldProps");
      expect(module).toHaveProperty("InputProps");
      expect(module).toHaveProperty("SelectProps");
      expect(module).toHaveProperty("TextareaProps");
      expect(module).toHaveProperty("ProgressBarProps");
      expect(module).toHaveProperty("CampaignProgressProps");
      expect(module).toHaveProperty("CampaignHeaderProps");
      expect(module).toHaveProperty("ErrorBoundaryProps");
      expect(module).toHaveProperty("EmptyStateProps");
      expect(module).toHaveProperty("ErrorStateProps");
    });
  });

  describe("Barrel export completeness", () => {
    it("should export all documented public components", async () => {
      const module = await import("../index");

      const expectedExports = [
        "Button",
        "Modal",
        "Card",
        "CardHeader",
        "CardBody",
        "CardFooter",
        "ProgressBar",
        "CampaignProgress",
        "CampaignHeader",
        "CampaignHeaderTitle",
        "CampaignHeaderMeta",
        "CampaignHeaderActions",
        "CampaignActions",
        "CampaignDetailSkeleton",
        "FormField",
        "Input",
        "Select",
        "Textarea",
        "ErrorBoundary",
        "ErrorFallback",
        "ThemeProvider",
        "useTheme",
        "EmptyState",
        "ErrorState",
      ];

      for (const exp of expectedExports) {
        expect(module).toHaveProperty(exp);
      }
    });

    it("should have consistent type exports", async () => {
      const module = await import("../index");

      const typeExports = [
        "ButtonProps",
        "ModalProps",
        "CardProps",
        "CardVariant",
        "ProgressBarProps",
        "CampaignProgressProps",
        "CampaignProgressClassNames",
        "CampaignHeaderProps",
        "CampaignHeaderClassNames",
        "CampaignHeaderTitleProps",
        "CampaignHeaderMetaProps",
        "CampaignHeaderActionsProps",
        "CampaignActionsProps",
        "CampaignActionsClassNames",
        "CampaignDetailSkeletonProps",
        "FormFieldProps",
        "FormControlProps",
        "InputProps",
        "SelectProps",
        "SelectOption",
        "TextareaProps",
        "ErrorBoundaryProps",
        "ErrorBoundaryLevel",
        "ErrorFallbackProps",
        "EmptyStateProps",
        "ErrorStateProps",
        "Theme",
        "ThemeProviderProps",
        "UseThemeReturn",
        "CampaignCardData",
        "FormatCampaignCardOptions",
        "FormattedCampaignCard",
      ];

      for (const typeExp of typeExports) {
        expect(module).toHaveProperty(typeExp);
      }
    });
  });

  describe("Individual component file exports", () => {
    it("should export Button from Button.tsx", async () => {
      const module = await import("../Button");
      expect(module).toHaveProperty("Button");
    });

    it("should export Modal from Modal.tsx", async () => {
      const module = await import("../Modal");
      expect(module).toHaveProperty("Modal");
    });

    it("should export FormField from FormField.tsx", async () => {
      const module = await import("../FormField");
      expect(module).toHaveProperty("FormField");
    });

    it("should export Input from Input.tsx", async () => {
      const module = await import("../Input");
      expect(module).toHaveProperty("Input");
    });

    it("should export EmptyState from EmptyState.tsx", async () => {
      const module = await import("../EmptyState");
      expect(module).toHaveProperty("EmptyState");
    });

    it("should export ErrorState from ErrorState.tsx", async () => {
      const module = await import("../ErrorState");
      expect(module).toHaveProperty("ErrorState");
    });

    it("should export ErrorBoundary from ErrorBoundary.tsx", async () => {
      const module = await import("../ErrorBoundary");
      expect(module).toHaveProperty("ErrorBoundary");
    });

    it("should export ThemeProvider from context/ThemeContext.tsx", async () => {
      const module = await import("../context/ThemeContext");
      expect(module).toHaveProperty("ThemeProvider");
      expect(module).toHaveProperty("useTheme");
    });
  });

  describe("Utility module exports", () => {
    it("should export progress utilities", async () => {
      const module = await import("../utils/progress");
      expect(module).toHaveProperty("calculateProgress");
      expect(module).toHaveProperty("clampProgress");
      expect(module).toHaveProperty("isProgressFunded");
    });

    it("should export formatting utilities", async () => {
      const module = await import("../utils/formatCampaignCard");
      expect(module).toHaveProperty("formatCampaignCard");
    });

    it("should export style utilities", async () => {
      const module = await import("../lib/utils");
      expect(module).toHaveProperty("cn");
    });
  });

  describe("No duplicate exports", () => {
    it("should not have duplicate exports in barrel file", async () => {
      const module = await import("../index");

      const exports = Object.keys(module);
      const uniqueExports = new Set(exports);

      expect(exports.length).toBe(uniqueExports.size);
    });
  });

  describe("Scoped import compatibility", () => {
    it("should support importing from component files directly", async () => {
      const buttonModule = await import("../Button");
      const formFieldModule = await import("../FormField");
      const emptyStateModule = await import("../EmptyState");

      expect(buttonModule.Button).toBeDefined();
      expect(formFieldModule.FormField).toBeDefined();
      expect(emptyStateModule.EmptyState).toBeDefined();
    });

    it("should support importing from utility modules directly", async () => {
      const progressModule = await import("../utils/progress");
      const formatModule = await import("../utils/formatCampaignCard");

      expect(progressModule.calculateProgress).toBeDefined();
      expect(formatModule.formatCampaignCard).toBeDefined();
    });
  });

  describe("Export organization", () => {
    it("should have form primitives grouped in exports", async () => {
      const module = await import("../index");

      const formComponents = ["FormField", "Input", "Select", "Textarea"];
      for (const component of formComponents) {
        expect(module).toHaveProperty(component);
      }
    });

    it("should have campaign components grouped in exports", async () => {
      const module = await import("../index");

      const campaignComponents = [
        "CampaignHeader",
        "CampaignProgress",
        "CampaignActions",
      ];
      for (const component of campaignComponents) {
        expect(module).toHaveProperty(component);
      }
    });

    it("should have state components grouped in exports", async () => {
      const module = await import("../index");

      const stateComponents = ["EmptyState", "ErrorState"];
      for (const component of stateComponents) {
        expect(module).toHaveProperty(component);
      }
    });
  });
});
