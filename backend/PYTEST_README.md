# Pytest Testing Guide

This document provides instructions for running pytest tests for the advanced-phishing-detector backend, both locally and in Docker.

## Quick Start

### Local Testing (fastest)
```bash
# Install dependencies
pip install -r requirements.txt

# Run all tests
pytest -v

# Run with coverage report
pytest -v --cov=. --cov-report=html tests/
```

### Docker Testing
```bash
# Build backend image
docker build -t phishing-backend .

# Run all tests in container
docker run --rm phishing-backend pytest tests/ -v
```

---

## Running Tests Locally

### Prerequisites

- **Python**: 3.11+ (installed and accessible in PATH)
- **pip**: Python package manager
- **Virtual Environment** (optional but recommended):
  ```bash
  python -m venv venv
  # On Windows:
  venv\Scripts\activate
  # On macOS/Linux:
  source venv/bin/activate
  ```

### Installation

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Install all dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

  **Note**: `uvloop` is included in requirements with a platform marker and installs only on non-Windows systems.
  On Windows, pip automatically skips it.

3. **Verify installation**:
   ```bash
   pytest --version
   ```

### Running Tests

#### Run all tests with verbose output
```bash
pytest -v
```
Output shows each test as it passes/fails:
```
tests/test_feedback.py::test_submit_feedback_creates_reported_email_and_feedback PASSED [  4%]
tests/test_login.py::test_login_success PASSED                                         [ 36%]
...
======================== 25 passed in 1.23s ========================
```

#### Run specific test file
```bash
# Only authentication tests
pytest tests/test_login.py -v

# Only predictions tests
pytest tests/test_predict.py -v

# Only statistics tests
pytest tests/test_statistics.py -v

# Only feedback tests
pytest tests/test_feedback.py -v

# Only user management tests
pytest tests/test_users.py -v
```

#### Run specific test function
```bash
# One test at a time
pytest tests/test_login.py::test_login_success -v
pytest tests/test_predict.py::test_predict_model_high_risk -v
```

#### Run with coverage report
```bash
# Show coverage in terminal
pytest -v --cov=. tests/

# Generate HTML coverage report (opens in browser)
pytest -v --cov=. --cov-report=html tests/
# Open htmlcov/index.html in your browser
```

#### Show test output/prints
```bash
# Capture output from print() statements
pytest -v -s tests/

# Show local variables on failure
pytest -v -l tests/
```

#### Fail fast (stop on first failure)
```bash
pytest -v -x tests/
```

#### Run only tests matching a pattern
```bash
# All tests with "feedback" in name
pytest -v -k feedback

# All tests with "login" in name
pytest -v -k login
```

### Test Structure

The backend includes 25 tests across 7 test files:

| File | Tests | Purpose |
|------|-------|---------|
| `test_health.py` | 1 | Health endpoint verification |
| `test_login.py` | 3 | Authentication & login flow |
| `test_predict.py` | 4 | ML model predictions |
| `test_users.py` | 5 | User CRUD operations |
| `test_statistics.py` | 3 | Statistics endpoint |
| `test_feedback.py` | 7 | Feedback submission & retrieval |
| `conftest.py` | N/A | Shared test fixtures & setup |

### Test Fixtures

All tests rely on fixtures defined in `conftest.py`:

- **`setup_database`**: Creates/tears down test SQLite database (session-scoped)
- **`db_session`**: Fresh database session for each test (function-scoped)
- **`client`**: FastAPI TestClient with overridden database dependency
- **`normal_user`**: Test user with "viewer" role
- **`admin_user`**: Test user with "admin" role

Example fixture usage in tests:
```python
def test_login_success(client):
    """Uses the 'client' fixture"""
    response = client.post("/auth/login", json={...})
    assert response.status_code == 200

def test_predict(client, db_session):
    """Uses both 'client' and 'db_session' fixtures"""
    response = client.post("/predict", json={...})
    assert response.status_code == 200
```

---

## Running Tests in Docker

### Prerequisites

