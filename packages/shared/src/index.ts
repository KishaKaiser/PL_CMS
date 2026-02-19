// ──────────────────────────────────────────────
// Role enum
// ──────────────────────────────────────────────
export enum Role {
  ADMIN = 'ADMIN',
  ADVISOR = 'ADVISOR',
  CLIENT = 'CLIENT',
}

// ──────────────────────────────────────────────
// Auth DTOs
// ──────────────────────────────────────────────
export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
}

// ──────────────────────────────────────────────
// User DTOs
// ──────────────────────────────────────────────
export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

// ──────────────────────────────────────────────
// Advisor DTOs
// ──────────────────────────────────────────────
export interface AdvisorProfileDto {
  id: string;
  userId: string;
  displayName: string;
  bio?: string;
  ratePerMinute: number;
  isOnline: boolean;
}

// ──────────────────────────────────────────────
// Client DTOs
// ──────────────────────────────────────────────
export interface ClientProfileDto {
  id: string;
  userId: string;
  displayName: string;
  balanceMinutes: number;
}

// ──────────────────────────────────────────────
// Call / Queue DTOs
// ──────────────────────────────────────────────
export interface CallSessionDto {
  id: string;
  advisorId: string;
  clientId: string;
  startedAt: string;
  endedAt?: string;
  durationMinutes?: number;
  billedMinutes?: number;
}

export interface CallQueueDto {
  id: string;
  advisorId: string;
  name: string;
  isActive: boolean;
}

// ──────────────────────────────────────────────
// Message DTOs
// ──────────────────────────────────────────────
export interface MessageDto {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  sentAt: string;
  readAt?: string;
}

export interface BroadcastMessageDto {
  id: string;
  authorId: string;
  subject: string;
  body: string;
  sentAt: string;
}

// ──────────────────────────────────────────────
// CMS DTOs
// ──────────────────────────────────────────────
export interface PageDto {
  id: string;
  slug: string;
  title: string;
  content: string;
  publishedAt?: string;
}

export interface PostDto {
  id: string;
  slug: string;
  title: string;
  excerpt?: string;
  content: string;
  publishedAt?: string;
  authorId: string;
}

// ──────────────────────────────────────────────
// Module / Setting / Audit DTOs
// ──────────────────────────────────────────────
export interface ModuleDto {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface SettingDto {
  key: string;
  value: string;
}

export interface AuditLogDto {
  id: string;
  actorId: string;
  action: string;
  entity: string;
  entityId?: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}

// ──────────────────────────────────────────────
// Pagination
// ──────────────────────────────────────────────
export interface PaginatedDto<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}
