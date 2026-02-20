.PHONY: dev db-reset migrate seed sqlx-prepare backend frontend dbhub test

DB_URL = postgres://timeshift:timeshift_dev@127.0.0.1:5432/timeshift

# Drop and recreate the database (native PostgreSQL)
db-reset:
	sudo -u postgres psql -c "DROP DATABASE IF EXISTS timeshift;" postgres
	sudo -u postgres psql -c "CREATE DATABASE timeshift OWNER timeshift;" postgres

# Apply migrations
migrate:
	DATABASE_URL=$(DB_URL) sqlx migrate run --source backend/migrations

# Load seed data (run after migrate)
seed:
	PGPASSWORD=timeshift_dev psql -U timeshift -h 127.0.0.1 -d timeshift < backend/seeds/valleycom.sql

# Regenerate sqlx offline query cache (run after changing SQL queries)
sqlx-prepare:
	cd backend && DATABASE_URL=$(DB_URL) cargo sqlx prepare

# Run the backend
backend:
	cd backend && DATABASE_URL=$(DB_URL) cargo run

# Run dbhub MCP server against this project's database.
# It prefers DSN if set; otherwise falls back to DATABASE_URL (from .env or env).
dbhub:
	@set -a; [ -f .env ] && . ./.env; set +a; \
	DSN=$${DSN:-$${DATABASE_URL}}; \
	if [ -z "$$DSN" ]; then \
		echo "Missing DSN/DATABASE_URL. Set one in .env or your shell."; \
		exit 1; \
	fi; \
	npx -y @bytebase/dbhub@latest --dsn "$$DSN"

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
