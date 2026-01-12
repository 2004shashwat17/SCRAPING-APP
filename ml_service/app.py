from flask import Flask, request, jsonify
import os
from model import predict_from_csv

app = Flask(__name__)

# Simple auth: require X-ML-TOKEN header if set
ML_TOKEN = os.environ.get('ML_TOKEN')

@app.route('/predict', methods=['POST'])
def predict():
    if ML_TOKEN:
        token = request.headers.get('X-ML-TOKEN')
        if token != ML_TOKEN:
            return jsonify({'error': 'forbidden'}), 403

    data = request.get_json() or {}
    csv_path = data.get('csv_path')
    user_id = data.get('userId')

    if not csv_path or not user_id:
        return jsonify({'error': 'csv_path and userId required'}), 400

    # Basic safety: don't allow reading outside project (simple check)
    if '..' in csv_path or csv_path.startswith('/'):
        return jsonify({'error': 'invalid csv_path'}), 400

    if not os.path.exists(csv_path):
        return jsonify({'error': 'csv not found', 'path': csv_path}), 404

    try:
        result = predict_from_csv(csv_path, user_id)
    except Exception as e:
        return jsonify({'error': 'prediction failed', 'detail': str(e)}), 500

    return jsonify({'success': True, 'userId': user_id, 'result': result})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
