export type OrgPublic = {
  id: number;
  name: string;
  slug: string;
  code: string;
  motto: string | null;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  county: string | null;
  location: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  formVersion: number;
};

export type SubscriptionInfo = {
  status: string;
  planName: string | null;
  planCode: string | null;
  billingCycle: string | null;
  currentPeriodEnd: string | null;
  maxStations: number | null;
  maxMembers: number | null;
};

export type StationRow = {
  id: number;
  name: string;
  code: string;
  location: string | null;
  description: string | null;
  isArchived: boolean;
  memberCount: number;
  activeMemberCount: number;
  pendingApplications: number;
  chairperson: { id: number; name: string } | null;
  secretary: { id: number; name: string } | null;
  deputy: { id: number; name: string } | null;
};

export type InvitationRow = {
  id: number;
  token: string;
  stationId: number;
  stationName: string;
  expiresAt: string;
  maxUses: number;
  usesCount: number;
  isRevoked: boolean;
  createdAt: string;
};

export type MemberRow = {
  id: number;
  firstName: string;
  middleName: string | null;
  surname: string;
  phone: string | null;
  email: string | null;
  area: string | null;
  dob: string | null;
  gender: string | null;
  nationalId: string | null;
  photoUrl: string | null;
  bikeRegNo: string | null;
  bikeModel: string | null;
  bikeOwnership: string | null;
  membershipNumber: string | null;
  existingQrId: string | null;
  status: string;
  source: string;
  registrationDate: string | null;
  stationId: number;
  stationName: string;
  stationCode: string;
  createdAt: string;
};

export type MemberDetail = MemberRow & {
  idImageUrl: string | null;
  idType: string | null;
  idNumber: string | null;
  idName: string | null;
  idDob: string | null;
  idGender: string | null;
  idIssuedAt: string | null;
  idExpiryAt: string | null;
  altPhone: string | null;
  customValues: {
    fieldId: number;
    key: string;
    label: string;
    type: string;
    value: unknown;
  }[];
  transfers: {
    id: number;
    fromStation: string;
    toStation: string;
    reason: string;
    status: string;
    createdAt: string;
  }[];
  card: { id: number; qrPayload: string; issuedAt: string; version: number } | null;
};

export type CustomFieldDef = {
  id: number;
  key: string;
  label: string;
  type: string;
  options: string[] | null;
  required: boolean;
  enabled: boolean;
  position: number;
  visibility: string;
  helpText: string | null;
  formVersion: number;
};

export type ApplicationRow = {
  id: number;
  formVersion: number;
  status: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  area: string | null;
  stationId: number;
  stationName: string;
  createdAt: string;
  chairNotes: string | null;
  decisionNotes: string | null;
};

export type ApplicationDetail = ApplicationRow & {
  data: Record<string, unknown>;
  fields: CustomFieldDef[];
  recommendedByName: string | null;
  recommendedAt: string | null;
  decisionByName: string | null;
  decisionAt: string | null;
  rejectionReason: string | null;
};

export type TransferRow = {
  id: number;
  memberId: number;
  memberName: string;
  membershipNumber: string | null;
  phone: string | null;
  fromStationId: number;
  fromStationName: string;
  toStationId: number;
  toStationName: string;
  reason: string;
  status: string;
  requestedByName: string | null;
  note: string | null;
  createdAt: string;
  decidedAt: string | null;
};

export type CardPublic = {
  member: {
    name: string;
    number: string;
    phone: string | null;
    photoUrl: string | null;
    bikeRegNo: string | null;
    status: string;
    registrationDate: string | null;
    station: string;
    orgName: string;
    orgLogo: string | null;
    primaryColor: string;
  };
  qrPayload: string;
  version: number;
  issuedAt: string;
};

export type StationMemberOption = { id: number; name: string; membershipNumber: string | null };
export type CandidateOfficial = { id: number; fullName: string; email: string; phone: string | null };
export type OfficialRow = { id: number; userId: number; name: string; email: string; phone: string | null; role: string; status: string; note: string | null };
export type AuditLogItem = { id: number; action: string; entity: string | null; entityId: string | null; userName: string | null; details: Record<string, unknown> | null; createdAt: string };
export type NotificationItem = { id: number; type: string; title: string; body: string | null; readAt: string | null; createdAt: string };
export type AnnouncementItem = { id: number; title: string; body: string; author: string | null; stationId: number | null; createdAt: string };
