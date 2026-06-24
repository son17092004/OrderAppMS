import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { DeliveryRepository } from './repositories/delivery.repository';
import { DeliveryStatus, Delivery } from './entities/delivery.entity';
import {
  DeliveryAssignedEvent,
  DeliveryCompletedEvent,
  DeliveryFailedEvent,
  JsonLogger
} from '@food-ordering/common';

@Injectable()
export class DeliveryService {
  constructor(
    private readonly deliveryRepository: DeliveryRepository,
    @Inject('KAFKA_CLIENT') private readonly kafkaClient: ClientKafka,
    private readonly logger: JsonLogger,
  ) {
    this.logger.setContext(DeliveryService.name);
  }

  // Tự động bổ sung thông tin Nhà hàng / Khách hàng / Địa chỉ từ order-service cho các bản ghi cũ (Self-healing data)
  async enrichDeliveries(deliveries: Delivery[]): Promise<Delivery[]> {
    await Promise.all(
      deliveries.map(async (delivery) => {
        // BUG-H1 Fix: enrichment nếu thiếu bất kỳ trường nào HOẶC còn là fallback default
        const needsEnrich =
          !delivery.restaurantName ||
          !delivery.userEmail ||
          !delivery.deliveryAddress ||
          delivery.deliveryAddress === 'No Address Provided';

        if (needsEnrich) {
          this.logger.log(`Enriching missing details for Delivery ${delivery.id} (Order ${delivery.orderId})...`, 'DataRecovery');
          try {
            const res = await fetch(`http://order-service:3004/v1/orders/internal/${delivery.orderId}`);
            if (res.ok) {
              const data = await res.json() as any;
              if (data && data.data) {
                const restId = data.data.restaurantId;
                const restName = data.data.restaurantName;
                const usrId = data.data.userId;
                const usrEmail = data.data.userEmail;
                const address = data.data.deliveryAddress;

                // Chỉ update nếu dữ liệu từ order-service có giá trị thực sự
                if (address && address !== 'No Address Provided') {
                  delivery.deliveryAddress = address;
                }
                if (restName) delivery.restaurantName = restName;
                if (restId) delivery.restaurantId = restId;
                if (usrId) delivery.userId = usrId;
                if (usrEmail) delivery.userEmail = usrEmail;

                await this.deliveryRepository.updateOldDeliveryDetails(delivery.id, {
                  restaurantId: restId || delivery.restaurantId,
                  restaurantName: restName || delivery.restaurantName,
                  userId: usrId || delivery.userId,
                  userEmail: usrEmail || delivery.userEmail,
                  deliveryAddress: (address && address !== 'No Address Provided') ? address : delivery.deliveryAddress,
                });
                this.logger.log(`Successfully enriched & saved details for Delivery ${delivery.id}`, 'DataRecovery');
              }
            } else {
              this.logger.error(`Order-service returned status ${res.status} when fetching order ${delivery.orderId}`, 'DataRecovery');
            }
          } catch (err: any) {
            this.logger.error(`Failed to fetch order details internally for Order ${delivery.orderId}: ${err.message}`, 'DataRecovery');
          }
        }
      })
    );
    return deliveries;
  }

  // Consumer: OrderCreated -> Tạo Delivery PENDING
  async handleOrderCreated(payload: any): Promise<void> {
    const orderId = payload.orderId;
    this.logger.log(`Received OrderCreated for Order ${orderId}. Creating delivery record...`, 'KafkaConsumer');
    try {
      const existing = await this.deliveryRepository.findByOrderId(orderId);
      if (existing) {
        this.logger.warn(`Delivery for Order ${orderId} already exists. Skipping creation.`, 'KafkaConsumer');
        return;
      }
      const delivery = await this.deliveryRepository.createDelivery(
        orderId,
        payload.restaurantId,
        payload.restaurantName,
        payload.userId,
        payload.userEmail,
        payload.deliveryAddress
      );
      this.logger.log(`Created delivery record ${delivery.id} for Order ${orderId} (PENDING)`, 'KafkaConsumer');
    } catch (err: any) {
      this.logger.error(`Failed to handle OrderCreated for Order ${orderId}: ${err.message}`, 'KafkaConsumer');
    }
  }

