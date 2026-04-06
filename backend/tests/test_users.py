def test_register_user_success(client):
    payload = {
        "username": "newuser",
        "password_hash": "mypassword",
        "role": "viewer",
        "first_name": "New",
        "last_name": "User"
    }

    response = client.post("/users/register", json=payload)

    assert response.status_code == 201
    data = response.json()
    assert data["username"] == "newuser"
    assert data["role"] == "viewer"
    assert data["first_name"] == "New"
    assert data["last_name"] == "User"
    assert "id" in data


def test_register_user_duplicate_username(client, normal_user):
    payload = {
    "username": "testuser",
    "password_hash": "testpass",
    "role": "viewer",
    "first_name": "Test",
    "last_name": "User"
}

    response = client.post("/users/register", json=payload)

    assert response.status_code == 400
    assert response.json()["detail"] == "Username exists"


def test_list_users(client, normal_user):
    response = client.get("/users")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["username"] == "testuser"
