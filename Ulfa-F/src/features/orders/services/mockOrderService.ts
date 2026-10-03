import type { MerchantUser } from '../../dashboard/types';
import type {
  CreateOrderPayload,
  OrdersQueryParams,
  OrdersSummary,
  PaginatedOrdersResponse,
  SystemOrder,
  UpdateOrderPayload,
} from '../types';

const STORAGE_KEY = 'ulfa_temporary_mock_orders_v1';

export const mockMerchants: MerchantUser[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    companyName: 'متجر الورد',
    email: 'flowers@ulfa.test',
    role: 'MERCHANT',
    isUnlimitedQuota: false,
    totalQuota: 500,
    usedLinks: 86,
    status: 'ACTIVE',
    createdAt: '2026-01-15T09:00:00.000Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    companyName: 'بيت الهدايا',
    email: 'gifts@ulfa.test',
    role: 'MERCHANT',
    isUnlimitedQuota: false,
    totalQuota: 300,
    usedLinks: 142,
    status: 'ACTIVE',
    createdAt: '2026-02-03T09:00:00.000Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    companyName: 'لمسة فرح',
    email: 'joy@ulfa.test',
    role: 'MERCHANT',
    isUnlimitedQuota: false,
    totalQuota: 250,
    usedLinks: 54,
    status: 'ACTIVE',
    createdAt: '2026-03-20T09:00:00.000Z',
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    companyName: 'Memories Studio',
    email: 'memories@ulfa.test',
    role: 'MERCHANT',
    isUnlimitedQuota: true,
    totalQuota: 0,
    usedLinks: 318,
    status: 'ACTIVE',
    createdAt: '2026-04-08T09:00:00.000Z',
  },
];

