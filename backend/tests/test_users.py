from auth import verify_password


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


def test_update_user_admin_can_edit_any_user(client, normal_user, admin_auth_headers):
    payload = {
        "first_name": "Updated",
        "last_name": "Person",
        "role": "editor",
    }

    response = client.put(f"/users/{normal_user.id}", json=payload, headers=admin_auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["first_name"] == "Updated"
    assert data["last_name"] == "Person"
    assert data["role"] == "editor"


def test_update_user_non_admin_can_edit_own_profile(client, normal_user, normal_auth_headers, db_session):
    payload = {
        "first_name": "Self",
        "last_name": "Edited",
        "password_hash": "newpassword123",
    }

    response = client.put(f"/users/{normal_user.id}", json=payload, headers=normal_auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["first_name"] == "Self"
    assert data["last_name"] == "Edited"

    db_session.refresh(normal_user)
    assert verify_password("newpassword123", normal_user.password_hash)


def test_update_user_non_admin_cannot_edit_others(client, admin_user, normal_auth_headers):
    payload = {"first_name": "NotAllowed"}

    response = client.put(f"/users/{admin_user.id}", json=payload, headers=normal_auth_headers)

    assert response.status_code == 403
    assert response.json()["detail"] == "You can only edit your own profile"


def test_update_user_non_admin_cannot_change_role(client, normal_user, normal_auth_headers):
    payload = {"role": "admin"}

    response = client.put(f"/users/{normal_user.id}", json=payload, headers=normal_auth_headers)

    assert response.status_code == 403
    assert response.json()["detail"] == "Only admins can change user roles"
