require("dotenv").config();

const bcrypt = require("bcryptjs");

const prisma = require("../config/db");

const password = "Password123!";

const users = [
  {
    name: "Admin User",
    email: "admin@erp.test",
    role: "ADMIN"
  },
  {
    name: "Sales User",
    email: "sales@erp.test",
    role: "SALES"
  },
  {
    name: "Warehouse User",
    email: "warehouse@erp.test",
    role: "WAREHOUSE"
  },
  {
    name: "Accounts User",
    email: "accounts@erp.test",
    role: "ACCOUNTS"
  }
];

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);

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
