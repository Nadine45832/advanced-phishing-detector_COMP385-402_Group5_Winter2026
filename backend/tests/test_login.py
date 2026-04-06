def test_login_success(client, normal_user):
    payload = {
        "username": "testuser",
        "password": "password123"
    }

    response = client.post("/auth/login", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["username"] == "testuser"


def test_login_invalid_password(client, normal_user):
    payload = {
        "username": "testuser",
        "password": "wrongpassword"
    }

    response = client.post("/auth/login", json=payload)

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid username or password"


def test_login_invalid_username(client):
    payload = {
        "username": "doesnotexist",
        "password": "password123"
    }

    response = client.post("/auth/login", json=payload)

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid username or password"
