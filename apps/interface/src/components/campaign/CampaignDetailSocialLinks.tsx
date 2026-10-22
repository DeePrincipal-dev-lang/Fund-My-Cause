import React from "react";

export interface CampaignDetailSocialLinksProps {
  links: string[];
}

export function CampaignDetailSocialLinks({
  links,
}: CampaignDetailSocialLinksProps) {
  if (!links || links.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-gray-500">Links</p>
      <ul className="space-y-1">
        {links.map((url) => (
          <li key={url}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-sm text-indigo-600 hover:underline dark:text-indigo-400"
            >
              {url}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
