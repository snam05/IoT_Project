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
const char* WIFI_SSID = "CON CHO BAT MANG LAM CHO";
const char* WIFI_PASSWORD = "20052005";

const char* MQTT_HOST = "13.229.56.194";
const int MQTT_PORT = 1883;
const char* MQTT_USERNAME = "iot_user";
const char* MQTT_PASSWORD = "Iotuser@123";

const char* CABINET_CODE = "TEST_CABINET"; // manually assigned unique cabinet code
const int COMPARTMENT_COUNT = 8;        // compartments are numbered 1..N
const int LOCK_PINS[COMPARTMENT_COUNT] = {15, 2, 4, 16, 17, 5, 18, 19};

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

#define OLED_SDA 21
#define OLED_SCL 22
SSD1306Wire display(0x3c, OLED_SDA, OLED_SCL);

const unsigned long OTP_INTERVAL = 30000;
const unsigned long HELLO_INTERVAL = 15000;
const unsigned long RECONNECT_INTERVAL = 3000;
const unsigned long DISPLAY_REFRESH_INTERVAL = 500;
const unsigned long DUPLICATE_OTP_WINDOW = 30000;

String cabinetIdentity;
String currentCode = "------";
String currentQrPayload = "";
String cabinetStatus = "BOOT";
String statusMessage = "Starting";
unsigned long lastOtpRequest = 0;
unsigned long lastHello = 0;
unsigned long lastReconnectAttempt = 0;
unsigned long lastDisplayRefresh = 0;
String lastProcessedMsgId = "";
unsigned long codeStartedAt = 0;
String lastRenderedStatusTitle = "";
String lastRenderedStatusDetail = "";
String lastRenderedOtpCode = "";
String lastRenderedQrPayload = "";
int lastRenderedProgressWidth = -1;

unsigned long tempDisplayStartedAt = 0;
bool isTempDisplayActive = false;
String tempDisplayTitle = "";
String tempDisplayDetail = "";

void showTemporaryStatus(String title, String detail) {
  tempDisplayTitle = title;
  tempDisplayDetail = detail;
  tempDisplayStartedAt = millis();
  isTempDisplayActive = true;
  drawStatus(title, detail);
}

QRCode qrcode;
uint8_t qrcodeBytes[128];

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
  unsigned long now = millis();
  if (
    title == lastRenderedStatusTitle &&
    detail == lastRenderedStatusDetail &&
    now - lastDisplayRefresh < DISPLAY_REFRESH_INTERVAL
  ) {
    return;
  }

  display.clear();
  display.setColor(WHITE);
  display.setTextAlignment(TEXT_ALIGN_CENTER);
  display.setFont(ArialMT_Plain_16);
  display.drawString(64, 6, title);
  display.setFont(ArialMT_Plain_10);
  display.drawStringMaxWidth(64, 30, 118, detail);
  display.display();

  lastDisplayRefresh = now;
  lastRenderedStatusTitle = title;
  lastRenderedStatusDetail = detail;
  lastRenderedOtpCode = "";
  lastRenderedQrPayload = "";
  lastRenderedProgressWidth = -1;
}

void prepareQr(String payload) {
  if (!payload.length()) payload = currentCode;
  qrcode_initText(&qrcode, qrcodeBytes, 1, ECC_LOW, payload.c_str());
}

