export const getCmakeLists = (projectName, boardType) => {
  const extraLibs = boardType === "pico_w" ? "pico_cyw43_arch_none" : "";

  return `cmake_minimum_required(VERSION 3.13)

include(pico_sdk_import.cmake)

project(${projectName} C CXX ASM)
set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 17)

pico_sdk_init()

add_executable(${projectName} src/main.cpp)

target_link_libraries(${projectName} 
    pico_stdlib
    ${extraLibs}
)

# Enable USB output, disable UART by default
pico_enable_stdio_usb(${projectName} 1)
pico_enable_stdio_uart(${projectName} 0)

pico_add_extra_outputs(${projectName})
`;
};

export const getMainCpp = (boardType) => {
  // Pico W uses a different mechanism for the onboard LED
  if (boardType === "pico_w") {
    return `#include "pico/stdlib.h"
#include "pico/cyw43_arch.h"

int main() {
    stdio_init_all();
    if (cyw43_arch_init()) {
        printf("WiFi init failed");
        return -1;
    }
    
    while (true) {
        cyw43_arch_gpio_put(CYW43_WL_GPIO_LED_PIN, 1);
        sleep_ms(250);
        cyw43_arch_gpio_put(CYW43_WL_GPIO_LED_PIN, 0);
        sleep_ms(250);
        printf("Blinking Pico W!\\n");
    }
}`;
  }

  // Standard Pico
  return `#include "pico/stdlib.h"
#include <stdio.h>

int main() {
    stdio_init_all();
    const uint LED_PIN = PICO_DEFAULT_LED_PIN;
    gpio_init(LED_PIN);
    gpio_set_dir(LED_PIN, GPIO_OUT);

    while (true) {
        gpio_put(LED_PIN, 1);
        sleep_ms(250);
        gpio_put(LED_PIN, 0);
        sleep_ms(250);
        printf("Blinking Standard Pico!\\n");
    }
}`;
};

export const getSdkImport = () => `
if (NOT DEFINED ENV{PICO_SDK_PATH})
    if (NOT DEFINED PICO_SDK_PATH)
        message(FATAL_ERROR "PICO_SDK_PATH is not defined.")
    endif()
else()
    set(PICO_SDK_PATH $ENV{PICO_SDK_PATH})
endif()
get_filename_component(PICO_SDK_PATH "\${PICO_SDK_PATH}" REALPATH)
include(\${PICO_SDK_PATH}/external/pico_sdk_import.cmake)
`;

// THE CRITICAL PART: VS Code IntelliSense Configuration
export const getVsCodeProperties = (useLocalSdk) => {
  // If local, we point to the submodule. If not, we assume the user has the ENV var set.
  const sdkPath = useLocalSdk
    ? "${workspaceFolder}/pico-sdk"
    : "${env:PICO_SDK_PATH}";

  return `{
    "configurations": [
        {
            "name": "Pico ARM",
            "includePath": [
                "${sdkPath}/src/common/pico_base/include",
                "${sdkPath}/src/common/pico_binary_info/include",
                "${sdkPath}/src/common/pico_sync/include",
                "${sdkPath}/src/common/pico_time/include",
                "${sdkPath}/src/common/pico_util/include",
                "${sdkPath}/src/rp2_common/**",
                "${sdkPath}/src/boards/include",
                "\${workspaceFolder}/**"
            ],
            "defines": [
                "PICO_BOARD=pico"
            ],
            "compilerPath": "arm-none-eabi-gcc",
            "cStandard": "c11",
            "cppStandard": "c++17",
            "intelliSenseMode": "gcc-arm"
        }
    ],
    "version": 4
}`;
};
export const getPackageJson = (projectName, board) => {
  return `{
  "name": "${projectName}",
  "version": "1.0.0",
  "scripts": {
    "configure": "cmake -S . -B build -DPICO_BOARD=${board}",
    "build": "cmake --build build -j4",
    "clean": "node scripts/clean.js",
    "flash": "node scripts/flash.js",
    "dev": "npm run build && npm run flash"
  },
  "description": "Pico project scaffolded by create-pico-app"
}`;
};

export const getFlashScript = (projectName) => {
  return `const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_NAME = '${projectName}';
const UF2_SOURCE = path.join(__dirname, '..', 'build', \`\${PROJECT_NAME}.uf2\`);

// Common mount points for the RPI-RP2 volume
const CANDIDATES = [
    '/Volumes/RPI-RP2',       // macOS
    '/media/$USER/RPI-RP2',   // Linux (generic)
    'D:', 'E:', 'F:', 'G:'    // Windows (brute force check)
];

function findPico() {
    for (const drive of CANDIDATES) {
        // Handle dynamic user in Linux path
        const resolvedPath = drive.replace('$USER', process.env.USER || 'pi');
        
        // Check if drive exists and appears to be a Pico (has INFO_UF2.TXT)
        if (fs.existsSync(resolvedPath)) {
            // Strict check: make sure it's actually a Pico bootloader
            if (fs.existsSync(path.join(resolvedPath, 'INFO_UF2.TXT'))) {
                return resolvedPath;
            }
        }
    }
    return null;
}

const destination = findPico();

if (!destination) {
    console.error('❌ Could not find a mounted Raspberry Pi Pico (RPI-RP2).');
    console.error('👉 Please hold BOOTSEL, plug in the Pico, and try again.');
    process.exit(1);
}

if (!fs.existsSync(UF2_SOURCE)) {
    console.error('❌ Build artifact not found at:', UF2_SOURCE);
    console.error('👉 Run "npm run build" first.');
    process.exit(1);
}

console.log(\`⚡ Flashing \${PROJECT_NAME} to \${destination}...\`);

try {
    fs.copyFileSync(UF2_SOURCE, path.join(destination, \`\${PROJECT_NAME}.uf2\`));
    console.log('✅ Flash complete! The Pico should reboot now.');
} catch (e) {
    console.error('❌ Flash failed:', e.message);
}
`;
};

export const getCleanScript = () => `const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '..', 'build');

if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true, force: true });
    console.log('🗑 Build directory cleaned.');
    // Recreate it empty so cmake doesn't complain later
    fs.mkdirSync(buildDir);
}
`;
