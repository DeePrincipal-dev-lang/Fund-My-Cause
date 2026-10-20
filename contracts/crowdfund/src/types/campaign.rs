//! Campaign-domain types for the crowdfund contract.
//!
//! This module contains the types that describe a campaign itself: its
//! lifecycle status, aggregate statistics, metadata, funding milestones,
//! matching configuration, templates, visibility, and reward tiers.

use soroban_sdk::{contracttype, Address, Bytes, String, Vec};

/// Lifecycle status of a campaign.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Status {
    /// Campaign is accepting contributions.
    Active,
    /// Campaign reached its goal and is accepting contributions until deadline.
    Funded,
    /// Campaign reached its deadline without meeting its goal.
    Failed,
    /// Campaign was cancelled by the creator.
    Cancelled,
    /// Campaign succeeded and funds have been withdrawn.
    Completed,
}

/// Aggregate statistics for a campaign.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CampaignStats {
    /// Total amount contributed so far.
    pub total_raised: i128,
    /// Number of distinct contributors.
    pub contributor_count: u32,
    /// Number of contributions recorded.
    pub contribution_count: u32,
    /// Timestamp of the most recent contribution.
    pub last_contribution_at: u64,
}

/// Core campaign information.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CampaignInfo {
    /// Address of the campaign creator.
    pub creator: Address,
    /// Funding goal in stroops.
    pub goal: i128,
    /// Unix timestamp when the campaign deadline occurs.
    pub deadline: u64,
    /// Unix timestamp when the campaign was created.
    pub created_at: u64,
    /// Current lifecycle status.
    pub status: Status,
    /// Human-readable campaign title.
    pub title: String,
    /// Human-readable campaign description.
    pub description: String,
    /// Optional image reference for the campaign.
    pub image: Option<String>,
    /// Optional external URL for the campaign.
    pub url: Option<String>,
}

/// A single update posted by the campaign creator.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CampaignUpdate {
    /// Monotonically increasing update identifier.
    pub id: u64,
    /// Address that authored the update.
    pub author: Address,
    /// Update body text.
    pub content: String,
    /// Unix timestamp when the update was posted.
    pub created_at: u64,
}

/// A funding milestone the campaign aims to reach.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FundingMilestone {
    /// Monotonically increasing milestone identifier.
    pub id: u64,
    /// Amount that must be raised to reach this milestone.
    pub amount: i128,
    /// Human-readable description of the milestone.
    pub description: String,
    /// Whether the milestone has been reached.
    pub reached: bool,
    /// Unix timestamp when the milestone was reached, if applicable.
    pub reached_at: Option<u64>,
}

/// Configuration for matching funds applied to contributions.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MatchingConfig {
    /// Address providing the matching funds.
    pub sponsor: Address,
    /// Total matching pool available.
    pub pool: i128,
    /// Ratio of matching funds per unit contributed, in basis points.
    pub match_ratio_bps: u32,
    /// Maximum matching amount per contribution.
    pub max_match_per_contribution: i128,
    /// Amount of the matching pool already consumed.
    pub matched_so_far: i128,
}

/// Kind of campaign template.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TemplateType {
    /// Standard all-or-nothing campaign.
    Standard,
    /// Campaign that keeps funds even if the goal is not met.
    Flexible,
    /// Campaign with recurring contributions.
    Recurring,
    /// Campaign with matching funds.
    Matched,
}

/// High-level category describing a campaign's purpose.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Category {
    /// Arts and culture.
    Arts,
    /// Community and social causes.
    Community,
    /// Education.
    Education,
    /// Environment and sustainability.
    Environment,
    /// Health and medical.
    Health,
    /// Technology and software.
    Technology,
    /// Other or uncategorized.
    Other,
}

/// A reusable campaign template.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CampaignTemplate {
    /// Kind of template.
    pub template_type: TemplateType,
    /// Category the template belongs to.
    pub category: Category,
    /// Default funding goal for campaigns created from this template.
    pub default_goal: i128,
    /// Default campaign duration in seconds.
    pub default_duration: u64,
    /// Optional template description.
    pub description: Option<String>,
}

/// Visibility of a campaign to the public.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Visibility {
    /// Visible to everyone.
    Public,
    /// Visible only to addresses explicitly granted access.
    Private,
    /// Visible only to the creator.
    Unlisted,
}

/// A reward tier offered to contributors.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RewardTier {
    /// Monotonically increasing tier identifier.
    pub id: u64,
    /// Minimum contribution required to claim this tier.
    pub min_contribution: i128,
    /// Human-readable tier name.
    pub name: String,
    /// Human-readable tier description.
    pub description: String,
    /// Maximum number of claims available, if limited.
    pub max_claims: Option<u32>,
    /// Number of claims already made.
    pub claimed: u32,
    /// Optional metadata payload for the tier.
    pub metadata: Option<Bytes>,
}

/// A collection of reward tiers attached to a campaign.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RewardTiers {
    /// Ordered list of reward tiers.
    pub tiers: Vec<RewardTier>,
}