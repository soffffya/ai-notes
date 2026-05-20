import { Injectable } from '@nestjs/common';
import { AiActionType, type AiActionLog } from '@prisma/client';
import type { AiModelDecision } from './ai.types';

type JsonRecord = Record<string, unknown>;

@Injectable()
export class AiPayloadHelper {
  asRecord(payload: unknown): JsonRecord {
    return payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as JsonRecord)
      : {};
  }

  toDecision(actionLog: AiActionLog): AiModelDecision {
    const payload = this.asRecord(actionLog.payloadJson);

    return {
      action:
        actionLog.type === AiActionType.SUGGEST_CATEGORY
          ? 'assign_category'
          : actionLog.type === AiActionType.SUGGEST_LIST
            ? 'add_to_list'
            : 'none',
      confidence: actionLog.confidence,
      categoryId: this.asOptionalString(payload.categoryId),
      listId: this.asOptionalString(payload.listId),
      itemText: this.asOptionalString(payload.itemText),
      reason: this.asOptionalString(payload.reason) ?? 'Suggestion applied manually',
    };
  }

  appendAppliedAt(payload: unknown, appliedAt = new Date().toISOString()) {
    return {
      ...this.asRecord(payload),
      appliedAt,
    };
  }

  getPreviousCategoryId(payload: unknown) {
    return this.asOptionalString(this.asRecord(payload).previousCategoryId);
  }

  getListUndoPayload(payload: unknown) {
    const record = this.asRecord(payload);

    return {
      listId: this.asOptionalString(record.listId),
      listItemId: this.asOptionalString(record.listItemId),
    };
  }

  private asOptionalString(value: unknown) {
    return typeof value === 'string' ? value : null;
  }
}
