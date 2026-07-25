import { Injectable } from '@nestjs/common';
import { WORKFLOW_RUN_EVENT, type WorkflowRunEventData } from '@flowcraft/shared-types';
import { inngest } from './client';

/** Thin injectable wrapper so services can send the run event without importing the client directly. */
@Injectable()
export class InngestService {
  async triggerRun(data: WorkflowRunEventData): Promise<void> {
    await inngest.send({ name: WORKFLOW_RUN_EVENT, data });
  }
}
