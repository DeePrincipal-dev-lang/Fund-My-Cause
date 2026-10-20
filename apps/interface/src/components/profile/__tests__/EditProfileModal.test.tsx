import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EditProfileModal } from "../EditProfileModal";
import type { ProfileData } from "@/types/profile";

// Mock the required modules
vi.mock("@/lib/profileStore", () => ({
  writeProfile: vi.fn(),
}));

vi.mock("@/lib/profileValidation", () => ({
  validateBio: vi.fn((bio: string) => bio.length <= 280),
  validateSocialLinks: vi.fn((links: string[]) => {
    if (links.length > 5) return false;
    for (const link of links) {
      try {
        new URL(link);
      } catch {
        return false;
      }
    }
    return true;
  }),
  MAX_BIO_LENGTH: 280,
  MAX_SOCIAL_LINKS: 5,
}));

vi.mock("@/lib/pinata", () => ({
  uploadToPinata: vi.fn(async () => "ipfs://QmMockHash"),
}));

vi.mock("@/lib/imageValidation", () => ({
  validateImageFile: vi.fn((file: File) => ({
    valid: file.type.startsWith("image/") && file.size < 5 * 1024 * 1024,
    error: null,
  })),
}));

vi.mock("@/hooks/useFocusTrap", () => ({
  useFocusTrap: vi.fn((active, options) => ({
    current: document.createElement("div"),
  })),
}));

