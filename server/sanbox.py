import requests

url = "https://fiu-sandbox.setu.co/v2/consents"

payload = {
	"consentDuration": {
		"unit": "MONTH",
		"value": "24"
	},
	"vua": "9999999999@onemoney",
	"dataRange": {
		"from": "2023-01-01T00:00:00Z",
		"to": "2025-01-24T00:00:00Z"
	},
	"consentTypes": ["PROFILE", "SUMMARY", "TRANSACTIONS"],
	"context": []
}
headers = {
	"Authorization": "Bearer eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJyX3FuMDZYenNoRHpXeXg3NUkwN1NsQkh3YzBtSUZKLU9pdm5sSjRnemhvIn0.eyJleHAiOjE3NTU0MjQyMTQsImlhdCI6MTc1NTQyMjQxNCwianRpIjoiNWQxY2VmYWYtYWZjNy00MzZjLWJmMmQtNzM2MjU0ZTEyOWIyIiwiaXNzIjoiaHR0cHM6Ly9hdXRoLXYyLnNldHUuY28vcmVhbG1zL3NldHUiLCJzdWIiOiI2MWNhNGM5YS1kMGJjLTRlYjktODc2ZC0yZjVlOGRmYzAxMDYiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiI3YWUwNTUzZi1mMTBmLTQ3NWQtODhlYS00YTVmOTRmZjM3MjMiLCJyZWFsbV9hY2Nlc3MiOnsicm9sZXMiOlsiZGVmYXVsdC1yb2xlcy1zZXR1IiwiYm90QDQxOTM2NmViLTM2N2UtNDc4Zi04NzMxLTQ5YzgyNjI0YTg3ZSIsIm9mZmxpbmVfYWNjZXNzIiwidW1hX2F1dGhvcml6YXRpb24iXX0sInNjb3BlIjoiVEVTVCIsImNsaWVudEhvc3QiOiIzNS4yMDcuMTkzLjg0IiwiY2xpZW50SWQiOiI3YWUwNTUzZi1mMTBmLTQ3NWQtODhlYS00YTVmOTRmZjM3MjMiLCJjbGllbnRBZGRyZXNzIjoiMzUuMjA3LjE5My44NCJ9.ZiVkyhMRki7GvZcKRxSy5tMbGscyn5pu7RNnxpWjhZMh10nRv1L2SHKpJ4v0hgs0-40akfbrXo5SdO0JXrQrzN53hoY5Uwe3WWbq4JOiE3UfChYizYgbfyOMemRjIz4SJ8J2sYVBAgmRxMVe24olVwJ-N3fitZFFaBkoLVpN1YCxEBi06Xh8kWRi_9Z-n1aYcUYWYjHNX4vK7rgaKICltRPT4FrPskM2TqB6vpOXa9k78I_27JDh10KAvzwph98Q2tw9TwompgX2xUXY4TfUVWS5LX_k777Wj7zE7HCGucuB8mzMxfAOrMfBUR41To9IdY1FGng24nz-8YE1YUarhw",
	"x-product-instance-id": "b6d7a54a-6150-4fe7-a556-d37763720bcd",
	"Content-Type": "application/json"
}

response = requests.request("POST", url, json=payload, headers=headers)

print(response.text)