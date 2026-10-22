import React from "react";
import Image from "next/image";
import { DEFAULT_HERO_IMAGE } from "@/lib/constants";

export interface CampaignDetailHeroProps {
  title: string;
  imageUrl?: string;
}

export function CampaignDetailHero({
  title,
  imageUrl = DEFAULT_HERO_IMAGE,
}: CampaignDetailHeroProps) {
  const src = imageUrl.replace("w=1200", "w=1600");
  return (
    <div className="relative h-72 w-full overflow-hidden md:h-96">
      <Image
        src={src}
        alt={title}
        fill
        className="object-cover"
        priority
        sizes="100vw"
      />
    </div>
  );
}
