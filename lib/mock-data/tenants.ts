import type { Tenant } from "@/types/tenant";

// Fictional tenants. Their tenancies are in ./tenancies.ts.
export const sampleTenants: Tenant[] = [
  {
    id: "tenant-priya-sharma",
    fullName: "Priya Sharma",
    phone: "+91 98450 21734",
    email: "priya.sharma@example.com",
    currentAddress: "14, 3rd Cross, Jayanagar 4th Block, Bengaluru, Karnataka 560011",
    emergencyContact: { name: "Anil Sharma", phone: "+91 98450 66120" },
  },
  {
    id: "tenant-karthik-nair",
    fullName: "Karthik Nair",
    phone: "+91 99001 48213",
    email: "karthik.nair@example.com",
    emergencyContact: { name: "Lakshmi Nair", phone: "+91 94470 31852" },
  },
  {
    id: "tenant-sneha-kulkarni",
    fullName: "Sneha Kulkarni",
    phone: "+91 97400 53318",
    email: "sneha.kulkarni@example.com",
  },
  {
    id: "tenant-rohan-das",
    fullName: "Rohan Das",
    phone: "+91 90080 72641",
    email: "rohan.das@example.com",
    currentAddress: "22, Lake Town, Block A, Kolkata, West Bengal 700089",
  },
  {
    id: "tenant-fatima-shaikh",
    fullName: "Fatima Shaikh",
    phone: "+91 98860 19457",
    email: "fatima.shaikh@example.com",
    emergencyContact: { name: "Imran Shaikh", phone: "+91 98860 40211" },
  },
  {
    id: "tenant-vikram-rao",
    fullName: "Vikram Rao",
    phone: "+91 98490 35562",
    email: "vikram.rao@example.com",
    emergencyContact: { name: "Sudha Rao", phone: "+91 98490 77103" },
  },
  {
    id: "tenant-meera-joshi",
    fullName: "Meera Joshi",
    phone: "+91 96520 84470",
    email: "meera.joshi@example.com",
  },
  {
    id: "tenant-ananya-iyer",
    fullName: "Ananya Iyer",
    phone: "+91 94400 61289",
    email: "ananya.iyer@example.com",
    currentAddress: "7, Venkatanarayana Road, T. Nagar, Chennai, Tamil Nadu 600017",
  },
  {
    id: "tenant-rahul-verma",
    fullName: "Rahul Verma",
    phone: "+91 98220 47716",
    email: "rahul.verma@example.com",
    emergencyContact: { name: "Neha Verma", phone: "+91 98220 90354" },
  },
  {
    id: "tenant-aditi-menon",
    fullName: "Aditi Menon",
    phone: "+91 97300 28845",
    email: "aditi.menon@example.com",
  },
  {
    id: "tenant-arjun-mehta",
    fullName: "Arjun Mehta",
    phone: "+91 99450 13027",
    email: "arjun.mehta@example.com",
    currentAddress: "B-504, Sea Breeze Apartments, Andheri West, Mumbai, Maharashtra 400053",
  },
];
