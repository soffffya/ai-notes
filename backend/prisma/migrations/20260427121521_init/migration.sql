/*
  Warnings:

  - A unique constraint covering the columns `[listId,noteId]` on the table `ListItem` will be added. If there are existing duplicate values, this will fail.
  - Made the column `categoryId` on table `Note` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Note" DROP CONSTRAINT "Note_categoryId_fkey";

-- AlterTable
ALTER TABLE "Note" ALTER COLUMN "categoryId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ListItem_listId_noteId_key" ON "ListItem"("listId", "noteId");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
