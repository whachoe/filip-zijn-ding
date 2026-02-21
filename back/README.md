# MMT Assessment Tool - Backend API

## Setup

### 1. Install Dependencies
```bash
cd back
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` and update with your database credentials:
```bash
cp .env.example .env
```

Edit `.env`:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mmt_assessment
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_secure_random_string
PORT=3000
```

### 3. Create Database
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE mmt_assessment;
```

### 4. Run Migrations
```bash
npm run migrate
```

This will create all tables and insert a default admin user:
- Username: `admin`
- Password: `admin123`
- **⚠️ Change this password immediately in production!**

### 5. Start Server

Development mode (with auto-restart):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

Server will run on `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Assessments (requires authentication)
- `GET /api/assessments` - List user's assessments
- `GET /api/assessments/:id` - Get specific assessment
- `POST /api/assessments` - Upload/sync assessment(s)
- `DELETE /api/assessments/:id` - Delete assessment

### Questions
- `GET /api/questions/latest` - Get latest question set
- `GET /api/questions/:version` - Get specific version

### Media (requires authentication)
- `POST /api/media` - Upload file
- `GET /api/media/:id` - Download file
- `GET /api/media/assessment/:assessmentId` - Get files for assessment
- `DELETE /api/media/:id` - Delete file

### Admin (requires admin role)
- `GET /api/admin/users` - List all users
- `PUT /api/admin/users/:id/role` - Update user role
- `GET /api/admin/questions` - List all question sets
- `POST /api/admin/questions` - Create new question set
- `PUT /api/admin/questions/:id` - Update question set
- `GET /api/admin/assessments` - List all assessments

### Health Check
- `GET /api/health` - Server health status

## Development

### Database Access
```bash
psql -U postgres -d mmt_assessment
```

### View Logs
Server logs to console. In production, consider using PM2 or similar for log management.

### Testing API
Use curl, Postman, or any HTTP client:

```bash
# Register user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123","email":"test@example.com"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123"}'

# Use returned token for authenticated requests
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Security Notes

1. **Change default admin password** immediately
2. **Use strong JWT_SECRET** in production (generate with `openssl rand -hex 32`)
3. **Enable HTTPS** in production
4. **Set secure CORS** policy in production
5. **Regular backups** of PostgreSQL database
6. **Monitor file uploads** (disk space, malicious files)

## Deployment

### Using PM2
```bash
npm install -g pm2
pm2 start server.js --name mmt-api
pm2 save
pm2 startup
```

### Nginx Reverse Proxy
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
