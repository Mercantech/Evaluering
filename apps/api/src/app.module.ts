import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { EvaluationsModule } from './evaluations/evaluations.module';
import { PublicModule } from './public/public.module';
import { TemplatesModule } from './templates/templates.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    EvaluationsModule,
    PublicModule,
    TemplatesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
