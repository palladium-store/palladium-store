import { customerGuard } from '@/lib/guard';
import { ProfileForm } from '@/components/store/account-forms';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const { customer, user } = await customerGuard('/account/profile');
  return (
    <div>
      <h2 className="h-display mb-6 text-2xl sm:text-3xl">Profile</h2>
      <ProfileForm name={customer.name} phone={customer.phone ?? ''} email={user.email} />
    </div>
  );
}
