Reddit Clone - Backend
A backend implementation for a Reddit-like social media application built with Node.js, Express, and Prisma.

Features
User authentication (register/login)

JWT-based session management

File uploads with Cloudinary integration

Prisma ORM for database management

RESTful API endpoints

Technologies Used
Node.js

Express

Prisma (ORM)

PostgreSQL (database)

Cloudinary (image storage)

JSON Web Tokens (authentication)

Bcrypt (password hashing)

Prerequisites
Node.js (v16 or higher recommended)

PostgreSQL database

Cloudinary account (for image uploads)

npm or yarn

Installation
Clone the repository:

bash
git clone https://github.com/your-username/reddit-clone-backend.git
cd reddit-clone-backend
Install dependencies:

bash
npm install
# or
yarn install
Set up environment variables:
Create a .env file in the root directory with the following variables:

DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
JWT_SECRET=your_jwt_secret_key
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
Run database migrations:

bash
npx prisma migrate dev
Running the Application
For development:

bash
npm run dev
# or
yarn dev
The server will start on http://localhost:3000 by default.

Available Scripts
dev: Start the development server with nodemon

migrate:dev: Run Prisma migrations in development mode

migrate:deploy: Deploy Prisma migrations to production

generate: Generate Prisma client

postinstall: Automatically runs after installation (generates Prisma client and pushes DB schema)

Database Schema
The Prisma schema can be found in prisma/schema.prisma. Run the following command to visualize your database:

bash
npx prisma studio
API Documentation
API endpoints and their documentation will be available once the server is running. Check the routes directory for implementation details.

Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.
