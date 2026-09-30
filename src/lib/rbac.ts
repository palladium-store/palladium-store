import type { Role } from '@prisma/client';

export type Permission =
  | 'VIEW_ORDERS' | 'EDIT_ORDERS' | 'MANAGE_PRODUCTS' | 'MANAGE_INVENTORY'
  | 'VIEW_CUSTOMERS' | 'VIEW_REPORTS' | 'MANAGE_DISCOUNTS' | 'MANAGE_SETTINGS' | 'MANAGE_STAFF' | 'VIEW_AUDIT';

const ALL: Permission[] = ['VIEW_ORDERS', 'EDIT_ORDERS', 'MANAGE_PRODUCTS', 'MANAGE_INVENTORY', 'VIEW_CUSTOMERS', 'VIEW_REPORTS', 'MANAGE_DISCOUNTS', 'MANAGE_SETTINGS', 'MANAGE_STAFF', 'VIEW_AUDIT'];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  CUSTOMER: [],
  SUPER_ADMIN: ALL,
  ADMIN: ALL.filter((p) => p !== 'MANAGE_STAFF'),
  INVENTORY_MANAGER: ['MANAGE_PRODUCTS', 'MANAGE_INVENTORY', 'VIEW_ORDERS'],
  ORDER_MANAGER: ['VIEW_ORDERS', 'EDIT_ORDERS', 'VIEW_CUSTOMERS'],
  STAFF: ['VIEW_ORDERS', 'VIEW_CUSTOMERS'],
};
export const ROLE_LABELS: Record<Role, string> = {
  CUSTOMER: 'Customer', SUPER_ADMIN: 'Super Admin', ADMIN: 'Admin',
  INVENTORY_MANAGER: 'Inventory Manager', ORDER_MANAGER: 'Order Manager', STAFF: 'Staff',
};
export const STAFF_ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN', 'INVENTORY_MANAGER', 'ORDER_MANAGER', 'STAFF'];
export const can = (role: Role, p: Permission) => ROLE_PERMISSIONS[role]?.includes(p) ?? false;
export const isStaff = (role: Role) => role !== 'CUSTOMER';

// Which admin nav sections a role can see.
export const NAV: { href: string; label: string; perm: Permission | null }[] = [
  { href: '/admin', label: 'Dashboard', perm: null },
  { href: '/admin/orders', label: 'Orders', perm: 'VIEW_ORDERS' },
  { href: '/admin/products', label: 'Products', perm: 'MANAGE_PRODUCTS' },
  { href: '/admin/inventory', label: 'Inventory', perm: 'MANAGE_INVENTORY' },
  { href: '/admin/customers', label: 'Customers', perm: 'VIEW_CUSTOMERS' },
  { href: '/admin/discounts', label: 'Discounts', perm: 'MANAGE_DISCOUNTS' },
  { href: '/admin/reports', label: 'Reports', perm: 'VIEW_REPORTS' },
  { href: '/admin/analytics', label: 'Analytics', perm: 'VIEW_REPORTS' },
  { href: '/admin/marketing', label: 'Marketing', perm: 'MANAGE_DISCOUNTS' },
  { href: '/admin/content', label: 'Content', perm: 'MANAGE_SETTINGS' },
  { href: '/admin/settings', label: 'Settings', perm: 'MANAGE_SETTINGS' },
];
