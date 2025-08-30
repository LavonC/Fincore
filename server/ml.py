from flask import Flask, request, jsonify
import numpy as np

app = Flask(__name__)


def dummy_model(features):
    return np.sum(features)

@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()
    features = data.get('features', [])
    prediction = dummy_model(features)
    return jsonify({'prediction': prediction})

if __name__ == '__main__':
    app.run(debug=True)