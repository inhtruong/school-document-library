# Tính năng hiện tại — Stacks (School Document Library)

Tài liệu này mô tả các tính năng đã hoàn thiện tính đến thời điểm hiện tại. Đây là bản MVP tập trung vào quản lý/tìm kiếm tài liệu, xác thực, upload theo học liệu phân loại (Grade → Subject → Lesson → Document Type), tìm kiếm có bộ lọc/sắp xếp/phân trang theo taxonomy, xem trước tài liệu công khai (PDF/ảnh/video/Word hiện đại .docx), tải tài liệu có bảo vệ đăng nhập, đánh giá tài liệu 1-5 sao, bình luận tài liệu, báo cáo tài liệu (report), lưu tài liệu yêu thích (bookmark), theo dõi Giáo viên/Bài học (follow), và thông báo trong ứng dụng khi có tài liệu mới (in-app notifications) — **chưa có** preview Word cũ (.doc)/Excel, trang quản trị (bao gồm cả duyệt report), thông báo qua email/push, hay tìm kiếm AI.

## Stack công nghệ

- **Frontend:** Next.js (App Router) + React + Tailwind CSS + shadcn/ui-style components
- **Backend:** Next.js Route Handlers (REST API)
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** Auth.js (Credentials provider, JWT session)
- **File Storage:** Local filesystem (`storage_local/`, server-side only) — không cần dịch vụ lưu trữ ngoài
- **Test:** Vitest (583 test, cover validation + API routes + auth/authorization + upload/local storage + preview/Range parsing + preview-kind classification + DOCX render integration boundary + protected download + safe callback URL + Content-Disposition filename safety + education taxonomy validation/APIs + search query parsing/taxonomy filter resolution/sort/pagination + rating validation/aggregation/API/ownership + comment validation/pagination/API/ownership/cross-Document isolation + report validation/duplicate-prevention/API/ownership + bookmark idempotency/pagination/API/ownership + Teacher/Lesson follow target-validation/self-follow/idempotency/pagination/isolation + notification recipient-calculation/dedup/uploader-exclusion/idempotency/pagination/ownership/isolation + production env validation/fail-fast/upload-size parsing/APP_URL format + admin bootstrap validation/duplicate-prevention + health check)

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

## 2. Tìm kiếm & Kết quả — `/search` (Step 6B, *mới*)

- **Bộ lọc theo taxonomy, cùng cấu trúc với upload:** `Grade → Subject → Lesson/Topic`, cộng thêm **Document Type**. Chọn lại Grade sẽ reset Subject + Lesson; chọn lại Subject sẽ reset Lesson. Subject bị disable tới khi chọn Grade, Lesson bị disable tới khi chọn Subject — component `SearchFilters` (`src/components/SearchFilters.tsx`), tái dùng đúng 2 API đọc taxonomy đã có (`/api/subjects?gradeId=`, `/api/lessons?subjectId=`), không tạo API riêng.
- **URL là nguồn sự thật duy nhất** cho toàn bộ trạng thái tìm kiếm: `q`, `gradeId`, `subjectId`, `lessonId`, `documentType`, `sort`, `page`. Copy URL đã lọc dán vào tab/trình duyệt khác sẽ khôi phục đúng y hệt từ khoá, bộ lọc, sắp xếp, trang — không lưu trạng thái chỉ ở React state.
- **Sắp xếp:** `newest` (mặc định), `oldest`, `title_asc`, `title_desc` — map tường minh sang Prisma `orderBy` qua bảng cho phép cố định (`SORT_ORDER_BY`), không bao giờ truyền thẳng giá trị query vào `orderBy`.
- **Phân trang phía server** qua Prisma `skip`/`take` + `count()` (không load hết rồi phân trang ở bộ nhớ). Page size cố định 1 chỗ: `SEARCH_PAGE_SIZE = 12` (`src/lib/documents/search-query.ts`). Đổi từ khoá/bộ lọc/sắp xếp sẽ luôn reset về trang 1.
- **Search khớp không phân biệt hoa/thường trên 5 trường:** `title`, `description`, `subject` (legacy free-text), tên Subject theo taxonomy, tên Lesson theo taxonomy — tài liệu legacy (không có taxonomy) vẫn tìm được bình thường khi không chọn bộ lọc taxonomy.
- **Không tin dữ liệu từ URL:** `resolveSearchTaxonomyFilters()` (`src/lib/documents/search-filters.ts`) luôn tra lại DB — Subject sai Grade hoặc Lesson sai Subject sẽ tự động bị bỏ qua (kết quả rộng hơn) thay vì lỗi/crash; `sort`/`page` không hợp lệ tự chuẩn hoá về mặc định.
- **Tương thích ngược hoàn toàn:** trang chủ ("Browse by subject", "Popular documents") vẫn dùng nguyên `?subject=` và `?take=` như cũ, chạy song song với luồng lọc/phân trang mới trên cùng API `GET /api/documents`.
- Mỗi kết quả hiển thị qua `DocumentCard`: tiêu đề, môn học, loại tài liệu, năm học, mô tả ngắn
- **Empty state** thân thiện khi không có kết quả khớp bộ lọc, kèm nút quay về xem tất cả; nút **"Clear filters"** xuất hiện khi có bộ lọc đang active, reset Grade/Subject/Lesson/Document Type/Sort/trang về mặc định (giữ nguyên từ khoá)

## 3. Chi tiết tài liệu — `/documents/[id]` *(mới)*

