# 🚀 Food Ordering & Delivery Microservices Platform

Hệ thống đặt món ăn trực tuyến xây dựng trên kiến trúc **Microservices hướng sự kiện (Event-Driven Architecture)** sử dụng hệ sinh thái **NestJS & React TypeScript**, được quản lý hiệu quả dưới dạng Monorepo bởi **Nx Workspace**.

---

## 🏗️ Kiến trúc Hệ thống (System Architecture)

Hệ thống được thiết kế theo nguyên lý cô lập dịch vụ và dữ liệu chặt chẽ:
*   **API Gateway**: Cửa ngõ duy nhất tiếp nhận request từ Client, chịu trách nhiệm định tuyến, gỡ lỗi CORS và phân luồng bảo mật.
*   **Database per Service**: Mỗi service sở hữu cơ sở dữ liệu riêng biệt để đảm bảo tính độc lập dữ liệu tuyệt đối (PostgreSQL, MongoDB, Redis).
*   **gRPC & HTTP/2**: Giao tiếp đồng bộ hiệu năng cao, độ trễ siêu thấp (<2ms) phục vụ xác thực Token giữa API Gateway và Auth Service.
*   **Apache Kafka**: Hệ thống Event Broker chính phục vụ giao tiếp bất đồng bộ, điều phối giao dịch phân tán bằng **Saga Pattern (Choreography)** và gửi thông báo.

```
                  [ Client Browser (React) ]
                             | (REST HTTP)
                             v
                     [ API Gateway ]
                             |
         +-------------------+-------------------+
         | (gRPC Auth Validation)                | (REST HTTP Routing)
         v                                       v
   [ Auth Service ]                     [ Microservices Zone ]
         | (PostgreSQL)            - Restaurant Svc (PostgreSQL)
   [ Keycloak IAM ]                - Cart Service (Redis Cache)
                                   - Order Service (PostgreSQL)
                                         |
                                         v (Kafka Events)
                                  [ Apache Kafka ]
                                         |
                       +-----------------+-----------------+
                       v                                   v
             [ Payment Service ]                [ Notification Service ]
               (PostgreSQL DB)                        (MongoDB DB)
```

---

## 🌟 Tính năng Nổi bật (Key Features)

1.  **Single Sign-On (SSO) & RBAC**: Tích hợp với **Keycloak OpenID Connect (OIDC)** để xác thực tập trung. Hỗ trợ phân quyền phân vai chi tiết (`ADMIN`, `RESTAURANT_OWNER`, `CUSTOMER`).
2.  **Saga Pattern (Choreography)**: Xử lý luồng đặt hàng và thanh toán bất đồng bộ. Tự động thực hiện hành động bù đắp (**Compensating Action**) để hủy đơn hàng (`CANCELLED`) nếu giao dịch thanh toán thất bại (vượt hạn mức 1.000.000đ).
3.  **Real-time Notification Center**: Component quả chuông ở Header tự động lắng nghe và cập nhật thông báo kết quả thanh toán tức thời từ MongoDB, đi kèm hiệu ứng micro-animation đẹp mắt.
4.  **Restaurant & Menu Management**: Quản trị viên phân quyền gán chủ sở hữu nhà hàng, chủ nhà hàng quản lý món ăn và thực đơn của riêng mình.

---

## 📂 Cấu trúc Thư mục Monorepo (Nx Workspace)

```text
ktpm-ms-monorepo/
├── packages/
│   ├── api-gateway/          # Cổng API Gateway định tuyến (NestJS)
│   ├── auth-service/         # Dịch vụ xác thực gRPC & Đồng bộ Keycloak (NestJS)
│   ├── restaurant-service/   # Dịch vụ quản lý nhà hàng, thực đơn (NestJS)
│   ├── cart-service/         # Dịch vụ lưu trữ giỏ hàng tạm thời (NestJS + Redis)
│   ├── order-service/        # Dịch vụ quản lý đơn hàng & Saga (NestJS)
│   ├── payment-service/      # Dịch vụ thanh toán tự động & Stripe Mock (NestJS)
│   ├── notification-service/ # Dịch vụ log thông báo (NestJS + MongoDB)
│   ├── common/               # Thư viện chia sẻ Decorators, Interceptors, Guards, DTOs
│   └── client/               # Giao diện Frontend Single Page App (React + Vite)
├── keycloak/                 # Cấu hình realm và client Keycloak
├── docker-compose.yml        # File orchestrate hạ tầng (Postgres, Mongo, Redis, Kafka, Keycloak)
└── package.json              # Quản lý dependencies toàn dự án
```

---

## 🌐 Danh sách Cổng Dịch vụ (Ports Allocation)

| Dịch vụ | Giao thức | Port | Cơ sở dữ liệu |
| :--- | :--- | :--- | :--- |
| **API Gateway** | REST HTTP | `3000` | Không có |
| **Auth Service** | gRPC (internal) | `3001` / `50051` | PostgreSQL (`auth_db`) |
| **Restaurant Service**| REST HTTP | `3002` | PostgreSQL (`restaurant_db`) |
| **Cart Service** | REST HTTP | `3003` | Redis Cache (Port `6379`) |
| **Order Service** | REST HTTP / Kafka | `3004` | PostgreSQL (`order_db`) |
| **Payment Service** | REST HTTP / Kafka | `3005` | PostgreSQL (`payment_db`) |
| **Notification Svc** | REST HTTP / Kafka | `3006` | MongoDB (`notification_db`) |
| **React Client** | Web Page | `5173` | Không có |
| **Keycloak IAM** | OIDC Identity | `8080` | Sử dụng PostgreSQL |

---

## 🛠️ Hướng dẫn Khởi chạy Hệ thống

### Yêu cầu hệ thống:
*   Đã cài đặt **Node.js** (v18 trở lên) & **npm**.
*   Đã cài đặt **Docker & Docker Compose**.

### Bước 1: Khởi động Hạ tầng Docker (Database, Kafka, Keycloak)
Chạy lệnh sau tại thư mục gốc của dự án để khởi động toàn bộ các dịch vụ nền:
```bash
docker-compose up -d
```
*Đợi khoảng 1-2 phút để Keycloak, Kafka và các cơ sở dữ liệu khởi tạo cấu hình hoàn tất.*

### Bước 2: Cài đặt Dependencies toàn Monorepo
```bash
npm install
```

### Bước 3: Khởi chạy các dịch vụ Backend & Frontend
Bạn có thể khởi chạy nhanh toàn bộ các dịch vụ bằng lệnh Nx:
```bash
npx nx run-many --target=serve --all --parallel=10
```

Hoặc chạy độc lập từng service khi phát triển:
*   Chạy Client: `npx nx serve client`
*   Chạy API Gateway: `npx nx serve api-gateway`
*   Chạy các Services backend: `npx nx serve <service-name>` (Ví dụ: `npx nx serve order-service`)

---

## 🧪 Chạy Kiểm thử (Testing)

Hệ thống cấu hình sẵn các bộ test case Unit và Integration sử dụng **Jest**:

*   Chạy test cho toàn bộ hệ thống:
    ```bash
    npx nx run-many --target=test --all
    ```
*   Chạy test riêng cho một service cụ thể:
    ```bash
    npx nx test <service-name>
    ```

---
*Chúc bạn có những trải nghiệm tuyệt vời cùng Food Ordering Microservices Platform!*
