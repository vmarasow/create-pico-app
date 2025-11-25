export const getCmakeLists = (projectName, board, template) => {
  const isW = board === "pico_w";
  const isRTOS = template === "freertos";

  // --- BASIC TEMPLATE (Unchanged) ---
  if (!isRTOS) {
    const extraLibs = isW ? "pico_cyw43_arch_none" : "";
    return `cmake_minimum_required(VERSION 3.13)
include(pico_sdk_import.cmake)
project(${projectName} C CXX ASM)
set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 17)
pico_sdk_init()
add_executable(${projectName} src/main.cpp)
target_link_libraries(${projectName} pico_stdlib ${extraLibs})
pico_enable_stdio_usb(${projectName} 1)
pico_enable_stdio_uart(${projectName} 0)
pico_add_extra_outputs(${projectName})
`;
  }

  // --- FREERTOS TEMPLATE (Manual Source + Threadsafe Driver) ---
  // We use 'threadsafe_background' because the OS needs to manage the WiFi chip
  const wifiLib = isW ? "pico_cyw43_arch_threadsafe_background" : "";

  return `cmake_minimum_required(VERSION 3.13)
include(pico_sdk_import.cmake)
project(${projectName} C CXX ASM)
set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 17)

pico_sdk_init()

# --- SETUP FREERTOS PATHS ---
set(FREERTOS_KERNEL_PATH \${PICO_SDK_PATH}/lib/FreeRTOS-Kernel)
set(FREERTOS_RP2040_PORT_PATH \${FREERTOS_KERNEL_PATH}/portable/ThirdParty/GCC/RP2040)

# --- CREATE FREERTOS LIBRARY MANUALLY ---
add_library(FreeRTOS STATIC
    \${FREERTOS_KERNEL_PATH}/tasks.c
    \${FREERTOS_KERNEL_PATH}/list.c
    \${FREERTOS_KERNEL_PATH}/queue.c
    \${FREERTOS_KERNEL_PATH}/timers.c
    \${FREERTOS_KERNEL_PATH}/event_groups.c
    \${FREERTOS_KERNEL_PATH}/stream_buffer.c
    \${FREERTOS_KERNEL_PATH}/portable/MemMang/heap_4.c
    \${FREERTOS_RP2040_PORT_PATH}/port.c
)

target_include_directories(FreeRTOS PUBLIC
    src
    \${FREERTOS_KERNEL_PATH}/include
    \${FREERTOS_RP2040_PORT_PATH}/include
)

target_link_libraries(FreeRTOS PUBLIC
    pico_stdlib
    pico_multicore
    hardware_exception
    hardware_irq
    hardware_claim
)

# --- YOUR APP ---
add_executable(${projectName} src/main.cpp)

target_link_libraries(${projectName} 
    FreeRTOS
    pico_stdlib
    ${wifiLib}
)

pico_enable_stdio_usb(${projectName} 1)
pico_enable_stdio_uart(${projectName} 0)
pico_add_extra_outputs(${projectName})
`;
};

