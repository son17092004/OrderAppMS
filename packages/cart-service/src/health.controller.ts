import { Controller, Get, Header, Inject, InternalServerErrorException } from '@nestjs/common';
import Redis from 'ioredis';

@Controller()
export class HealthController {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  @Get('health')
  async health() {
    try {
      const redisPing = await this.redis.ping();
      if (redisPing === 'PONG') {
        return {
          status: 'UP',
          redis: 'connected',
          timestamp: new Date().toISOString(),
        };
      } else {
        throw new InternalServerErrorException({
          status: 'DOWN',
          redis: 'disconnected',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      throw new InternalServerErrorException({
        status: 'DOWN',
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      });
    }
  }

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4')
  metrics() {
    const memory = process.memoryUsage();
    return [
      '# HELP process_cpu_user_seconds_total Total user CPU time spent in seconds.',
      '# TYPE process_cpu_user_seconds_total counter',
      `process_cpu_user_seconds_total ${process.cpuUsage().user / 1000000}`,
      '# HELP process_memory_rss_bytes Resident set size in bytes.',
      '# TYPE process_memory_rss_bytes gauge',
      `process_memory_rss_bytes ${memory.rss}`,
      '# HELP process_memory_heap_used_bytes Heap used size in bytes.',
      '# TYPE process_memory_heap_used_bytes gauge',
      `process_memory_heap_used_bytes ${memory.heapUsed}`
    ].join('\n') + '\n';
  }
}