const INITIAL_ORDERS: SystemOrder[] = [
  {
    id: 'a1000000-0000-4000-8000-000000000001',
    customerPhone: '+970591000001',
    externalOrderId: 'ORD-2026-1048',
    customerName: 'سارة خالد',
    status: 'PENDING',
    createdAt: '2026-08-12T08:35:00.000Z',
    merchant: mockMerchants[0],
    nfcItems: [],
  },
  {
    id: 'a1000000-0000-4000-8000-000000000002',
    customerPhone: '+970591000002',
    externalOrderId: 'ORD-2026-1047',
    customerName: 'محمد نصار',
    status: 'PENDING',
    createdAt: '2026-08-12T07:10:00.000Z',
    merchant: mockMerchants[1],
    nfcItems: [
      {
        id: 'b1000000-0000-4000-8000-000000000001',
        productName: 'Memory Bracelet',
        nfcId: 'NFC-DEMO-1047-A',
        isLocked: false,
        createdAt: '2026-08-12T07:20:00.000Z',
      },
      {
        id: 'b1000000-0000-4000-8000-000000000002',
        productName: 'Gift Card',
        nfcId: 'NFC-DEMO-1047-B',
        isLocked: false,
        createdAt: '2026-08-12T07:22:00.000Z',
      },
    ],
  },
  {
    id: 'a1000000-0000-4000-8000-000000000003',
    customerPhone: '+970591000003',
    externalOrderId: 'ORD-2026-1046',
    customerName: 'ليان أحمد',
    status: 'COMPLETED',
    createdAt: '2026-08-11T16:42:00.000Z',
    merchant: mockMerchants[2],
    nfcItems: [
      {
        id: 'b1000000-0000-4000-8000-000000000003',
        productName: 'Love Letter Card',
        nfcId: 'NFC-DEMO-1046',
        isLocked: true,
        createdAt: '2026-08-11T17:00:00.000Z',
      },
    ],
  },
  {
    id: 'a1000000-0000-4000-8000-000000000004',
    customerPhone: '+970591000004',
    externalOrderId: 'WEB-8831',
    customerName: 'Omar Saleh',
    status: 'COMPLETED',
    createdAt: '2026-08-11T12:15:00.000Z',
    merchant: mockMerchants[3],
    nfcItems: [
      {
        id: 'b1000000-0000-4000-8000-000000000004',
        productName: 'Digital Memory Frame',
        nfcId: 'NFC-DEMO-8831',
        isLocked: false,
        createdAt: '2026-08-11T12:40:00.000Z',
      },
    ],
  },
  {
    id: 'a1000000-0000-4000-8000-000000000005',
    customerPhone: '+970591000005',
    externalOrderId: 'ORD-2026-1044',
    customerName: 'نور حجازي',
    status: 'PENDING',
    createdAt: '2026-08-10T14:05:00.000Z',
    merchant: mockMerchants[0],
    nfcItems: [],
  },
  {
    id: 'a1000000-0000-4000-8000-000000000006',
    customerPhone: '+970591000006',
    externalOrderId: 'ORD-2026-1043',
    customerName: 'ريم عادل',
    status: 'PENDING',
    createdAt: '2026-08-10T09:30:00.000Z',
    merchant: mockMerchants[1],
    nfcItems: [
      {
        id: 'b1000000-0000-4000-8000-000000000006',
        productName: 'Birthday NFC Card',
        nfcId: 'NFC-DEMO-1043',
        isLocked: false,
        createdAt: '2026-08-10T09:45:00.000Z',
      },
    ],
  },
  {
    id: 'a1000000-0000-4000-8000-000000000007',
    customerPhone: '+970591000007',
    externalOrderId: 'POS-5712',
    customerName: 'Yousef Ali',
    status: 'COMPLETED',
    createdAt: '2026-08-09T18:20:00.000Z',
    merchant: mockMerchants[3],
    nfcItems: [
      {
        id: 'b1000000-0000-4000-8000-000000000007',
        productName: 'Photo Keychain',
        nfcId: 'NFC-DEMO-5712',
        isLocked: false,
        createdAt: '2026-08-09T18:35:00.000Z',
      },
    ],
  },
  {
    id: 'a1000000-0000-4000-8000-000000000008',
    customerPhone: '+970591000008',
    externalOrderId: 'ORD-2026-1041',
    customerName: 'ميس قاسم',
    status: 'PENDING',
    createdAt: '2026-08-09T10:12:00.000Z',
    merchant: mockMerchants[2],
    nfcItems: [],
  },
  {
    id: 'a1000000-0000-4000-8000-000000000009',
    customerPhone: '+970591000009',
    externalOrderId: 'ORD-2026-1040',
    customerName: 'رنا سمير',
    status: 'COMPLETED',
    createdAt: '2026-08-08T15:50:00.000Z',
    merchant: mockMerchants[0],
    nfcItems: [],
  },
  {
    id: 'a1000000-0000-4000-8000-000000000010',
    customerPhone: '+970591000010',
    externalOrderId: 'WEB-8824',
    customerName: 'Dana Nasser',
    status: 'PENDING',
    createdAt: '2026-08-08T11:05:00.000Z',
    merchant: mockMerchants[3],
    nfcItems: [],
  },
  {
    id: 'a1000000-0000-4000-8000-000000000011',
    customerPhone: '+970591000011',
    externalOrderId: 'ORD-2026-1038',
    customerName: 'أحمد مراد',
    status: 'PENDING',
    createdAt: '2026-08-07T13:25:00.000Z',
    merchant: mockMerchants[1],
    nfcItems: [],
  },
  {
    id: 'a1000000-0000-4000-8000-000000000012',
    customerPhone: '+970591000012',
    externalOrderId: 'ORD-2026-1037',
    customerName: 'هبة إبراهيم',
    status: 'COMPLETED',
    createdAt: '2026-08-06T08:55:00.000Z',
    merchant: mockMerchants[2],
    nfcItems: [],
  },
];

const cloneInitialOrders = (): SystemOrder[] =>
  JSON.parse(JSON.stringify(INITIAL_ORDERS)) as SystemOrder[];

