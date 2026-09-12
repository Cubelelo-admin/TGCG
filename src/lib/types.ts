export type TicketGroup = "competitive" | "non_competitive";

export interface TicketCategory {
  id: string;
  event_id: string;
  group: TicketGroup;
  name: string;
  description: string | null;
  price_inr: number;
  min_age: number | null;
  max_age: number | null;
  capacity: number | null;
  sold_count: number;
  requires_kyc: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface Addon {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  price_inr: number;
  capacity: number | null;
  sold_count: number;
  is_active: boolean;
  sort_order: number;
}

export interface EventRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  venue: string | null;
  event_date: string;
  starts_at_text: string | null;
  is_active: boolean;
}
