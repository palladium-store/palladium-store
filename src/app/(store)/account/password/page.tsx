import { customerGuard } from '@/lib/guard';
import { PasswordForm } from '@/components/store/account-forms';

export const dynamic = 'force-dynamic';

export default async function PasswordPage() {
  await customerGuard('/account/password');
  return (
    <div>
      <h2 className="h-display mb-6 text-2xl sm:text-3xl">Change password</h2>
      <PasswordForm />
    </div>
  );
}