  // Consumer: PaymentCompleted -> Cập nhật Delivery sang ASSIGNED
  async handlePaymentCompleted(payload: any): Promise<void> {
    const orderId = payload.orderId;
    this.logger.log(`Received PaymentCompleted for Order ${orderId}. Updating delivery to ASSIGNED...`, 'KafkaConsumer');
    try {
      const delivery = await this.deliveryRepository.findByOrderId(orderId);
      if (!delivery) {
        // Nếu payment completed mà delivery record chưa tạo (hiếm gặp vì OrderCreated chạy trước), ta tự động tạo luôn
        const newDelivery = await this.deliveryRepository.createDelivery(orderId);
        await this.deliveryRepository.updateStatus(newDelivery.id, DeliveryStatus.ASSIGNED);
        this.logger.log(`Delivery record for Order ${orderId} not found. Created and updated to ASSIGNED`, 'KafkaConsumer');
        return;
      }
      
      if (delivery.status === DeliveryStatus.PENDING) {
        await this.deliveryRepository.updateStatus(delivery.id, DeliveryStatus.ASSIGNED);
        this.logger.log(`Updated delivery ${delivery.id} for Order ${orderId} to ASSIGNED`, 'KafkaConsumer');
      } else {
        this.logger.warn(`Delivery ${delivery.id} is in status ${delivery.status}. Skipping update to ASSIGNED.`, 'KafkaConsumer');
      }
    } catch (err: any) {
      this.logger.error(`Failed to handle PaymentCompleted for Order ${orderId}: ${err.message}`, 'KafkaConsumer');
    }
  }

  // Consumer: OrderCancelled -> Huỷ Delivery khi Payment thất bại (Saga Compensation)
  async handleOrderCancelled(payload: any): Promise<void> {
    const orderId = payload.orderId;
    this.logger.log(`Received OrderCancelled for Order ${orderId}. Cleaning up delivery record...`, 'KafkaConsumer');
    try {
      const delivery = await this.deliveryRepository.findByOrderId(orderId);
      if (!delivery) {
        this.logger.warn(`No delivery record found for cancelled Order ${orderId}. Nothing to cleanup.`, 'KafkaConsumer');
        return;
      }
      // Chỉ cleanup nếu delivery chưa được tài xế nhận (còn PENDING hoặc ASSIGNED)
      if (delivery.status === DeliveryStatus.PENDING || delivery.status === DeliveryStatus.ASSIGNED) {
        await this.deliveryRepository.updateStatus(delivery.id, DeliveryStatus.CANCELLED, payload.reason || 'Order cancelled');
        this.logger.log(`Delivery ${delivery.id} cancelled as compensation for Order ${orderId}`, 'KafkaConsumer');
      } else {
        this.logger.warn(`Delivery ${delivery.id} is in status ${delivery.status}. Skipping cancellation (may be in transit).`, 'KafkaConsumer');
      }
    } catch (err: any) {
      this.logger.error(`Failed to handle OrderCancelled for Order ${orderId}: ${err.message}`, 'KafkaConsumer');
    }
  }

  // API Driver nhận đơn
  async assignDriver(orderId: string, driverId: string): Promise<Delivery> {
    this.logger.log(`Driver ${driverId} attempting to accept Order ${orderId}`, 'DriverAction');
    const delivery = await this.deliveryRepository.findByOrderId(orderId);
    if (!delivery) {
      throw new NotFoundException(`Không tìm thấy thông tin giao hàng cho đơn ${orderId}`);
    }

    if (delivery.status !== DeliveryStatus.ASSIGNED) {
      throw new BadRequestException(`Đơn hàng này hiện không ở trạng thái chờ tài xế (Trạng thái hiện tại: ${delivery.status})`);
    }

    const updated = await this.deliveryRepository.assignDriver(delivery.id, driverId, DeliveryStatus.PICKED_UP);
    this.logger.log(`Driver ${driverId} successfully assigned to Order ${orderId}. Status: PICKED_UP`, 'DriverAction');

    // Phát sự kiện DeliveryAssigned lên Kafka
    const event = new DeliveryAssignedEvent(orderId, driverId);
    this.kafkaClient.emit('DeliveryAssigned', JSON.stringify(event));
    this.logger.log(`Published DeliveryAssigned event for Order ${orderId}`, 'DriverAction');

    return updated;
  }

