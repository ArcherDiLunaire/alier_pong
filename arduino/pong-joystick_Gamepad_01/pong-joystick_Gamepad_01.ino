#include <BleGamepad.h>

BleGamepad bleGamepad("XIAO Arcade", "DIY", 100);

int pinLeft = 4;
int pinRight = 5;

void setup() {
  pinMode(pinLeft, INPUT_PULLUP);
  pinMode(pinRight, INPUT_PULLUP);

  Serial.begin(115200);
  bleGamepad.begin();
}

void loop() {
  if (bleGamepad.isConnected()) {

    // UP
    if (digitalRead(pinLeft) == LOW) {
      bleGamepad.press(BUTTON_1); // temporary mapping
    } else {
      bleGamepad.release(BUTTON_1);
    }

    // DOWN
    if (digitalRead(pinRight) == LOW) {
      bleGamepad.press(BUTTON_2);
    } else {
      bleGamepad.release(BUTTON_2);
    }
  }

  delay(10);
}
