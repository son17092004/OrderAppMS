import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'notifications' })
export class NotificationLog extends Document {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  orderId: string;

  @Prop({ required: true, enum: ['EMAIL', 'SMS'] })
  type: string;

  @Prop({ required: true })
  content: string;

  @Prop({ default: Date.now })
  sentAt: Date;
}

export const NotificationLogSchema = SchemaFactory.createForClass(NotificationLog);
