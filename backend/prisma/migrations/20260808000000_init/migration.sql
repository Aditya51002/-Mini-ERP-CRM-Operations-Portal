CREATE TABLE `User` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `passwordHash` VARCHAR(191) NOT NULL,
  `role` ENUM('ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS') NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `User_email_key`(`email`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Customer` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `mobile` VARCHAR(191) NULL,
  `email` VARCHAR(191) NULL,
  `businessName` VARCHAR(191) NULL,
  `gstNumber` VARCHAR(191) NULL,
  `customerType` ENUM('RETAIL', 'WHOLESALE', 'DISTRIBUTOR') NOT NULL DEFAULT 'RETAIL',
  `address` VARCHAR(191) NULL,
  `status` ENUM('LEAD', 'ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'LEAD',
  `followUpDate` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomerNote` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `customerId` INTEGER NOT NULL,
  `note` VARCHAR(191) NOT NULL,
  `createdById` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `CustomerNote_customerId_idx`(`customerId`),
  INDEX `CustomerNote_createdById_idx`(`createdById`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Product` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `sku` VARCHAR(191) NOT NULL,
  `category` VARCHAR(191) NULL,
  `unitPrice` DECIMAL(12, 2) NOT NULL,
  `currentStock` INTEGER NOT NULL DEFAULT 0,
  `minStockAlert` INTEGER NOT NULL DEFAULT 0,
  `location` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Product_sku_key`(`sku`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `StockMovement` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `productId` INTEGER NOT NULL,
  `quantity` INTEGER NOT NULL,
  `movementType` ENUM('IN', 'OUT') NOT NULL,
  `reason` VARCHAR(191) NOT NULL,
  `createdById` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `StockMovement_productId_idx`(`productId`),
  INDEX `StockMovement_createdById_idx`(`createdById`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SalesChallan` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `challanNumber` VARCHAR(191) NOT NULL,
  `customerId` INTEGER NOT NULL,
  `totalQuantity` INTEGER NOT NULL DEFAULT 0,
  `status` ENUM('DRAFT', 'CONFIRMED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `createdById` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `SalesChallan_challanNumber_key`(`challanNumber`),
  INDEX `SalesChallan_customerId_idx`(`customerId`),
  INDEX `SalesChallan_createdById_idx`(`createdById`),
  INDEX `SalesChallan_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ChallanItem` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `challanId` INTEGER NOT NULL,
  `productId` INTEGER NOT NULL,
  `productNameSnapshot` VARCHAR(191) NOT NULL,
  `skuSnapshot` VARCHAR(191) NOT NULL,
  `unitPriceSnapshot` DECIMAL(12, 2) NOT NULL,
  `quantity` INTEGER NOT NULL,
  INDEX `ChallanItem_challanId_idx`(`challanId`),
  INDEX `ChallanItem_productId_idx`(`productId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CustomerNote`
  ADD CONSTRAINT `CustomerNote_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `CustomerNote_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `StockMovement`
  ADD CONSTRAINT `StockMovement_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `StockMovement_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `SalesChallan`
  ADD CONSTRAINT `SalesChallan_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `SalesChallan_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ChallanItem`
  ADD CONSTRAINT `ChallanItem_challanId_fkey` FOREIGN KEY (`challanId`) REFERENCES `SalesChallan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ChallanItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
