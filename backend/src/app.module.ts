import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { HealthModule } from './health/health.module';
import { ListsModule } from './lists/lists.module';
import { NotesModule } from './notes/notes.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    AuthModule,
    NotesModule,
    CategoriesModule,
    ListsModule,
    AiModule,
  ],
})
export class AppModule {}
