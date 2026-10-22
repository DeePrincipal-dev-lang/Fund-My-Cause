"use client";

import React, { ReactNode } from "react";
import { cn } from "./lib/utils";
import { CampaignActions, type CampaignActionsProps } from "./CampaignActions";

export interface CampaignHeaderClassNames {
  root?: string;
  media?: string;
  image?: string;
  body?: string;
  title?: string;
  organization?: string;
  description?: string;
}

export interface CampaignHeaderTitleProps {
  /** Campaign title. */
  title: string;
  /** Heading level for the title. */
  headingLevel?: 2 | 3 | 4;
  /** Wraps the title text — used for search-term highlighting. */
  renderTitle?: (title: string) => ReactNode;
  className?: string;
}

export function CampaignHeaderTitle({
  title,
  headingLevel = 2,
  renderTitle,
  className,
}: CampaignHeaderTitleProps) {
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  return (
    <Heading className={className}>
      {renderTitle ? renderTitle(title) : title}
    </Heading>
  );
}

export interface CampaignHeaderMetaProps {
  /** Owning organisation or creator. */
  organization?: ReactNode;
  /** Short summary rendered under the organisation line. */
  description?: ReactNode;
  className?: string;
  classNames?: {
    organization?: string;
    description?: string;
  };
}

export function CampaignHeaderMeta({
  organization,
  description,
  className,
  classNames,
}: CampaignHeaderMetaProps) {
  if (!organization && !description) return null;
  const content = (
    <>
      {organization && (
        <p className={classNames?.organization}>{organization}</p>
      )}
      {description && <p className={classNames?.description}>{description}</p>}
    </>
  );

  if (className) {
    return <div className={className}>{content}</div>;
  }
  return content;
}

export type CampaignHeaderActionsProps = CampaignActionsProps;

export function CampaignHeaderActions({
  layout = "inline",
  ...props
}: CampaignHeaderActionsProps) {
  return <CampaignActions layout={layout} {...props} />;
}

export interface CampaignHeaderProps {
  /** Campaign title. Required even while loading so the skeleton keeps its shape. */
  title: string;
  /** Owning organisation or creator, rendered under the title. */
  organization?: ReactNode;
  /** Short summary rendered under the organisation line. */
  description?: ReactNode;
  /** Header image source. Falls back to `fallbackImageUrl` when it fails to load. */
  imageUrl?: string;
  imageAlt?: string;
  /** Shown when `imageUrl` is missing or errors. */
  fallbackImageUrl?: string;
  /**
   * Renders the image element. Supply this to plug in a framework-specific
   * image component (e.g. `next/image`); a plain `<img>` is used otherwise.
   */
  renderImage?: (props: {
    src: string;
    alt: string;
    className: string;
    /** Call this on load failure to fall back to `fallbackImageUrl`. */
    onError: () => void;
  }) => ReactNode;
  /** Wraps the title text — used for search-term highlighting. */
  renderTitle?: (title: string) => ReactNode;
  /** Absolutely positioned children over the media area (badges, actions). */
  overlay?: ReactNode;
  /** Heading level for the title, so the card fits the page's outline. */
  headingLevel?: 2 | 3 | 4;
  /** Renders a skeleton in place of the media and text. */
  isLoading?: boolean;
  /** Replaces the media with an error message. */
  error?: string | null;
  /**
   * Rendered inside the body container, after the summary. Lets a card keep a
   * single padded/spaced body while still composing `CampaignProgress` and
   * `CampaignActions` below the identity block.
   */
  children?: ReactNode;
  classNames?: CampaignHeaderClassNames;
  className?: string;
}

/**
 * Identity block of a campaign card: media, title, organisation and summary.
 *
 * Purely presentational — it owns no data fetching and no formatting, so the
 * same markup backs the listing, detail, search and related-campaign views.
 *
 * @example
 * <CampaignHeader
 *   title={campaign.title}
 *   imageUrl={campaign.image}
 *   renderImage={(p) => <Image {...p} fill sizes="..." />}
 * />
 */
export function CampaignHeader({
  title,
  organization,
  description,
  imageUrl,
  imageAlt,
  fallbackImageUrl,
  renderImage,
  renderTitle,
  overlay,
  headingLevel = 2,
  isLoading = false,
  error = null,
  children,
  classNames,
  className,
}: CampaignHeaderProps) {
  const [failed, setFailed] = React.useState(false);

  // A new source deserves a fresh attempt — otherwise one failure sticks forever.
  React.useEffect(() => setFailed(false), [imageUrl]);

  const resolvedSrc = (!failed && imageUrl) || fallbackImageUrl || "";
  const alt = imageAlt ?? `${title} - campaign header image`;
  const imageClass = cn("object-cover w-full h-full", classNames?.image);

  return (
    <div className={cn(classNames?.root, className)}>
      <div className={cn("relative", classNames?.media)}>
        {isLoading ? (
          <div
            role="status"
            aria-label="Loading campaign image"
            className="w-full h-full animate-pulse bg-[var(--color-surface-elevated,#e5e7eb)]"
          />
        ) : error ? (
          <div
            role="alert"
            className="w-full h-full flex items-center justify-center text-sm text-red-500 bg-[var(--color-surface-elevated,#e5e7eb)]"
          >
            {error}
          </div>
        ) : resolvedSrc && renderImage ? (
          renderImage({
            src: resolvedSrc,
            alt,
            className: imageClass,
            onError: () => setFailed(true),
          })
        ) : resolvedSrc ? (
          <img
            src={resolvedSrc}
            alt={alt}
            className={imageClass}
            onError={() => setFailed(true)}
          />
        ) : null}
        {overlay}
      </div>

      <div className={classNames?.body}>
        <CampaignHeaderTitle
          title={title}
          headingLevel={headingLevel}
          renderTitle={renderTitle}
          className={classNames?.title}
        />
        <CampaignHeaderMeta
          organization={organization}
          description={description}
          classNames={{
            organization: classNames?.organization,
            description: classNames?.description,
          }}
        />
        {children}
      </div>
    </div>
  );
}

CampaignHeader.Title = CampaignHeaderTitle;
CampaignHeader.Meta = CampaignHeaderMeta;
CampaignHeader.Actions = CampaignHeaderActions;
