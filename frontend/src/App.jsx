import { Navigate, Route, Routes } from 'react-router';
import { GuestOnly, RequireAdmin, RequireSignedIn } from './auth/RouteGuards';
import { AllBookingsPage } from './features/admin/AllBookingsPage';
import { OccupancyPage } from './features/admin/OccupancyPage';
import { PeoplePage } from './features/admin/PeoplePage';
import { RulesPage } from './features/admin/RulesPage';
import { SpacesPage } from './features/admin/SpacesPage';
import { DemoPage } from './features/auth/DemoPage';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { InvitePage } from './features/auth/InvitePage';
import { LoginPage } from './features/auth/LoginPage';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { BookingViewPage } from './features/bookings/BookingViewPage';
import { ChangeBookingPage } from './features/bookings/ChangeBookingPage';
import { MyBookingsPage } from './features/bookings/MyBookingsPage';
import { DeskAreaPage } from './features/desks/DeskAreaPage';
import { HomePage } from './features/home/HomePage';
import { ProfilePage } from './features/profile/ProfilePage';
import { RoomPage } from './features/rooms/RoomPage';
import { AdminLayout } from './layout/AdminLayout';
import { NotFoundPage } from './pages/ErrorPages';

/**
 * Routes (UI-UX.md "Routes and screens"). Log in is the start page at "/"; the demo has its own page.
 * The guards only decide what is shown: the server checks every role and ownership again.
 */
export function App() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path="/" element={<LoginPage />} />
        <Route path="/demo" element={<DemoPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/invite/:token" element={<InvitePage />} />

      <Route element={<RequireSignedIn />}>
        <Route path="/home" element={<HomePage />} />
        <Route path="/spaces/desks/:floorId" element={<DeskAreaPage />} />
        <Route path="/spaces/rooms/:roomId" element={<RoomPage />} />
        <Route path="/bookings" element={<MyBookingsPage />} />
        <Route path="/bookings/:id" element={<BookingViewPage />} />
        <Route path="/bookings/:id/change" element={<ChangeBookingPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/admin" element={<RequireAdmin />}>
          <Route element={<AdminLayout />}>
            <Route index element={<OccupancyPage />} />
            <Route path="spaces" element={<SpacesPage />} />
            <Route path="rules" element={<RulesPage />} />
            <Route path="people" element={<PeoplePage />} />
            <Route path="bookings" element={<AllBookingsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
