import os
from google.cloud import vision

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "../service_account.json"

client = vision.ImageAnnotatorClient()

with open("../privacy.png", "rb") as image_file:  
    content = image_file.read()

image = vision.Image(content=content)

response = client.text_detection(image=image)
texts = response.text_annotations

if texts:
    print("there are texts detected:")
    print(texts[0].description)
else:
    print("THERE ARE NO TEXTS DETECTED")

if response.error.message:
    raise Exception(f"API Error: {response.error.message}")