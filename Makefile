.PHONY: dev db-start db-stop db-reset migrate seed sqlx-prepare backend frontend dbhub test

DB_URL = postgres://timeshift:timeshift_dev@localhost:5432/timeshift
CONTAINER = timeshift-pg

# Start the dev database
db-start:
	podman run -d --name $(CONTAINER) \
		-e POSTGRES_USER=timeshift \
		-e POSTGRES_PASSWORD=timeshift_dev \
		-e POSTGRES_DB=timeshift \
		-p 5432:5432 \
		docker.io/postgres:16-alpine || podman start $(CONTAINER)

# Stop the dev database
db-stop:
	podman stop $(CONTAINER)

# Drop and recreate the database
db-reset:
	podman exec $(CONTAINER) psql -U timeshift -c "DROP DATABASE IF EXISTS timeshift;" postgres
	podman exec $(CONTAINER) psql -U timeshift -c "CREATE DATABASE timeshift;" postgres

# Apply migrations
migrate:
	DATABASE_URL=$(DB_URL) sqlx migrate run --source backend/migrations

# Load seed data (run after migrate)
seed:
	podman exec -i $(CONTAINER) psql -U timeshift -d timeshift < backend/seeds/valleycom.sql

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
