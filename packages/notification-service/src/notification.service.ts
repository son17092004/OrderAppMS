import { Injectable } from '@nestjs/common';
import { NotificationRepository } from './repositories/notification.repository';
import { JsonLogger } from '@food-ordering/common';

@Injectable()
export class NotificationService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly logger: JsonLogger,
  ) {
    this.logger.setContext(NotificationService.name);
  }

  async sendNotification(userId: string, orderId: string, type: 'EMAIL' | 'SMS', content: string): Promise<void> {
    this.logger.log(`Dispatching notification event: [Type: ${type}] [User: ${userId}] [Order: ${orderId}]`, 'Notify');
    this.logger.log(`Notification Content: "${content}"`, 'Notify');

    await this.notificationRepository.createLog(userId, orderId, type, content);
    this.logger.log(`Audit log stored in MongoDB for user ${userId}`, 'Notify');
  }

  async getUserNotifications(userId: string) {
    return this.notificationRepository.findLogsByUserId(userId);
  }
}
