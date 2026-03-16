import requests
import os

BASE_URL = "http://localhost:8080/api/files"

def test_flow():
    # 1. Create a dummy file
    filename = "test_image.png"
    with open(filename, "w") as f:
        f.write("fake image data")

    try:
        # 2. Upload
        print(f"--- Uploading {filename} ---")
        with open(filename, "rb") as f:
            files = {'file': (filename, f, 'image/png')}
            r = requests.post(f"{BASE_URL}/upload", files=files)
        
        if r.status_code != 200:
            print(f"Upload failed: {r.status_code} {r.text}")
            return

        res_data = r.json()
        print("Upload Response:", res_data)
        saved_name = res_data.get('fileName')
        
        if not saved_name:
            print("No fileName in response!")
            return

        # 3. Download with original name
        print(f"\n--- Downloading {saved_name} with dName={filename} ---")
        r = requests.get(f"{BASE_URL}/download/{saved_name}", params={'dName': filename})
        
        print("Download Status:", r.status_code)
        cd = r.headers.get('Content-Disposition')
        print("Content-Disposition:", cd)
        
        if cd and f'filename="{filename}"' in cd:
            print("✅ SUCCESS: Content-Disposition is correct!")
        else:
            print("❌ FAILURE: Content-Disposition is wrong or missing filename.")

        # 4. Check if saved_name has extension
        if "." in saved_name:
            print(f"✅ SUCCESS: Saved name '{saved_name}' has extension.")
        else:
            print(f"❌ FAILURE: Saved name '{saved_name}' missing extension.")

    finally:
        if os.path.exists(filename):
            os.remove(filename)

if __name__ == "__main__":
    test_flow()
