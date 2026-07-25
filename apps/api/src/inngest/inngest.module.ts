import { Global, Module } from '@nestjs/common';
import { InngestService } from './inngest.service';

/** Provides InngestService app-wide. The serve handler is mounted in main.ts. */
@Global()
@Module({
  providers: [InngestService],
  exports: [InngestService],
})
export class InngestModule {}
