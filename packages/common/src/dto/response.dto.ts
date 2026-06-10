export class StandardResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  timestamp: string;

  constructor(success: boolean, message: string, data?: T) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.timestamp = new Date().toISOString();
  }

  static success<T>(message: string, data?: T): StandardResponse<T> {
    return new StandardResponse(true, message, data);
  }

  static error<T>(message: string, data?: T): StandardResponse<T> {
    return new StandardResponse(false, message, data);
  }
}
