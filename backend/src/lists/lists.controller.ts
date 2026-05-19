import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/types/authenticated-request';
import { CreateListDto } from './dto/create-list.dto';
import { CreateListItemDto } from './dto/create-list-item.dto';
import { ReorderListItemsDto } from './dto/reorder-list-items.dto';
import { UpdateListItemDto } from './dto/update-list-item.dto';
import { ListsService } from './lists.service';

@UseGuards(JwtAuthGuard)
@Controller('lists')
export class ListsController {
  constructor(private readonly listsService: ListsService) {}

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.listsService.findAll(req.user.userId);
  }

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateListDto) {
    return this.listsService.create(req.user.userId, dto);
  }

  @Post(':id/items')
  addItem(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: CreateListItemDto) {
    return this.listsService.addItem(req.user.userId, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.listsService.remove(req.user.userId, id);
  }

  @Patch(':id/items/reorder')
  reorderItems(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ReorderListItemsDto,
  ) {
    return this.listsService.reorderItems(req.user.userId, id, dto);
  }

  @Patch(':listId/items/:itemId')
  updateItem(
    @Req() req: AuthenticatedRequest,
    @Param('listId') listId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateListItemDto,
  ) {
    return this.listsService.updateItem(req.user.userId, listId, itemId, dto);
  }

  @Delete(':listId/items/:itemId')
  removeItem(@Req() req: AuthenticatedRequest, @Param('listId') listId: string, @Param('itemId') itemId: string) {
    return this.listsService.removeItem(req.user.userId, listId, itemId);
  }
}
