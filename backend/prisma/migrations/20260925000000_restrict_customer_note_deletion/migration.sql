ALTER TABLE `CustomerNote`
  DROP FOREIGN KEY `CustomerNote_customerId_fkey`;

ALTER TABLE `CustomerNote`
  ADD CONSTRAINT `CustomerNote_customerId_fkey`
  FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
