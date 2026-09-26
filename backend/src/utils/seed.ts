import "dotenv/config";

import type { Role as RoleType } from "@prisma/client";
import bcrypt from "bcryptjs";

import prisma from "../config/db";
import { Role } from "../constants/enums";

const password = "Password123!";

const users: Array<{
  name: string;
  email: string;
  role: RoleType;
}> = [
  {
    name: "Admin User",
    email: "admin@erp.test",
    role: Role.ADMIN
  },
  {
    name: "Sales User",
    email: "sales@erp.test",
    role: Role.SALES
  },
  {
    name: "Warehouse User",
    email: "warehouse@erp.test",
    role: Role.WAREHOUSE
  },
  {
    name: "Accounts User",
    email: "accounts@erp.test",
    role: Role.ACCOUNTS
  }
];

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.stockMovement.deleteMany();
  await prisma.challanItem.deleteMany();
  await prisma.salesChallan.deleteMany();
  await prisma.customerNote.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.createMany({
    data: users.map((user) => ({
      ...user,
      passwordHash
    }))
  });

  const userCount = await prisma.user.count();

  if (userCount !== users.length) {
    throw new Error(`Expected ${users.length} seeded users, found ${userCount}`);
  }

  console.log("Seeded users:");
  for (const user of users) {
    console.log(`${user.role}: ${user.email} / ${password}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
