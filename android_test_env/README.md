# Smart Egg Android 模拟测试环境

已配置：

- JDK 17：`~/Library/Java/JavaVirtualMachines/temurin-17.jdk`
- Android SDK：`~/Library/Android/sdk`
- Android 35 Google APIs ARM64 系统镜像
- 横屏模拟设备：`Smart_Egg_Phone`

启动模拟器：

```bash
./android_test_env/start-emulator.sh
```

安装 `dist` 中版本号最高的 APK 并启动：

```bash
./android_test_env/install-latest.sh
```

模拟器日志位于 `/tmp/smart-egg-emulator.log`。