void drawOtpScreen() {
  unsigned long elapsed = millis() - codeStartedAt;
  int progressWidth = elapsed >= OTP_INTERVAL ? 0 : map(OTP_INTERVAL - elapsed, 0, OTP_INTERVAL, 0, 128);
  progressWidth = constrain(progressWidth, 0, 128);

  unsigned long now = millis();
  bool otpChanged = currentCode != lastRenderedOtpCode || currentQrPayload != lastRenderedQrPayload;
  bool progressChanged = progressWidth != lastRenderedProgressWidth;
  if (!otpChanged && (!progressChanged || now - lastDisplayRefresh < DISPLAY_REFRESH_INTERVAL)) {
    return;
  }

  display.clear();
  display.setColor(WHITE);
  
  // 1. Header: Elegant Cabinet Code centered in Yellow Region
  display.setFont(ArialMT_Plain_10);
  display.setTextAlignment(TEXT_ALIGN_CENTER);
  display.drawString(64, 0, cabinetIdentity);

  // Progress Bar in Yellow Region (y = 12, height = 3)
  if (progressWidth > 0) {
    display.fillRect(0, 12, progressWidth, 3);
  }

  // 2. Left Half (x = 0 to 63): Perfect Symmetrical QR Code (Version 1, 21x21 modules -> 42x42 pixels)
  // Center of left half is x = 32. QR code is 42x42 pixels.
  // White quiet zone background: x = 9 to 55 (width 46), y = 16 to 62 (height 46)
  display.fillRect(9, 16, 46, 46);
  
  display.setColor(BLACK);
  for (uint8_t y = 0; y < qrcode.size; y++) {
    for (uint8_t x = 0; x < qrcode.size; x++) {
      if (qrcode_getModule(&qrcode, x, y)) {
        display.fillRect(11 + (x * 2), 18 + (y * 2), 2, 2);
      }
    }
  }

  // 3. Right Half (x = 64 to 127): Symmetrical stacked OTP code (3 on top, 3 below)
  display.setColor(WHITE);
  display.drawVerticalLine(63, 16, 48);

  // OTP 6-digit number displayed as 3 digits on top, 3 digits below, centered exactly at x = 96
  display.setFont(ArialMT_Plain_24);
  display.setTextAlignment(TEXT_ALIGN_CENTER);
  display.drawString(96, 16, currentCode.substring(0, 3));
  display.drawString(96, 39, currentCode.substring(3, 6));

  display.display();

  lastDisplayRefresh = now;
  lastRenderedOtpCode = currentCode;
  lastRenderedQrPayload = currentQrPayload;
  lastRenderedProgressWidth = progressWidth;
  lastRenderedStatusTitle = "";
  lastRenderedStatusDetail = "";
}

void publishHello() {
  String payload = "{\"cabinetCode\":\"" + String(CABINET_CODE) + "\",\"compartmentCount\":" + String(COMPARTMENT_COUNT) + ",\"identity\":\"" + cabinetIdentity + "\",\"firmware\":\"esp32-mqtt-cabinet-1\"}";
  mqtt.publish(topicHello().c_str(), payload.c_str(), false);
  lastHello = millis();
}

