import { ServiceCategoryId } from "./catalog";

export type FollowRecord = {
  user_id: string;
  tournament_id: string;
  created_at: Date;
};

export type NotificationRecord = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  link: string;
  is_read: boolean;
  created_at: Date;
};

export type ServiceListingRecord = {
  id: string;
  user_id: string;
  category: ServiceCategoryId | string;
  title: string;
  body: string;
  city: string;
  sport: string;
  contact_name: string;
  mobile: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  owner_name?: string;
};
