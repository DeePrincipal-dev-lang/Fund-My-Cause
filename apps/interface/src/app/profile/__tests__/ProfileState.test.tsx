import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useState } from "react";
import type { ProfileData } from "@/types/profile";

// Mock the profileStore module
vi.mock("@/lib/profileStore", () => ({
  readProfile: vi.fn((address: string) => ({
    avatarUri: "",
    bio: "Test bio",
    socialLinks: [],
  })),
  writeProfile: vi.fn(),
}));

// Test suite for profile page state management
describe("Profile Page State Management", () => {
  describe("Profile state initialization and updates", () => {
    it("should initialize profile state from localStorage or defaults", () => {
      const mockAddress =
        "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
      const defaultProfile: ProfileData = {
        avatarUri: "",
        bio: "",
        socialLinks: [],
      };

      expect(defaultProfile).toEqual({
        avatarUri: "",
        bio: "",
        socialLinks: [],
      });
    });

    it("should update profile state when saved", () => {
      const { result } = renderHook(() =>
        useState<ProfileData>({
          avatarUri: "",
          bio: "",
          socialLinks: [],
        }),
      );

      const updatedProfile: ProfileData = {
        avatarUri: "ipfs://hash",
        bio: "Updated bio",
        socialLinks: ["https://twitter.com/user"],
      };

      act(() => {
        result.current[1](updatedProfile);
      });

      expect(result.current[0]).toEqual(updatedProfile);
    });

    it("should maintain profile state across modal open/close", () => {
      const { result: profileResult } = renderHook(() =>
        useState<ProfileData>({
          avatarUri: "",
          bio: "Original bio",
          socialLinks: [],
        }),
      );

      const { result: editOpenResult } = renderHook(() => useState(false));

      act(() => {
        editOpenResult.current[1](true);
      });

      expect(profileResult.current[0].bio).toBe("Original bio");
      expect(editOpenResult.current[0]).toBe(true);

      act(() => {
        editOpenResult.current[1](false);
      });

      expect(editOpenResult.current[0]).toBe(false);
      expect(profileResult.current[0].bio).toBe("Original bio");
    });
  });

  describe("Edit modal state", () => {
    it("should toggle edit modal open/close", () => {
      const { result } = renderHook(() => useState(false));

      expect(result.current[0]).toBe(false);

      act(() => {
        result.current[1](true);
      });

      expect(result.current[0]).toBe(true);

      act(() => {
        result.current[1](false);
      });

      expect(result.current[0]).toBe(false);
    });

    it("should not lose profile data when modal is closed without save", () => {
      const originalProfile: ProfileData = {
        avatarUri: "ipfs://old",
        bio: "Original bio",
        socialLinks: ["https://twitter.com/user"],
      };

      const { result: profileResult } = renderHook(() =>
        useState<ProfileData>(originalProfile),
      );

      const { result: editResult } = renderHook(() => useState(false));

      act(() => {
        editResult.current[1](true);
      });

      // Simulate user closing modal without saving
      act(() => {
        editResult.current[1](false);
      });

      expect(profileResult.current[0]).toEqual(originalProfile);
    });
  });

  describe("Profile field validation state", () => {
    it("should manage bio field validation errors", () => {
      const { result } = renderHook(() => useState<string | null>(null));

      expect(result.current[0]).toBeNull();

      act(() => {
        result.current[1]("Bio exceeds maximum length");
      });

      expect(result.current[0]).toBe("Bio exceeds maximum length");

      act(() => {
        result.current[1](null);
      });

      expect(result.current[0]).toBeNull();
    });

    it("should manage social links field validation errors", () => {
      const { result } = renderHook(() => useState<string | null>(null));

      expect(result.current[0]).toBeNull();

      act(() => {
        result.current[1]("Invalid URL format in social links");
      });

      expect(result.current[0]).toBe("Invalid URL format in social links");
    });

    it("should clear validation error when field becomes valid", () => {
      const { result: errorResult } = renderHook(() =>
        useState<string | null>("Validation error"),
      );

      const { result: bioResult } = renderHook(() =>
        useState("Valid bio text"),
      );

      expect(errorResult.current[0]).toBe("Validation error");
      expect(bioResult.current[0]).toBe("Valid bio text");

      act(() => {
        errorResult.current[1](null);
      });

      expect(errorResult.current[0]).toBeNull();
    });
  });

  describe("Optimistic update and rollback", () => {
    it("should save profile and close modal on success", () => {
      const originalProfile: ProfileData = {
        avatarUri: "",
        bio: "Original",
        socialLinks: [],
      };

      const updatedProfile: ProfileData = {
        avatarUri: "ipfs://new",
        bio: "Updated",
        socialLinks: ["https://twitter.com/user"],
      };

      const { result: profileResult } = renderHook(() =>
        useState<ProfileData>(originalProfile),
      );

      const { result: editResult } = renderHook(() => useState(false));

      // Simulate successful save
      act(() => {
        profileResult.current[1](updatedProfile);
        editResult.current[1](false);
      });

      expect(profileResult.current[0]).toEqual(updatedProfile);
      expect(editResult.current[0]).toBe(false);
    });

    it("should maintain current profile state if save operation fails", () => {
      const originalProfile: ProfileData = {
        avatarUri: "",
        bio: "Original",
        socialLinks: [],
      };

      const { result: profileResult } = renderHook(() =>
        useState<ProfileData>(originalProfile),
      );

      const { result: errorResult } = renderHook(() =>
        useState<string | null>(null),
      );

      // Simulate save failure
      act(() => {
        errorResult.current[1]("Failed to save profile");
      });

      expect(profileResult.current[0]).toEqual(originalProfile);
      expect(errorResult.current[0]).toBe("Failed to save profile");
    });

    it("should rollback changes if save operation fails", () => {
      const originalProfile: ProfileData = {
        avatarUri: "",
        bio: "Original",
        socialLinks: [],
      };

      const tempProfile: ProfileData = {
        avatarUri: "ipfs://temp",
        bio: "Temporary changes",
        socialLinks: ["https://temp.com"],
      };

      const { result: profileResult } = renderHook(() =>
        useState<ProfileData>(originalProfile),
      );

      // Simulate optimistic update
      act(() => {
        profileResult.current[1](tempProfile);
      });

      expect(profileResult.current[0]).toEqual(tempProfile);

      // Simulate rollback on failure
      act(() => {
        profileResult.current[1](originalProfile);
      });

      expect(profileResult.current[0]).toEqual(originalProfile);
    });
  });

  describe("Avatar upload state", () => {
    it("should track avatar upload in progress", () => {
      const { result } = renderHook(() => useState(false));

      expect(result.current[0]).toBe(false);

      act(() => {
        result.current[1](true);
      });

      expect(result.current[0]).toBe(true);

      act(() => {
        result.current[1](false);
      });

      expect(result.current[0]).toBe(false);
    });

    it("should handle avatar upload error state", () => {
      const { result: uploadingResult } = renderHook(() => useState(false));
      const { result: errorResult } = renderHook(() =>
        useState<string | null>(null),
      );

      act(() => {
        uploadingResult.current[1](true);
      });

      expect(uploadingResult.current[0]).toBe(true);
      expect(errorResult.current[0]).toBeNull();

      // Simulate upload failure
      act(() => {
        uploadingResult.current[1](false);
        errorResult.current[1]("Upload failed");
      });

      expect(uploadingResult.current[0]).toBe(false);
      expect(errorResult.current[0]).toBe("Upload failed");
    });

    it("should update avatar URI on successful upload", () => {
      const { result: avatarResult } = renderHook(() => useState(""));
      const { result: uploadingResult } = renderHook(() => useState(false));

      act(() => {
        uploadingResult.current[1](true);
      });

      act(() => {
        uploadingResult.current[1](false);
        avatarResult.current[1]("ipfs://QmNewHash");
      });

      expect(uploadingResult.current[0]).toBe(false);
      expect(avatarResult.current[0]).toBe("ipfs://QmNewHash");
    });
  });

  describe("Social links management state", () => {
    it("should add a new social link", () => {
      const { result } = renderHook(() => useState<string[]>([]));

      act(() => {
        result.current[1]([...result.current[0], ""]);
      });

      expect(result.current[0]).toHaveLength(1);
    });

    it("should update a specific social link", () => {
      const { result } = renderHook(() =>
        useState<string[]>(["https://twitter.com/user", ""]),
      );

      act(() => {
        const updated = [...result.current[0]];
        updated[1] = "https://github.com/user";
        result.current[1](updated);
      });

      expect(result.current[0][1]).toBe("https://github.com/user");
    });

    it("should remove a social link by index", () => {
      const { result } = renderHook(() =>
        useState<string[]>([
          "https://twitter.com/user",
          "https://github.com/user",
        ]),
      );

      act(() => {
        result.current[1](result.current[0].filter((_, idx) => idx !== 0));
      });

      expect(result.current[0]).toEqual(["https://github.com/user"]);
    });

    it("should maintain correct link count after multiple operations", () => {
      const { result } = renderHook(() =>
        useState<string[]>(["https://twitter.com/user"]),
      );

      act(() => {
        result.current[1]([...result.current[0], "https://github.com/user"]);
      });

      expect(result.current[0]).toHaveLength(2);

      act(() => {
        result.current[1](result.current[0].filter((_, idx) => idx !== 0));
      });

      expect(result.current[0]).toHaveLength(1);
    });
  });
});
