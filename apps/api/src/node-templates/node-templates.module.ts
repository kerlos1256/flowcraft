import { Module } from '@nestjs/common';
import { NodeTemplatesController } from './node-templates.controller';

@Module({ controllers: [NodeTemplatesController] })
export class NodeTemplatesModule {}
