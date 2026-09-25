import { Module } from '@nestjs/common';
import { EvaluationsController } from './evaluations.controller';
import { EvaluationsService } from './evaluations.service';
import { TemplatesModule } from '../templates/templates.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [TemplatesModule, AiModule],
  controllers: [EvaluationsController],
  providers: [EvaluationsService],
  exports: [EvaluationsService],
})
export class EvaluationsModule {}
