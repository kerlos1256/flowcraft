import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { InngestModule } from './inngest/inngest.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { RunsModule } from './runs/runs.module';
import { NodeTemplatesModule } from './node-templates/node-templates.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    PrismaModule,
    InngestModule,
    WorkflowsModule,
    RunsModule,
    NodeTemplatesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