  // API Driver hoàn thành giao hàng
  async completeDelivery(orderId: string, driverId: string): Promise<Delivery> {
    this.logger.log(`Driver ${driverId} completing delivery for Order ${orderId}`, 'DriverAction');
    const delivery = await this.deliveryRepository.findByOrderId(orderId);
    if (!delivery) {
      throw new NotFoundException(`Không tìm thấy thông tin giao hàng cho đơn ${orderId}`);
    }

    // BUG-M3 Fix: kiểm tra null trước khi so sánh driverId
    if (!delivery.driverId || delivery.driverId !== driverId) {
      throw new BadRequestException('Bạn không phải là tài xế được phân công cho đơn hàng này');
    }

    if (delivery.status !== DeliveryStatus.PICKED_UP) {
      throw new BadRequestException(`Đơn hàng này không ở trạng thái đang giao (Trạng thái hiện tại: ${delivery.status})`);
    }

    const updated = await this.deliveryRepository.updateStatus(delivery.id, DeliveryStatus.DELIVERED);
    this.logger.log(`Delivery completed successfully for Order ${orderId}`, 'DriverAction');

    // Phát sự kiện DeliveryCompleted lên Kafka
    const event = new DeliveryCompletedEvent(orderId, driverId);
    this.kafkaClient.emit('DeliveryCompleted', JSON.stringify(event));
    this.logger.log(`Published DeliveryCompleted event for Order ${orderId}`, 'DriverAction');

    return updated;
  }

  // API Driver giao hàng thất bại / huỷ đơn
  async failDelivery(orderId: string, driverId: string, reason: string): Promise<Delivery> {
    this.logger.log(`Driver ${driverId} reported delivery failed for Order ${orderId}. Reason: ${reason}`, 'DriverAction');
    const delivery = await this.deliveryRepository.findByOrderId(orderId);
    if (!delivery) {
      throw new NotFoundException(`Không tìm thấy thông tin giao hàng cho đơn ${orderId}`);
    }

    // BUG-M3 Fix: kiểm tra null trước khi so sánh driverId
    if (!delivery.driverId || delivery.driverId !== driverId) {
      throw new BadRequestException('Bạn không phải là tài xế được phân công cho đơn hàng này');
    }

    if (delivery.status !== DeliveryStatus.PICKED_UP) {
      throw new BadRequestException(`Đơn hàng này không ở trạng thái đang giao (Trạng thái hiện tại: ${delivery.status})`);
    }

    const updated = await this.deliveryRepository.updateStatus(delivery.id, DeliveryStatus.CANCELLED, reason);
    this.logger.log(`Delivery marked as CANCELLED/Failed for Order ${orderId}. Reason: ${reason}`, 'DriverAction');

    // Phát sự kiện DeliveryFailed lên Kafka
    const event = new DeliveryFailedEvent(orderId, reason);
    this.kafkaClient.emit('DeliveryFailed', JSON.stringify(event));
    this.logger.log(`Published DeliveryFailed event for Order ${orderId}`, 'DriverAction');

    return updated;
  }

  // Lấy thông tin delivery
  async getDeliveryByOrderId(orderId: string): Promise<Delivery> {
    const delivery = await this.deliveryRepository.findByOrderId(orderId);
    if (!delivery) {
      throw new NotFoundException(`Không tìm thấy thông tin giao hàng cho đơn ${orderId}`);
    }
    const enrichedList = await this.enrichDeliveries([delivery]);
    return enrichedList[0];
  }

  // Danh sách các đơn đang chờ tài xế
  async getAvailableDeliveries(): Promise<Delivery[]> {
    const list = await this.deliveryRepository.findAvailableDeliveries();
    return this.enrichDeliveries(list);
  }

  // Danh sách đơn hàng của một tài xế cụ thể
  async getDriverDeliveries(driverId: string): Promise<Delivery[]> {
    const list = await this.deliveryRepository.findDriverDeliveries(driverId);
    return this.enrichDeliveries(list);
  }
}
