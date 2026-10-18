import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App';
import Home from './home';
import SignInPage from './auth/sign-in';
import ApiAuthProvider from './auth/ApiAuthProvider';
import Dashboard from './dashboard';
import EditResume from './dashboard/resume/[resumeId]/edit';
import ViewResume from './my-resume/ViewResume';
import './index.css';

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/auth/sign-in/*', element: <SignInPage /> },
  { element: <App />, children: [
    { path: '/dashboard', element: <Dashboard /> },
    { path: '/dashboard/resume/:resumeId/edit', element: <EditResume /> },
    { path: '/my-resume/:resumeId/view', element: <ViewResume /> },
  ] },
]);
const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
ReactDOM.createRoot(document.getElementById('root')).render(
  publishableKey ? <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/">
    <ApiAuthProvider><RouterProvider router={router} /></ApiAuthProvider>
  </ClerkProvider> : <p>Authentication is not configured.</p>
);
