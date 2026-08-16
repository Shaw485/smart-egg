# Smart Egg Android 包装工程

这是网页版本的离线 Android WebView 包装，应用启动后加载 `assets/web_preview/index.html`。

构建前安装 Android SDK Platform 35、Build Tools 35.0.0 和 JDK 17，然后设置：

```bash
SMART_EGG_ANDROID_SDK=/path/to/sdk \
SMART_EGG_JAVA_HOME=/path/to/jdk \
./build-apk.sh
```

产物位于 `build/Smart-Egg-v142.apk`。构建目录和签名文件不提交到仓库。
