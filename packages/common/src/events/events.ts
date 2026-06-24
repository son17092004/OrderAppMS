export enum EventPattern {
  OrderCreated = 'OrderCreated',
  PaymentCompleted = 'PaymentCompleted',
  PaymentFailed = 'PaymentFailed',
  OrderConfirmed = 'OrderConfirmed',
  OrderCancelled = 'OrderCancelled',
  NotificationRequested = 'NotificationRequested',
  DeliveryAssigned = 'DeliveryAssigned',
  DeliveryCompleted = 'DeliveryCompleted',
  DeliveryFailed = 'DeliveryFailed',
}

export abstract class BaseEvent {
  abstract readonly pattern: EventPattern;
  readonly timestamp: string;

  constructor() {
    this.timestamp = new Date().toISOString();
  }

  freeze() {
    Object.freeze(this);
  }
}

export class OrderCreatedEvent extends BaseEvent {
  readonly pattern = EventPattern.OrderCreated;
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly restaurantId: string,
    public readonly amount: number,
    public readonly restaurantName: string,
    public readonly userEmail: string,
    public readonly deliveryAddress: string,
    public readonly items: Array<{
      foodItemId: string;
      name: string;
      price: number;
      quantity: number;
    }>
  ) {
    super();
    this.freeze();
  }
}

export class PaymentCompletedEvent extends BaseEvent {
  readonly pattern = EventPattern.PaymentCompleted;
  constructor(
    public readonly paymentId: string,
    public readonly orderId: string,
    public readonly transactionId: string,
    public readonly amount: number
  ) {
    super();
    this.freeze();
  }
}

export class PaymentFailedEvent extends BaseEvent {
  readonly pattern = EventPattern.PaymentFailed;
  constructor(
    public readonly orderId: string,
    public readonly amount: number,
    public readonly reason: string
  ) {
    super();
    this.freeze();
  }
}

export class OrderConfirmedEvent extends BaseEvent {
  readonly pattern = EventPattern.OrderConfirmed;
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly restaurantId: string
  ) {
    super();
    this.freeze();
  }
}

export class OrderCancelledEvent extends BaseEvent {
  readonly pattern = EventPattern.OrderCancelled;
  constructor(
    public readonly orderId: string,
    public readonly reason: string
  ) {
    super();
    this.freeze();
  }
}

export class NotificationRequestedEvent extends BaseEvent {
  readonly pattern = EventPattern.NotificationRequested;
  constructor(
    public readonly userId: string,
    public readonly orderId: string,
    public readonly type: 'EMAIL' | 'SMS',
    public readonly content: string
  ) {
    super();
    this.freeze();
  }
}

export class DeliveryAssignedEvent extends BaseEvent {
  readonly pattern = EventPattern.DeliveryAssigned;
  constructor(
    public readonly orderId: string,
    public readonly driverId: string
  ) {
    super();
    this.freeze();
  }
}

export class DeliveryCompletedEvent extends BaseEvent {
  readonly pattern = EventPattern.DeliveryCompleted;
  constructor(
    public readonly orderId: string,
    public readonly driverId: string
  ) {
    super();
    this.freeze();
  }
}

export class DeliveryFailedEvent extends BaseEvent {
  readonly pattern = EventPattern.DeliveryFailed;
  constructor(
    public readonly orderId: string,
    public readonly reason: string
  ) {
    super();
    this.freeze();
  }
}
