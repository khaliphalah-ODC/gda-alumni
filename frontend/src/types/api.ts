export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'ALUMNI' | 'STUDENT';
export type PostType = 'ANNOUNCEMENT' | 'STORY' | 'EVENT' | 'HISTORY' | 'SCHOOL_LEADER' | 'ALUMNI_LEADER' | 'GALLERY' | 'ACHIEVEMENT';
export type RequestType = 'CERTIFICATE' | 'TRANSCRIPT' | 'DIPLOMA' | 'WAEC_CERTIFICATE' | 'WASSCE_CERTIFICATE';
export type RequestStatus = 'SUBMITTED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'READY_FOR_PICKUP' | 'COMPLETED';

export interface ApiResponse<T> { success: boolean; message: string; data: T; pagination: Pagination | null; }
export interface Pagination { page: number; limit: number; total: number; totalPages: number; }
export interface User { profileImage?: string | null; id: string; email: string; role: Role; createdAt: string; updatedAt: string; }
export interface AlumniProfile { id: string; userId: string; fullName: string; graduationYear: number | null; occupation: string | null; location: string | null; phone: string | null; bio: string | null; profileImage: string | null; imageVersion: number; user: Pick<User, 'id' | 'email' | 'role'>; }
export interface DirectoryProfile { id: string; fullName: string; graduationYear: number | null; occupation: string | null; location: string | null; bio: string | null; profileImage: string | null; }
export interface AlumniDashboard {
  profile: AlumniProfile | null;
  membership: { reference: string; status: string; reviewedAt: string | null; activatedAt: string | null } | null;
  profileCompletion: { completed: number; total: number; percent: number };
  announcements: { id: string; title: string; content: string; publishedAt: string | null }[];
  stories: { id: string; title: string; content: string; isPublished: boolean; updatedAt: string }[];
  events: { id: string; title: string; content: string; eventDate: string; eventTime: string | null; eventLocation: string | null; audience: string | null }[];
  requests: Pick<DocumentRequest, 'id' | 'requestType' | 'status' | 'adminNote' | 'createdAt' | 'completedAt'>[];
  requestCounts: { status: RequestStatus; _count: { _all: number } }[];
}
export interface Post { id: string; version: number; title: string; content: string; image?: string | null; category?: string | null; type: PostType; isPublished: boolean; publishedAt?: string | null; createdBy: string; eventDate?: string | null; eventTime?: string | null; eventLocation?: string | null; audience?: string | null; createdAt: string; user: Pick<User, 'id'>; }
export interface ShowcasePost extends Post { imageAlt: string; imageCaption: string | null; imageWidth: number; imageHeight: number; displayOrder: number; summary: string | null; heading: string | null; sourceUrl: string | null; sourceLabel: string | null; milestoneDate: string | null; }
export interface ManagedCollection { managed: boolean; items: ShowcasePost[]; }
export interface AboutRecord extends Post { milestoneDate: string | null; position: string | null; displayOrder: number; }
export interface DocumentRequest { id: string; version: number; requestType: RequestType; purpose: string; status: RequestStatus; adminNote?: string | null; requestedBy: string; fullNameAtGraduation: string; graduationYear?: number | null; studentIdOrIndexNumber?: string | null; contactPhone: string; completedAt?: string | null; createdAt: string; user: Pick<User, 'id' | 'email' | 'role'>; }

export interface ApplicationForm { fullName: string; email: string; phone: string; location: string; previousName: string; graduationYear: number | ''; studentIndexNumber: string; lastClassAttended: string; verificationInformation: string; }
export interface MembershipApplication extends Omit<ApplicationForm, 'graduationYear'> { id: string; reference: string; graduationYear: number; status: 'PENDING' | 'APPROVED' | 'REJECTED'; rejectionReason: string | null; reviewedBy: string | null; reviewedAt: string | null; activatedAt: string | null; userId: string | null; createdAt: string; activationExpiresAt: string | null; activationDeliveryStatus: 'NONE' | 'DEVELOPMENT' | 'SENT' | 'FAILED'; activationDeliveryAt: string | null; history: { id: string; action: string; notes: string | null; actorId: string | null; createdAt: string; snapshot: Record<string, unknown> | null }[]; }

export interface AdminDashboard {
  stats: { totalApprovedAlumni: number; pendingApplications: number; rejectedApplications: number; activatedAlumniAccounts: number; activeAlumniAccounts: number; publishedAnnouncements: number; publishedStories: number; upcomingEvents: number; totalRequests: number };
  requestsByStatus: Record<RequestStatus, number>;
  recentApplications: { id: string; reference: string; fullName: string; graduationYear: number; createdAt: string }[];
  recentRequests: { id: string; requestType: RequestType; status: RequestStatus; fullNameAtGraduation: string; createdAt: string }[];
  membershipActivity: { id: string; action: string; createdAt: string; application: { reference: string; fullName: string }; actor: { email: string } | null }[];
  asOf: string;
}

export interface AccountProfile { fullName: string; phone: string | null; location: string | null; profileImage: string | null; imageVersion: number; }
export interface AccountSettings { id: string; email: string; role: Role; isActive: boolean; profile: AccountProfile | null; emailChangeAvailable: boolean; media: { enabled: boolean; maxBytes: number; provider?: 'local' | 'cloudinary' }; }
export interface MediaConfiguration { provider: 'local' | 'cloudinary'; configured: boolean; maxBytes: number; formats: string[]; status: string; }
export interface PlatformSettings { media: MediaConfiguration; platformName: string; emailEnabled: boolean; mediaEnabled: boolean; email: { configured: boolean; sender: string | null; status: string }; cloudinary: { configured: boolean; cloudName: string | null; maxBytes: number; formats: string[]; status: string }; }
export interface StaffAccount extends User { isActive: boolean; staffProfile: AccountProfile | null; }
