import predict


class DummyModelHigh:
    def predict_proba(self, df):
        return [[0.1, 0.9]]


class DummyModelMedium:
    def predict_proba(self, df):
        return [[0.45, 0.55]]


class DummyModelLow:
    def predict_proba(self, df):
        return [[0.9, 0.1]]


class DummyBrokenModel:
    def predict_proba(self, df):
        raise Exception("boom")


def test_predict_model_high_risk(client, normal_auth_headers, monkeypatch):
    monkeypatch.setattr(predict, "model_available", True)
    monkeypatch.setattr(predict, "model", DummyModelHigh())

    payload = {
        "subject": "Urgent account issue 1",
        "from": "scam@example.com",
        "bodyText": "Click here to verify your account immediately",
        "links": []
    }

    response = client.post("/predict-model", json=payload, headers=normal_auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["phishing_probability"] == 0.9
    assert data["risk_level"] == "high"
    assert data["action"] == "warn"


def test_predict_model_medium_risk(client, normal_auth_headers, monkeypatch):
    monkeypatch.setattr(predict, "model_available", True)
    monkeypatch.setattr(predict, "model", DummyModelMedium())

    payload = {
        "subject": "Please review 2",
        "from": "maybe@example.com",
        "bodyText": "There is a link in this email",
        "links": []
    }

    response = client.post("/predict-model", json=payload, headers=normal_auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["risk_level"] == "medium"
    assert data["action"] == "warn"


def test_predict_model_low_risk(client, normal_auth_headers, monkeypatch):
    monkeypatch.setattr(predict, "model_available", True)
    monkeypatch.setattr(predict, "model", DummyModelLow())

    payload = {
        "subject": "Hello 3",
        "from": "friend@example.com",
        "bodyText": "Just checking in",
        "links": []
    }

    response = client.post("/predict-model", json=payload, headers=normal_auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["risk_level"] == "low"
    assert data["action"] == "none"


def test_predict_model_fallback_when_model_unavailable(client, normal_auth_headers, monkeypatch):
    monkeypatch.setattr(predict, "model_available", False)
    monkeypatch.setattr(predict, "model", None)

    payload = {
        "subject": "Test",
        "from": "test@example.com",
        "bodyText": "Some email body",
        "links": []
    }

    response = client.post("/predict-model", json=payload, headers=normal_auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["phishing_probability"] == 0.0
    assert data["risk_level"] == "low"
    assert data["action"] == "none"
    assert "Model not available" in data["reasons"][0]


def test_predict_model_handles_exception(client, normal_auth_headers, monkeypatch):
    monkeypatch.setattr(predict, "model_available", True)
    monkeypatch.setattr(predict, "model", DummyBrokenModel())

    payload = {
        "subject": "Broken test",
        "from": "broken@example.com",
        "bodyText": "This should fail",
        "links": []
    }

    response = client.post("/predict-model", json=payload, headers=normal_auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["phishing_probability"] == 0.0
    assert data["risk_level"] == "low"
    assert data["action"] == "none"
    assert "Prediction failed" in data["reasons"][0]


def test_predict_requires_auth(client):
    payload = {
        "subject": "No auth",
        "from": "anon@example.com",
        "bodyText": "Body",
        "links": []
    }

    response = client.post("/predict-model", json=payload)

    assert response.status_code in (401, 403)