- **Docker**: Installed and running ([Install Docker](https://docs.docker.com/get-docker/))
- **Docker Compose** (optional, for multi-container testing)

### Build the Backend Image

```bash
cd backend
docker build -t phishing-backend .
```

This creates an image with:
- Python 3.11 runtime
- All dependencies from `requirements.txt`
- Backend source code copied in
- Pytest installed and ready

### Run Tests in Container

#### All tests with verbose output
```bash
docker run --rm phishing-backend pytest tests/ -v
```

#### Specific test file
```bash
docker run --rm phishing-backend pytest tests/test_login.py -v
```

#### With coverage
```bash
docker run --rm phishing-backend pytest tests/ -v --cov=. --cov-report=term-missing
```

#### Save coverage report to local machine
```bash
docker run --rm -v %cd%\coverage:/app/htmlcov phishing-backend \
  pytest tests/ --cov=. --cov-report=html
# On macOS/Linux:
# docker run --rm -v $(pwd)/coverage:/app/htmlcov phishing-backend \
#   pytest tests/ --cov=. --cov-report=html
```

### Using Docker Compose

If Docker Compose services are configured for testing:

```bash
# Run tests with docker-compose (if available)
docker-compose -f docker-compose.yml run backend pytest tests/ -v

# Run and remove container after
docker-compose -f docker-compose.yml run --rm backend pytest tests/ -v
```

---

## Troubleshooting

### Issue: `ModuleNotFoundError: No module named 'pytest'`

**Solution**: Install dependencies
```bash
pip install -r requirements.txt
```

Or install pytest specifically:
```bash
pip install pytest
```

### Issue: `ModuleNotFoundError: No module named 'sqlalchemy'` (or other packages)

**Solution**: Reinstall requirements
```bash
# Clear pip cache and reinstall
pip install --force-reinstall -r requirements.txt
```

### Issue: Database permission errors

**Solution**: Ensure write permissions in the `backend/` directory
```bash
# On Windows: tests create temp test.db file
# Make sure folder is writable:
icacls backend /grant %username%:F /T

# On macOS/Linux:
chmod -R u+w backend/
```

### Issue: ImportError with conftest.py

**Solution**: Ensure you're running pytest from the `backend/` directory
```bash
# CORRECT
cd backend
pytest tests/ -v

# WRONG
cd ..
pytest backend/tests/ -v
```

### Issue: Tests hang or timeout

**Solution**: Run without coverage or with timeout
```bash
# No coverage (faster)
pytest -v tests/

# With timeout
pytest -v --timeout=30 tests/
```

### Issue: `FAILED` in predictions or feedback tests

The prediction tests use mocked models for testing. If failures occur:

1. Check test output: `pytest tests/test_predict.py -v -s`
2. Verify model pickle files exist in `backend/data/`
3. Ensure `predict.py` correctly loads mocked models in test environment

### Issue: Auth tests fail

Check:
1. The test database is being created: `pytest tests/test_login.py -v -s`
2. No port conflicts with existing server: `netstat -an | find "8000"` (Windows)
3. Database migrations are up-to-date

---

## Test Status Summary

**Current Status**: ✅ All tests passing

| Test Module | Count | Status |
|-------------|-------|--------|
| test_health.py | 1 | ✅ PASS |
| test_login.py | 3 | ✅ PASS |
| test_predict.py | 4 | ✅ PASS |
| test_users.py | 5 | ✅ PASS |
| test_statistics.py | 3 | ✅ PASS |
| test_feedback.py | 7 | ✅ PASS |
| **TOTAL** | **25** | **✅ PASS** |

---

## Advanced pytest Features

### Parallel test execution (faster)

Install pytest-xdist:
```bash
pip install pytest-xdist
```

Run tests in parallel (uses all CPU cores):
```bash
pytest -n auto tests/
```

Run with 4 workers:
```bash
pytest -n 4 tests/
```

### Generate JUnit XML for CI/CD

```bash
pytest -v --junit-xml=test-results.xml tests/
```

### Generate JSON report

```bash
pip install pytest-json-report
pytest -v --json-report --json-report-file=results.json tests/
```

### Debug a specific test

```bash
# Drop into debugger on failure
pytest -v --pdb tests/test_login.py

# Drop into debugger at test start
pytest -v --trace tests/test_login.py::test_login_success
```