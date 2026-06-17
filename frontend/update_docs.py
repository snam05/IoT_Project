import re

with open('../esp32/esp32.ino', 'r') as f:
    code = f.read()

# Replace variables
code = re.sub(r'const char\* WIFI_SSID = ".*?";', 'const char* WIFI_SSID = "WIFI_SSID";', code)
code = re.sub(r'const char\* WIFI_PASSWORD = ".*?";', 'const char* WIFI_PASSWORD = "WIFI_PASSWORD";', code)
code = re.sub(r'const char\* MQTT_HOST = ".*?";', 'const char* MQTT_HOST = "IP_Address";', code)
code = re.sub(r'const char\* MQTT_USERNAME = ".*?";', 'const char* MQTT_USERNAME = "username";', code)
code = re.sub(r'const char\* MQTT_PASSWORD = ".*?";', 'const char* MQTT_PASSWORD = "password";', code)

with open('src/pages/DocumentationPage.jsx', 'r') as f:
    doc_content = f.read()

# Replace the ESP32_CODE string
# Find the start and end of const ESP32_CODE = `...`;
start_idx = doc_content.find('const ESP32_CODE = `') + len('const ESP32_CODE = `')
end_idx = doc_content.find('`;\n\nexport default function DocumentationPage() {')

new_doc = doc_content[:start_idx] + code + doc_content[end_idx:]

with open('src/pages/DocumentationPage.jsx', 'w') as f:
    f.write(new_doc)
