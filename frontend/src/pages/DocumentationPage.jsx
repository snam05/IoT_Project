import { useState } from 'react';
import TopNavBar from '../components/TopNavBar';
import Footer from '../components/Footer';

const ESP32_CODE = `/*
 * Smart Locker ESP32 Cabinet Client (TOTP Offline Version)
 *
 * One ESP32 controls one cabinet with N compartments. Communicates via MQTT for
 * announcement and receiving commands, but calculates the 6-digit OTP offline
 * using TOTP (Time-based One-time Password) synced via NTP.
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Preferences.h>
#include "time.h"
#include <mbedtls/md.h>
#include <mbedtls/base64.h>
#include "SSD1306Wire.h"
#include "qrcode.h"

// ── Deployment config ─────────────────────────────────────────
const char* WIFI_SSID = "Wifi_SSID";
const char* WIFI_PASSWORD = "Wifi_Password";

const char* MQTT_HOST = "IP_Address";
const int MQTT_PORT = 1883;
const char* MQTT_USERNAME = "username";
const char* MQTT_PASSWORD = "password";

const char* CABINET_CODE = "BACH_KHOA"; // manually assigned unique cabinet code
const int COMPARTMENT_COUNT = 8;        // compartments are numbered 1..N
const int LOCK_PINS[COMPARTMENT_COUNT] = {15, 2, 4, 16, 17, 5, 18, 19};

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

#define OLED_SDA 21
#define OLED_SCL 22
SSD1306Wire display(0x3c, OLED_SDA, OLED_SCL);

const unsigned long HELLO_INTERVAL = 5000;
const unsigned long RECONNECT_INTERVAL = 3000;
const unsigned long DISPLAY_REFRESH_INTERVAL = 1000;

Preferences preferences;
String totpSecret = "";

String cabinetIdentity;
String currentCode = "------";
String currentQrPayload = "";
String cabinetStatus = "BOOT";
String statusMessage = "Starting";
unsigned long lastHello = 0;
unsigned long lastReconnectAttempt = 0;
unsigned long lastDisplayRefresh = 0;
String lastProcessedMsgId = "";
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

void drawOtpScreen(int progressWidth) {
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
  if (progressWidth > 0 && currentCode != "------") {
    display.fillRect(0, 12, progressWidth, 3);
  }

  // 2. Left Half (x = 0 to 63): Symmetrical QR Code or Loading state
  if (currentCode != "------") {
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
  } else {
    display.setFont(ArialMT_Plain_10);
    display.setTextAlignment(TEXT_ALIGN_CENTER);
    display.drawString(32, 32, "Loading...");
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
  String payload = "{\"cabinetCode\":\"" + String(CABINET_CODE) + "\",\"compartmentCount\":" + String(COMPARTMENT_COUNT) + ",\"identity\":\"" + cabinetIdentity + "\",\"firmware\":\"esp32-mqtt-cabinet-totp\"}";
  mqtt.publish(topicHello().c_str(), payload.c_str(), false);
  lastHello = millis();
}

// ── NVS Helper functions ──────────────────────────────────────
void loadSecret() {
  preferences.begin("locker", true);
  totpSecret = preferences.getString("totp_secret", "");
  preferences.end();
  Serial.print("[NVS] Loaded secret length: ");
  Serial.println(totpSecret.length());
}

void saveSecret(const String& secret) {
  preferences.begin("locker", false);
  preferences.putString("totp_secret", secret);
  preferences.end();
  totpSecret = secret;
  Serial.println("[NVS] Saved new TOTP secret");
}

// ── Cryptographic TOTP Helpers ────────────────────────────────
bool decodeBase64(const String& input, uint8_t* out, size_t maxLen, size_t& outLen) {
  int ret = mbedtls_base64_decode(out, maxLen, &outLen, (const unsigned char*)input.c_str(), input.length());
  return ret == 0;
}

bool hmac_sha1(const uint8_t* key, size_t keyLen, const uint8_t* msg, size_t msgLen, uint8_t* output) {
  mbedtls_md_context_t ctx;
  mbedtls_md_init(&ctx);
  const mbedtls_md_info_t* info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA1);
  if (!info) return false;
  
  if (mbedtls_md_setup(&ctx, info, 1) != 0) return false;
  if (mbedtls_md_hmac_starts(&ctx, key, keyLen) != 0) return false;
  if (mbedtls_md_hmac_update(&ctx, msg, msgLen) != 0) return false;
  if (mbedtls_md_hmac_finish(&ctx, output) != 0) return false;
  
  mbedtls_md_free(&ctx);
  return true;
}

String getTOTPCode(const String& base64Secret, uint64_t timeStep) {
  uint8_t key[64];
  size_t keyLen = 0;
  if (!decodeBase64(base64Secret, key, sizeof(key), keyLen)) {
    Serial.println("[TOTP] Base64 decode failed");
    return "ERROR ";
  }
  
  uint8_t msg[8];
  for (int i = 7; i >= 0; i--) {
    msg[i] = timeStep & 0xFF;
    timeStep >>= 8;
  }
  
  uint8_t hash[20];
  if (!hmac_sha1(key, keyLen, msg, 8, hash)) {
    Serial.println("[TOTP] HMAC calculation failed");
    return "ERROR ";
  }
  
  uint8_t offset = hash[19] & 0x0F;
  uint32_t binary = ((hash[offset] & 0x7F) << 24) |
                    ((hash[offset + 1] & 0xFF) << 16) |
                    ((hash[offset + 2] & 0xFF) << 8) |
                    (hash[offset + 3] & 0xFF);
  
  uint32_t otp = binary % 1000000;
  char codeStr[7];
  sprintf(codeStr, "%06d", otp);
  return String(codeStr);
}

bool isTimeSynced() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return false;
  }
  return timeinfo.tm_year > 120; // Year is since 1900, so > 120 is > 2020
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  String message;
  for (unsigned int i = 0; i < length; i++) message += (char)payload[i];
  String topicStr = String(topic);

  if (topicStr == topicRegistration()) {
    String newStatus = jsonValue(message, "status");
    statusMessage = jsonValue(message, "message");
    
    if (newStatus == "DELETED" || newStatus == "REJECTED") {
      saveSecret("");
      cabinetStatus = newStatus;
      while (true) {
        drawStatus(newStatus, "Please restart system!");
        delay(5000);
      }
    }

    if (newStatus == "APPROVED") {
      String secretKey = jsonValue(message, "secretKey");
      if (secretKey.length() > 0 && secretKey != "null" && secretKey != totpSecret) {
        saveSecret(secretKey);
      }
      
      if (cabinetStatus != "APPROVED") {
        cabinetStatus = "APPROVED";
        // Apply initial locker states
        String states = jsonValue(message, "states");
        if (states.length() == COMPARTMENT_COUNT) {
          for (int i = 0; i < COMPARTMENT_COUNT; i++) {
            int pin = LOCK_PINS[i];
            int val = (states[i] == '0') ? LOW : HIGH;
            digitalWrite(pin, val);
            Serial.printf("[Init State] Set compartment %d to %s (Pin %d)\n", i + 1, (val == LOW) ? "OPEN" : "LOCK", pin);
          }
        }
      }
    } else {
      cabinetStatus = newStatus;
      drawStatus(cabinetStatus, statusMessage);
    }
    return;
  }

  if (topicStr == topicCommand()) {
    String action = jsonValue(message, "action");

    String msgId = jsonValue(message, "msgId");
    if (msgId.length() > 0 && msgId == lastProcessedMsgId) {
      Serial.println("[Command] Ignored duplicate command (QoS 2)");
      return;
    }
    if (msgId.length() > 0) {
      lastProcessedMsgId = msgId;
    }

    String compStr = jsonValue(message, "compartmentNo");
    int compNo = compStr.toInt();
    if (compNo >= 1 && compNo <= COMPARTMENT_COUNT) {
      int pin = LOCK_PINS[compNo - 1];
      if (action == "unlock") {
        digitalWrite(pin, LOW); // Open lock
        Serial.printf("[Lock Control] Unlocked compartment %d (Pin %d)\n", compNo, pin);
        if (millis() > 5000) {
          showTemporaryStatus("OPENED", "Compartment " + compStr + " is opened");
        }
      } else if (action == "lock") {
        digitalWrite(pin, HIGH); // Lock pin
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
  
  // Sync time with NTP
  configTime(7 * 3600, 0, "pool.ntp.org", "time.nist.gov");
  Serial.println("[NTP] Configured time sync");
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
    mqtt.subscribe(topicCommand().c_str(), 1);
    publishHello();
  }
}

void setup() {
  Serial.begin(115200);

  // Initialize lock control pins
  for (int i = 0; i < COMPARTMENT_COUNT; i++) {
    pinMode(LOCK_PINS[i], OUTPUT);
    digitalWrite(LOCK_PINS[i], HIGH); // Lock initially
  }

  cabinetIdentity = String(CABINET_CODE) + ":" + String(COMPARTMENT_COUNT);

  display.init();
  display.flipScreenVertically();
  drawStatus("SMART LOCKER", cabinetIdentity);

  // Load persistent NVS variables
  loadSecret();

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMqttMessage);
  mqtt.setBufferSize(512);

  connectWifi();
  connectMqtt();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
    if (WiFi.status() != WL_CONNECTED) {
      drawStatus("WIFI ERROR", "Connection lost!");
      delay(500);
      return;
    }
  }

  if (!mqtt.connected()) {
    connectMqtt();
    if (!mqtt.connected()) {
      drawStatus("MQTT ERROR", "Broker disconnected!");
      delay(500);
      return;
    }
  }

  mqtt.loop();

  unsigned long now = millis();

  if (isTempDisplayActive) {
    if (now - tempDisplayStartedAt >= 3000) {
      isTempDisplayActive = false;
      cabinetStatus = "APPROVED";
    }
  } else {
    if (mqtt.connected() && now - lastHello >= HELLO_INTERVAL) {
      publishHello();
    }
    
    if (cabinetStatus == "APPROVED") {
      if (totpSecret.length() == 0) {
        drawStatus("PENDING", "Waiting for secret key...");
      } else if (!isTimeSynced()) {
        drawStatus("NTP SYNC", "Syncing time...");
      } else {
        time_t rawTime = time(nullptr);
        uint64_t currentStep = rawTime / 30;
        
        // Time remaining in current 30s step in ms
        unsigned long timeRemainingMs = (30 - (rawTime % 30)) * 1000 - (millis() % 1000);
        if (timeRemainingMs > 30000) timeRemainingMs = 30000;
        
        String newCode = getTOTPCode(totpSecret, currentStep);
        if (newCode != currentCode) {
          currentCode = newCode;
          prepareQr(currentCode);
        }
        
        int progressWidth = map(timeRemainingMs, 0, 30000, 0, 128);
        progressWidth = constrain(progressWidth, 0, 128);
        
        drawOtpScreen(progressWidth);
      }
    }
  }
  delay(100);
}

`;

