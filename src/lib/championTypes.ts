export type ChampionClaimType = "show_winner" | "champion_profile";

export type ChampionCardCodeRow = {
  id: string;
  promotion_id: string;
  code: string;
  active: boolean;
  created_at: string;
};

export type ChampionClaimRow = {
  id: string;
  promotion_id: string;
  show_id: string | null;
  claim_type: ChampionClaimType;
  claimed_username: string;
  claimed_avatar: string | null;
  source_code_id: string;
  claimed_by_user_id: string | null;
  claimed_by_guest_id: string | null;
  created_at: string;
};

export type ChampionCompletedShow = {
  id: string;
  name: string;
  starts_at: string | null;
  promotion_id: string | null;
  winner_user_id: string | null;
  winner_username: string | null;
  winner_avatar: string | null;
};

export type ChampionPromotion = {
  id: string;
  name: string;
  image_url: string | null;
};

export type ChampionParticipant = {
  user_id: string;
  display_name: string;
  avatar_key: string | null;
  claim_type: ChampionClaimType;
  claimed_show_id: string | null;
};

export type ChampionProfileClaim = {
  id: string;
  promotion_id: string;
  promotion_name: string;
  promotion_image_url: string | null;
  show_id: string | null;
  show_name: string | null;
  show_starts_at: string | null;
  claim_type: ChampionClaimType;
  claimed_username: string;
  claimed_avatar: string | null;
  created_at: string;
};

export type PromotionChampionshipStatus = {
  status: "inaugural" | "defending" | "vacant";
  previous_show_id: string | null;
  previous_show_name: string | null;
  champion_user_id: string | null;
  champion_username: string | null;
  champion_avatar: string | null;
};

export type PromotionLineageReign = {
  lineage_number: number;
  reign_number: number;
  champion_user_id: string | null;
  champion_username: string;
  champion_avatar: string | null;
  won_show_id: string;
  won_show_name: string;
  won_at: string | null;
  ended_at: string | null;
  successful_defenses: number;
  is_current: boolean;
};

export type PromotionLineageStatus = {
  status: "inaugural" | "defending" | "vacant";
  champion_user_id: string | null;
  champion_username: string | null;
  champion_avatar: string | null;
  reign_number: number | null;
  successful_defenses: number | null;
  active_show_id: string | null;
  active_show_name: string | null;
};

export type PromotionLineagePageData = {
  promotion: ChampionPromotion | null;
  status: PromotionLineageStatus;
  lineage: PromotionLineageReign[];
  call_to_action_show_id: string | null;
};
