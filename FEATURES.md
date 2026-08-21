# Tính năng hiện tại — Stacks (School Document Library)

Tài liệu này mô tả các tính năng đã hoàn thiện tính đến thời điểm hiện tại. Đây là bản MVP tập trung vào quản lý/tìm kiếm tài liệu và nền tảng xác thực — **chưa có** upload file, xem PDF, tải file thật, trang quản trị, hay tìm kiếm AI.

## Stack công nghệ

- **Frontend:** Next.js (App Router) + React + Tailwind CSS + shadcn/ui-style components
- **Backend:** Next.js Route Handlers (REST API)
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** Auth.js (Credentials provider, JWT session)
- **Test:** Vitest (58 test, cover validation + API routes + api-client + auth/authorization)

## Luồng người dùng chính

```
Trang chủ ──▶ Tìm kiếm / Duyệt theo môn ──▶ Kết quả tìm kiếm ──▶ Chi tiết tài liệu
```

---

## 1. Trang chủ — `/`

- Logo/tên app + thanh tìm kiếm lớn (placeholder: "Search documents, subjects, exams...")
- **Browse by subject:** danh sách môn học kèm số lượng tài liệu thật, lấy từ `GET /api/subjects` (group theo `subject`, không có bảng Subject riêng)
- **Popular documents:** 4 tài liệu mới nhất (`GET /api/documents?take=4`, sắp xếp theo `createdAt` giảm dần)
- Toàn bộ dữ liệu tải qua API, không có mock data trong UI

## 2. Tìm kiếm & Kết quả — `/search?q=...&subject=...`

- Nhận từ khoá qua query param `q`, lọc theo môn qua `subject`
- Search khớp không phân biệt hoa/thường trên 3 trường: `title`, `description`, `subject`
- Chip lọc theo môn học (All subjects + từng môn), có trạng thái active
- Mỗi kết quả hiển thị qua `DocumentCard`: tiêu đề, môn học, loại tài liệu, năm học, mô tả ngắn
- Empty state thân thiện khi không có kết quả, kèm nút quay về xem tất cả

## 3. Chi tiết tài liệu — `/documents/[id]` *(mới)*

- Bấm vào bất kỳ `DocumentCard` nào (ở trang chủ hoặc trang tìm kiếm) sẽ mở trang này
- Hiển thị đầy đủ: tiêu đề, môn học, loại tài liệu, năm học, mô tả, ngày tạo (format "Added <ngày>")
- **Preview placeholder:** khối "Document preview will be available here." — chưa xem được nội dung thật
- **Nút Download:** hiển thị nhưng bị disable — chưa tải file được
- **ID không tồn tại/không hợp lệ** → hiển thị trang "Document not found" thân thiện (qua `notFound()` của Next.js), có nút quay lại trang tìm kiếm
- Lỗi backend/DB (nếu có) sẽ rơi vào error boundary chung của app (`error.tsx`)

## 4. Document CRUD API

| Method | Endpoint | Mô tả |
| --- | --- | --- |
| GET | `/api/documents` | Danh sách tài liệu. Hỗ trợ `?search=`, `?subject=`, `?take=`, `?skip=` |
| GET | `/api/documents/:id` | Lấy 1 tài liệu theo id |
| POST | `/api/documents` | Tạo tài liệu mới (validate bằng zod) |
| PUT | `/api/documents/:id` | Cập nhật tài liệu (partial update) |
| DELETE | `/api/documents/:id` | Xoá tài liệu |
| GET | `/api/subjects` | Danh sách môn học kèm số lượng tài liệu |

- Tất cả response dùng chung 1 envelope: `{ success, data, error, meta? }`
- Validate input ở tầng API bằng zod (`src/lib/validation/document.ts`) — bắt buộc `title`, `subject`, `documentType`, `academicYear`; `description` optional
- Trả đúng HTTP status: `200/201` khi thành công, `400` khi dữ liệu không hợp lệ hoặc JSON sai định dạng, `404` khi không tìm thấy tài liệu, `500` khi lỗi hệ thống/DB (có log lỗi ở server, không lộ chi tiết ra client)

## 5. Database (PostgreSQL + Prisma)

Model `Document` (đơn giản, không quan hệ):

```
id            String   @id (cuid)
title         String
description   String?
subject       String
documentType  String
academicYear  String
createdAt     DateTime
updatedAt     DateTime
```

