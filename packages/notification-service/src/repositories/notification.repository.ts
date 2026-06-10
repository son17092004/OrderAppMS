import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotificationLog } from '../schemas/notification.schema';

@Injectable()
export class NotificationRepository {
  constructor(
    @InjectModel(NotificationLog.name)
    private readonly notificationModel: Model<NotificationLog>,
  ) {}

  async createLog(userId: string, orderId: string, type: string, content: string): Promise<NotificationLog> {
    const log = new this.notificationModel({
      userId,
      orderId,
      type,
      content,
    });
    return log.save();
  }

  async findLogsByUserId(userId: string): Promise<NotificationLog[]> {
    return this.notificationModel.find({ userId }).sort({ sentAt: -1 }).exec();
  }
}
