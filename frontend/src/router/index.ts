import { APP_NAME } from '@/config/branding';
const ChatbotFaqView = () => import('@/views/ChatbotFaqView.vue');
const ChatbotManagementView = () => import('@/views/ChatbotManagementView.vue');
const ManageAlumniView = () => import('@/views/ManageAlumniView.vue');
const AccountSettingsView = () => import('@/views/AccountSettingsView.vue');
const SuperAdminView = () => import('@/views/SuperAdminView.vue');
const AccountVerificationView = () => import('@/views/AccountVerificationView.vue');
import { loginDestination } from '@/utils/login';
import { nextTick } from 'vue';
const GuidanceView = () => import('@/views/GuidanceView.vue');
const NotFoundView = () => import('@/views/NotFoundView.vue');
import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from '@/stores/auth';
const HomeView = () => import('@/views/HomeView.vue'); const InfoView = () => import('@/views/InfoView.vue'); const ServicesView = () => import('@/views/ServicesView.vue'); const ContentListView = () => import('@/views/ContentListView.vue'); const AnnouncementsView = () => import('@/views/AnnouncementsView.vue'); const StoriesView = () => import('@/views/StoriesView.vue'); const LoginView = () => import('@/views/LoginView.vue'); const RegisterView = () => import('@/views/RegisterView.vue'); const DashboardView = () => import('@/views/DashboardView.vue'); const RequestView = () => import('@/views/RequestView.vue'); const AdminView = () => import('@/views/AdminView.vue');
const MembershipStatusView = () => import('@/views/MembershipStatusView.vue');
const ActivateView = () => import('@/views/ActivateView.vue');
const MembershipAdminView = () => import('@/views/MembershipAdminView.vue');
const MembershipQrView = () => import('@/views/MembershipQrView.vue');
const PasswordRecoveryView = () => import('@/views/PasswordRecoveryView.vue');
const ShowcaseManageView = () => import('@/views/ShowcaseManageView.vue');
const ProfileView = () => import('@/views/ProfileView.vue');
const DirectoryView = () => import('@/views/DirectoryView.vue');
const RequestHistoryView = () => import('@/views/RequestHistoryView.vue');
const ContentManageView = () => import('@/views/ContentManageView.vue');
const AboutContentManageView = () => import('@/views/AboutContentManageView.vue');
const ContentDetailView = () => import('@/views/ContentDetailView.vue');
const RequestManageView = () => import('@/views/RequestManageView.vue');
const ContactView = () => import('@/views/ContactView.vue');
const router = createRouter({ history: createWebHistory(), scrollBehavior: (to, from, savedPosition) => {
  if (savedPosition) return savedPosition;
  // Activation/verification URLs carry private fragments, rather than anchors.
  if (to.hash && document.getElementById(to.hash.slice(1))) return { el: to.hash, top: 100 };
  if (to.path === from.path) return false;
  return { top: 0 };
}, routes: [
  { path: '/gallery', component: () => import('@/views/GalleryView.vue') },
  { path: '/forgot-password', component: PasswordRecoveryView },
  { path: '/reset-password', component: PasswordRecoveryView, props: { reset: true } },
  { path: '/admin/content/gallery', component: ShowcaseManageView, props: { kind: 'gallery' }, meta: { auth: true, admin: true } },
  { path: '/admin/content/achievements', component: ShowcaseManageView, props: { kind: 'achievements' }, meta: { auth: true, admin: true } },
  { path: '/account/settings', component: AccountSettingsView, meta: { auth: true, shared: true } },
  { path: '/super-admin', component: SuperAdminView, props: { section: 'overview' }, meta: { auth: true, superAdmin: true } },
  { path: '/super-admin/admins', component: SuperAdminView, props: { section: 'admins' }, meta: { auth: true, superAdmin: true } },
  { path: '/super-admin/chatbot', component: ChatbotManagementView, props: { platform: true }, meta: { auth: true, superAdmin: true } },
  { path: '/admin/chatbot', component: ChatbotManagementView, meta: { auth: true, admin: true } },
  { path: '/super-admin/settings', component: SuperAdminView, props: { section: 'settings' }, meta: { auth: true, superAdmin: true } },
  { path: '/verify-email', component: AccountVerificationView },
  { path: '/admin-activate', component: AccountVerificationView, props: { adminActivation: true } },
  { path: '/', component: HomeView }, { path: '/about', component: InfoView, props: { page: 'about' } }, { path: '/services', component: ServicesView }, { path: '/contact', component: ContactView },
  { path: '/announcements', component: AnnouncementsView }, { path: '/stories', component: StoriesView }, { path: '/events', component: ContentListView, props: { type: 'events' } },
  { path: '/announcements/:id', component: ContentDetailView, props: { type: 'announcements' } }, { path: '/admin/content/announcements', component: ContentManageView, props: { type: 'announcements' }, meta: { auth: true, admin: true } },
  { path: '/stories/:id', component: ContentDetailView, props: { type: 'stories' } }, { path: '/admin/content/stories', component: ContentManageView, props: { type: 'stories' }, meta: { auth: true, admin: true } },
  { path: '/events/:id', component: ContentDetailView, props: { type: 'events' } }, { path: '/admin/content/events', component: ContentManageView, props: { type: 'events' }, meta: { auth: true, admin: true } },
  { path: '/admin/content/history', component: AboutContentManageView, props: { kind: 'history' }, meta: { auth: true, admin: true } },
  { path: '/admin/content/leadership', redirect: '/admin/content/leadership/school' },
  { path: '/admin/content/leadership/school', component: AboutContentManageView, props: { kind: 'school' }, meta: { auth: true, admin: true } },
  { path: '/admin/content/leadership/alumni', component: AboutContentManageView, props: { kind: 'alumni' }, meta: { auth: true, admin: true } },
  { path: '/stories/mine', component: ContentManageView, props: { type: 'stories', own: true }, meta: { auth: true } },
  { path: '/membership/status', component: MembershipStatusView }, { path: '/activate', component: ActivateView }, { path: '/admin/membership', component: MembershipAdminView, meta: { auth: true, admin: true } },
  { path: '/admin/membership/qr', component: MembershipQrView, meta: { auth: true, admin: true } },
  { path: '/login', component: LoginView }, { path: '/register', component: RegisterView }, { path: '/dashboard', component: DashboardView, meta: { auth: true } }, { path: '/requests/new', component: RequestView, meta: { auth: true } },
  { path: '/profile', component: ProfileView, meta: { auth: true } }, { path: '/alumni', component: DirectoryView, meta: { auth: true } }, { path: '/requests', component: RequestHistoryView, meta: { auth: true } },
  { path: '/admin/requests', component: RequestManageView, props: { admin: true }, meta: { auth: true, admin: true } },
  { path: '/admin', component: AdminView, meta: { auth: true, admin: true } }, { path: '/admin/alumni', component: ManageAlumniView, meta: { auth: true, admin: true } }, { path: '/help/faqs', component: ChatbotFaqView }, { path: '/privacy', component: GuidanceView, props: { page: 'privacy' } }, { path: '/terms', component: GuidanceView, props: { page: 'terms' } }, { path: '/help', component: GuidanceView, props: { page: 'help' } }, { path: '/:pathMatch(.*)*', component: NotFoundView }
] });
router.beforeEach(async (to) => {
  const { user, ready, refresh } = useAuth();
  if (to.meta.auth) {
    if (!ready.value) await refresh();
  } else if (!ready.value) {
    void refresh();
  }
  if (to.meta.auth && !user.value) return { path: '/login', query: { redirect: to.fullPath } };
  if (to.path === '/profile' && user.value?.role === 'ADMIN') return '/account/settings';
  if (to.path === '/dashboard' && user.value?.role === 'ADMIN') return '/admin';
  if (to.meta.superAdmin && user.value?.role !== 'SUPER_ADMIN') return loginDestination(undefined, user.value?.role ?? 'ALUMNI');
  if (to.meta.admin && user.value?.role !== 'ADMIN') return loginDestination(undefined, user.value?.role ?? 'ALUMNI');
  if (to.meta.auth && !to.meta.shared && !to.meta.superAdmin && user.value?.role === 'SUPER_ADMIN') return '/super-admin';
  return true;
});
window.addEventListener('gda:session-expired', () => {
  const current = router.currentRoute.value;
  if (current.meta.auth) void router.replace({ path: '/login', query: { redirect: current.fullPath } });
});
router.afterEach(async (to) => {
  document.title = `${to.path.split('/').filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).slice(0, 2).join(' · ') || 'Home'} | ${APP_NAME}`;
  await nextTick();
  document.getElementById('main-content')?.focus({ preventScroll: true });
});
export default router;
