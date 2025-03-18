from flask import Flask, request, jsonify
import os
import json
import re
from google.cloud import vision
from flask_cors import CORS  # ✅ Enable frontend-backend communication

app = Flask(__name__)
CORS(app)  # ✅ Allow frontend to access API

# ✅ Set Google Cloud credentials
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "named-sunset-453004-p9-2a2a8558a42d.json"
client = vision.ImageAnnotatorClient()

def extract_info_from_image(image_content):
    """Extracts First Name, Middle Name, Last Name, DOB, and Gender from an image."""
    image = vision.Image(content=image_content)
    response = client.text_detection(image=image)
    text = response.text_annotations[0].description if response.text_annotations else ""

    lines = text.split("\n")
    extracted_data = {
        "first_name": "Not Found",
        "middle_name": "Not Found",
        "last_name": "Not Found",
        "dob": "Not Found",
        "gender": "Not Found"
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

        # ✅ Extract Last Name (after ID reference)
        if last_name_index < len(lines) and last_name_index != -1:
            extracted_data["last_name"] = lines[last_name_index].strip()

        # ✅ Extract First & Middle Name (after Last Name) & Split into Separate Fields
        if last_name_index + 1 < len(lines):
            full_name = lines[last_name_index + 1].strip()
            name_parts = full_name.split()

            extracted_data["first_name"] = name_parts[0] if len(name_parts) > 0 else "Not Found"
            extracted_data["middle_name"] = " ".join(name_parts[1:]) if len(name_parts) > 1 else "Not Found"

        # ✅ Extract DOB
        dob_match = re.search(r"DOB\s*[:#]?\s*(\d{2}/\d{2}/\d{4})", line)
        if dob_match:
            extracted_data["dob"] = dob_match.group(1)

        # ✅ Extract Sex
        sex_match = re.search(r"\b(?:SEX[:\s]*)?(M|F)\b", line)
        if sex_match:
            extracted_data["gender"] = "Male" if sex_match.group(1) == "M" else "Female"

    return extracted_data

# ✅ API Route for File Upload & OCR
@app.route("/upload", methods=["POST"])
def upload_image():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    image_data = file.read()
    
    extracted_data = extract_info_from_image(image_data)
    return jsonify(extracted_data)  

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
