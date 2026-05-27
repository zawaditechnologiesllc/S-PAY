export const DEMO_USER = {
  id: "demo-user-001",
  email: "demo@spayewallet.com",
  fullName: "Alex Johnson",
  phoneNumber: "+1 555 123 4567",
  kycStatus: "approved" as const,
  celoWalletAddress: "0x1234567890abcdef1234567890abcdef12345678",
  createdAt: new Date("2024-01-15T10:00:00Z"),
};

export const DEMO_BALANCE = {
  balance: 1245.60,
  availableBalance: 1245.60,
  currency: "USD",
  celoAddress: "0x1234567890abcdef1234567890abcdef12345678",
  usdcBalance: 1245.60,
  usdtBalance: 0,
};

export const DEMO_TRANSACTIONS = [
  {
    id: "tx-001",
    type: "payment" as const,
    amount: 45.80,
    currency: "USD",
    description: "Paid to Amazon",
    counterparty: "Amazon",
    status: "completed" as const,
    createdAt: new Date("2025-05-22T10:45:00Z"),
  },
  {
    id: "tx-002",
    type: "receive" as const,
    amount: 200.00,
    currency: "USD",
    description: "Received from John Doe",
    counterparty: "John Doe",
    status: "completed" as const,
    createdAt: new Date("2025-05-21T20:15:00Z"),
  },
  {
    id: "tx-003",
    type: "recharge" as const,
    amount: 15.00,
    currency: "USD",
    description: "Mobile Recharge",
    counterparty: "Airtime",
    status: "completed" as const,
    createdAt: new Date("2025-05-21T18:30:00Z"),
  },
  {
    id: "tx-004",
    type: "send" as const,
    amount: 50.00,
    currency: "USD",
    description: "Sent to Maria Garcia",
    counterparty: "Maria Garcia",
    status: "completed" as const,
    createdAt: new Date("2025-05-20T14:00:00Z"),
  },
  {
    id: "tx-005",
    type: "receive" as const,
    amount: 1200.00,
    currency: "USD",
    description: "Salary from TechNova Inc.",
    counterparty: "TechNova Inc.",
    status: "completed" as const,
    createdAt: new Date("2025-05-19T09:00:00Z"),
  },
];

export const DEMO_BANK_ACCOUNTS = [
  {
    id: "acc-001",
    currency: "USD",
    accountType: "ach" as const,
    accountNumber: "123456789",
    routingNumber: "021000021",
    bankName: "S-PAY Bank (via Noah)",
    availableBalance: 7245.30,
    status: "active" as const,
  },
  {
    id: "acc-002",
    currency: "EUR",
    accountType: "sepa" as const,
    iban: "DE89370400440532013000",
    bankName: "S-PAY EUR Account (via Noah)",
    availableBalance: 2600.00,
    status: "active" as const,
  },
];

export const DEMO_INCOMING_PAYMENTS = [
  {
    id: "inc-001",
    amount: 2500.00,
    currency: "USD",
    sender: "Acme Inc.",
    paymentType: "ach" as const,
    status: "completed" as const,
    createdAt: new Date("2025-05-22T10:15:00Z"),
  },
  {
    id: "inc-002",
    amount: 1850.00,
    currency: "EUR",
    sender: "Global Ltd.",
    paymentType: "wire" as const,
    status: "completed" as const,
    createdAt: new Date("2025-05-21T19:45:00Z"),
  },
  {
    id: "inc-003",
    amount: 1900.00,
    currency: "USD",
    sender: "Tech Solutions",
    paymentType: "ach" as const,
    status: "completed" as const,
    createdAt: new Date("2025-05-20T09:30:00Z"),
  },
];

export const DEMO_CARD = {
  hasCard: true,
  isComingSoon: true,
  cards: [
    {
      id: "card-001",
      last4: "4567",
      network: "visa" as const,
      expiryMonth: 12,
      expiryYear: 2027,
      isPrimary: true,
      status: "active" as const,
      cardType: "virtual" as const,
      label: "S-PAY Visa",
    },
    {
      id: "card-002",
      last4: "7812",
      network: "mastercard" as const,
      expiryMonth: 8,
      expiryYear: 2026,
      isPrimary: false,
      status: "active" as const,
      cardType: "virtual" as const,
      label: "S-PAY Mastercard",
    },
  ],
  totalBalance: 1245.60,
  currency: "USD",
  cardStatus: "coming_soon" as const,
};

export const DEMO_CARD_TRANSACTIONS = [
  {
    id: "ctxn-001",
    merchantName: "Amazon.com",
    merchantLogo: null,
    amount: 45.80,
    currency: "USD",
    category: "Shopping",
    status: "approved" as const,
    createdAt: new Date("2025-05-22T10:45:00Z"),
  },
  {
    id: "ctxn-002",
    merchantName: "Starbucks",
    merchantLogo: null,
    amount: 6.75,
    currency: "USD",
    category: "Food & Dining",
    status: "approved" as const,
    createdAt: new Date("2025-05-21T08:30:00Z"),
  },
  {
    id: "ctxn-003",
    merchantName: "Uber",
    merchantLogo: null,
    amount: 18.40,
    currency: "USD",
    category: "Transport",
    status: "approved" as const,
    createdAt: new Date("2025-05-20T18:12:00Z"),
  },
];