export default function DocumentationPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(ESP32_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const DOCS_SECTIONS = [
    {
      id: 'overview',
      title: 'System Overview',
      icon: 'info',
      content: (
        <>
          <p>
            LockerSystem is an end-to-end, IoT-powered smart storage solution designed to simplify physical personal asset storage.
            The ecosystem consists of physical micro-controller integrated cabinets (ESP32), a lightweight secure Node.js backend
            powered by Prisma and SQLite/MySQL, and an elegant Apple Human Interface Guidelines-compliant React web client.
          </p>
          <p>
            Communication between physical smart hardware and the server is handled via MQTT protocols, offering secure, instant, 
            real-time locking and unlocking operations with offline fallback support using dynamic OTP verification.
          </p>
        </>
      ),
    },
    {
      id: 'user-guide',
      title: 'User Guide',
      icon: 'person',
      content: (
        <>
          <p>As a regular user, you can easily control and monitor your assigned compartments:</p>
          <div className="space-y-4 my-6">
            <div className="flex gap-4 items-start">
              <span className="w-6 h-6 rounded-full bg-primary text-on-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
              <div>
                <strong className="text-primary block mb-0.5">Access the Locker App</strong>
                <span className="text-body-md">Log in to your LockerSystem portal on your mobile phone or desktop computer.</span>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <span className="w-6 h-6 rounded-full bg-primary text-on-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
              <div>
                <strong className="text-primary block mb-0.5">Scan to Unlock</strong>
                <span className="text-body-md">Navigate to the QR Scanner menu, grant camera permissions, and point your camera at the cabinet compartment's QR code. The compartment door will pop open instantly.</span>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <span className="w-6 h-6 rounded-full bg-primary text-on-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
              <div>
                <strong className="text-primary block mb-0.5">Manage Your Assets</strong>
                <span className="text-body-md">Close the cabinet door securely after placing or extracting your belongings. Locker logs will log the transaction.</span>
              </div>
            </div>
          </div>
        </>
      ),
    },
    {
      id: 'admin-guide',
      title: 'Admin Guide',
      icon: 'admin_panel_settings',
      content: (
        <>
          <p>Administrators have elevated control over the entire system network:</p>
          <ul className="list-disc pl-6 space-y-3 my-6">
            <li>
              <strong>Overview Dashboard:</strong> View stats including Total Lockers, Lockers In-Use, Available units, and maintenance requirements.
            </li>
            <li>
              <strong>Locker Management:</strong> Inspect real-time status of locker compartments. Locks or Unlocks doors remotely, or flags compartments for Maintenance. Lockers can be filtered by Cabinet or status.
            </li>
            <li>
              <strong>Cabinet Approvals:</strong> Approve or Reject new physical ESP32 cabinet devices trying to register with the secure system gateway. Lock or Unlock entire cabinets simultaneously.
            </li>
            <li>
              <strong>User Auditing & Logs:</strong> Monitor active users and review detailed audit trials (locker unlock timestamps, IP logging, backend commands history) for complete system transparency.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'esp32-code',
      title: 'ESP32 Client Code',
      icon: 'developer_board',
      content: (
        <>
          <p>
            Below is the complete C++ firmware configuration designed to run on the physical ESP32 cabinet controllers.
            It handles connecting to secure Wi-Fi, establishing a robust MQTT client connection, reporting heartbeat pings,
            listening for dynamic unlock/lock instructions, and displaying server-assigned locker OTP codes and QR targets on an SSD1306 OLED screen.
          </p>
          <p className="text-body-sm text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200/50">
            <strong>Note:</strong> Make sure to customize the deployment configuration variables below with your local Wi-Fi SSID, Password, and MQTT broker credentials.
          </p>
          <div className="bg-surface-container-low rounded-2xl border border-outline-variant/10 overflow-hidden my-6 w-full max-w-full">
            <div className="bg-surface-container-high px-4 py-2 flex flex-wrap gap-2 items-center justify-between border-b border-outline-variant/10">
              <span className="font-mono text-xs font-semibold text-primary">esp32.ino</span>
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all duration-200 active:scale-95 ${
                  copied
                    ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400 font-bold'
                    : 'bg-surface-container-lowest text-primary hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                  {copied ? 'check' : 'content_copy'}
                </span>
                <span>{copied ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>
            <pre className="p-3 sm:p-4 overflow-x-auto text-xs font-mono text-on-surface leading-normal max-h-96 select-all whitespace-pre block w-full max-w-full scrollbar-thin">
              <code className="block w-full min-w-max">{ESP32_CODE}</code>
            </pre>
          </div>
        </>
      ),
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      icon: 'build',
      content: (
        <>
          <p>If you encounter unexpected errors or hardware lockouts:</p>
          <div className="space-y-4 my-6">
            <div className="p-5 bg-surface-container-low rounded-2xl border border-outline-variant/10">
              <h4 className="text-body-lg font-bold text-primary mb-2">Cabinet Offline Status</h4>
              <p className="text-body-md text-on-surface-variant">
                If the physical smart cabinet has lost Wi-Fi connection, you can generate a secure One-Time PIN (OTP) 
                offline in the Locker portal. Type the 6-digit pin directly into the cabinet physical numeric pad to gain access.
              </p>
            </div>
            <div className="p-5 bg-surface-container-low rounded-2xl border border-outline-variant/10">
              <h4 className="text-body-lg font-bold text-primary mb-2">QR Code Parsing Errors</h4>
              <p className="text-body-md text-on-surface-variant">
                Ensure that your camera has enough lighting when scanning the locker's physical QR label. If the scan fails, 
                double-check your internet connection or log in using another browser/device.
              </p>
            </div>
          </div>
        </>
      ),
    },
  ];

  return (
    <div className="bg-background text-on-surface antialiased min-h-screen flex flex-col">
      <TopNavBar />
      
      <main className="flex-grow pt-36 pb-section-padding px-margin-mobile md:px-margin-desktop md:pt-24 max-w-5xl mx-auto w-full">
        <header className="mb-12">
          <h1 className="text-display-lg text-primary font-bold mb-3">Documentation</h1>
          <p className="text-body-lg text-on-surface-variant">
            Learn how to use, configure, and manage LockerSystem smart cabinets.
          </p>
        </header>

        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Sidebar Menu */}
          <aside className="w-full md:w-64 bg-surface-container-lowest border border-outline-variant/10 rounded-2xl p-3 flex flex-col gap-1.5 flex-shrink-0">
            {DOCS_SECTIONS.map((sec) => {
              const isSelected = activeTab === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveTab(sec.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-label-md font-semibold transition-all duration-200 text-left ${
                    isSelected
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-low'
                  }`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    {sec.icon}
                  </span>
                  {sec.title}
                </button>
              );
            })}
          </aside>

          {/* Docs Content */}
          <section className="flex-1 bg-surface-container-lowest border border-outline-variant/10 rounded-3xl p-8 md:p-10 shadow-card w-full max-w-full overflow-hidden">
            {DOCS_SECTIONS.map((sec) => {
              if (activeTab !== sec.id) return null;
              return (
                <article key={sec.id} className="space-y-6 text-body-md text-on-surface-variant leading-relaxed w-full max-w-full">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="material-symbols-outlined text-primary text-3xl">{sec.icon}</span>
                    <h2 className="text-headline-xl text-primary font-bold">{sec.title}</h2>
                  </div>
                  {sec.content}
                </article>
              );
            })}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
