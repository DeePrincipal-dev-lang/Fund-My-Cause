//! Campaign-family events.
//!
//! These events describe lifecycle and configuration changes to a campaign
//! itself (initialization, status transitions, metadata, pausing, etc.).
//! Topics and payloads must remain byte-identical to the original
//! `types/events.rs` definitions.

use soroban_sdk::{contracttype, Address, Bytes, BytesN, String, Symbol, Vec};

use crate::types::{
    CampaignCategory, CampaignMetadata, CampaignStatus, CampaignTemplate, EmergencyContact,
    MatchingConfig, MultiSigConfig, RateLimitConfig, TierConfig, Visibility,
};

/// Emitted when a campaign is initialized.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventInitialized {
    pub campaign_id: BytesN<32>,
    pub creator: Address,
    pub goal: i128,
    pub deadline: u64,
    pub token: Address,
}

/// Emitted when a campaign's status changes.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventStatusChanged {
    pub campaign_id: BytesN<32>,
    pub old_status: CampaignStatus,
    pub new_status: CampaignStatus,
    pub timestamp: u64,
}

/// Emitted when campaign metadata is updated.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventMetadataUpdated {
    pub campaign_id: BytesN<32>,
    pub metadata: CampaignMetadata,
    pub timestamp: u64,
}

/// Emitted when a campaign's deadline is extended.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventDeadlineExtended {
    pub campaign_id: BytesN<32>,
    pub old_deadline: u64,
    pub new_deadline: u64,
    pub timestamp: u64,
}

/// Emitted when a campaign is paused.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventPaused {
    pub campaign_id: BytesN<32>,
    pub reason: String,
    pub timestamp: u64,
}

/// Emitted when a campaign is resumed.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventResumed {
    pub campaign_id: BytesN<32>,
    pub timestamp: u64,
}

/// Emitted when a campaign is cancelled.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventCancelled {
    pub campaign_id: BytesN<32>,
    pub reason: String,
    pub timestamp: u64,
}

/// Emitted when a campaign is archived.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventArchived {
    pub campaign_id: BytesN<32>,
    pub timestamp: u64,
}

/// Emitted when a campaign's goal is adjusted.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventGoalAdjusted {
    pub campaign_id: BytesN<32>,
    pub old_goal: i128,
    pub new_goal: i128,
    pub timestamp: u64,
}

/// Emitted when a campaign's category is updated.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventCategoryUpdated {
    pub campaign_id: BytesN<32>,
    pub old_category: CampaignCategory,
    pub new_category: CampaignCategory,
    pub timestamp: u64,
}

/// Emitted when a campaign template is applied.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventTemplateApplied {
    pub campaign_id: BytesN<32>,
    pub template: CampaignTemplate,
    pub timestamp: u64,
}

/// Emitted when matching is set up for a campaign.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventMatchingSetup {
    pub campaign_id: BytesN<32>,
    pub config: MatchingConfig,
    pub timestamp: u64,
}

/// Emitted when multi-signature configuration is set for a campaign.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventMultiSigConfigured {
    pub campaign_id: BytesN<32>,
    pub config: MultiSigConfig,
    pub timestamp: u64,
}

/// Emitted when an emergency contact is added.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventEmergencyContactAdded {
    pub campaign_id: BytesN<32>,
    pub contact: EmergencyContact,
    pub timestamp: u64,
}

/// Emitted when an emergency contact is removed.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventEmergencyContactRemoved {
    pub campaign_id: BytesN<32>,
    pub contact: Address,
    pub timestamp: u64,
}

/// Emitted when a campaign enters emergency mode.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventEmergencyActivated {
    pub campaign_id: BytesN<32>,
    pub reason: String,
    pub timestamp: u64,
}

/// Emitted when a campaign exits emergency mode.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventEmergencyDeactivated {
    pub campaign_id: BytesN<32>,
    pub timestamp: u64,
}

/// Emitted when an address is whitelisted for a campaign.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventWhitelisted {
    pub campaign_id: BytesN<32>,
    pub address: Address,
    pub timestamp: u64,
}

/// Emitted when an address is removed from the whitelist.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventWhitelistRemoved {
    pub campaign_id: BytesN<32>,
    pub address: Address,
    pub timestamp: u64,
}

/// Emitted when an address is blacklisted for a campaign.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventBlacklisted {
    pub campaign_id: BytesN<32>,
    pub address: Address,
    pub timestamp: u64,
}

/// Emitted when an address is removed from the blacklist.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventBlacklistRemoved {
    pub campaign_id: BytesN<32>,
    pub address: Address,
    pub timestamp: u64,
}

/// Emitted when a rate limit is configured.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventRateLimitConfigured {
    pub campaign_id: BytesN<32>,
    pub config: RateLimitConfig,
    pub timestamp: u64,
}

/// Emitted when a rate limit is updated.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventRateLimitUpdated {
    pub campaign_id: BytesN<32>,
    pub old_config: RateLimitConfig,
    pub new_config: RateLimitConfig,
    pub timestamp: u64,
}

/// Emitted when a rate limit is removed.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventRateLimitRemoved {
    pub campaign_id: BytesN<32>,
    pub timestamp: u64,
}

/// Emitted when a campaign's visibility is changed.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventVisibilityChanged {
    pub campaign_id: BytesN<32>,
    pub old_visibility: Visibility,
    pub new_visibility: Visibility,
    pub timestamp: u64,
}

/// Emitted when a tier is added to a campaign.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventTierAdded {
    pub campaign_id: BytesN<32>,
    pub tier: TierConfig,
    pub timestamp: u64,
}

/// Emitted when a tier is updated.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventTierUpdated {
    pub campaign_id: BytesN<32>,
    pub old_tier: TierConfig,
    pub new_tier: TierConfig,
    pub timestamp: u64,
}

/// Emitted when a tier is removed.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventTierRemoved {
    pub campaign_id: BytesN<32>,
    pub tier_id: u32,
    pub timestamp: u64,
}

/// Emitted when a campaign's tags are updated.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventTagsUpdated {
    pub campaign_id: BytesN<32>,
    pub tags: Vec<Symbol>,
    pub timestamp: u64,
}

/// Emitted when a campaign's image is updated.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EventImageUpdated {
    pub campaign_id: BytesN<32>,
    pub image_hash: Bytes,
    pub timestamp: u64,
}