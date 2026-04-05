# Unix/macOS helpers (use Git Bash or WSL on Windows).
.PHONY: help compose-up compose-down compose-build test-backend k8s-apply

help:
	@echo "Targets:"
	@echo "  compose-build   - docker compose build"
	@echo "  compose-up      - docker compose up -d"
	@echo "  compose-down    - docker compose down"
	@echo "  test-backend    - pytest in backend/"
	@echo "  k8s-apply       - kubectl apply -k k8s/"

compose-build:
	docker compose build

compose-up:
	docker compose up -d

compose-down:
	docker compose down

test-backend:
	cd backend && python -m pip install -q -r requirements-dev.txt && python -m pytest

k8s-apply:
	kubectl apply -k k8s/