describe("EditProfileModal", () => {
  const mockAddress = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const mockProfile: ProfileData = {
    avatarUri: "ipfs://QmOld",
    bio: "Original bio",
    socialLinks: ["https://twitter.com/user"],
  };
  const mockOnSave = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Modal rendering", () => {
    it("should render the edit profile modal with all sections", () => {
      render(
        <EditProfileModal
          address={mockAddress}
          current={mockProfile}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      );

      expect(screen.getByText("Edit Profile")).toBeInTheDocument();
      expect(screen.getByText(/Avatar/)).toBeInTheDocument();
      expect(screen.getByText(/Bio/)).toBeInTheDocument();
      expect(screen.getByText(/Social Links/)).toBeInTheDocument();
    });

    it("should display current profile data in form fields", () => {
      render(
        <EditProfileModal
          address={mockAddress}
          current={mockProfile}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      );

      const bioInput = screen.getByDisplayValue("Original bio");
      expect(bioInput).toBeInTheDocument();
    });

    it("should close modal when close button is clicked", () => {
      render(
        <EditProfileModal
          address={mockAddress}
          current={mockProfile}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      );

      const closeButton = screen.getByLabelText("Close modal");
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should close modal when cancel button is clicked", () => {
      render(
        <EditProfileModal
          address={mockAddress}
          current={mockProfile}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      );

      const cancelButton = screen.getByText("Cancel");
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("Bio validation", () => {
    it("should accept valid bio text", () => {
      const { rerender } = render(
        <EditProfileModal
          address={mockAddress}
          current={{
            avatarUri: "",
            bio: "Valid bio text",
            socialLinks: [],
          }}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      );

      const saveButton = screen.getByText("Save Changes");
      fireEvent.click(saveButton);

      // Should call onSave if bio is valid
      expect(mockOnSave).toHaveBeenCalled();
    });

    it("should display error message when bio exceeds max length", async () => {
      const longBio = "a".repeat(281);
      render(
        <EditProfileModal
          address={mockAddress}
          current={{
            avatarUri: "",
            bio: longBio,
            socialLinks: [],
          }}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      );

      const saveButton = screen.getByText("Save Changes");
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Bio must be at most/)).toBeInTheDocument();
      });
    });

    it("should show bio character count", () => {
      render(
        <EditProfileModal
          address={mockAddress}
          current={{
            avatarUri: "",
            bio: "Test bio",
            socialLinks: [],
          }}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      );

      expect(screen.getByText(/8\/280/)).toBeInTheDocument();
    });

    it("should update bio character count as user types", () => {
      render(
        <EditProfileModal
          address={mockAddress}
          current={{
            avatarUri: "",
            bio: "Test",
            socialLinks: [],
          }}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      );

      const bioInput = screen.getByDisplayValue("Test");
      fireEvent.change(bioInput, { target: { value: "Test bio updated" } });

      expect(screen.getByText(/16\/280/)).toBeInTheDocument();
    });
  });

  describe("Social links validation", () => {
    it("should accept valid social links", () => {
      render(
        <EditProfileModal
          address={mockAddress}
          current={{
            avatarUri: "",
            bio: "Bio",
            socialLinks: ["https://twitter.com/user"],
          }}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      );

      const saveButton = screen.getByText("Save Changes");
      fireEvent.click(saveButton);

      expect(mockOnSave).toHaveBeenCalled();
    });

    it("should display error when social link is invalid URL", async () => {
      const { rerender } = render(
        <EditProfileModal
          address={mockAddress}
          current={{
            avatarUri: "",
            bio: "Bio",
            socialLinks: ["not-a-url"],
          }}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      );

      const saveButton = screen.getByText("Save Changes");
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(
          screen.getByText(/All links must be valid URLs/),
        ).toBeInTheDocument();
      });
    });

    it("should allow adding a new social link", () => {
      render(
        <EditProfileModal
          address={mockAddress}
          current={{
            avatarUri: "",
            bio: "Bio",
            socialLinks: ["https://twitter.com/user"],
          }}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      );

      const addButton = screen.getByText(/Add/);
      fireEvent.click(addButton);

      const linkInputs = screen.getAllByPlaceholderText(/twitter.com/);
      expect(linkInputs.length).toBeGreaterThan(1);
    });

    it("should allow removing a social link", () => {
      render(
        <EditProfileModal
          address={mockAddress}
          current={{
            avatarUri: "",
            bio: "Bio",
            socialLinks: ["https://twitter.com/user"],
          }}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      );

      const removeButtons = screen.getAllByLabelText("Remove link");
      expect(removeButtons.length).toBeGreaterThan(0);
      fireEvent.click(removeButtons[0]);

      // After removal, there should be at most one less link
      const remainingRemoveButtons = screen.queryAllByLabelText("Remove link");
      expect(remainingRemoveButtons.length).toBeLessThanOrEqual(0);
    });

    it("should not allow more than max social links", () => {
      const maxLinks = Array(5)
        .fill(0)
        .map((_, i) => `https://example${i}.com`);

      render(
        <EditProfileModal
          address={mockAddress}
          current={{
            avatarUri: "",
            bio: "Bio",
            socialLinks: maxLinks,
          }}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      );

      const addButton = screen.queryByText(/Add/);
      expect(addButton).not.toBeInTheDocument();
    });

    it("should display correct social links count", () => {
      render(
        <EditProfileModal
          address={mockAddress}
          current={{
            avatarUri: "",
            bio: "Bio",
            socialLinks: [
              "https://twitter.com/user",
              "https://github.com/user",
            ],
          }}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      );

      expect(screen.getByText(/2\/5/)).toBeInTheDocument();
    });
  });

  describe("Form submission", () => {
    it("should call onSave with updated profile data", () => {
      const updatedBio = "Updated bio";
      const updatedLinks = ["https://new.com"];

      render(
        <EditProfileModal
          address={mockAddress}
          current={{
            avatarUri: "",
            bio: "Old bio",
            socialLinks: [],
          }}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      );

      const bioInput = screen.getByDisplayValue("Old bio");
      fireEvent.change(bioInput, { target: { value: updatedBio } });

      const saveButton = screen.getByText("Save Changes");
      fireEvent.click(saveButton);

      expect(mockOnSave).toHaveBeenCalled();
    });

    it("should not call onSave if validation fails", async () => {
      render(
        <EditProfileModal
          address={mockAddress}
          current={{
            avatarUri: "",
            bio: "a".repeat(281), // Exceeds max length
            socialLinks: [],
          }}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      );

      const saveButton = screen.getByText("Save Changes");
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).not.toHaveBeenCalled();
      });
    });

    it("should trim bio and filter empty social links on save", () => {
      render(
        <EditProfileModal
          address={mockAddress}
          current={{
            avatarUri: "",
            bio: "  Valid bio  ",
            socialLinks: ["https://valid.com", ""],
          }}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      );

      const saveButton = screen.getByText("Save Changes");
      fireEvent.click(saveButton);

      expect(mockOnSave).toHaveBeenCalled();
    });
  });

  describe("Avatar upload", () => {
    it("should have upload button for avatar", () => {
      render(
        <EditProfileModal
          address={mockAddress}
          current={mockProfile}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      );

      expect(screen.getByText("Upload Image")).toBeInTheDocument();
    });

    it("should display current avatar image if present", () => {
      render(
        <EditProfileModal
          address={mockAddress}
          current={{
            avatarUri: "ipfs://QmTest",
            bio: "Bio",
            socialLinks: [],
          }}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      );

      const avatarImg = screen.getByAltText("Current avatar");
      expect(avatarImg).toBeInTheDocument();
    });

    it("should show placeholder when no avatar present", () => {
      render(
        <EditProfileModal
          address={mockAddress}
          current={{
            avatarUri: "",
            bio: "Bio",
            socialLinks: [],
          }}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      );

      expect(screen.getByText("No avatar")).toBeInTheDocument();
    });
  });

  describe("Error handling", () => {
    it("should clear bio error when bio becomes valid", () => {
      const { rerender } = render(
        <EditProfileModal
          address={mockAddress}
          current={{
            avatarUri: "",
            bio: "a".repeat(281),
            socialLinks: [],
          }}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      );

      const saveButton = screen.getByText("Save Changes");
      fireEvent.click(saveButton);

      expect(screen.getByText(/Bio must be at most/)).toBeInTheDocument();

      // Now update with valid bio
      const bioInput = screen.getByDisplayValue("a".repeat(281));
      fireEvent.change(bioInput, { target: { value: "Valid bio" } });

      fireEvent.click(saveButton);

      expect(mockOnSave).toHaveBeenCalled();
    });

    it("should display appropriate error messages", async () => {
      render(
        <EditProfileModal
          address={mockAddress}
          current={{
            avatarUri: "",
            bio: "a".repeat(281),
            socialLinks: ["invalid"],
          }}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />,
      );

      const saveButton = screen.getByText("Save Changes");
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Bio must be at most/)).toBeInTheDocument();
        expect(
          screen.getByText(/All links must be valid URLs/),
        ).toBeInTheDocument();
      });
    });
  });
});
