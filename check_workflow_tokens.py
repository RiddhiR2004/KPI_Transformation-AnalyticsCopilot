import json
import os

# Set path relative to this script's directory
base_dir = os.path.dirname(os.path.abspath(__file__))
data_dir = os.path.join(base_dir, "data")
CHARS_PER_TOKEN = 4

print("==================================================")
print("===       WORKFLOW STEPS TOKEN TRACKER         ===")
print("==================================================\n")

def check_file(step_name, filename):
    path = os.path.join(data_dir, filename)
    if not os.path.exists(path):
        print(f"{step_name}:")
        print(f"  Status: NOT YET COMPLETED")
        print("-" * 50)
        return
        
    size = os.path.getsize(path)
    if size <= 2:
        print(f"{step_name}:")
        print(f"  Status: NOT YET COMPLETED (Empty File)")
        print("-" * 50)
        return
        
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        # Format the JSON to measure the exact character payload generated
        pretty_json = json.dumps(data, indent=2)
        chars = len(pretty_json)
        tokens = round(chars / CHARS_PER_TOKEN)
        
        print(f"{step_name}:")
        print(f"  Status: COMPLETED")
        print(f"  Source File: data/{filename}")
        print(f"  Size: {chars:,} characters")
        print(f"  Estimated Output Tokens: {tokens:,} tokens")
        if isinstance(data, dict) and "items" in data:
            print(f"  Generated Items: {len(data['items'])}")
    except Exception as e:
        print(f"Error reading data/{filename}: {e}")
    print("-" * 50)

check_file("Step 1: Curated Prompt Generation", "prompts.json")
check_file("Step 2: KPI Library Generation", "kpi_library.json")
check_file("Step 3: Functional Specification Studio", "functional_specification.json")
