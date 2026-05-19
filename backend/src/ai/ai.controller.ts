import { Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/types/authenticated-request';
import { AiService } from './ai.service';

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('analyze/:noteId')
  analyze(@Req() req: Request & AuthenticatedRequest, @Param('noteId') noteId: string) {
    const headerValue = req.headers['x-openai-api-key'];
    const apiKey = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    return this.aiService.analyzeNote(noteId, req.user.userId, apiKey);
  }

  @Post('apply/:actionLogId')
  applySuggestion(@Req() req: AuthenticatedRequest, @Param('actionLogId') actionLogId: string) {
    return this.aiService.applySuggestion(actionLogId, req.user.userId);
  }

  @Post('undo/:actionLogId')
  undo(@Req() req: AuthenticatedRequest, @Param('actionLogId') actionLogId: string) {
    return this.aiService.undoAction(actionLogId, req.user.userId);
  }
}