export const DEMO_SPENDING_SUMMARY = {
  period: "this_month",
  totalSpent: 1245.60,
  categories: [
    { category: "Shopping", amount: 620.40, percentage: 49.8, color: "#4DC9EE" },
    { category: "Food & Dining", amount: 310.20, percentage: 24.9, color: "#A8DEFF" },
    { category: "Transport", amount: 180.60, percentage: 14.5, color: "#1A2B4A" },
    { category: "Others", amount: 134.40, percentage: 10.8, color: "#94A3B8" },
  ],
};

export const ADMIN_STATS = {
  totalUsers: 1847,
  activeUsers: 1203,
  totalTransactionVolume: 284750.40,
  transactionsToday: 47,
  pendingKyc: 23,
  approvedKyc: 1620,
  rejectedKyc: 204,
  totalWalletBalance: 284750.40,
};

export const MOCK_USERS = [
  { id: "usr-001", email: "alex@example.com", fullName: "Alex Johnson", kycStatus: "approved", country: "Kenya", walletBalance: 1245.60, createdAt: new Date("2024-01-15T10:00:00Z") },
  { id: "usr-002", email: "maria@example.com", fullName: "Maria Garcia", kycStatus: "pending", country: "Brazil", walletBalance: 450.20, createdAt: new Date("2024-02-20T08:00:00Z") },
  { id: "usr-003", email: "james@example.com", fullName: "James Okonkwo", kycStatus: "approved", country: "Nigeria", walletBalance: 2100.00, createdAt: new Date("2024-03-05T14:00:00Z") },
  { id: "usr-004", email: "aisha@example.com", fullName: "Aisha Patel", kycStatus: "rejected", country: "India", walletBalance: 0, createdAt: new Date("2024-03-18T09:00:00Z") },
  { id: "usr-005", email: "li.wei@example.com", fullName: "Li Wei", kycStatus: "approved", country: "Philippines", walletBalance: 870.50, createdAt: new Date("2024-04-01T11:00:00Z") },
  { id: "usr-006", email: "sofia@example.com", fullName: "Sofia Herrera", kycStatus: "pending", country: "Mexico", walletBalance: 320.00, createdAt: new Date("2024-04-12T16:00:00Z") },
  { id: "usr-007", email: "kwame@example.com", fullName: "Kwame Mensah", kycStatus: "approved", country: "Ghana", walletBalance: 1580.75, createdAt: new Date("2024-05-01T10:00:00Z") },
  { id: "usr-008", email: "rina@example.com", fullName: "Rina Tanaka", kycStatus: "pending", country: "Indonesia", walletBalance: 95.30, createdAt: new Date("2024-05-20T12:00:00Z") },
];

export const MOCK_ALL_TRANSACTIONS = [
  { id: "atx-001", type: "receive", amount: 500, currency: "USD", description: "Received from client", counterparty: "Acme Corp", status: "completed", createdAt: new Date("2025-05-22T10:00:00Z") },
  { id: "atx-002", type: "send", amount: 120.50, currency: "USD", description: "Sent to Maria Garcia", counterparty: "Maria Garcia", status: "completed", createdAt: new Date("2025-05-21T14:30:00Z") },
  { id: "atx-003", type: "withdraw", amount: 200, currency: "USD", description: "M-Pesa withdrawal", counterparty: "Safaricom", status: "completed", createdAt: new Date("2025-05-21T09:15:00Z") },
  { id: "atx-004", type: "payment", amount: 45.80, currency: "USD", description: "Amazon purchase", counterparty: "Amazon", status: "completed", createdAt: new Date("2025-05-20T18:00:00Z") },
  { id: "atx-005", type: "receive", amount: 1200, currency: "USD", description: "Freelance payment", counterparty: "Upwork", status: "completed", createdAt: new Date("2025-05-19T11:00:00Z") },
  { id: "atx-006", type: "send", amount: 50, currency: "USD", description: "Sent to James", counterparty: "James Okonkwo", status: "pending", createdAt: new Date("2025-05-19T08:00:00Z") },
  { id: "atx-007", type: "recharge", amount: 20, currency: "USD", description: "Airtime top-up", counterparty: "Airtel", status: "completed", createdAt: new Date("2025-05-18T15:00:00Z") },
  { id: "atx-008", type: "withdraw", amount: 300, currency: "USD", description: "SEPA transfer", counterparty: "Deutsche Bank", status: "completed", createdAt: new Date("2025-05-17T13:00:00Z") },
  { id: "atx-009", type: "receive", amount: 750, currency: "USD", description: "Consulting payment", counterparty: "Toptal", status: "completed", createdAt: new Date("2025-05-16T10:00:00Z") },
  { id: "atx-010", type: "payment", amount: 18.40, currency: "USD", description: "Uber ride", counterparty: "Uber", status: "completed", createdAt: new Date("2025-05-15T19:30:00Z") },
];
