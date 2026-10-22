import type { Campaign } from "@/types/campaign";

export interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "charity" | "creative" | "tech" | "community" | "personal";
  defaultData: Partial<Campaign>;
}

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: "charity-medical",
    name: "Medical Fundraiser",
    description: "Raise funds for medical treatment or healthcare",
    icon: "🏥",
    category: "charity",
    defaultData: {
      title: "Help [Name] with Medical Treatment",
      description:
        "We are raising funds to help cover medical expenses. Your contribution will make a direct impact on their recovery.",
      goal: 5000, // 5000 XLM
      minContribution: 0.1, // 0.1 XLM
    },
  },
  {
    id: "creative-music",
    name: "Music Project",
    description: "Fund an album, concert, or music production",
    icon: "🎵",
    category: "creative",
    defaultData: {
      title: "Support [Artist] - New Album Release",
      description:
        "Help us produce and release our new album. Backers will receive exclusive content and early access.",
      goal: 10000, // 10000 XLM
      minContribution: 0.5, // 0.5 XLM
    },
  },
  {
    id: "tech-startup",
    name: "Tech Startup",
    description: "Launch a new technology product or service",
    icon: "💻",
    category: "tech",
    defaultData: {
      title: "[Product Name] - Revolutionary Tech Solution",
      description:
        "We are building the next generation of [category]. Your support helps us bring this innovation to market.",
      goal: 50000, // 50000 XLM
      minContribution: 1, // 1 XLM
    },
  },
  {
    id: "community-event",
    name: "Community Event",
    description: "Organize a local event or gathering",
    icon: "🎉",
    category: "community",
    defaultData: {
      title: "[Event Name] - Community Gathering",
      description:
        "Join us for an amazing community event. Your contribution helps us cover venue, catering, and entertainment.",
      goal: 5000, // 5000 XLM
      minContribution: 0.1, // 0.1 XLM
    },
  },
  {
    id: "personal-education",
    name: "Education Fund",
    description: "Support education or skill development",
    icon: "📚",
    category: "personal",
    defaultData: {
      title: "Support My Education Journey",
      description:
        "Help me pursue my educational goals. Your contribution will support tuition, materials, and living expenses.",
      goal: 10000, // 10000 XLM
      minContribution: 0.1, // 0.1 XLM
    },
  },
];

export function getTemplateById(id: string): CampaignTemplate | undefined {
  return CAMPAIGN_TEMPLATES.find((t) => t.id === id);
}

export function getTemplatesByCategory(
  category: CampaignTemplate["category"],
): CampaignTemplate[] {
  return CAMPAIGN_TEMPLATES.filter((t) => t.category === category);
}
