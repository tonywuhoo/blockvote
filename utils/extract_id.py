from flask import Flask, request, jsonify
import os
import re
from google.cloud import vision
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "named-sunset-453004-p9-2a2a8558a42d.json"
client = vision.ImageAnnotatorClient()

def extract_info_from_image(image_content):
    """Extracts First Name, Middle Name, Last Name, DOB, and Gender from an image."""
    image = vision.Image(content=image_content)
    response = client.text_detection(image=image)
    text = response.text_annotations[0].description if response.text_annotations else ""
    
    lines = text.split("\n")
    # Start with all fields as None
    extracted_data = {
        "first_name": None,
        "middle_name": None,
        "last_name": None,
        "dob": None,
        "gender": None
    }
    last_name_index = -1  

    for i, line in enumerate(lines):
        if "ID" in line:
            if i + 1 < len(lines) and re.match(r"^\d{3}\s?\d{3}\s?\d{3}$", lines[i + 1]):
                last_name_index = i + 2  # Assume last name is right after ID
            else:
                id_match = re.search(r"ID\s*[:#]?\s*(\d{3}\s?\d{3}\s?\d{3})", line)
                if id_match:
                    last_name_index = i + 1  # Assume last name is next line

        if last_name_index != -1 and last_name_index < len(lines):
            extracted_data["last_name"] = lines[last_name_index].strip()

        if last_name_index != -1 and last_name_index + 1 < len(lines):
            full_name = lines[last_name_index + 1].strip()
            name_parts = full_name.split()
            extracted_data["first_name"] = name_parts[0] if len(name_parts) > 0 else None
            extracted_data["middle_name"] = " ".join(name_parts[1:]) if len(name_parts) > 1 else None

        dob_match = re.search(r"DOB\s*[:#]?\s*(\d{2}/\d{2}/\d{4})", line)
        if dob_match:
            extracted_data["dob"] = dob_match.group(1)

        sex_match = re.search(r"\b(?:SEX[:\s]*)?(M|F)\b", line)
        if sex_match:
            extracted_data["gender"] = "Male" if sex_match.group(1) == "M" else "Female"

    return extracted_data

@app.route("/upload", methods=["POST"])
def upload_image():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    image_data = file.read()

    extracted_data = extract_info_from_image(image_data)
    # Filter out fields that are None
    clean_data = {k: v for k, v in extracted_data.items() if v is not None}

    # Function to truncate a string to 10 characters
    def truncate(value: str) -> str:
        return value[:10]

    # Truncate first_name and last_name if they exist
    if "first_name" in clean_data:
        clean_data["first_name"] = truncate(clean_data["first_name"])
    if "last_name" in clean_data:
        clean_data["last_name"] = truncate(clean_data["last_name"])

    # Create a combined field from first_name and last_name, truncated to 10 characters
    if "first_name" in clean_data or "last_name" in clean_data:
        combined = (clean_data.get("first_name", "") + clean_data.get("last_name", "")).strip()
        clean_data["combined"] = truncate(combined)

    return jsonify(clean_data)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
