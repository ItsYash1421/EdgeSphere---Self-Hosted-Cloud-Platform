import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CdnModule } from "./cdn/cdn.module";
import { CacheModule } from "./cache/cache.module";
import { MetricsModule } from "./metrics/metrics.module";
import { HealthModule } from "./health/health.module";
import { GeoModule } from "./geo/geo.module";
import { EventsModule } from "./events/events.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CacheModule,
    MetricsModule,
    GeoModule,
    CdnModule,
    HealthModule,
    EventsModule,
  ],
})
export class AppModule {}
