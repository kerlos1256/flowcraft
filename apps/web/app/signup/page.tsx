import { AuthForm } from '@/components/auth-form';

export const metadata = { title: 'Sign up — Flowcraft' };

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
