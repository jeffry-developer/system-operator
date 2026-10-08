import requests

url = "https://api.unsplash.com/search/photos"
headers = {"Authorization": "Client-ID We14mSBqBB6ZsAm0YQBkH5_Sc4wyBCpnfdIufi1VQ14"}
params = {"query": "romantica", "per_page": 5}

response = requests.get(url, headers=headers, params=params)
print(f"Status: {response.status_code}")
print(f"Body: {response.text}")
