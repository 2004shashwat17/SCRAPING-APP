import os
import tempfile
import json
from ml_service.app import app
import pandas as pd


def test_predict_endpoint(tmp_path, monkeypatch):
    # Create a small CSV
    csv_file = tmp_path / "sample.csv"
    df = pd.DataFrame({"text": ["hello", "world", None], "value": [1, 2, 3]})
    df.to_csv(csv_file, index=False)

    client = app.test_client()

    res = client.post('/predict', json={
        'csv_path': str(csv_file),
        'userId': 'test_user'
    })

    assert res.status_code == 200, res.get_data(as_text=True)
    data = res.get_json()
    assert data['success'] is True
    assert data['userId'] == 'test_user'
    assert 'result' in data
    assert data['result']['summary']['rows'] == 3
