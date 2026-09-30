import { customerGuard } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { AddressManager } from '@/components/store/address-manager';

export const dynamic = 'force-dynamic';

export default async function AddressesPage() {
  const { customer } = await customerGuard('/account/addresses');
  const rows = await prisma.address.findMany({ where: { customerId: customer.id }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] });
  const addresses = rows.map((a) => ({ id: a.id, label: a.label, recipient: a.recipient, phone: a.phone, line1: a.line1, barangay: a.barangay, city: a.city, province: a.province, postalCode: a.postalCode, isDefault: a.isDefault }));
  return (
    <div>
      <h2 className="h-display mb-6 text-2xl sm:text-3xl">Addresses</h2>
      <AddressManager addresses={addresses} defaultName={customer.name} defaultPhone={customer.phone ?? ''} />
    </div>
  );
}