- Có seed script (`prisma/seed.ts`) tạo sẵn 12 tài liệu mẫu trải đều 4 môn: Database, Data Structures, Web Development, Computer Networks
- `npm run db:migrate` / `npm run db:seed` / `npm run db:studio` để quản lý DB
- Model `User` (id, name, email unique, passwordHash, role, createdAt, updatedAt) + Prisma enum `Role` (STUDENT/TEACHER/ADMIN, mặc định STUDENT) — xem chi tiết ở mục [8. Xác thực & Phân quyền](#8-xác-thực--phân-quyền--authjs-mới)

## 6. UI / Design system

- Tailwind CSS v4 với design token riêng (màu `ink`, `paper`, `surface`, `accent`, font display/mono)
- Bộ component tái sử dụng theo phong cách shadcn/ui: `Button`, `Input`, `Badge`, `Card` (`src/components/ui/`)
- Component nghiệp vụ tái sử dụng: `SearchBar`, `DocumentCard`, `SubjectCard`, `SiteHeader`
- Giao diện tối giản, responsive (mobile → desktop)

## 7. Xử lý lỗi

- Error boundary toàn app (`src/app/error.tsx`) — hiển thị thông báo thân thiện + nút "Try again" khi API/DB không kết nối được
- Trang not-found riêng cho tài liệu không tồn tại (`src/app/documents/[id]/not-found.tsx`)
- Validate dữ liệu đầu vào ở API trước khi chạm DB

## 8. Xác thực & Phân quyền — Auth.js *(mới)*

- **Đăng ký** — `/register`: name, email, password. Luôn tạo tài khoản với `role = STUDENT`, **không** nhận role từ client (kể cả khi client cố gửi `role: "ADMIN"` trong request, server bỏ qua và luôn gán STUDENT). Password được hash bằng bcrypt trước khi lưu. Trùng email bị từ chối (409). Đăng ký thành công sẽ tự động đăng nhập và chuyển về trang chủ.
- **Đăng nhập** — `/login`: email/password qua Auth.js Credentials provider, đối chiếu với bảng `User` trong Postgres. Sai thông tin đăng nhập hiển thị thông báo lỗi thân thiện ("Incorrect email or password.").
- **Đăng xuất** — nút Logout trên header, xoá session và chuyển về `/`.
- **Session** — dùng JWT, tồn tại giữa các lần load lại trang. Session expose `user.id`, `user.name`, `user.email`, `user.role` — role đọc được ở server-side cho các bước authorization sau này.
- **3 role:** `STUDENT`, `TEACHER`, `ADMIN` (lưu trong DB qua Prisma enum `Role`). `ADMIN` mới chỉ là nền tảng cho các bước sau — **chưa có** giao diện/API quản trị nào ở bước này. Guest = người chưa đăng nhập, không lưu trong DB.
- **Trang Profile** — `/profile`: hiển thị name, email, role. Bắt buộc đăng nhập — guest truy cập sẽ bị redirect sang `/login`.
- **Header** — guest thấy Login/Register; người đã đăng nhập thấy tên/email, badge role, link Profile, nút Logout.
- **Authorization helpers phía server** (`src/lib/auth/authorize.ts`): `requireAuth()` và `requireRole("TEACHER")` / `requireRole(["TEACHER", "ADMIN"])`. Kiểm tra quyền luôn thực hiện ở server, không dựa vào việc ẩn UI để bảo mật.
- **Tài khoản seed sẵn để dev/test** (`npm run db:seed`): `student@example.com` / `student123` (STUDENT), `teacher@example.com` / `teacher123` (TEACHER), `admin@example.com` / `admin123` (ADMIN) — mật khẩu đơn giản, chỉ dùng local, luôn được hash trước khi lưu.

---

## Chưa làm (ngoài phạm vi hiện tại)

- Trang quản trị (Admin dashboard), quản lý người dùng (User management)
- Giáo viên upload tài liệu, duyệt giáo viên (teacher approval), lưu trữ file thật
- Xem PDF thật, tải file thật
- Đăng nhập Google/OAuth, xác minh email, quên mật khẩu, 2FA
- Tìm kiếm AI / semantic search / embeddings
- Yêu thích (favorites), bình luận (comments)
