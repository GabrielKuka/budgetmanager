# BudgetManager — Project Guidelines

## Stack

| Layer    | Technology                                |
| -------- | ----------------------------------------- |
| Frontend | React 18, react-router-dom v6, Recharts   |
| Backend  | Django 4.2, DRF 3.14, SQLite              |
| Styling  | SCSS + CSS custom properties (light/dark) |
| Auth     | DRF TokenAuthentication (custom User model via email) |
| CI/CD    | Azure Pipelines, Docker Compose           |

## Build & Test

### Frontend (`cd frontend`)
```sh
npm install              # install deps
npm start                # dev on :3001 (production-like)
npm run test-start       # dev on :3002 (local testing only)
npm test                 # run tests (jest)
npx prettier ./src/ --check  # formatting check (CI)
npx prettier ./src/ --write  # auto-format (commit hook)
```

### Backend (`cd backend`)
```sh
uv sync                  # install deps
uv run python manage.py runserver 100.73.35.59:8002  # local testing
uv run python manage.py runserver 0.0.0.0:8001       # production / Docker
uv run black -l 79 --check .  # formatting check (CI)
uv run black -l 79 .         # auto-format (commit hook)
```

### Docker
```sh
docker-compose up -d --build
```

## Architecture

- **Frontend** serves on `:3001`, uses Axios to call the Django backend on `:8001`
- **Backend** serves a REST API via DRF, authentication via `TokenAuthentication`
- **Database**: SQLite at `budgetdb/budgetmanagerdb_v3`, shared via volume mount
- **State**: React Context API — see `frontend/src/context/` (GlobalContext, ThemeContext, ToastContext, ConfirmContext)
- **Custom User model**: `Users.User` with `email` as `USERNAME_FIELD`

## Code Conventions

### Frontend
- Use **SCSS** colocated with components (e.g., `navbar.jsx` → `navbar.scss`)
- Theme via CSS variables in `:root` / `:root[data-theme="dark"]` (defined in `index.css`)
- Context-based state management — do NOT add Redux or other state libraries
- Components use `.jsx` extension, non-component helpers use `.js`
- Format with Prettier (v2.8.8)

### Backend
- **Function-based views** with `@api_view` decorators for most endpoints; class-based generics for auth CRUD
- Serializers: ModelSerializer with `validate_<field>()` for custom validation
- URL config per app in `urls.py`, included in root `budgetmanager/urls.py`
- Management commands in `backend/{app}/management/commands/`
- Format with Black (`-l 79`)
- Token in request header: `Authorization: Token <value>`

## Key Endpoints

| Prefix          | App            |
| --------------- | -------------- |
| `/users/`       | Registration, token, profile |
| `/accounts/`    | Account CRUD, totals, stats  |
| `/transactions/`| Add, delete, search, stats   |
| `/currencies/`  | Convert, exchange rates      |

## Potential Pitfalls

- `TokenAuthentication` requires `rest_framework.authtoken` in INSTALLED_APPS (already configured)
- Backend runs Python 3.8–3.10 — avoid f-string debugging tricks and 3.11+ features
- CORS allows all origins locally — do not ship to production without restricting
- Frontend uses `PORT=3001` (production) or `PORT=3002` (local testing via `npm run test-start`) — watch for port conflicts
- Backend uses port `8001` in production / Docker, port `8002` for local testing
