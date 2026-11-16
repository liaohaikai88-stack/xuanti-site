export type Role = "user" | "admin";
export type Tier = "free" | "annual";
export type TopicStatus = "draft" | "published";
export type EventType = "holiday" | "solar_term" | "campaign" | "solemn";
export type OrderStatus = "pending" | "paid" | "cancelled";

export type User = {
  id: number;
  username: string;
  email: string;
  role: Role;
  phone: string | null;
  consentAt: string | null;
  consentVersion: string | null;
  tier: Tier;
  membershipExpiresAt: string | null;
  credits: number;
  createdAt: string;
  deletedAt: string | null;
};

export type Industry = {
  id: number;
  slug: string;
  name: string;
  color: string;
  description: string;
  sortOrder: number;
};

export type Topic = {
  id: number;
  industryId: number;
  industryName: string;
  industrySlug: string;
  industryColor: string;
  title: string;
  hook: string;
  platform: string;
  contentForm: string;
  publishDate: string;
  sortOrder: number;
  note: string;
  isSample: boolean;
  status: TopicStatus;
};

export type CalendarDirection = {
  industryName: string;
  direction: string;
};

export type CalendarEvent = {
  id: number;
  dateLabel: string;
  startDate: string | null;
  endDate: string | null;
  title: string;
  prepLabel: string;
  caution: string;
  summary: string;
  detail: string;
  eventType: EventType;
  isSample: boolean;
  sortOrder: number;
  directions: CalendarDirection[];
};

export type CaseStudy = {
  id: number;
  title: string;
  platform: string;
  industryId: number | null;
  industryName: string | null;
  industryColor: string | null;
  teaser: string;
  body: string;
  publishedAt: string;
  isSample: boolean;
};

export type LegalDoc = {
  slug: string;
  title: string;
  content: string;
  updatedAt: string;
};

export type Order = {
  id: number;
  orderNo: string;
  userId: number;
  username: string;
  email: string;
  amountFen: number;
  status: OrderStatus;
  provider: string;
  providerRef: string | null;
  createdAt: string;
  paidAt: string | null;
  activatedBy: number | null;
};

export type TopicInput = {
  industryId: number;
  title: string;
  hook: string;
  platform: string;
  contentForm: string;
  publishDate: string;
  sortOrder?: number;
  note?: string;
  isSample?: boolean;
  status?: TopicStatus;
};
