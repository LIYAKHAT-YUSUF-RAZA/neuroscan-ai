# Main Backend Gateway (Node.js + Express + Multer)

API gateway providing request validation, file streaming to the Python AI service, CORS protection, and optional MongoDB history persistence with graceful degradation.

---

## Features
- **In-Memory Streaming:** Multer stores files in memory buffers to avoid orphaned files on disk.
- **Resilient Persistence:** If MongoDB is offline, inferences continue normally while history saving is bypassed.
- **Security:** Strict MIME type validation, 10 MB payload limits, and no stack trace leaks in production.

---

## Setup & Running

1. **Install Dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Run Tests:**
   ```bash
   npm test
   ```

3. **Start Development Server:**
   ```bash
   npm run dev
   ```
   Or production:
   ```bash
   npm start
   ```
   The backend runs on `http://localhost:5000`.

---

## API Endpoints

- `GET /api/health`: System health (Express status, MongoDB connectivity, Flask AI availability).
- `POST /api/predict`: Multipart image upload on field `image`. Returns complete classification, category distribution, and heatmaps.
- `POST /api/explain`: Multipart image upload returning standalone Grad-CAM and Integrated Gradients.
- `GET /api/history`: Recent prediction runs recorded in MongoDB.
- `DELETE /api/history`: Clears all saved prediction records.
