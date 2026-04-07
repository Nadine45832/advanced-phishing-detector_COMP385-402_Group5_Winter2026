def test_register_user_success(client, admin_auth_headers):
    payload = {
        "username": "newuser",
        "password_hash": "mypassword",
        "role": "user",
        "first_name": "New",
        "last_name": "User"
    }

    response = client.post("/users/register", json=payload, headers=admin_auth_headers)

    assert response.status_code == 201
    data = response.json()
    assert data["username"] == "newuser"
    assert data["role"] == "user"
    assert data["first_name"] == "New"
    assert data["last_name"] == "User"
    assert "id" in data


def test_register_user_duplicate_username(client, normal_user, admin_auth_headers):
    payload = {
        "username": "testuser",
        "password_hash": "testpass",
        "role": "user",
        "first_name": "Test",
        "last_name": "User"
    }

    response = client.post("/users/register", json=payload, headers=admin_auth_headers)

    assert response.status_code == 400
    assert response.json()["detail"] == "Username exists"


def test_register_user_non_admin(client, normal_auth_headers):
    payload = {
        "username": "testuser",
        "password_hash": "testpass",
        "role": "user",
        "first_name": "Test",
        "last_name": "User"
    }

    response = client.post("/users/register", json=payload, headers=normal_auth_headers)

    assert response.status_code == 400
    assert response.json()["detail"] == "Only admins can create a new user"


def test_list_users(client, normal_user, admin_auth_headers):
    response = client.get("/users", headers=admin_auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["username"] == "testuser"


def test_list_users_unauthenticated(client, normal_user):
    response = client.get("/users")

    assert response.status_code == 403
