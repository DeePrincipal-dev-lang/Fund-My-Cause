import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import {
  CampaignHeader,
  CampaignHeaderTitle,
  CampaignHeaderMeta,
  CampaignHeaderActions,
} from "../CampaignHeader";
import {
  activeCampaign,
  fundedCampaign,
  draftCampaign,
} from "../../../../fixtures/campaign";

describe("CampaignHeader", () => {
  it("renders the title, organisation and description when populated", () => {
    // Use activeCampaign fixture for title/description; supply an org separately
    // (CampaignFixture has no organization field — it is a UI-only prop).
    render(
      <CampaignHeader
        title={activeCampaign.title}
        organization="Maji Trust"
        description={activeCampaign.description}
      />,
    );

    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      activeCampaign.title,
    );
    expect(screen.getByText("Maji Trust")).toBeDefined();
    expect(screen.getByText(activeCampaign.description)).toBeDefined();
  });

  it("renders only the title when everything else is empty", () => {
    const { container } = render(
      <CampaignHeader title={draftCampaign.title} />,
    );

    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      draftCampaign.title,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("p")).toBeNull();
  });

  it("shows a loading placeholder instead of the media", () => {
    const { container } = render(
      <CampaignHeader title={activeCampaign.title} isLoading />,
    );

    expect(screen.getByRole("status")).toBeDefined();
    expect(container.querySelector("img")).toBeNull();
  });

  it("shows the error message instead of the media", () => {
    render(
      <CampaignHeader title={activeCampaign.title} error="Image unavailable" />,
    );

    expect(screen.getByRole("alert").textContent).toBe("Image unavailable");
  });

  it("falls back to the fallback image when the source fails to load", () => {
    const { container } = render(
      <CampaignHeader
        title={fundedCampaign.title}
        imageUrl={fundedCampaign.image!}
        fallbackImageUrl="https://example.com/fallback.png"
      />,
    );

    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(fundedCampaign.image);

    fireEvent.error(img);

    expect(
      (container.querySelector("img") as HTMLImageElement).getAttribute("src"),
    ).toBe("https://example.com/fallback.png");
  });

  it("delegates rendering to renderImage when supplied", () => {
    const renderImage = vi.fn(({ alt }) => <figure aria-label={alt} />);
    render(
      <CampaignHeader
        title={activeCampaign.title}
        imageUrl={activeCampaign.image!}
        renderImage={renderImage}
      />,
    );

    expect(renderImage).toHaveBeenCalled();
    expect(
      screen.getByLabelText(`${activeCampaign.title} - campaign header image`),
    ).toBeDefined();
  });

  it("renders the overlay and body children", () => {
    render(
      <CampaignHeader title={activeCampaign.title} overlay={<span>Badge</span>}>
        <span>Progress</span>
      </CampaignHeader>,
    );

    expect(screen.getByText("Badge")).toBeDefined();
    expect(screen.getByText("Progress")).toBeDefined();
  });
});

describe("CampaignHeaderTitle", () => {
  it("renders title with default h2 heading", () => {
    render(<CampaignHeaderTitle title={activeCampaign.title} />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      activeCampaign.title,
    );
  });

  it("renders title with custom heading level", () => {
    render(
      <CampaignHeaderTitle title={fundedCampaign.title} headingLevel={3} />,
    );
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe(
      fundedCampaign.title,
    );
  });

  it("supports custom title render function", () => {
    render(
      <CampaignHeaderTitle
        title={activeCampaign.title}
        renderTitle={(t) => <mark>{t}</mark>}
      />,
    );
    expect(
      screen.getByText(activeCampaign.title).tagName.toLowerCase(),
    ).toBe("mark");
  });
});

describe("CampaignHeaderMeta", () => {
  it("renders organization and description", () => {
    render(
      <CampaignHeaderMeta
        organization="Eco Builders"
        description={activeCampaign.description}
      />,
    );
    expect(screen.getByText("Eco Builders")).toBeDefined();
    expect(screen.getByText(activeCampaign.description)).toBeDefined();
  });

  it("returns null when neither organization nor description is provided", () => {
    const { container } = render(<CampaignHeaderMeta />);
    expect(container.firstChild).toBeNull();
  });

  it("wraps in a container if className is supplied", () => {
    const { container } = render(
      <CampaignHeaderMeta
        organization="Eco"
        description={draftCampaign.description}
        className="meta-wrapper"
      />,
    );
    expect(container.querySelector(".meta-wrapper")).toBeDefined();
  });
});

describe("CampaignHeaderActions", () => {
  it("defaults to inline layout", () => {
    const onShare = vi.fn();
    const onSave = vi.fn();
    render(
      <CampaignHeaderActions
        onShare={onShare}
        onSave={onSave}
        shareAriaLabel="Share"
        saveAriaLabel="Save"
      />,
    );
    expect(screen.getByLabelText("Share")).toBeDefined();
    expect(screen.getByLabelText("Save")).toBeDefined();
  });
});
