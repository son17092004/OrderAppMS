import { Controller, Get, UseGuards } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { StandardResponse, HttpAuthGuard, RolesGuard, Roles, User, AuthenticatedUser } from '@food-ordering/common';

@ApiTags('Notifications')
@Controller({ path: 'notifications', version: '1' })
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all notifications for the current customer (Customer only)' })
  @ApiResponse({ status: 200, description: 'List of user notifications retrieved successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Requires CUSTOMER role.' })
  async getNotifications(@User() user: AuthenticatedUser) {
    const logs = await this.notificationService.getUserNotifications(user.id);
    return StandardResponse.success('Notifications retrieved successfully', logs);
  }

  @EventPattern('NotificationRequested')
  async handleNotificationRequested(@Payload() message: any) {
    const data = typeof message === 'string' ? JSON.parse(message) : message;
    await this.notificationService.sendNotification(data.userId, data.orderId, data.type, data.content);
  }
}
