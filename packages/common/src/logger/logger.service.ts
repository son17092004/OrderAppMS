import { Injectable, LoggerService } from '@nestjs/common';

@Injectable()
export class JsonLogger implements LoggerService {
  private contextName?: string;

  setContext(context: string) {
    this.contextName = context;
  }

  private formatLog(level: string, message: any, context?: string, trace?: string) {
    const logObject = {
      timestamp: new Date().toISOString(),
      level,
      context: context || this.contextName,
      message: typeof message === 'object' ? message : { text: message },
      ...(trace && { trace }),
    };
    return JSON.stringify(logObject);
  }

  log(message: any, context?: string) {
    process.stdout.write(this.formatLog('info', message, context) + '\n');
  }

  error(message: any, trace?: string, context?: string) {
    process.stderr.write(this.formatLog('error', message, context, trace) + '\n');
  }

  warn(message: any, context?: string) {
    process.stdout.write(this.formatLog('warn', message, context) + '\n');
  }

  debug(message: any, context?: string) {
    process.stdout.write(this.formatLog('debug', message, context) + '\n');
  }

  verbose(message: any, context?: string) {
    process.stdout.write(this.formatLog('verbose', message, context) + '\n');
  }
}
