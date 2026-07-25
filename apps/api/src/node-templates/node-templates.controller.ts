import { Controller, Get } from '@nestjs/common';
import { NODE_TEMPLATES, type NodeTemplateDto } from '@flowcraft/shared-types';

/** Serves the node-template registry that drives the palette + config forms. */
@Controller('node-templates')
export class NodeTemplatesController {
  @Get()
  list(): NodeTemplateDto[] {
    return NODE_TEMPLATES.map((t) => ({
      type: t.type,
      category: t.category,
      label: t.label,
      description: t.description,
      icon: t.icon,
      configSchema: t.configSchema,
    }));
  }
}
