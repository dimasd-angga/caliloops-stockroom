import { InventoryItem, RecentSale } from './types';

export const inventoryItems: InventoryItem[] = [
  {
    id: 'item-1',
    name: 'Quantum Core Processor',
    stock: 150,
    price: 2499.99,
    location: 'Aisle 1, Shelf A',
    status: 'In Stock',
  },
  {
    id: 'item-2',
    name: 'Hyper-Threaded RAM (16GB)',
    stock: 45,
    price: 189.99,
    location: 'Aisle 1, Shelf B',
    status: 'In Stock',
  },
  {
    id: 'item-3',
    name: 'Graphene-Weave Cable',
    stock: 8,
    price: 29.99,
    location: 'Bin 24',
    status: 'Low Stock',
  },
  {
    id: 'item-4',
    name: 'Sentient AI Chip',
    stock: 0,
    price: 9999.99,
    location: 'Vault 7',
    status: 'Out of Stock',
  },
  {
    id: 'item-5',
    name: 'Cryo-Cooling Unit',
    stock: 72,
    price: 450.0,
    location: 'Aisle 3, Shelf C',
    status: 'In Stock',
  },
  {
    id: 'item-6',
    name: 'Holographic Display Unit',
    stock: 12,
    price: 1200.5,
    location: 'Aisle 5, Shelf A',
    status: 'Low Stock',
  },
  {
    id: 'item-7',
    name: 'Fusion Power Cell',
    stock: 300,
    price: 899.0,
    location: 'Restricted Area',
    status: 'In Stock',
  },
];

export const recentSales: RecentSale[] = [
  {
    id: 'sale-1',
    name: 'Olivia Martin',
    email: 'olivia.martin@email.com',
    amount: '+$1,999.00',
  },
  {
    id: 'sale-2',
    name: 'Jackson Lee',
    email: 'jackson.lee@email.com',
    amount: '+$39.00',
  },
  {
    id: 'sale-3',
    name: 'Isabella Nguyen',
    email: 'isabella.nguyen@email.com',
    amount: '+$299.00',
  },
  {
    id: 'sale-4',
    name: 'William Kim',
    email: 'will@email.com',
    amount: '+$99.00',
  },
  {
    id: 'sale-5',
    name: 'Sofia Davis',
    email: 'sofia.davis@email.com',
    amount: '+$39.00',
  },
];