- Bấm vào bất kỳ `DocumentCard` nào (ở trang chủ hoặc trang tìm kiếm) sẽ mở trang này
- Hiển thị đầy đủ: tiêu đề, môn học, loại tài liệu, năm học, mô tả, ngày tạo (format "Added <ngày>")
- **Preview file thật** qua component `FilePreview` — xem chi tiết ở mục [10. Xem trước tài liệu công khai](#10-xem-trước-tài-liệu-công-khai--public-file-preview-step-5a-mới)
- **Nút Download** (`DownloadButton`) — xem chi tiết ở mục [11. Tải tài liệu có bảo vệ đăng nhập](#11-tải-tài-liệu-có-bảo-vệ-đăng-nhập--protected-download-step-5b-mới). Tài liệu không có file → nút vẫn disable cho mọi đối tượng.
- **Đánh giá 1-5 sao** (`DocumentRatingSection`) — xem chi tiết ở mục [13. Đánh giá tài liệu](#13-đánh-giá-tài-liệu--document-rating-step-7a-mới)
- **Bình luận** (`CommentSection`) — xem chi tiết ở mục [14. Bình luận tài liệu](#14-bình-luận-tài-liệu--document-comments-step-7b-mới)
- **Báo cáo tài liệu** (`ReportDocumentAction`) — xem chi tiết ở mục [15. Báo cáo tài liệu](#15-báo-cáo-tài-liệu--document-reporting-step-7c-mới)
- **Lưu tài liệu yêu thích** (`BookmarkAction`) — xem chi tiết ở mục [16. Lưu tài liệu yêu thích](#16-lưu-tài-liệu-yêu-thích--bookmarksfavorites-step-8a-mới)
- **Theo dõi Giáo viên/Bài học** (`TeacherFollowAction`, `LessonFollowAction`) — xem chi tiết ở mục [17. Theo dõi Giáo viên/Bài học](#17-theo-dõi-giáo-viênbài-học--follow-teacherlesson-step-8b-mới)
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
| POST | `/api/documents/upload` | Upload file (PDF/Word/Excel/ảnh/video) + metadata. Chỉ TEACHER/ADMIN, multipart form data |

- Tất cả response dùng chung 1 envelope: `{ success, data, error, meta? }`
- Validate input ở tầng API bằng zod (`src/lib/validation/document.ts`) — bắt buộc `title`, `subject`, `documentType`, `academicYear`; `description` optional
- Trả đúng HTTP status: `200/201` khi thành công, `400` khi dữ liệu không hợp lệ hoặc JSON sai định dạng, `404` khi không tìm thấy tài liệu, `500` khi lỗi hệ thống/DB (có log lỗi ở server, không lộ chi tiết ra client)

## 5. Database (PostgreSQL + Prisma)

Model `Document`:

```
id            String        @id (cuid)
title         String
description   String?
subject       String        // legacy free-text, xem mục 12
academicYear  String
documentType  DocumentType  // enum, xem mục 12 (trước đây là String)
gradeId       String?       // taxonomy, nullable — xem mục 12
subjectId     String?
lessonId      String?
createdAt     DateTime
updatedAt     DateTime
```

- Có seed script (`prisma/seed.ts`) tạo sẵn 12 tài liệu mẫu legacy trải đều 4 môn (Database, Data Structures, Web Development, Computer Networks) + 4 tài liệu mẫu mới có taxonomy (Grade/Subject/Lesson) — xem mục [12. Học liệu phân loại](#12-học-liệu-phân-loại--education-taxonomy-step-6a-mới)
- `npm run db:migrate` / `npm run db:seed` / `npm run db:studio` để quản lý DB
- Model `User` (id, name, email unique, passwordHash, role, createdAt, updatedAt) + Prisma enum `Role` (STUDENT/TEACHER/ADMIN, mặc định STUDENT) — xem chi tiết ở mục [8. Xác thực & Phân quyền](#8-xác-thực--phân-quyền--authjs-mới)
- `Document` có thêm 6 field file (đều nullable): `fileKey`, `fileName`, `fileSize`, `mimeType`, `fileCategory` (enum `FileCategory`: PDF/WORD/EXCEL/IMAGE/VIDEO), `uploadedById` (quan hệ tới `User`) — tài liệu không có file vẫn hoạt động bình thường (giá trị null). Xem mục [9. Upload tài liệu](#9-upload-tài-liệu--teacheradmin-mới)
- Model `Grade`, `Subject`, `Lesson` — xem mục [12. Học liệu phân loại](#12-học-liệu-phân-loại--education-taxonomy-step-6a-mới)

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

- **Đăng ký** — `/register`: name, email, password. Luôn tạo tài khoản với `role = STUDENT`, **không** nhận role từ client (kể cả khi client cố gửi `role: "ADMIN"` trong request, server bỏ qua và luôn gán STUDENT). Password được hash bằng bcrypt trước khi lưu. Trùng email bị từ chối (409) — hiển thị lỗi thân thiện cả inline lẫn toast. Lỗi validate input hiển thị inline. Đăng ký thành công sẽ tự động đăng nhập, chuyển về trang chủ, kèm toast "Account created successfully".
- **Đăng nhập** — `/login`: email/password qua Auth.js Credentials provider, đối chiếu với bảng `User` trong Postgres. Sai thông tin đăng nhập hiển thị thông báo lỗi thân thiện inline ("Incorrect email or password."). Đăng nhập thành công hiển thị toast "Logged in successfully".
- **Đăng xuất** — nút Logout trên header, xoá session, chuyển về `/` kèm toast "Logged out successfully".
- **Feedback UX** (`src/components/ToastListener.tsx`, `src/lib/toast-messages.ts`, Sonner) — hệ thống toast dùng chung cho toàn app: toast báo thành công cho đăng ký/đăng nhập/đăng xuất/upload; toast báo lỗi cho lỗi đăng nhập sai và lỗi cấp hành động (vd. trùng email, lỗi lưu trữ) để tránh trùng lặp với thông báo lỗi validate vốn đã hiển thị inline sát form. 3 biến thể màu sắc + icon riêng để nhận diện ngay: xanh lá (success), hổ phách (warning — sẵn sàng cho tính năng sau này, hiện chưa có luồng nào dùng), đỏ (error).
- **Session** — dùng JWT, tồn tại giữa các lần load lại trang. Session expose `user.id`, `user.name`, `user.email`, `user.role` — role đọc được ở server-side cho các bước authorization sau này.
- **3 role:** `STUDENT`, `TEACHER`, `ADMIN` (lưu trong DB qua Prisma enum `Role`). `ADMIN` mới chỉ là nền tảng cho các bước sau — **chưa có** giao diện/API quản trị nào ở bước này. Guest = người chưa đăng nhập, không lưu trong DB.
- **Trang Profile** — `/profile`: hiển thị name, email, role. Bắt buộc đăng nhập — guest truy cập sẽ bị redirect sang `/login`.
- **Header** — guest thấy Login/Register; người đã đăng nhập thấy tên/email, badge role, link Profile, nút Logout.
- **Authorization helpers phía server** (`src/lib/auth/authorize.ts`): `requireAuth()` và `requireRole("TEACHER")` / `requireRole(["TEACHER", "ADMIN"])`. Kiểm tra quyền luôn thực hiện ở server, không dựa vào việc ẩn UI để bảo mật.
- **Tài khoản seed sẵn để dev/test** (`npm run db:seed`): `student@example.com` / `student123` (STUDENT), `teacher@example.com` / `teacher123` (TEACHER), `admin@example.com` / `admin123` (ADMIN) — mật khẩu đơn giản, chỉ dùng local, luôn được hash trước khi lưu.

## 9. Upload tài liệu — Teacher/Admin, Local Storage *(mới)*

- **Ai được upload:** chỉ `TEACHER` và `ADMIN`. STUDENT và guest không được phép — kiểm tra luôn thực hiện ở server (`hasRole`/`requireRole`), việc ẩn nút "Upload Document" trên header với các role khác chỉ là UX, không phải cơ chế bảo mật.
- **Trang** `/upload` — form: Title, **Grade → Subject → Lesson/Topic (dropdown xếp tầng) → Document Type**, Academic Year, Description, File (1 file). Chỉ TEACHER/ADMIN truy cập được (redirect nếu không đủ quyền). Xem chi tiết bộ chọn xếp tầng và validate ở mục [12. Học liệu phân loại](#12-học-liệu-phân-loại--education-taxonomy-step-6a-mới).
- **API** `POST /api/documents/upload` — cùng logic, dùng chung service `uploadDocument()` với trang `/upload`.
- **5 loại file được hỗ trợ**, allowlist tập trung ở `src/lib/storage/local-storage.ts`:
  - **PDF:** `.pdf`
  - **Word:** `.doc`, `.docx`
  - **Excel:** `.xls`, `.xlsx`
  - **Image:** `.jpg`, `.jpeg`, `.png`, `.webp`
  - **Video:** `.mp4`, `.webm`
- **Validate ở server** cho mọi loại: có file, phần mở rộng nằm trong allowlist, `Content-Type` khớp với phần mở rộng (không tin riêng tên file hay content-type), dung lượng ≤ giới hạn cấu hình, và với các định dạng có chữ ký byte thực tế (magic bytes) — PDF, PNG, JPEG, WEBP, DOCX/XLSX, DOC/XLS, MP4, WEBM — còn kiểm tra thêm nội dung byte đầu file có khớp chữ ký hay không.
- **Giới hạn dung lượng mặc định 10 MB**, khai báo một chỗ duy nhất trong `src/lib/documents/upload-config.ts` (`MAX_UPLOAD_SIZE_MB` / `MAX_UPLOAD_SIZE_BYTES`) — mọi chỗ validate đều đọc từ đây, đổi giới hạn chỉ cần sửa 1 file. Giới hạn body request của Next.js Server Actions (`next.config.ts`) được đặt cao hơn giá trị này để lỗi "quá dung lượng" luôn đi qua được validate của app và hiển thị thông báo thân thiện, thay vì bị framework chặn trước với lỗi thô.
- **Lưu trữ: local filesystem**, thư mục `storage_local/` ở gốc project, tự động tạo khi cần — **không cần dịch vụ hay credential ngoài nào**. Phân loại theo thư mục con: `pdf/`, `word/`, `excel/`, `images/`, `videos/`. Mỗi file lưu theo key tự sinh, không dùng tên file gốc: `{category}/{uuid}.{ext}` (ví dụ `pdf/550e8400-....pdf`). Chỉ lưu key tương đối vào DB (`fileKey`), không lưu đường dẫn tuyệt đối, không tạo URL công khai.
- **Chủ sở hữu file:** `uploadedById` luôn lấy từ session đã xác thực trên server — client không thể tự khai báo hoặc giả mạo người upload.
- **Xử lý lỗi từng phần:** nếu ghi file cục bộ thất bại → không tạo record `Document`. Nếu tạo `Document` thất bại sau khi đã ghi file thành công → app tự động thử xoá file mồ côi (orphan) đó. File ghi với flag exclusive (không tự động ghi đè), và mọi đường dẫn lưu trữ được kiểm tra containment để chặn path traversal (`../..`).
- **Chi tiết tài liệu:** với tài liệu có file, trang `/documents/[id]` hiển thị thêm tên file gốc, loại file (PDF/Word document/Excel spreadsheet/Image/Video), dung lượng, và người upload — tối giản, tài liệu seed cũ không có file vẫn hiển thị bình thường.
- **Feedback:** upload thành công chuyển sang trang chi tiết tài liệu kèm toast "Document uploaded successfully". Lỗi validate (file/type không hỗ trợ, quá dung lượng, thiếu metadata) hiển thị inline sát form; lỗi cấp hệ thống (ghi file/lưu DB thất bại) hiển thị cả inline lẫn toast. Không lộ đường dẫn hệ thống, lỗi database hay stack trace ra client.
- **Giới hạn MVP đã biết:** file nằm trên ổ đĩa cục bộ của server — phù hợp cho local/single-instance, nhưng **không** phù hợp cho serverless/nhiều instance (file không được share, có thể mất khi redeploy). Do toàn bộ logic filesystem gói gọn trong `src/lib/storage/local-storage.ts`, sau này đổi sang storage khác chỉ cần sửa 1 module.

## 10. Xem trước tài liệu công khai — Public File Preview (Step 5A, *mới*)

- **Hoàn toàn công khai:** guest, STUDENT, TEACHER, ADMIN đều xem trước được — trang `/documents/[id]` và API preview **không** gọi `requireAuth()`/`requireRole()`.
- **Luồng chính:** Search → Document Detail → Preview, không cần đăng nhập.
- **4 loại được xem trực tiếp:**
  - **PDF** (`.pdf`) ✅ — nhúng qua `<iframe>`, dùng trình xem PDF gốc của trình duyệt (cuộn, zoom, in — chưa dùng PDF.js).
  - **Ảnh** (`.jpg`, `.jpeg`, `.png`, `.webp`) ✅ — `<img>` responsive, giữ tỷ lệ, không tràn layout, không lightbox/zoom/gallery.
  - **Video** (`.mp4`, `.webm`) ✅ — `<video controls>` gốc của trình duyệt, không autoplay, không custom player. Hỗ trợ HTTP `Range` request (`206 Partial Content`) để tua video mượt.
  - **Word hiện đại** (`.docx`) ✅ *(mới)* — render trực tiếp trong trình duyệt bằng thư viện `docx-preview` (client-side, không convert phía server), qua component `DocxPreview` (`src/components/DocxPreview.tsx`, dynamic import — không chạy lúc SSR). Có trạng thái loading ("Loading document preview...") và fallback lỗi thân thiện ("Unable to preview this Word document.") khi file lỗi/không mở được.
- **Word cũ (`.doc`) ❌ và Excel (`.xls`/`.xlsx`) ❌ — vẫn chỉ placeholder:** `.doc` hiện "Preview is not available for legacy Word (.doc) files yet.", `.xls`/`.xlsx` hiện "Excel spreadsheet preview is not available yet." — không dùng Google Docs Viewer, Office Online, hay convert phía server. `.doc` và `.docx` dùng chung `fileCategory = WORD`, nên phân biệt bằng `mimeType` (`src/lib/documents/preview-kind.ts` — nguồn duy nhất quyết định loại preview, dùng chung cho cả API và UI), không dựa vào tên file.
- **Tài liệu không có file** (12 tài liệu seed cũ) hiện "File preview is not available for this document." — không crash.
- **API công khai** `GET /api/documents/:id/preview` — chỉ nhận Document ID, không nhận đường dẫn file. Luồng: id → tra `Document` trong Postgres → đọc `fileKey` (server-controlled) → resolve an toàn qua `resolveStoragePath`/`statLocalFile` (tái dùng từ Step 4, có kiểm containment chặn path traversal) → trả nội dung file (kể cả DOCX — trả nguyên byte file, không convert HTML phía server). Không set `Content-Disposition: attachment` (đây là preview, không phải download).
- **`storage_local/` không bao giờ public:** không nằm trong `public/`, không có route static nào expose trực tiếp — mọi truy cập file đều phải qua API preview này.
- **Component dùng chung** `FilePreview` (`src/components/FilePreview.tsx`) quyết định render gì dựa theo `resolvePreviewKind(fileCategory, mimeType)`, dùng lại ở `/documents/[id]`.
- **Xử lý lỗi:** tài liệu không tồn tại → 404; không có file → 404 kèm placeholder thân thiện; `fileKey` có trong DB nhưng file vật lý bị mất → 404 thân thiện, không crash; loại không hỗ trợ preview (Word cũ/Excel) → 415, không stream nhầm byte; DOCX lỗi/hỏng ở phía client → fallback thân thiện, không crash cả trang, không lộ chi tiết parse lỗi; lỗi hệ thống bất ngờ → 500 chung chung, không lộ absolute path hay stack trace.
- **Download (tải file thật)** — xem chi tiết ở mục [11. Tải tài liệu có bảo vệ đăng nhập](#11-tải-tài-liệu-có-bảo-vệ-đăng-nhập--protected-download-step-5b-mới).

## 11. Tải tài liệu có bảo vệ đăng nhập — Protected Download (Step 5B, *mới*)

- **Bắt buộc đăng nhập, không phân biệt role:** guest ❌ — STUDENT ✅, TEACHER ✅, ADMIN ✅ đều tải được. `GET /api/documents/:id/download` gọi `auth()` trực tiếp (không dùng `requireRole()` vì không giới hạn role cụ thể), guest gọi API sẽ nhận `401`. Bảo mật luôn thực hiện ở server, không dựa vào việc ẩn nút Download trên UI.
- **Luồng guest:** nút Download vẫn là link bấm được (không disable) — trỏ tới `/login?callbackUrl=/documents/{id}`. Đăng nhập thành công sẽ quay lại đúng trang tài liệu đó (không phải trang chủ), người dùng bấm Download lần nữa để tải — **không** tự động tải ngay sau khi đăng nhập.
- **Callback URL an toàn** (`src/lib/auth/callback-url.ts`, `isSafeCallbackUrl()`) — chỉ chấp nhận đường dẫn nội bộ dạng `/...`, từ chối mọi giá trị có thể redirect ra ngoài site (`https://evil.example.com`, `//evil.example.com`, mẹo dùng backslash, `javascript:`...). Callback không hợp lệ/thiếu sẽ dùng lại hành vi mặc định (`/`) như trước.
- **Giữ tên file gốc, không lộ `fileKey`:** `Content-Disposition: attachment` dùng `Document.fileName` (tên file người upload đặt), qua `buildContentDisposition()` (`src/lib/documents/content-disposition.ts`) — loại bỏ ký tự điều khiển/xuống dòng (chống header injection), escape dấu ngoặc kép, và có thêm tham số `filename*=UTF-8''...` cho tên file có dấu. `fileKey` dạng `pdf/550e8400-....pdf` không bao giờ xuất hiện làm tên file tải về.
- **Tái dùng cơ chế resolve file an toàn từ Step 5A** — `statLocalFile`/`createLocalFileReadStream` (`src/lib/storage/local-storage.ts`), không viết lại logic path. Luồng: Document ID → `fileKey` từ DB → resolve có kiểm containment trong `storage_local/` → trả file. `storage_local/` vẫn không bao giờ public.
- **Tải được mọi định dạng upload hỗ trợ**, không phụ thuộc việc có preview hay không: DOC, XLS/XLSX tải được dù không xem trước được.
- **Tài liệu không có file** → nút Download luôn disable (button thật, không phải link) cho mọi người, kể cả đã đăng nhập — không đưa người dùng sang trang login cho tài liệu không có file để tải.
- **Xử lý lỗi:** guest gọi API → 401; tài liệu không tồn tại → 404; không có file → 404; `fileKey` có trong DB nhưng file vật lý bị mất → 404 thân thiện, không crash; lỗi hệ thống bất ngờ → 500 chung chung, không lộ absolute path/stack trace/chi tiết Prisma.
- **Preview vẫn công khai, không đổi:** `GET /api/documents/:id/preview` vẫn không gọi `auth()`/`requireAuth()`/`requireRole()` — endpoint download hoàn toàn tách biệt, không tái dùng logic auth của download bên trong preview.

## 12. Học liệu phân loại — Education Taxonomy (Step 6A, *mới*)

- **Cấu trúc phân cấp:** `Grade (Khối lớp) → Subject (Môn học) → Lesson/Topic (Bài học)`, cộng thêm **Document Type** kiểm soát trên mọi Document. Một Subject thuộc đúng 1 Grade; một Lesson thuộc đúng 1 Subject (chưa hỗ trợ many-to-many). Model: `Grade`, `Subject`, `Lesson` trong `prisma/schema.prisma`, enum `DocumentType` (`LECTURE`, `EXERCISE`, `EXAM`, `ANSWER`, `REFERENCE`, `OTHER`).
- **API đọc taxonomy:** `GET /api/grades` (sắp theo `sortOrder`), `GET /api/subjects?gradeId=...`, `GET /api/lessons?subjectId=...` — dùng chung envelope `{ success, data, error }` với các API khác. Chưa có CRUD/quản trị taxonomy ở bước này (chỉ đọc, dữ liệu seed).
- **Dropdown xếp tầng trên `/upload`** (`TaxonomySelectFields`, client component nhỏ): chọn Grade → tải Subject theo Grade đó; chọn Subject → tải Lesson theo Subject đó. Đổi Grade sẽ reset Subject + Lesson; đổi Subject sẽ reset Lesson. Có trạng thái loading và fallback lỗi thân thiện khi không tải được Subject/Lesson.
- **Validate hierarchy bắt buộc ở server, không chỉ dựa vào dropdown:** `validateTaxonomySelection()` (`src/lib/documents/taxonomy.ts`) luôn tra lại DB — Subject phải thực sự thuộc Grade đã chọn, Lesson phải thực sự thuộc Subject đã chọn. Tổ hợp giả mạo/không nhất quán (vd. chọn Grade 12 nhưng gửi kèm Subject thực chất thuộc Grade 11) bị từ chối với `400`, bất kể client gửi ID gì.
- **Tương thích ngược:** `Document.gradeId`/`subjectId`/`lessonId` đều nullable — tài liệu tạo trước khi có taxonomy (hoặc dùng field `subject` free-text cũ) vẫn hiển thị bình thường với `subject` text sẵn có; `documentType` cũ đã migrate sang enum mới, không mất dữ liệu (migration giữ nguyên 24 tài liệu thật lúc chạy, map đúng theo từng loại). Tài liệu upload mới qua taxonomy tự động điền `subject` (text, legacy) từ tên Subject đã chọn, nên trang chủ/tìm kiếm (vẫn nhóm theo field `subject` này) hoạt động không đổi cho cả 2 loại tài liệu.
- **Document Detail & DocumentCard:** hiển thị Grade (badge), Subject, Lesson, Document Type (label dễ đọc, không phải giá trị enum thô) khi tài liệu có taxonomy; tài liệu cũ không có taxonomy vẫn hiển thị gọn gàng qua `subject`/`documentType` như trước — không phá vỡ preview/download.
- **Seed dữ liệu phát triển:** 3 khối (Grade 10/11/12), mỗi khối 2 môn (Mathematics, Physics), mỗi môn 1–2 bài học — đủ để phát triển/kiểm thử luồng, không phải bộ dữ liệu chương trình học đầy đủ. Seed dùng `upsert` theo natural key (không xoá-tạo-lại như Document/User) để chạy lại `npm run db:seed` không làm mất liên kết taxonomy của tài liệu đã có. Giữ nguyên 12 tài liệu seed Step 1 (legacy, không có taxonomy) và thêm 4 tài liệu mẫu mới có taxonomy để kiểm thử cả 2 luồng.

## 13. Đánh giá tài liệu — Document Rating (Step 7A, *mới*)

- **1-5 sao, mỗi người dùng chỉ 1 đánh giá cho mỗi tài liệu:** model `DocumentRating` (`prisma/schema.prisma`) với ràng buộc `@@unique([documentId, userId])` — đánh giá lại cùng tài liệu sẽ cập nhật đánh giá cũ (Prisma `upsert`), không tạo dòng mới. Xoá Document hoặc User sẽ cascade xoá đánh giá liên quan, không để mồ côi.
- **Ai được đánh giá:** `STUDENT`, `TEACHER`, `ADMIN` đều đánh giá được, không phân biệt role. Guest **không** đánh giá được — bấm vào sao sẽ chuyển sang `/login?callbackUrl=/documents/{id}` (tái dùng đúng cơ chế callback an toàn của nút Download, qua helper dùng chung `documentLoginHref()`), **không** gửi đánh giá trước khi đăng nhập.
- **API:**
  - `GET /api/documents/:id/ratings` — công khai, không cần đăng nhập. Trả `averageRating` (làm tròn 1 chữ số thập phân, `null` nếu chưa có đánh giá nào — không dùng `0` vì `0` không phải giá trị đánh giá hợp lệ), `ratingCount`, `currentUserRating` (đánh giá của người gọi nếu đã đăng nhập, ngược lại `null`).
  - `PUT /api/documents/:id/rating` — bắt buộc đăng nhập (mọi role), body `{ value: 1-5 }`. `userId` luôn lấy từ session, **không** nhận từ body — client chỉ được gửi `value`. Đánh giá tài liệu không tồn tại → `404`.
- **Validate server-side:** `value` phải là số nguyên 1-5 (`src/lib/validation/rating.ts`, zod) — `0`, `6`, số âm, số thập phân, chuỗi, `null`, thiếu giá trị đều bị từ chối với `400` thân thiện.
- **Tính trung bình bằng Prisma/PostgreSQL `aggregate()`** (`getRatingSummary()`, `src/lib/documents/rating.ts`) — không load hết các dòng đánh giá vào bộ nhớ, không lưu average trực tiếp trên `Document`.
- **UI trên `/documents/[id]`** (`DocumentRatingSection` + `StarRating`): hiển thị điểm trung bình, tổng số lượt đánh giá, và cụm 5 sao. Guest thấy sao ở chế độ chỉ đọc (theo điểm trung bình đã làm tròn), bấm vào sẽ chuyển sang đăng nhập. Người đã đăng nhập thấy sao tương tác thật (`role="radiogroup"`, dùng bàn phím được), bấm sao sẽ gọi `PUT` rồi tải lại tóm tắt để cập nhật — không dùng optimistic update hay thư viện cache phía client.
- **Toast** (Sonner có sẵn): lần đầu đánh giá → "Rating submitted successfully"; đổi đánh giá đã có → "Rating updated successfully"; lỗi → "Unable to save your rating." (không lộ chi tiết Prisma/database).
- **Tài liệu cũ/legacy và tài liệu có taxonomy đều đánh giá được như nhau** — không cần migrate gì thêm ngoài bảng `DocumentRating` mới.

## 14. Bình luận tài liệu — Document Comments (Step 7B, *mới*)

- **Bình luận phẳng, chưa có reply/thread:** model `DocumentComment` (`prisma/schema.prisma`) liên kết Document và User; xoá Document hoặc User sẽ cascade xoá bình luận liên quan. Nội dung là plain text, giới hạn `COMMENT_MAX_LENGTH` (1000 ký tự, `src/lib/documents/comment-config.ts`) — **không** parse/render như HTML (không dùng `dangerouslySetInnerHTML` ở đâu trong UI bình luận), nên dán nội dung kiểu `<script>...</script>` chỉ hiển thị ra chữ, không thực thi.
- **Đọc công khai, không cần đăng nhập:** `GET /api/documents/:id/comments` — mới nhất trước, phân trang `COMMENTS_PAGE_SIZE` (20, cùng file config) — không bao giờ query không giới hạn; tổng số bình luận lấy từ `count()` của DB, không đếm theo trang trả về. Mỗi bình luận chỉ lộ `author.id`/`name`/`role` — **không** lộ `email`/`passwordHash`.
- **Đăng bình luận cần đăng nhập, không phân biệt role:** `POST /api/documents/:id/comments` — `STUDENT`, `TEACHER`, `ADMIN` đều đăng được. `userId` luôn lấy từ session, client chỉ được gửi `content`. Bình luận tài liệu không tồn tại → `404`.
- **Sửa: chỉ chủ sở hữu, kể cả ADMIN cũng không được sửa bình luận người khác:** `PUT /api/documents/:id/comments/:commentId` trả `403` cho bất kỳ ai không phải tác giả — kiểm duyệt dùng xoá, không dùng sửa giả danh. `updatedAt` đổi khi sửa, `createdAt` giữ nguyên.
- **Xoá: chủ sở hữu hoặc ADMIN:** `DELETE /api/documents/:id/comments/:commentId` — tác giả (mọi role) hoặc ADMIN xoá được; người khác → `403`, guest → `401`. Cả 2 route đều kiểm tra bình luận thực sự thuộc `:id` trong URL — bình luận của Document khác không sửa/xoá được qua nhầm route (trả `404` giống như không tồn tại, không lộ thông tin tồn tại chéo Document).
- **Validate server-side:** nội dung bắt buộc, trim, từ chối rỗng/toàn khoảng trắng/vượt `COMMENT_MAX_LENGTH` (`src/lib/validation/comment.ts`, zod).
- **UI trên `/documents/[id]`** (`CommentSection` + `CommentForm` + `CommentItem`, đặt sau nút Download): tiêu đề `Comments (N)`, textarea thường + nút gửi cho người đã đăng nhập (đếm ký tự, disable khi rỗng/đang gửi — không có rich-text editor), link "Log in to leave a comment" (dùng chung `documentLoginHref()` với Download/Rating) cho guest. Mỗi bình luận hiện tên tác giả, badge role, ngày định dạng, và Edit/Delete inline khi có quyền — Edit chuyển thành textarea kèm Save/Cancel; Delete hiện xác nhận inline nhẹ "Delete this comment?" thay vì `window.confirm()` của trình duyệt.
- **Toast** (Sonner có sẵn): "Comment posted successfully" / "Comment updated successfully" / "Comment deleted successfully" khi thành công; "Unable to save comment" / "Unable to delete comment" khi lỗi (không lộ chi tiết Prisma/database).

## 15. Báo cáo tài liệu — Document Reporting (Step 7C, *mới*)

- **Bất kỳ người dùng đã đăng nhập nào cũng báo cáo được, không giới hạn quyền sở hữu:** `STUDENT`, `TEACHER`, `ADMIN` đều báo cáo được, kể cả báo cáo tài liệu do chính mình upload. Guest thấy nút "Report document" nhưng bấm vào sẽ chuyển sang `/login?callbackUrl=/documents/{id}` (dùng chung `documentLoginHref()` với Download/Rating/Comments) — không gửi báo cáo trước khi đăng nhập.
- **Lý do báo cáo kiểm soát chặt (enum `ReportReason`):** Broken file, Wrong content, Wrong grade/subject/lesson, Preview issue, Duplicate document, Copyright issue, Other — không nhận free-text tuỳ ý.
- **Mô tả (description) tuỳ chọn, trừ khi lý do là Other thì bắt buộc:** trim, giới hạn `REPORT_DESCRIPTION_MAX_LENGTH` (1000 ký tự, `src/lib/documents/report-config.ts`), từ chối mô tả toàn khoảng trắng khi lý do là Other. Plain text, không parse HTML.
- **Chống báo cáo trùng lặp:** mỗi user chỉ có tối đa 1 báo cáo `OPEN` cho mỗi tổ hợp (Document, lý do) — kiểm tra 2 lớp: API tự tra trước để trả `409` thân thiện ("You have already reported this issue."), và một partial unique index viết tay trong migration (`DocumentReport(documentId, userId, reason) WHERE status = 'OPEN'`, vì Prisma schema DSL không hỗ trợ mệnh đề `WHERE` trên `@@unique`) chặn race condition nếu 2 request trùng thời điểm. Báo cáo cũ đã `RESOLVED`/`DISMISSED` **không** chặn báo cáo `OPEN` mới cho cùng lý do. Cùng 1 user vẫn báo cáo được lý do khác bất kỳ lúc nào.
- **API:**
  - `POST /api/documents/:id/reports` — bắt buộc đăng nhập (mọi role), body `{ reason, description? }`. `documentId` luôn lấy từ route, `userId` luôn từ session, `status` luôn là `OPEN` khi tạo — client không thể tự set các trường này. Báo cáo tài liệu không tồn tại → `404`.
  - `GET /api/documents/:id/reports/mine` — bắt buộc đăng nhập, chỉ trả về danh sách lý do mà chính người gọi đang có báo cáo `OPEN` — **không** lộ báo cáo của người khác.
- **Nền tảng trạng thái, chưa có kiểm duyệt:** enum `ReportStatus` (`OPEN` mặc định, `RESOLVED`, `DISMISSED`) đã có trên model, nhưng bước này chỉ tạo báo cáo `OPEN`. **Chưa có** hành động resolve/dismiss, ghi chú admin, trang `/admin/reports`, hay email thông báo — báo cáo chỉ được lưu lại để chờ bước Admin moderation sau này.
- **UI trên `/documents/[id]`** (`ReportDocumentAction`, đặt sau nút Download): hiển thị như 1 link phụ nhỏ, không cạnh tranh thị giác với Preview/Download. Bấm vào mở form mở rộng inline (select lý do + textarea mô tả tuỳ chọn/bắt buộc) thay vì dùng dialog/modal — nhất quán với các primitive tự viết theo phong cách shadcn sẵn có, không thêm dependency mới. Danh sách lý do gợi ý "(already reported)" cho lý do đã có báo cáo `OPEN`, lấy từ `GET .../reports/mine`.
- **Toast** (Sonner có sẵn): "Report submitted successfully" khi thành công; "You have already reported this issue" khi trùng lặp (`409`); "Unable to submit report" khi lỗi khác — không lộ chi tiết Prisma/database. Nút Report không bao giờ bị vô hiệu hoá vĩnh viễn — vẫn báo cáo được lý do khác.

## 16. Lưu tài liệu yêu thích — Bookmarks/Favorites (Step 8A, *mới*)

- **Bất kỳ người dùng đã đăng nhập nào cũng lưu được, mỗi user chỉ 1 lưu cho mỗi tài liệu:** model `DocumentBookmark` (`prisma/schema.prisma`) với `@@unique([documentId, userId])`. `STUDENT`, `TEACHER`, `ADMIN` đều lưu được. Guest thấy nút "Save document" nhưng bấm vào sẽ chuyển sang `/login?callbackUrl=/documents/{id}` (dùng chung `documentLoginHref()` với Download/Rating/Comments/Report) — không lưu trước khi đăng nhập.
- **Thêm là idempotent:** `POST /api/documents/:id/bookmark` dùng Prisma `upsert` trên khoá `(documentId, userId)` — gửi lại nhiều lần không tạo dòng trùng, không lỗi. Xoá (`DELETE`) dùng `deleteMany`, khớp 0 dòng vẫn không lỗi nếu chưa từng lưu.
- **API:**
  - `GET /api/documents/:id/bookmark` — bắt buộc đăng nhập, trả `{ bookmarked: true/false }` chỉ cho chính người gọi.
  - `POST /api/documents/:id/bookmark` — bắt buộc đăng nhập. `documentId` luôn lấy từ route, `userId` luôn từ session — cả 2 endpoint đều không đọc body nên client không có trường nào để giả mạo. Lưu tài liệu không tồn tại → `404`.
  - `DELETE /api/documents/:id/bookmark` — bắt buộc đăng nhập, xoá bookmark của chính người gọi.
- **Riêng tư hoàn toàn theo từng user:** không có tổng số lượt lưu công khai, không xếp hạng phổ biến theo bookmark, không trending — `/saved` chỉ bao giờ query bookmark của chính user đang đăng nhập.
- **UI trên `/documents/[id]`** (`BookmarkAction`, cạnh khối đánh giá sao): nút toggle icon trái tim — viền rỗng "Save document" khi chưa lưu, tô đặc "Saved" khi đã lưu.
- **Trang `/saved`** — bắt buộc đăng nhập (guest → `/login?callbackUrl=/saved`, dùng chung cơ chế `loginHrefFor()`/`documentLoginHref()`). Hiển thị danh sách tài liệu đã lưu của user, sắp theo **ngày lưu mới nhất trước** (`Bookmark.createdAt`, không phải `Document.createdAt`), tái dùng `DocumentCard` và cùng kiểu phân trang với `/search`. Phân trang phía server, giới hạn `SAVED_PAGE_SIZE` (12, `src/lib/documents/bookmark-config.ts`) — không query không giới hạn. Link "Saved" xuất hiện trên header cho user đã đăng nhập.
- **Toast** (Sonner có sẵn): "Document saved" / "Document removed from saved items" khi thành công; "Unable to update saved document" khi lỗi.

## 17. Theo dõi Giáo viên/Bài học — Follow Teacher/Lesson (Step 8B, *mới*)

- **2 quan hệ follow độc lập:** model `TeacherFollow` (`@@unique([followerId, teacherId])`) và `LessonFollow` (`@@unique([userId, lessonId])`) trong `prisma/schema.prisma`. `STUDENT`, `TEACHER`, `ADMIN` đều theo dõi được cả 2 loại. Guest thấy nút Follow nhưng bấm vào sẽ chuyển sang `/login?callbackUrl=...` (dùng chung `loginHrefFor()`/`documentLoginHref()` với Download/Rating/Comments/Report/Bookmark) — không tự động follow sau khi đăng nhập, phải bấm lại.
- **Chỉ user có `role = TEACHER` mới được follow như 1 giáo viên:** `POST /api/teachers/:teacherId/follow` tra role của user đích — `STUDENT`/`ADMIN` hoặc user không tồn tại đều trả `404` giống hệt nhau (không lộ user đích có tồn tại hay không). Một `TEACHER` được phép theo dõi `TEACHER` khác bình thường.
- **Chặn tự theo dõi chính mình:** nếu `followerId === teacherId` → từ chối với `400` thân thiện ("You cannot follow yourself"), kiểm tra trước cả khi tra DB. UI cũng ẩn hẳn nút Follow khi tài liệu do chính người xem upload.
- **Thêm là idempotent, xoá luôn an toàn:** cả 2 API `POST` đều `upsert` trên khoá unique — gọi lại nhiều lần không tạo dòng trùng; cả 2 API `DELETE` đều `deleteMany` — khớp 0 dòng vẫn không lỗi. Cả 4 endpoint (`GET`/`POST`/`DELETE` cho cả Teacher và Lesson) đều không đọc body — `teacherId`/`lessonId` luôn từ route, `followerId`/`userId` luôn từ session.
- **API:**
  - `GET/POST/DELETE /api/teachers/:teacherId/follow` — bắt buộc đăng nhập, chỉ trả/thao tác trạng thái follow của chính người gọi.
  - `GET/POST/DELETE /api/lessons/:lessonId/follow` — tương tự, validate Lesson tồn tại trước khi tạo.
- **UI trên `/documents/[id]`:** `TeacherFollowAction` hiện cạnh tên người upload trong khối "Uploaded by" — chỉ khi `uploadedBy.role === "TEACHER"` (ẩn hoàn toàn nếu người upload không phải giáo viên hoặc tài liệu không có `uploadedBy`). `LessonFollowAction` hiện cạnh tên Lesson trong khối taxonomy — chỉ khi tài liệu có Lesson cấu trúc (ẩn với tài liệu legacy không có Lesson).
- **Trang `/following`** — bắt buộc đăng nhập (guest → `/login?callbackUrl=/following`). 2 mục: **Followed Teachers** (tên + số tài liệu đã upload, tính hiệu quả bằng Prisma `_count`, không lộ email) và **Followed Lessons** (Grade/Subject/Lesson), đều sắp theo **ngày follow mới nhất trước** (`createdAt` của dòng follow, không phải ngày tạo Teacher/Lesson). Phân trang độc lập qua `?teachersPage=`/`?lessonsPage=`, giới hạn `FOLLOWING_PAGE_SIZE` (12, `src/lib/follow/follow-config.ts`). Mỗi mục có nút Unfollow, bấm là xoá khỏi danh sách ngay. Chỉ hiển thị follow của chính user đang đăng nhập — không lộ danh sách follow của người khác.
- **Không hiển thị số lượng follower công khai** ở đâu cả — không xếp hạng giáo viên/bài học phổ biến, không gợi ý follow. Các bảng follow tồn tại để bước Admin/notification sau này truy vấn "ai đang theo dõi Teacher/Lesson này", không phải để hiển thị số đếm ở bước này.
- **Toast** (Sonner có sẵn): "Teacher followed" / "Teacher unfollowed" / "Lesson followed" / "Lesson unfollowed" khi thành công; "Unable to update follow status" khi lỗi.
- **Bước này chỉ tạo và quản lý quan hệ follow** — việc dùng các quan hệ này để thông báo cho người theo dõi khi có tài liệu mới được xây ở Step 8C, xem mục [18. Thông báo trong ứng dụng](#18-thông-báo-trong-ứng-dụng--in-app-notifications-step-8c-mới) bên dưới.

## 18. Thông báo trong ứng dụng — In-App Notifications (Step 8C, *mới*)

- **Chỉ 1 loại thông báo, tạo tự động sau khi upload thành công:** model `Notification` (`prisma/schema.prisma`, enum `NotificationType` hiện chỉ có `NEW_DOCUMENT` — cố tình giữ nhỏ, chưa thiết kế trước các loại comment/rating/report). Người nhận là **hợp của 2 tập** — user đang theo dõi Giáo viên upload (chỉ khi người upload có `role = TEACHER`; ADMIN upload thì nhánh Teacher-follow không áp dụng) và user đang theo dõi Lesson của tài liệu (chỉ khi tài liệu có Lesson cấu trúc) — gộp lại bằng `Set` nên user theo dõi **cả hai** chỉ nhận **đúng 1** thông báo cho tài liệu đó. Người upload luôn bị loại khỏi danh sách nhận, kể cả khi họ tự theo dõi chính mình/Lesson của mình.
- **Sinh thông báo nằm trong flow upload có sẵn, tách bạch khỏi việc tạo Document:** `uploadDocument()` (`src/lib/documents/upload.ts`) gọi `createNewDocumentNotifications()` ngay sau khi `prisma.document.create()` thành công, trong 1 khối `try/catch` **riêng biệt** với khối tạo Document. Nếu sinh thông báo lỗi, lỗi chỉ được log lại — Document đã tạo **không bị xoá, không rollback**, upload vẫn được coi là thành công.
- **Idempotent:** `@@unique([userId, documentId, type])` trên `Notification`, kết hợp `createMany({ skipDuplicates: true })` — gọi sinh thông báo nhiều lần cho cùng 1 Document không bao giờ tạo dòng trùng.
- **Nội dung do server tự sinh, chỉ plain text, không HTML, client không thể can thiệp:** ví dụ khi TEACHER upload: `Teacher Nguyen Van A uploaded "Derivative Exercises" for Derivatives.`; khi ADMIN upload: `A new document "Derivative Exercises" was added to Derivatives.`
- **API:**
  - `GET /api/notifications` — bắt buộc đăng nhập, chỉ trả thông báo của chính người gọi, sắp **mới nhất trước**, phân trang qua `?page=`, giới hạn `NOTIFICATIONS_PAGE_SIZE` (20, `src/lib/notifications/notification-config.ts`). `meta` có thêm `unreadCount` — không phụ thuộc trang hiện tại.
  - `GET /api/notifications/unread-count` — bắt buộc đăng nhập, trả `{ unreadCount }` của chính người gọi.
  - `PATCH /api/notifications/:id/read` — bắt buộc đăng nhập, chỉ đánh dấu đọc thông báo của chính mình; thông báo không tồn tại hoặc của người khác đều trả `404` giống hệt nhau. Gọi lại nhiều lần vẫn an toàn (idempotent).
  - `POST /api/notifications/read-all` — bắt buộc đăng nhập, đánh dấu đọc toàn bộ thông báo **chưa đọc của chính mình**, trả về `{ updatedCount }`.
- **Riêng tư hoàn toàn theo từng user:** `userId` luôn lấy từ session, không bao giờ nhận từ query/body. Không endpoint nào lộ thông báo, số chưa đọc, hay danh sách follower của người khác.
- **Trang `/notifications`** — bắt buộc đăng nhập (guest → `/login?callbackUrl=/notifications`, dùng chung `loginHrefFor()`). Danh sách sắp mới nhất trước; thông báo chưa đọc có nền tô nhẹ, chấm tròn nhỏ, chữ đậm hơn — không dùng màu sắc/hiệu ứng mạnh. Nút "Mark all as read" chỉ hiện khi còn thông báo chưa đọc.
- **Bấm vào 1 thông báo** (`NotificationItem`): đánh dấu đã đọc (gọi API nền, không chặn điều hướng) rồi chuyển sang `/documents/:id` qua `<Link>` bình thường; `router.refresh()` giúp số chưa đọc trên header đồng bộ ở lần render kế tiếp — không cần state toàn cục.
- **Chuông thông báo trên header** (`SiteHeader.tsx`) — chỉ hiện với user đã đăng nhập, có badge số chưa đọc (hiển thị tối đa `99+`), ẩn hẳn badge khi `unreadCount = 0`. Bấm vào chuyển tới `/notifications`.
- **Toast** (Sonner có sẵn): "All notifications marked as read" khi "Mark all as read" thành công; "Unable to update notifications" khi lỗi.
- **Không backfill lịch sử:** chỉ tài liệu upload **sau** khi có Step 8C mới sinh thông báo — tài liệu cũ không được tạo thông báo hồi tố.
- **Chưa có:** thông báo qua email, push notification, tuỳ chọn/cài đặt thông báo (notification preferences), thông báo cho bình luận/đánh giá/báo cáo, hay AI.

## 19. Chuẩn bị Production cho VPS — Production Readiness (Step 13A, *mới*)

- **Chỉ thay đổi cấu hình/vận hành, không đổi tính năng:** mục tiêu Step 13A là triển khai được lên 1 VPS Ubuntu đơn (Nginx → `127.0.0.1:3000` → Next.js → PostgreSQL local), không sửa lại bất kỳ tính năng nào đã có ở trên.
- **Chỉ bind `127.0.0.1:3000`, không public:** `npm start` chạy `next start -H 127.0.0.1` thay vì `next start` trần (mặc định bind mọi interface — đã tự kiểm chứng: không có flag thì thấy `TCP *:3002` trong socket table, có flag thì chỉ thấy `TCP 127.0.0.1:3000`). Ưu tiên hành vi runtime rõ ràng hơn là chỉ dựa vào firewall VPS. `npm run dev` không đổi.
- **Config tập trung, tách theo an toàn client/server:** `src/lib/env-core.ts` chứa toàn bộ logic đọc `process.env` (`STORAGE_ROOT`, `MAX_UPLOAD_SIZE_MB`, `APP_URL`, cộng `DATABASE_URL`/`AUTH_SECRET`/`AUTH_TRUST_HOST`), **không** import `"server-only"` vì `next.config.ts` và các script CLI trong `prisma/` (chạy qua `tsx`) cần import trực tiếp, và 2 context đó không tương thích package `server-only` (đã xác nhận qua lỗi build/tsx thật). `src/lib/env.ts` re-export lại toàn bộ từ `env-core.ts`, có `"server-only"` — code app thật (Server Component, API route, lib server-only khác) import từ đây, nên nếu lỡ import vào Client Component sẽ báo lỗi ngay lúc build thay vì âm thầm trôi qua. Không hàm nào trả về/log giá trị secret thật — `validateProductionEnv()` chỉ báo tên biến thiếu/sai, không bao giờ in giá trị `DATABASE_URL`/`AUTH_SECRET`.
- **`STORAGE_ROOT` — tách file khỏi source code:** production bắt buộc set biến này (absolute path, ví dụ `/var/lib/school-library/storage`, tách khỏi thư mục release `/var/www/school-library/current`) — path tương đối cũng bị từ chối. Dev vẫn dùng `./storage_local` mặc định như cũ, hành vi upload/download/preview không đổi.
- **`MAX_UPLOAD_SIZE_MB` — 1 rule parse duy nhất, dùng chung:** không set thì mặc định 10 MB (không phải lỗi); có set thì phải là số dương hợp lệ — `0`, số âm, hay chữ không phải số đều bị từ chối rõ ràng (production build/start sẽ fail), không còn âm thầm rơi về 10 như trước. Đọc ở 2 nơi với 2 thời điểm khác nhau: `upload-config.ts` đọc lúc app **start** (restart là cập nhật), còn giới hạn body Server Action trong `next.config.ts` bị "đóng băng" lúc **build** — vì vậy env lúc `build` và lúc `start` phải khớp nhau, nếu không giới hạn khung của Next.js có thể thấp hơn giới hạn nghiệp vụ mà không ai biết.
- **`APP_URL` — rà lại, xác nhận không dùng, để optional có validate:** kiểm tra toàn bộ codebase, không có request path nào đọc biến này (pattern self-fetch từng cần nó đã bị xoá ở phần tối ưu performance). Giữ lại làm config *optional* cho mục đích ops (Nginx `server_name` nên trỏ vào đâu) — nếu có set thì phải là URL `http://`/`https://` hợp lệ, sai format sẽ bị `validateProductionEnv()` từ chối rõ ràng.
- **Migration production:** `npm run db:migrate:deploy` (`prisma migrate deploy`) — không tương tác, không seed tự động — dùng thay cho `npm run db:migrate` (`prisma migrate dev`, chỉ dành cho dev).
- **Chặn seed chạy nhầm ở production — hard-fail, không phải cảnh báo:** `prisma/seed.ts` kiểm tra `NODE_ENV` trước khi chạm DB — nếu là `production` thì từ chối ngay, exit code khác 0, không có "continue anyway". Đã verify: chạy thử với `NODE_ENV=production`, đếm số dòng Document/User trước/sau giống hệt nhau. Dev không bị ảnh hưởng.
- **Tạo tài khoản ADMIN production đầu tiên:** `npm run create-admin` (`prisma/create-admin.ts`) — script CLI tương tác, hỏi tên/email/mật khẩu (mật khẩu không hiện ra terminal khi chạy ở terminal thật, fallback hiện rõ chỉ khi input bị pipe/không phải TTY thật), dùng lại đúng validate của đăng ký công khai (`registerSchema`), chỉ khác `role: ADMIN`. Không bao giờ in lại mật khẩu/hash. Không có trang đăng ký Admin, không có API route cho việc này. Từ chối email trùng, exit code khác 0 khi lỗi.
- **`GET /api/health`** — public, dùng cho VPS monitoring/xác minh sau deploy. Kiểm tra app đang chạy + Postgres kết nối được (`SELECT 1`). Trả `{ status: "ok"|"error", checks: { database: "ok"|"error" } }` với mã `200`/`503`. Không bao giờ lộ `DATABASE_URL`, đường dẫn filesystem, secret, hay stack trace — lỗi chi tiết chỉ log phía server. Cố tình giữ tối giản, không thêm các check phụ thuộc/monitoring khác.
- **Rà lại logging:** kiểm tra toàn bộ `console.error`/`console.log` trong `src/` và `prisma/` — log server-side có thể chi tiết (phục vụ debug qua journald ở Step 13B) nhưng không bao giờ có password, `AUTH_SECRET`, session token, hay header `Authorization`; hàm `authorize()` xác thực credentials (`authenticate.ts`) không log gì cả. Response cho client vẫn luôn là thông điệp chung chung.
- **Node.js 24 LTS, ghim rõ ràng:** `engines.node` đổi từ `>=22` (quá rộng, version tương lai vẫn pass) thành `">=24 <25"`, khớp `.nvmrc` (`24`). Đã verify thật — không chỉ đối chiếu `engines` của Next.js: cài Node 24.19.0 thật qua Homebrew (không đổi Node mặc định của máy), chạy toàn bộ Vitest suite + `tsc --noEmit` + `next build`/`npm start` trên Node 24 thật, đối chiếu với Node 26 (bản có sẵn) — cả 2 đều pass giống nhau.
- **Đã verify (live, không chỉ mô tả):** Vitest suite + `tsc --noEmit` + `next build` pass trên cả Node 24 và Node 26 khi có đủ `STORAGE_ROOT`/`AUTH_TRUST_HOST`; `next build` **báo lỗi đúng, riêng biệt** cho từng trường hợp: thiếu `STORAGE_ROOT`, `STORAGE_ROOT` tương đối, `MAX_UPLOAD_SIZE_MB` = 0/âm/không phải số, `APP_URL` sai format — test từng trường hợp riêng. `npm start` chạy thật với Postgres thật: socket table xác nhận chỉ `127.0.0.1:3000` (không có `0.0.0.0`/wildcard), `curl` + `/api/health` đều 200, đăng nhập được, upload file thật nằm đúng `STORAGE_ROOT` cấu hình (xác nhận trên disk) và đọc được qua preview/download, seed guard chặn đúng trước khi đụng DB, `create-admin` tạo tài khoản thật + đăng nhập được + từ chối email trùng. Toàn bộ data test đã xoá sau khi verify.
- **Chưa làm ở Step 13A:** file cấu hình systemd, script deploy tự động, cấu trúc thư mục release, cấu hình Nginx — **đã làm ở Step 13B ngay dưới đây**. Security headers, rate limiting, backup/restore vẫn còn để các sub-step sau.

## 20. Chuẩn bị Deploy & Runtime — Deployment & Runtime Preparation (Step 13B, *mới*)

- **Chỉ chuẩn bị artifact trong repo, KHÔNG deploy lên VPS thật:** toàn bộ mục này là template + script nằm trong repo (`deploy/`) — không SSH, không cài đặt, không restart service, không đụng UFW/PostgreSQL thật, không deploy source thật lên VPS nào cả.
- **Kiến trúc release-based:** `/var/www/school-library/releases/<timestamp>-<sha>/` (mỗi lần deploy 1 thư mục riêng, export từ `git archive`, không có `.git` hay file untracked lẫn vào) + symlink `current` trỏ tới release đang chạy. Dữ liệu bền vững (`STORAGE_ROOT`, `/etc/school-library/production.env`) nằm **ngoài** mọi release — xoá/deploy release không bao giờ đụng tới file đã upload hay secret.
- **`deploy/systemd/school-library.service`** — template, chưa cài lên máy nào. Chạy bằng user `schoolapp` (không phải root), từ `current`, load `production.env` qua `EnvironmentFile`, chạy đúng lệnh `npm start` thật (đã bind `127.0.0.1:3000` từ Step 13A). Hardening nhẹ (`NoNewPrivileges`, `PrivateTmp`, `ProtectSystem=strict` + `ReadWritePaths` cho `STORAGE_ROOT`) — cố tình chưa hardening sâu (để Step 13C). Log qua `journalctl -u school-library`, không ghi log vào thư mục source.
- **`deploy/nginx/school-library.conf`** — template, chưa cài lên máy nào. Proxy `YOUR_DOMAIN` (placeholder, chưa phải domain thật) → `127.0.0.1:3000`, forward đủ header chuẩn (`Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`). `client_max_body_size 12M` — cao hơn `MAX_UPLOAD_SIZE_MB` mặc định (10) một chút; **nếu đổi `MAX_UPLOAD_SIZE_MB` phải tự sửa giá trị này rồi reload Nginx**, Nginx không tự đọc được env của app. Không có `location` nào serve trực tiếp `/var/lib/school-library/storage` — preview/download vẫn luôn đi qua route Next.js có kiểm tra auth. HTTPS **chưa** cấu hình — chỉ có block comment placeholder cho Certbot ở bước sau.
- **`deploy/scripts/deploy.sh`** — `set -euo pipefail`, không có `set -x` (tránh lộ giá trị của `production.env` được `source` giữa script). Luồng: resolve git ref → tạo release dir mới → `git archive` export → `npm ci` → verify Node version theo `.nvmrc` → `prisma generate` → `npm test` → `tsc --noEmit` → `npm run db:migrate:deploy` → `npm run build` → chuyển symlink `current` (atomic, `ln -sfn` + `mv -Tf`) → `systemctl restart` → check `/api/health` → dọn release cũ (giữ 5 bản gần nhất + bản đang active). Test/tsc/build/migration lỗi → dừng ngay (`set -e`), symlink/service KHÔNG bị đụng, release cũ vẫn chạy. Không bao giờ gọi `npm run db:seed` hay `npm run create-admin` trong lúc deploy.
- **Rollback tự động khi health check thất bại sau restart:** chuyển `current` về release trước đó + restart lại, rồi báo lỗi rõ ràng — **không** tự động rollback database. Đã ghi rõ: "Source rollback ≠ database rollback" — nếu migration không tương thích ngược, revert source thôi chưa chắc an toàn.
- **Dọn release cũ an toàn:** giữ 5 bản gần nhất + bản `current` đang trỏ tới (kể cả khi bản đó cũ hơn 5 bản gần nhất, ví dụ sau rollback) — không bao giờ xoá `current`, release đang active, storage, hay file env.
- **`create-admin` vẫn tách biệt:** không nằm trong `deploy.sh`, không chạy mỗi lần deploy — vẫn là thao tác thủ công 1 lần như Step 13A.
- **Đã verify kỹ bằng dry-run thật (không chạm VPS thật):** `bash -n` syntax check pass. Chạy **toàn bộ** script thật (không mock) với 1 git repo tạm trong `/tmp` (tách biệt hoàn toàn khỏi repo thật) — `npm ci`/`prisma generate`/`npm test` (583 test pass)/`tsc --noEmit`/`npm run db:migrate:deploy` (no-op an toàn, DB local đã migrate sẵn)/`npm run build` đều chạy **thật**, chỉ mock `systemctl`/`sudo`/`curl` health check. Test riêng path rollback: health check trỏ tới port không lắng nghe → xác nhận script tự chuyển `current` về release cũ + restart lại + báo lỗi rõ, không đụng DB. Test riêng logic dọn release cũ với case "current đang trỏ vào bản cũ nhất" (nếu không giữ đúng sẽ mất release đang chạy) — **bắt được 1 bug thật**: so sánh path bằng string thay vì canonicalize cả 2 vế khiến `current` bị xoá nhầm khi `BASE_DIR` có symlink (macOS `/tmp` → `/private/tmp`) — đã fix bằng cách `readlink -f` cả 2 vế trước khi so sánh. Cũng phát hiện `mapfile` (bash 4+) không chạy trên bash 3.2 — đã đổi sang `while read` cho tương thích rộng hơn. Đã rà static: không có password/token/domain thật/SSH key nào trong `deploy/`.
- **Chưa làm:** deploy thật lên VPS, HTTPS/Certbot, security headers, rate limiting, backup/restore automation — xem mục Chưa làm bên dưới.

---

## Chưa làm (ngoài phạm vi hiện tại)

- Trang quản trị (Admin dashboard), quản lý người dùng (User management)
- Quản trị taxonomy (thêm/sửa/xoá Grade/Subject/Lesson qua UI)
- Duyệt giáo viên (teacher approval)
- Preview Word cũ (.doc), preview Excel (.xls/.xlsx), PDF.js, thumbnail, image gallery
- Đăng nhập Google/OAuth, xác minh email, quên mật khẩu, 2FA
- Tìm kiếm AI / semantic search / embeddings, trích xuất nội dung file, xử lý AI, lưu tìm kiếm (saved searches)
- Upload nhiều file cùng lúc, drag & drop, thanh tiến trình upload
- Sắp xếp tìm kiếm theo rating (rating-based search sort), rating analytics/moderation
- Trả lời bình luận / thread lồng nhau (comment replies, nested threads), mention, rich text/hình ảnh trong bình luận, thích bình luận (comment likes)
- Kiểm duyệt báo cáo (admin report moderation), resolve/dismiss report, ghi chú admin, `/admin/reports`, email thông báo
- Tổng số lượt lưu công khai (bookmark count), xếp hạng phổ biến/trending theo bookmark, bộ sưu tập/thư mục (collections), chia sẻ mạng xã hội
- Số lượt follower công khai, gợi ý follow, trang hồ sơ giáo viên (teacher public profile), trang chi tiết bài học (lesson detail page)
- Thông báo qua email/push, tuỳ chọn/cài đặt thông báo (notification preferences), thông báo cho bình luận/đánh giá/báo cáo
- Deploy thật lên VPS (chạy `deploy.sh` thật, cài systemd unit + Nginx config thật lên server), HTTPS/Certbot (Step 13B chỉ có template + script trong repo, chưa động vào VPS thật)
- Security headers, rate limiting API, security hardening upload/auth (Step 13C)
- Backup/restore PostgreSQL + file storage, tài liệu vận hành backup (Step 13D)
