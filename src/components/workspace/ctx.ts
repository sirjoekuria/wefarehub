import type { OrgInit } from "./Workspace";

export type Ctx = {
  org: OrgInit;
  role: "owner" | "admin" | "secretary" | "treasurer" | null;
  user: { id: number; email: string; fullName: string; platformRole: string | null };
  chairStationId: number | null;
  chairStationName: string | null;
  stationFilter: number | "all";
  setStationFilter: (v: number | "all") => void;
  refreshKey: number;
  refresh: () => void;
  isChair: boolean;
  isOfficer: boolean;
};