const readOrders = (): SystemOrder[] => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    const initialOrders = cloneInitialOrders();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialOrders));
    return initialOrders;
  }

  try {
    const orders = JSON.parse(saved) as Array<SystemOrder & { status: string }>;
    const normalizedOrders = orders.map((order) => ({
      ...order,
      status: order.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING',
    })) as SystemOrder[];
    writeOrders(normalizedOrders);
    return normalizedOrders;
  } catch {
    const initialOrders = cloneInitialOrders();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialOrders));
    return initialOrders;
  }
};

const writeOrders = (orders: SystemOrder[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
};

const getSummary = (orders: SystemOrder[]): OrdersSummary => ({
  total: orders.length,
  pending: orders.filter((order) => order.status === 'PENDING').length,
  completed: orders.filter((order) => order.status === 'COMPLETED').length,
});

const waitForUi = async () => {
  await new Promise((resolve) => window.setTimeout(resolve, 180));
};

export const mockOrderService = {
  getMerchants: () => mockMerchants,

  resetOrders: () => {
    writeOrders(cloneInitialOrders());
  },

  async getOrders(params: OrdersQueryParams): Promise<PaginatedOrdersResponse> {
    await waitForUi();
    const allOrders = readOrders();
    let filtered = [...allOrders];
    const search = params.search?.toLowerCase();

    if (search) {
      filtered = filtered.filter((order) =>
        [
          order.id,
          order.externalOrderId,
          order.customerName,
          order.customerPhone,
          order.merchant?.companyName,
          order.merchant?.email,
        ].some((value) => value?.toLowerCase().includes(search)),
      );
    }

    if (params.status) {
      filtered = filtered.filter((order) => order.status === params.status);
    }

    if (params.merchantId) {
      filtered = filtered.filter((order) => order.merchant?.id === params.merchantId);
    }

    if (params.dateFrom) {
      const from = new Date(params.dateFrom).getTime();
      filtered = filtered.filter((order) => new Date(order.createdAt).getTime() >= from);
    }

    if (params.dateTo) {
      const to = new Date(params.dateTo).getTime();
      filtered = filtered.filter((order) => new Date(order.createdAt).getTime() <= to);
    }

    filtered.sort(
      (first, second) =>
        new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
    );

    const page = params.page || 1;
    const limit = params.limit || 10;
    const start = (page - 1) * limit;

    return {
      items: filtered.slice(start, start + limit),
      meta: {
        total: filtered.length,
        page,
        limit,
        totalPages: Math.max(Math.ceil(filtered.length / limit), 1),
      },
      summary: getSummary(allOrders),
    };
  },

  async getOrder(orderId: string): Promise<SystemOrder> {
    await waitForUi();
    const order = readOrders().find((item) => item.id === orderId);
    if (!order) throw new Error('Mock order not found');
    return order;
  },

  async createOrder(payload: CreateOrderPayload): Promise<SystemOrder> {
    await waitForUi();
    const orders = readOrders();
    const merchant = mockMerchants.find((item) => item.id === payload.merchantId);
    if (!merchant) throw new Error('Mock merchant not found');

    const order: SystemOrder = {
      id: crypto.randomUUID(),
      externalOrderId: payload.externalOrderId,
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      status: payload.status || 'PENDING',
      createdAt: new Date().toISOString(),
      merchant,
      nfcItems: [],
    };
    writeOrders([order, ...orders]);
    return order;
  },

  async updateOrder(orderId: string, payload: UpdateOrderPayload): Promise<SystemOrder> {
    await waitForUi();
    const orders = readOrders();
    const index = orders.findIndex((item) => item.id === orderId);
    if (index < 0) throw new Error('Mock order not found');

    const merchant = payload.merchantId
      ? mockMerchants.find((item) => item.id === payload.merchantId)
      : orders[index].merchant;
    const updatedOrder = { ...orders[index], ...payload, merchant };
    delete (updatedOrder as SystemOrder & { merchantId?: string }).merchantId;
    orders[index] = updatedOrder;
    writeOrders(orders);
    return updatedOrder;
  },

  async deleteOrder(orderId: string): Promise<void> {
    await waitForUi();
    writeOrders(readOrders().filter((order) => order.id !== orderId));
  },
};
