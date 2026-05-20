import { Module } from '@nestjs/common';
import { AiActionExecutor } from './ai-action.executor';
import { AiController } from './ai.controller';
import { AiDecisionEngine } from './ai-decision.engine';
import { AiPayloadHelper } from './ai-payload.helper';
import { AiUndoExecutor } from './ai-undo.executor';
import { AiService } from './ai.service';

@Module({
  controllers: [AiController],
  providers: [AiService, AiPayloadHelper, AiDecisionEngine, AiActionExecutor, AiUndoExecutor],
  exports: [AiService],
})
export class AiModule {}
