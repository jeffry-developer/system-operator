import requests

def test_lexica():
    response = requests.get("https://lexica.art/api/v1/search?q=romantic")
    print(response.status_code)
    if response.status_code == 200:
        data = response.json()
        print(f"Got {len(data.get('images', []))} images")
        if data.get('images'):
            print(data['images'][0]['src'])

test_lexica()
