# EdgeSphere — End User Guide

Welcome to the EdgeSphere platform! This guide will walk you through exactly how to use the system step-by-step as an end user, from creating an account to uploading files and experiencing high-speed CDN delivery.

---

## Step 1: Accessing the Dashboard

Once the platform is running (via `npm run Edsphere`), open your web browser and navigate to the main dashboard:
👉 **[http://localhost:3100](http://localhost:3100)**

This is the central Next.js frontend where all user interactions take place.

---

## Step 2: Creating an Account (Registration)

Before you can upload files, you need to create an account.
1. On the Dashboard home page, click the **"Register"** or **"Sign Up"** button.
2. Enter your email address and a strong password.
3. Click Submit.
   - *Behind the scenes: The Next.js app sends this to the API Gateway, which forwards it to the Auth Service. A PostgreSQL record is created, and a JWT token is returned.*
4. Once registered, log in using your new credentials. You are now authenticated!

---

## Step 3: Creating a Storage Bucket

Similar to AWS S3, all files in EdgeSphere must be organized into "Buckets".
1. Navigate to the **"Storage"** or **"Buckets"** section in the Dashboard sidebar.
2. Click **"Create New Bucket"**.
3. Give your bucket a unique name (e.g., `my-first-bucket`).
   - *Rules: Lowercase letters, numbers, and hyphens only (no spaces).*
4. Choose whether the bucket should be **Public** (anyone can view the files via CDN) or **Private** (requires authentication to view).
5. Click **Create**.
   - *Behind the scenes: The Storage Service creates the metadata in Postgres and provisions the actual bucket in the underlying MinIO server.*

---

## Step 4: Uploading Files

Now that you have a bucket, let's upload a file.
1. Click on your newly created bucket to open it.
2. Click the **"Upload File"** button (or drag and drop a file).
3. Select an image or video from your computer.
4. The upload will start immediately, and you will see a progress bar.
   - *Behind the scenes: The frontend requests a **Presigned URL** from the backend. It then uploads the file directly to MinIO, ensuring high performance even for massive 5GB videos.*

---

## Step 5: Experiencing the CDN & Real-time Updates

Once the file is uploaded, you can experience the true power of EdgeSphere!

### 1. Real-time WebSocket Notifications
Notice how the file immediately appeared in your bucket list on the Dashboard without you having to refresh the page?
- *How it works: When the upload finishes, a Kafka event is fired. The WebSocket Gateway catches it and pushes a live update to your screen.*

### 2. Accessing the File via CDN
Click on the uploaded file in the Dashboard to get its **CDN Link**. It will look something like this:
`http://localhost:8080/my-first-bucket/image.jpg`

- **First Click (Cache Miss):** Open the link in a new tab. It will load normally. The CDN had to fetch this from the origin (MinIO) and save it to RAM.
- **Second Click (Cache Hit):** Refresh the page. Notice how it loads almost instantly? It is now being served directly from the CDN Edge Node's Redis RAM cache!

### 3. On-the-Fly Image Resizing (Bonus)
If you uploaded an image, you can ask the CDN to resize it for you instantly!
Add `?w=300` to the end of your CDN URL:
`http://localhost:8080/my-first-bucket/image.jpg?w=300`
Press enter, and the CDN will automatically resize the image to 300 pixels wide and cache that specific size for future requests.

---

## Admin Section: Viewing Observability Tools

If you want to see what is happening in the background as an Admin, EdgeSphere provides professional observability tools:

### MinIO Console (Direct Object Storage)
- **URL:** [http://localhost:9001](http://localhost:9001)
- **Login:** `admin` / `admin123` (Default Docker credentials)
- Here you can see the raw files stored directly on the disk, exactly as AWS S3 looks.

### Grafana (Platform Metrics)
- **URL:** [http://localhost:3200](http://localhost:3200)
- **Login:** `admin` / `admin`
- View beautiful dashboards showing API Gateway traffic, Redis cache hit rates, CPU usage, and Storage capacity.

### Jaeger (Request Tracing)
- **URL:** [http://localhost:16686](http://localhost:16686)
- Wondering why a file upload was slow? Open Jaeger and search for your request. It will show you exactly how many milliseconds the Gateway, Auth, and Storage services took to process it.
