/*
 * Smart Locker ESP32 Cabinet Client
 *
 * One ESP32 controls one cabinet with N compartments. Configure CABINET_CODE and
 * COMPARTMENT_COUNT below before flashing. The ESP32 communicates only through
 * MQTT: it announces itself, waits for admin approval, then requests a fresh
 * 6-digit proximity code every 30 seconds and displays the server-issued code
 * as text + QR on a 0.96" SSD1306 OLED.
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <Wire.h>
#include "SSD1306Wire.h"
#include "qrcode.h"

// ── Deployment config ─────────────────────────────────────────
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const char* MQTT_HOST = "xxxxxxxx.s1.eu.hivemq.cloud";
const int MQTT_PORT = 8883;
const char* MQTT_USERNAME = "your-hivemq-username";
const char* MQTT_PASSWORD = "your-hivemq-password";

const char* CABINET_CODE = "CABINET_A"; // manually assigned unique cabinet code
const int COMPARTMENT_COUNT = 10;        // compartments are numbered 1..N

// For production, replace setInsecure() with your broker root CA.
WiFiClientSecure wifiClient;
PubSubClient mqtt(wifiClient);

#define OLED_SDA 21
#define OLED_SCL 22
SSD1306Wire display(0x3c, OLED_SDA, OLED_SCL);

const unsigned long OTP_INTERVAL = 30000;
const unsigned long HELLO_INTERVAL = 15000;
const unsigned long RECONNECT_INTERVAL = 3000;

String cabinetIdentity;
String currentCode = "------";
String currentQrPayload = "";
String cabinetStatus = "BOOT";
String statusMessage = "Starting";
unsigned long lastOtpRequest = 0;
unsigned long lastHello = 0;
unsigned long lastReconnectAttempt = 0;
unsigned long codeStartedAt = 0;

QRCode qrcode;
uint8_t qrcodeBytes[64];

String topicHello() { return "lockersystem/cabinet/" + String(CABINET_CODE) + "/hello"; }
String topicRegistration() { return "lockersystem/cabinet/" + String(CABINET_CODE) + "/registration"; }
String topicOtpRequest() { return "lockersystem/cabinet/" + String(CABINET_CODE) + "/otp/request"; }
String topicOtpResponse() { return "lockersystem/cabinet/" + String(CABINET_CODE) + "/otp/response"; }
String topicCommand() { return "lockersystem/cabinet/" + String(CABINET_CODE) + "/command"; }

String jsonValue(String payload, String key) {
  String pattern = "\"" + key + "\":";
  int start = payload.indexOf(pattern);
  if (start < 0) return "";
  start += pattern.length();
  while (start < payload.length() && payload[start] == ' ') start++;
  if (payload[start] == '"') {
    int end = payload.indexOf('"', start + 1);
    if (end < 0) return "";
    return payload.substring(start + 1, end);
  }
  int end = start;
  while (end < payload.length() && payload[end] != ',' && payload[end] != '}') end++;
  return payload.substring(start, end);
}

void drawStatus(String title, String detail) {
  display.clear();
  display.setColor(WHITE);
  display.setTextAlignment(TEXT_ALIGN_CENTER);
  display.setFont(ArialMT_Plain_16);
  display.drawString(64, 6, title);
  display.setFont(ArialMT_Plain_10);
  display.drawStringMaxWidth(64, 30, 118, detail);
  display.display();
}

void prepareQr(String payload) {
  if (!payload.length()) payload = currentCode;
  qrcode_initText(&qrcode, qrcodeBytes, 1, ECC_LOW, payload.c_str());
}

void drawOtpScreen() {
  unsigned long elapsed = millis() - codeStartedAt;
  int progressWidth = elapsed >= OTP_INTERVAL ? 0 : map(OTP_INTERVAL - elapsed, 0, OTP_INTERVAL, 0, 128);

  display.clear();
  display.setColor(WHITE);
  display.setFont(ArialMT_Plain_10);
  display.setTextAlignment(TEXT_ALIGN_CENTER);
  display.drawString(64, 0, cabinetIdentity);
  display.fillRect(0, 12, progressWidth, 3);
  display.drawVerticalLine(63, 16, 48);

  display.fillRect(6, 17, 54, 46);
  display.setColor(BLACK);
  for (uint8_t y = 0; y < qrcode.size; y++) {
    for (uint8_t x = 0; x < qrcode.size; x++) {
      if (qrcode_getModule(&qrcode, x, y)) {
        display.fillRect(8 + (x * 2), 18 + (y * 2), 2, 2);
      }
    }
  }

  display.setColor(WHITE);
  display.setFont(ArialMT_Plain_24);
  display.setTextAlignment(TEXT_ALIGN_CENTER);
  display.drawString(95, 14, currentCode.substring(0, 3));
  display.drawString(95, 38, currentCode.substring(3, 6));
  display.display();
}

void publishHello() {
  String payload = "{\"cabinetCode\":\"" + String(CABINET_CODE) + "\",\"compartmentCount\":" + String(COMPARTMENT_COUNT) + ",\"identity\":\"" + cabinetIdentity + "\",\"firmware\":\"esp32-mqtt-cabinet-1\"}";
  mqtt.publish(topicHello().c_str(), payload.c_str(), false);
  lastHello = millis();
}

void requestOtp() {
  String payload = "{\"cabinetCode\":\"" + String(CABINET_CODE) + "\",\"compartmentCount\":" + String(COMPARTMENT_COUNT) + ",\"identity\":\"" + cabinetIdentity + "\"}";
  mqtt.publish(topicOtpRequest().c_str(), payload.c_str(), false);
  lastOtpRequest = millis();
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  String message;
  for (unsigned int i = 0; i < length; i++) message += (char)payload[i];
  String topicStr = String(topic);

  if (topicStr == topicRegistration()) {
    cabinetStatus = jsonValue(message, "status");
    statusMessage = jsonValue(message, "message");
    if (cabinetStatus == "APPROVED") requestOtp();
    else drawStatus(cabinetStatus, statusMessage);
    return;
  }

  if (topicStr == topicOtpResponse()) {
    String status = jsonValue(message, "status");
    if (status != "APPROVED") {
      cabinetStatus = status;
      statusMessage = jsonValue(message, "message");
      drawStatus(cabinetStatus, statusMessage);
      return;
    }

    currentCode = jsonValue(message, "code");
    currentQrPayload = jsonValue(message, "qrPayload");
    if (currentCode.length() == 6) {
      cabinetStatus = "APPROVED";
      codeStartedAt = millis();
      prepareQr(currentCode);
      drawOtpScreen();
    }
  }
}

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  drawStatus("WIFI", "Connecting...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print('.');
    drawStatus("WIFI LOST", "Reconnecting to access point");
  }
  Serial.println("\nWiFi connected");
}

void connectMqtt() {
  if (mqtt.connected()) return;
  unsigned long now = millis();
  if (now - lastReconnectAttempt < RECONNECT_INTERVAL) return;
  lastReconnectAttempt = now;

  drawStatus("MQTT LOST", "Connecting to server...");
  String clientId = "locker-" + String(CABINET_CODE) + "-" + String((uint32_t)ESP.getEfuseMac(), HEX);
  if (mqtt.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD)) {
    mqtt.subscribe(topicRegistration().c_str(), 1);
    mqtt.subscribe(topicOtpResponse().c_str(), 1);
    mqtt.subscribe(topicCommand().c_str(), 1);
    publishHello();
  }
}

void setup() {
  Serial.begin(115200);
  cabinetIdentity = String(CABINET_CODE) + ":" + String(COMPARTMENT_COUNT);

  display.init();
  display.flipScreenVertically();
  drawStatus("SMART LOCKER", cabinetIdentity);

  wifiClient.setInsecure();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMqttMessage);
  mqtt.setBufferSize(512);

  connectWifi();
  connectMqtt();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWifi();
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();

  unsigned long now = millis();
  if (mqtt.connected() && now - lastHello >= HELLO_INTERVAL && cabinetStatus != "APPROVED") {
    publishHello();
  }
  if (mqtt.connected() && cabinetStatus == "APPROVED" && now - lastOtpRequest >= OTP_INTERVAL) {
    requestOtp();
  }

  if (cabinetStatus == "APPROVED" && currentCode.length() == 6) drawOtpScreen();
  delay(100);
}
