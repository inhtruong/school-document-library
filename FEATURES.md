# Tính năng hiện tại — Stacks (School Document Library)

Tài liệu này mô tả các tính năng đã hoàn thiện tính đến thời điểm hiện tại. Đây là bản MVP tập trung vào quản lý/tìm kiếm tài liệu, xác thực, upload theo học liệu phân loại (Grade → Subject → Lesson → Document Type), tìm kiếm có bộ lọc/sắp xếp/phân trang theo taxonomy, xem trước tài liệu công khai (PDF/ảnh/video/Word hiện đại .docx), tải tài liệu có bảo vệ đăng nhập, đánh giá tài liệu 1-5 sao, và bình luận tài liệu — **chưa có** preview Word cũ (.doc)/Excel, trang quản trị, báo cáo (report), hay tìm kiếm AI.

## Stack công nghệ

- **Frontend:** Next.js (App Router) + React + Tailwind CSS + shadcn/ui-style components
- **Backend:** Next.js Route Handlers (REST API)
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** Auth.js (Credentials provider, JWT session)
- **File Storage:** Local filesystem (`storage_local/`, server-side only) — không cần dịch vụ lưu trữ ngoài
- **Test:** Vitest (364 test, cover validation + API routes + api-client + auth/authorization + upload/local storage + preview/Range parsing + preview-kind classification + DOCX render integration boundary + protected download + safe callback URL + Content-Disposition filename safety + education taxonomy validation/APIs + search query parsing/taxonomy filter resolution/sort/pagination + rating validation/aggregation/API/ownership + comment validation/pagination/API/ownership/cross-Document isolation)

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
- Báo cáo tài liệu (report), yêu thích (bookmark), theo dõi giáo viên/bài học (follow), thông báo (notifications)
