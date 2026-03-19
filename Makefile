.PHONY: dev db-reset migrate seed reseed sqlx-prepare backend frontend test

DB_URL ?= postgres://timeshift:timeshift_dev@127.0.0.1:5432/timeshift

# Drop and recreate the database (native PostgreSQL)
db-reset:
	sudo -u postgres psql -c "DROP DATABASE IF EXISTS timeshift;" postgres
	sudo -u postgres psql -c "CREATE DATABASE timeshift OWNER timeshift;" postgres

# Apply migrations
migrate:
	DATABASE_URL=$(DB_URL) sqlx migrate run --source backend/migrations

# Load seed data (run after migrate — first-time only)
seed:
	PGPASSWORD=timeshift_dev psql -U timeshift -h 127.0.0.1 -d timeshift < backend/seeds/demo.sql

# Wipe and reload all seed data (works on both dev and production)
reseed:
	./scripts/reseed.sh

# Regenerate sqlx offline query cache (run after changing SQL queries)
sqlx-prepare:
	cd backend && DATABASE_URL=$(DB_URL) cargo sqlx prepare

# Run the backend
backend:
	cd backend && DATABASE_URL=$(DB_URL) cargo run

# Run backend tests
test:
	cd backend && DATABASE_URL=$(DB_URL) TEST_DATABASE_URL=$(DB_URL) cargo test

# Run the frontend dev server
frontend:
	cd frontend && npm run dev

# Run both (requires two terminals or use tmux)
dev:
	@echo "Start backend:  make backend"
	@echo "Start frontend: make frontend"
	@echo "Or use: tmux new-session 'make backend' \; split-window 'make frontend'"
