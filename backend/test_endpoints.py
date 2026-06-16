import httpx
import time

def test_endpoints():
    base_url = "http://127.0.0.1:8000"
    
    # 1. Test /llm-status
    print("Testing /llm-status...")
    response = httpx.get(f"{base_url}/llm-status")
    print(f"Status code: {response.status_code}")
    print(f"Response: {response.json()}")
    assert response.status_code == 200
    status = response.json()
    assert "provider" in status
    assert "model" in status
    assert "uses_real_llm" in status

    # 2. Test /generate-prompt (will use whatever provider is set in .env; if it fails, falls back or uses demo)
    print("\nTesting /generate-prompt...")
    payload = {
        "user_instructions": "We want to focus on cost cutting and revenue growth in finance functional area."
    }
    start = time.time()
    response = httpx.post(f"{base_url}/generate-prompt", json=payload, timeout=30.0)
    duration = time.time() - start
    print(f"Status code: {response.status_code}")
    print(f"Response keys: {response.json().keys() if response.status_code == 200 else response.text}")
    print(f"Duration: {duration:.2f}s")
    assert response.status_code == 200
    data = response.json()
    assert "prompt" in data
    assert "ai_summary" in data

    print("\nAll endpoints integration verification tests PASSED!")

if __name__ == "__main__":
    test_endpoints()