export const getMainCpp = (board, template) => {
  // --- FREERTOS MAIN ---
  if (template === "freertos") {
    return `#include "pico/stdlib.h"
#include "FreeRTOS.h"
#include "task.h"
#include <stdio.h>

// 1. Check if the WiFi Library was linked in CMake
#ifdef LIB_PICO_CYW43_ARCH
    #include "pico/cyw43_arch.h"
#endif

void vBlinkTask(void *pvParameters) {
    // 2. Setup Phase (Standard Pico Only)
    #ifndef LIB_PICO_CYW43_ARCH
    const uint LED_PIN = PICO_DEFAULT_LED_PIN;
    gpio_init(LED_PIN);
    gpio_set_dir(LED_PIN, GPIO_OUT);
    #endif

    while (true) {
        printf("Blink Task Running...\\n");

        #ifdef LIB_PICO_CYW43_ARCH
            // Option A: Pico W (WiFi Driver is present)
            cyw43_arch_gpio_put(CYW43_WL_GPIO_LED_PIN, 1);
            vTaskDelay(pdMS_TO_TICKS(500));
            cyw43_arch_gpio_put(CYW43_WL_GPIO_LED_PIN, 0);
        
        #else
            // Option B: Standard Pico
            gpio_put(LED_PIN, 1);
            vTaskDelay(pdMS_TO_TICKS(500));
            gpio_put(LED_PIN, 0);
        #endif

        vTaskDelay(pdMS_TO_TICKS(500));
    }
}

void vLogTask(void *pvParameters) {
    int count = 0;
    while (true) {
        printf("FreeRTOS Count: %d\\n", count++);
        vTaskDelay(pdMS_TO_TICKS(1000)); 
    }
}

int main() {
    stdio_init_all();

    // 4. Initialization (Pico W Only)
    #ifdef LIB_PICO_CYW43_ARCH
    if (cyw43_arch_init()) {
        printf("WiFi Init Failed!\\n");
        return -1;
    }
    #endif

    xTaskCreate(vBlinkTask, "Blink Task", 256, NULL, 1, NULL);
    xTaskCreate(vLogTask, "Log Task", 256, NULL, 1, NULL);

    vTaskStartScheduler();
    while(1){};
}`;
  }

  // --- BASIC BLINKY MAIN (Unchanged) ---
  const header =
    board === "pico_w" ? '#include "pico/cyw43_arch.h"' : "#include <stdio.h>";

  return `#include "pico/stdlib.h"
${header}

int main() {
    stdio_init_all();
    // ... (Your standard blinky template content) ...
    return 0;
}
`;
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
export const getGithubAction = (board) => {
  return `name: Build ${board}

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - name: Checkout Code
      uses: actions/checkout@v4
      with:
        submodules: true

    - name: Install Toolchain
      run: |
        sudo apt-get update
        sudo apt-get install -y cmake gcc-arm-none-eabi libnewlib-arm-none-eabi build-essential

    - name: Install Pico SDK
      run: |
        git clone https://github.com/raspberrypi/pico-sdk.git
        cd pico-sdk
        git submodule update --init

    - name: Configure CMake
      run: |
        export PICO_SDK_PATH=$GITHUB_WORKSPACE/pico-sdk
        cmake -S . -B build -DPICO_BOARD=${board}

    - name: Build
      run: cmake --build build
`;
};
export const getFreeRTOSConfig = () => {
  return `#ifndef FREERTOS_CONFIG_H
#define FREERTOS_CONFIG_H

#define configUSE_PREEMPTION                    1
#define configSMP_SPINLOCK_0                    0
#define configSMP_SPINLOCK_1                    1
#define configUSE_PORT_OPTIMISED_TASK_SELECTION 0
#define configUSE_TICKLESS_IDLE                 0
#define configCPU_CLOCK_HZ                      133000000
#define configTICK_RATE_HZ                      1000
#define configMAX_PRIORITIES                    5
#define configMINIMAL_STACK_SIZE                128
#define configMAX_TASK_NAME_LEN                 16
#define configUSE_16_BIT_TICKS                  0
#define configIDLE_SHOULD_YIELD                 1
#define configUSE_TASK_NOTIFICATIONS            1
#define configTASK_NOTIFICATION_ARRAY_ENTRIES   3
#define configUSE_MUTEXES                       1
#define configUSE_RECURSIVE_MUTEXES             1
#define configUSE_COUNTING_SEMAPHORES           1
#define configQUEUE_REGISTRY_SIZE               10
#define configUSE_QUEUE_SETS                    0
#define configUSE_TIME_SLICING                  1
#define configUSE_NEWLIB_REENTRANT              0
#define configENABLE_BACKWARD_COMPATIBILITY     0
#define configNUM_THREAD_LOCAL_STORAGE_POINTERS 5
#define configSTACK_DEPTH_TYPE                  uint32_t
#define configMESSAGE_BUFFER_LENGTH_TYPE        size_t
#define configSUPPORT_STATIC_ALLOCATION         0
#define configSUPPORT_DYNAMIC_ALLOCATION        1
#define configTOTAL_HEAP_SIZE                   (64*1024)
#define configAPPLICATION_ALLOCATED_HEAP        0
#define configUSE_IDLE_HOOK                     0
#define configUSE_TICK_HOOK                     0
#define configCHECK_FOR_STACK_OVERFLOW          0
#define configUSE_MALLOC_FAILED_HOOK            0
#define configUSE_DAEMON_TASK_STARTUP_HOOK      0
#define configUSE_PASSIVE_IDLE_HOOK             0

/* SMP settings */
#define configNUMBER_OF_CORES                   2
#define configTICK_CORE                         0
#define configRUN_MULTIPLE_PRIORITIES           1

/* Optional functions */
#define INCLUDE_vTaskPrioritySet                1
#define INCLUDE_uxTaskPriorityGet               1
#define INCLUDE_vTaskDelete                     1
#define INCLUDE_vTaskSuspend                    1
#define INCLUDE_vTaskDelayUntil                 1
#define INCLUDE_vTaskDelay                      1
#define INCLUDE_xTaskGetSchedulerState          1
#define INCLUDE_xTaskGetCurrentTaskHandle       1
#define INCLUDE_uxTaskGetStackHighWaterMark     1
#define INCLUDE_xTaskGetIdleTaskHandle          1
#define INCLUDE_eTaskGetState                   1
#define INCLUDE_xTimerPendFunctionCall          1
#define INCLUDE_xTaskAbortDelay                 1
#define INCLUDE_xTaskGetHandle                  1
#define INCLUDE_xTaskResumeFromISR              1

#define configENABLE_MPU                        0
#define configENABLE_FPU                        0
#define configENABLE_TRUSTZONE                  0

/* Map the assertion failure to the port interrupt disable */
#define configASSERT( x )   if( ( x ) == 0 ) { portDISABLE_INTERRUPTS(); for( ;; ); }

#endif /* FREERTOS_CONFIG_H */`;
};
