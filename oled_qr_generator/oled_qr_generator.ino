/*
 * Project: ESP32/ESP8266 OLED QR Code Generator
 * Description: Generates a 6-digit random OTP every 30 seconds, displays it as a 
 *              Version 1 (21x21) QR code scaled by 2 (42x42 pixels) on the LEFT half 
 *              of a 0.96" Yellow-Blue SSD1306 OLED screen, and displays the 6 digits 
 *              (3 digits on top, 3 on bottom) in large 24px font on the RIGHT half.
 *              The yellow zone displays "SMART LOCKER" with a sleek countdown progress bar.
 * Based on Richard Moore's highly-optimized local QRCode library.
 */

#include <Wire.h>
#include "SSD1306Wire.h"
#include "qrcode.h"

// Define I2C pins automatically for ESP32 or ESP8266
#if defined(ESP32)
  #define OLED_SDA 21
  #define OLED_SCL 22
#elif defined(ESP8266)
  #define OLED_SDA D2
  #define OLED_SCL D1
#else
  // Fallback defaults for other Arduino boards
  #define OLED_SDA SDA
  #define OLED_SCL SCL
#endif

// Initialize SSD1306 OLED display (Address: 0x3c)
SSD1306Wire display(0x3c, OLED_SDA, OLED_SCL);

// State variables
String currentOTP = "";
unsigned long lastChangeTime = 0;
const unsigned long INTERVAL = 30000; // 30 seconds refresh rate

// Allocate memory buffer for the Version 1 QR Code (21x21 modules requires 56 bytes)
QRCode qrcode;
uint8_t qrcodeBytes[64]; // 64 bytes is statically allocated and extremely safe for Version 1

// Generate a random 6-digit OTP and encode it into the QR code frame
void generateNewOTP() {
  // Generate a random 6-digit number (guaranteed between 100000 and 999999)
  long randNumber = random(100000, 1000000);
  currentOTP = String(randNumber);
  Serial.print("[OTP] New Code: ");
  Serial.println(currentOTP);

  // Encode the OTP string into the QR Code
  // Using Version 1 and Low Error Correction (ECC_LOW) for minimal modules & maximum dot size
  qrcode_initText(&qrcode, qrcodeBytes, 1, ECC_LOW, currentOTP.c_str());
  
  lastChangeTime = millis();
}

// Custom UI Draw Function optimized for 0.96" Yellow-Blue OLED displays
// Yellow Zone: y = 0 to 15 (SMART LOCKER title text & progress bar)
// Blue Zone: y = 16 to 63 (Divided into Left and Right halves by a vertical line at x = 63)
//  - Left Half: 42x42 QR Code inside a 46x46 white card quiet zone
//  - Right Half: Large OTP digits, 3 digits on top, 3 digits on bottom
void drawScreen(String otpCode, int progressWidth) {
  // Clear the screen buffer
  display.clear();

  // --- 1. DRAW YELLOW ZONE (y = 0 to 15) ---
  display.setColor(WHITE); // White on buffer = Yellow on the physical top of the OLED
  
  // Draw English text "SMART LOCKER" centered at y = 0
  display.setFont(ArialMT_Plain_10);
  display.setTextAlignment(TEXT_ALIGN_CENTER);
  display.drawString(64, 0, "SMART LOCKER");

  // Draw countdown progress bar under the text (y = 12 to 14, height = 3)
  display.fillRect(0, 12, progressWidth, 3);

  // --- 2. DRAW BLUE ZONE CONTENT (y = 16 to 63) ---
  
  // Draw a crisp vertical divider line between the Left and Right halves at x = 63
  display.drawVerticalLine(63, 16, 48);

  // --- LEFT HALF: QR Code ---
  // White card background (quiet zone) for Version 1 QR code (scaled by 2)
  // Card x: 9 to 54 (width 46), y: 17 to 62 (height 46).
  display.fillRect(9, 17, 46, 46);

  // Draw QR code black pixels inside the white card
  // Centered at offsetsX = 11, offsetsY = 19
  display.setColor(BLACK);
  for (uint8_t y = 0; y < qrcode.size; y++) {
    for (uint8_t x = 0; x < qrcode.size; x++) {
      if (qrcode_getModule(&qrcode, x, y)) {
        // Draw a solid 2x2 pixel square for each QR module
        display.fillRect(11 + (x * 2), 19 + (y * 2), 2, 2);
      }
    }
  }

  // --- RIGHT HALF: OTP Digits (3 on top, 3 on bottom) ---
  display.setColor(WHITE);
  display.setFont(ArialMT_Plain_24);
  display.setTextAlignment(TEXT_ALIGN_CENTER);

  // Split the 6-digit OTP into two parts of 3 digits each
  String topPart = otpCode.substring(0, 3);
  String bottomPart = otpCode.substring(3, 6);

  // Display the digits stacked vertically, perfectly centered in the right half (x = 95)
  // topPart occupies y = 14 to 37. bottomPart occupies y = 38 to 62.
  display.drawString(95, 14, topPart);
  display.drawString(95, 38, bottomPart);

  // Write RAM buffer to screen
  display.display();
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n--- ESP Yellow-Blue OLED QR OTP Dashboard (SMART LOCKER Layout) ---");

  // Seed the random number generator using analog input noise & time
  #if defined(ESP32)
    randomSeed(analogRead(36) + millis());
  #elif defined(ESP8266)
    randomSeed(analogRead(A0) + millis());
  #else
    randomSeed(analogRead(0) + millis());
  #endif

  // Initialize the OLED display
  display.init();
  display.flipScreenVertically();
  display.clear();
  display.display();

  // Generate and draw the initial OTP screen
  generateNewOTP();
  drawScreen(currentOTP, 128);
}

void loop() {
  unsigned long elapsed = millis() - lastChangeTime;

  if (elapsed >= INTERVAL) {
    // 30 seconds have passed! Generate a new OTP and reset timer
    generateNewOTP();
  } else {
    // Calculate remaining progress bar width (shrinks from 128 to 0)
    int progressWidth = map(INTERVAL - elapsed, 0, INTERVAL, 0, 128);
    
    // Draw the UI
    drawScreen(currentOTP, progressWidth);
  }

  // Smooth refresh rate: 10 FPS (100ms update interval) is perfect for a 30s progress bar
  delay(100);
}