void requestOtp() {
  unsigned long now = millis();
  if (now - lastOtpRequest < 2000 && lastOtpRequest != 0) {
    Serial.println("[OTP] Ignored duplicate OTP request (debounced)");
    return;
  }
  String payload = "{\"cabinetCode\":\"" + String(CABINET_CODE) + "\",\"compartmentCount\":" + String(COMPARTMENT_COUNT) + ",\"identity\":\"" + cabinetIdentity + "\"}";
  mqtt.publish(topicOtpRequest().c_str(), payload.c_str(), false);
  lastOtpRequest = now;
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  String message;
  for (unsigned int i = 0; i < length; i++) message += (char)payload[i];
  String topicStr = String(topic);

  if (topicStr == topicRegistration()) {
    cabinetStatus = jsonValue(message, "status");
    statusMessage = jsonValue(message, "message");
    if (cabinetStatus == "APPROVED") {
      // 1. Parse and apply initial states silently
      String states = jsonValue(message, "states");
      if (states.length() == COMPARTMENT_COUNT) {
        for (int i = 0; i < COMPARTMENT_COUNT; i++) {
          int pin = LOCK_PINS[i];
          int val = (states[i] == '0') ? LOW : HIGH;
          digitalWrite(pin, val);
          Serial.printf("[Init State] Set compartment %d to %s (Pin %d)\n", i + 1, (val == LOW) ? "OPEN" : "LOCK", pin);
        }
      }
      // 2. Request OTP now that initial opening/closing is fully completed
      requestOtp();
    } else {
      drawStatus(cabinetStatus, statusMessage);
    }
    return;
  }

  if (topicStr == topicOtpResponse()) {
    String status = jsonValue(message, "status");
    if (status != "APPROVED") {
      cabinetStatus = status;
      statusMessage = jsonValue(message, "message");
      showTemporaryStatus(cabinetStatus, statusMessage);
      return;
    }

    String nextCode = jsonValue(message, "code");
    String nextQrPayload = jsonValue(message, "qrPayload");
    bool duplicateActiveOtp =
      nextCode == currentCode &&
      nextQrPayload == currentQrPayload &&
      cabinetStatus == "APPROVED" &&
      millis() - codeStartedAt < DUPLICATE_OTP_WINDOW;
    if (duplicateActiveOtp) {
      Serial.println("[OTP] Ignored duplicate OTP response");
      return;
    }

    currentCode = nextCode;
    currentQrPayload = nextQrPayload;
    if (currentCode.length() == 6) {
      cabinetStatus = "APPROVED";
      codeStartedAt = millis();
      lastRenderedOtpCode = "";
      lastRenderedQrPayload = "";
      lastRenderedProgressWidth = -1;
      prepareQr(currentQrPayload.length() ? currentQrPayload : currentCode);
      drawOtpScreen();
    }
  }

  if (topicStr == topicCommand()) {
    String msgId = jsonValue(message, "msgId");
    if (msgId.length() > 0 && msgId == lastProcessedMsgId) {
      Serial.println("[Command] Ignored duplicate command (QoS 2)");
      return;
    }
    if (msgId.length() > 0) {
      lastProcessedMsgId = msgId;
    }

    String action = jsonValue(message, "action");
    String compStr = jsonValue(message, "compartmentNo");
    int compNo = compStr.toInt();
    if (compNo >= 1 && compNo <= COMPARTMENT_COUNT) {
      int pin = LOCK_PINS[compNo - 1];
      if (action == "unlock") {
        digitalWrite(pin, LOW); // Mở khóa (LOW)
        Serial.printf("[Lock Control] Unlocked compartment %d (Pin %d)\n", compNo, pin);
        if (millis() > 5000) {
          showTemporaryStatus("OPENED", "Compartment " + compStr + " is opened");
        }
      } else if (action == "lock") {
        digitalWrite(pin, HIGH); // Khóa (HIGH)
        Serial.printf("[Lock Control] Locked compartment %d (Pin %d)\n", compNo, pin);
        if (millis() > 5000) {
          showTemporaryStatus("CLOSED", "Compartment " + compStr + " is closed");
        }
      }
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

  // Initialize lock control pins
  for (int i = 0; i < COMPARTMENT_COUNT; i++) {
    pinMode(LOCK_PINS[i], OUTPUT);
    digitalWrite(LOCK_PINS[i], HIGH); // Auto-lock all compartments initially (HIGH)
  }

  cabinetIdentity = String(CABINET_CODE) + ":" + String(COMPARTMENT_COUNT);

  display.init();
  display.flipScreenVertically();
  drawStatus("SMART LOCKER", cabinetIdentity);

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

  if (isTempDisplayActive) {
    if (now - tempDisplayStartedAt >= 3000) {
      isTempDisplayActive = false;
      cabinetStatus = "APPROVED";
      requestOtp();
    }
  } else {
    if (mqtt.connected() && now - lastHello >= HELLO_INTERVAL && cabinetStatus != "APPROVED") {
      publishHello();
    }
    if (mqtt.connected() && cabinetStatus == "APPROVED" && now - lastOtpRequest >= OTP_INTERVAL) {
      requestOtp();
    }
  }
  delay(100);
}
