# advanced-phishing-detector
Advanced Email Phishing Detector.

## Prerequisites
1. Docker Desktop (or Docker Engine + Docker Compose).
2. Python 3.12+ for local backend runs.
3. Node.js 20+ for local frontend runs.

## Train The Model
1. `cd backend/data`
2. `python create_model.py`

## Run Locally (Without Docker)
1. Ensure PostgreSQL is running and reachable.
2. Update `DATABASE_URL` in `backend/database.py` or set it via environment variable.
3. Start backend:
	1. `cd backend`
	2. `uvicorn app:app --reload`
4. Start frontend in another terminal:
	1. `cd frontend/app`
	2. `npm install`
	3. `npm run dev`

## Run With Docker
From the repository root:
1. `docker compose up --build`

On first backend startup, if `backend/data/phishing_model.pkl` is missing, the container will train and generate it automatically before starting the API.

## Rebuild And Restart
1. `docker compose down`
2. `docker compose up --build`

## Rebuild From A Clean Database
1. `docker compose down -v`
2. `docker compose up --build`

Notes:
1. `docker compose up --build` rebuilds containers but keeps the Postgres data volume.
2. Use `down -v` only when you want to remove all existing DB data.
3. If you change frontend code while using the current compose setup, a full rebuild is usually not required.
4. If you change backend dependencies or Dockerfile layers, rebuild is required.

## Common Commands
1. Start all services: `docker compose up --build`
2. Stop all services: `docker compose down`
3. Reset DB and start fresh: `docker compose down -v ; docker compose up --build`
4. Run backend tests: `cd backend ; pytest tests -v`

## Service URLs
1. Frontend: `http://localhost:3000`
2. Backend API: `http://localhost:8000`
3. Health check: `http://localhost:8000/health`